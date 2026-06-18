import { PrismaClient } from '@prisma/client'

/**
 * Matrice des permissions par défaut.
 * 13 modules × 2 actions (view, manage) = 26 permissions.
 * Idempotent : upsert par (resource, action), preserve les rôles custom.
 *
 * Pour ajouter un module : ajoute-le ici, redéploie. Pour donner
 * automatiquement l'accès à un rôle existant : ajoute le module dans
 * ROLE_DEFAULTS ci-dessous.
 */

export const RESOURCES = [
  { key: 'orders', label: 'Commandes' },
  { key: 'menu', label: 'Menu & modificateurs' },
  { key: 'inventory', label: 'Stock & entrepôts' },
  { key: 'customers', label: 'Clients & dettes' },
  { key: 'tables', label: 'Tables & réservations' },
  { key: 'employees', label: 'Équipe & planning' },
  { key: 'caisse', label: 'Caisse & banque' },
  { key: 'finances', label: 'Finances & factures' },
  { key: 'analytics', label: 'Analytics & rapports' },
  { key: 'marketing', label: 'Promotions & campagnes' },
  { key: 'terminaux', label: 'Terminaux & imprimantes' },
  { key: 'reviews', label: 'Avis clients' },
  { key: 'settings', label: 'Paramètres & audit' },
] as const

export const ACTIONS = ['view', 'manage'] as const

export type ResourceKey = (typeof RESOURCES)[number]['key']
export type ActionKey = (typeof ACTIONS)[number]

/**
 * Permissions attribuées par défaut à chaque rôle système au SEED INITIAL.
 * Si un rôle existe déjà avec des permissions configurées, on ne touche PAS
 * (sauf ajout de nouvelles permissions absentes pour les rôles non manager-).
 * Tableau de "<resource>:<action>" — "*" = tout.
 */
const ROLE_DEFAULTS: Record<string, string[]> = {
  superadmin: ['*'],
  manager: [
    'orders:view', 'orders:manage',
    'menu:view', 'menu:manage',
    'inventory:view', 'inventory:manage',
    'customers:view', 'customers:manage',
    'tables:view', 'tables:manage',
    'employees:view', 'employees:manage',
    'caisse:view', 'caisse:manage',
    'finances:view', 'finances:manage',
    'analytics:view',
    'marketing:view', 'marketing:manage',
    'terminaux:view', 'terminaux:manage',
    'reviews:view', 'reviews:manage',
    'settings:view',
  ],
  caissier: [
    'orders:view', 'orders:manage',
    'menu:view',
    'customers:view', 'customers:manage',
    'tables:view', 'tables:manage',
    'caisse:view', 'caisse:manage',
    'reviews:view',
  ],
  serveur: [
    'orders:view', 'orders:manage',
    'menu:view',
    'tables:view', 'tables:manage',
    'customers:view',
    'reviews:view',
  ],
  cuisinier: [
    'orders:view',
    'menu:view',
    'inventory:view',
  ],
  client: [],
}

function expandToKeys(keys: string[]): string[] {
  if (keys.includes('*')) {
    return RESOURCES.flatMap(r => ACTIONS.map(a => `${r.key}:${a}`))
  }
  return keys
}

export async function ensurePermissionsAndDefaults(prisma: PrismaClient): Promise<void> {
  // 1. Upsert toutes les permissions (resource, action)
  for (const r of RESOURCES) {
    for (const a of ACTIONS) {
      await prisma.permission.upsert({
        where: { resource_action: { resource: r.key, action: a } },
        update: { description: `${a === 'view' ? 'Voir' : 'Gérer'} ${r.label.toLowerCase()}` },
        create: {
          resource: r.key,
          action: a,
          description: `${a === 'view' ? 'Voir' : 'Gérer'} ${r.label.toLowerCase()}`,
        },
      })
    }
  }

  // 2. Pour chaque rôle système, attache ses permissions par défaut SI le rôle
  //    n'a aucune permission attachée (premier seed). Sinon on respecte ce que
  //    l'admin a configuré.
  for (const [roleName, keys] of Object.entries(ROLE_DEFAULTS)) {
    const role = await prisma.role.findUnique({
      where: { name: roleName },
      include: { permissions: true },
    })
    if (!role) continue
    if (role.permissions.length > 0) continue

    const expanded = expandToKeys(keys)
    for (const key of expanded) {
      const parts = key.split(':')
      const resource = parts[0]
      const action = parts[1]
      if (!resource || !action) continue
      const perm = await prisma.permission.findUnique({
        where: { resource_action: { resource, action } },
      })
      if (!perm) continue
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      })
    }
  }
}

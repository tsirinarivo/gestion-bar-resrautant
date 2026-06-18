import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { RESOURCES, ACTIONS } from '../lib/permissions-seed'

export const roleRouter = Router()
roleRouter.use(authenticate)

// Liste des resources/actions dispo (pour construire la matrice côté UI)
roleRouter.get('/catalog', authorize('manager', 'superadmin'), (_req, res) => {
  res.json({
    success: true,
    data: { resources: RESOURCES, actions: ACTIONS },
  })
})

// GET /api/roles → tous les rôles avec permissions
roleRouter.get('/', authorize('manager', 'superadmin'), async (_req, res, next) => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    })
    const flat = (roles as Array<{
      id: string
      name: string
      displayName: string
      description: string | null
      isSystem: boolean
      _count: { users: number }
      permissions: Array<{ permission: { resource: string; action: string } }>
    }>).map(r => ({
      id: r.id,
      name: r.name,
      displayName: r.displayName,
      description: r.description,
      isSystem: r.isSystem,
      usersCount: r._count.users,
      permissions: r.permissions.map(rp => `${rp.permission.resource}:${rp.permission.action}`),
    }))
    res.json({ success: true, data: flat })
  } catch (error) {
    next(error)
  }
})

// POST /api/roles → créer un rôle custom (non-system)
const createSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_-]{1,30}$/, 'Format: minuscules, chiffres, tirets'),
  displayName: z.string().min(2).max(60),
  description: z.string().max(200).optional(),
  permissions: z.array(z.string()).default([]),
})
roleRouter.post('/', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const parsed = createSchema.parse(req.body)
    const existing = await prisma.role.findUnique({ where: { name: parsed.name } })
    if (existing) return res.status(409).json({ success: false, error: 'Ce nom est déjà pris' })

    const role = await prisma.role.create({
      data: {
        name: parsed.name,
        displayName: parsed.displayName,
        description: parsed.description,
        isSystem: false,
      },
    })
    await syncPermissions(role.id, parsed.permissions)
    res.status(201).json({ success: true, data: { id: role.id } })
  } catch (error) {
    next(error)
  }
})

// PUT /api/roles/:id/permissions → remplace toutes les permissions du rôle
const updatePermsSchema = z.object({
  permissions: z.array(z.string()),
})
roleRouter.put('/:id/permissions', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params
    const parsed = updatePermsSchema.parse(req.body)
    const role = await prisma.role.findUnique({ where: { id } })
    if (!role) return res.status(404).json({ success: false, error: 'Rôle introuvable' })

    // Le superadmin garde toutes les permissions (sécurité : on ne se locke pas dehors)
    if (role.name === 'superadmin') {
      return res.status(400).json({ success: false, error: 'Le rôle superadmin ne peut pas être restreint' })
    }
    await syncPermissions(id, parsed.permissions)
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/roles/:id → renommer un rôle custom
const patchSchema = z.object({
  displayName: z.string().min(2).max(60).optional(),
  description: z.string().max(200).optional(),
})
roleRouter.patch('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const role = await prisma.role.findUnique({ where: { id: req.params.id } })
    if (!role) return res.status(404).json({ success: false, error: 'Rôle introuvable' })
    if (role.isSystem) {
      return res.status(400).json({ success: false, error: 'Un rôle système ne peut pas être renommé' })
    }
    const parsed = patchSchema.parse(req.body)
    const updated = await prisma.role.update({ where: { id: role.id }, data: parsed })
    res.json({ success: true, data: updated })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/roles/:id → supprimer un rôle custom (impossible pour system)
roleRouter.delete('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const role = await prisma.role.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { users: true } } },
    })
    if (!role) return res.status(404).json({ success: false, error: 'Rôle introuvable' })
    if (role.isSystem) {
      return res.status(400).json({ success: false, error: 'Un rôle système ne peut pas être supprimé' })
    }
    if (role._count.users > 0) {
      return res.status(400).json({
        success: false,
        error: `${role._count.users} utilisateur(s) utilisent ce rôle. Reassignez-les d'abord.`,
      })
    }
    await prisma.role.delete({ where: { id: role.id } })
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

async function syncPermissions(roleId: string, keys: string[]): Promise<void> {
  const wanted = new Set<string>(keys)
  const allPerms = (await prisma.permission.findMany()) as Array<{
    id: string
    resource: string
    action: string
  }>
  const permByKey = new Map<string, string>(
    allPerms.map(p => [`${p.resource}:${p.action}`, p.id]),
  )

  const current = (await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: true },
  })) as Array<{ permission: { resource: string; action: string } }>
  const currentKeys = new Set<string>(
    current.map(rp => `${rp.permission.resource}:${rp.permission.action}`),
  )

  const toAdd: string[] = []
  for (const key of wanted) {
    if (!currentKeys.has(key) && permByKey.has(key)) toAdd.push(key)
  }
  const toRemove: string[] = []
  for (const key of currentKeys) {
    if (!wanted.has(key)) toRemove.push(key)
  }

  if (toRemove.length > 0) {
    await prisma.rolePermission.deleteMany({
      where: {
        roleId,
        permission: {
          OR: toRemove.map(k => {
            const parts = k.split(':')
            return { resource: parts[0]!, action: parts[1]! }
          }),
        },
      },
    })
  }
  if (toAdd.length > 0) {
    await prisma.rolePermission.createMany({
      data: toAdd.map(k => ({ roleId, permissionId: permByKey.get(k)! })),
      skipDuplicates: true,
    })
  }
}

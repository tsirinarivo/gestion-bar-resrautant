import { useAuthStore } from '@/store/auth'

type PermissionRow = {
  permission?: { resource?: string; action?: string } | null
}

export type PermissionKey = `${string}:${'view' | 'manage'}`

/**
 * Vérifie si l'utilisateur courant a la permission demandée.
 * Format : "<resource>:<action>" (ex: "orders:manage", "stock:view").
 * Le rôle 'superadmin' a toujours toutes les permissions (court-circuit).
 */
export function useHasPermission(): (key: PermissionKey) => boolean {
  const user = useAuthStore(s => s.user)
  return (key: PermissionKey) => {
    if (!user) return false
    const roleName = (user as { role?: { name?: string } | null }).role?.name
    if (roleName === 'superadmin') return true
    const perms = ((user as { role?: { permissions?: PermissionRow[] } | null }).role?.permissions ??
      []) as PermissionRow[]
    for (const rp of perms) {
      const r = rp.permission?.resource
      const a = rp.permission?.action
      if (r && a && `${r}:${a}` === key) return true
    }
    return false
  }
}

/**
 * Hook pour gater du JSX en une ligne :
 *   const can = usePermission()
 *   {can('orders:manage') && <button>Créer</button>}
 */
export function usePermission(): (key: PermissionKey) => boolean {
  return useHasPermission()
}

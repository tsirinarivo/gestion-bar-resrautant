'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

// Pages accessible par rôle (undefined = accès complet)
const ROLE_HOME: Record<string, string> = {
  cuisinier: '/kds',
  caissier: '/pos',
  serveur: '/orders',
}

const ROLE_ALLOWED: Record<string, string[]> = {
  cuisinier: ['/kds', '/orders', '/tables', '/dashboard'],
  caissier: ['/pos', '/orders', '/tables', '/customers', '/dashboard'],
  serveur: ['/orders', '/tables', '/reservations', '/dashboard'],
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) { router.push('/login'); return }
    const role = user?.role?.name ?? ''
    const allowed = ROLE_ALLOWED[role]
    if (allowed) {
      const ok = allowed.some(p => pathname === p || pathname.startsWith(p + '/'))
      if (!ok) router.push(ROLE_HOME[role] ?? '/dashboard')
    }
  }, [isAuthenticated, pathname, router, user])

  if (!isAuthenticated) return null

  return (
    <div className="flex h-screen bg-brand-dark overflow-hidden">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onMenuToggle={() => setMobileOpen(o => !o)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

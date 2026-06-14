'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  LogOut,
  Settings,
  Receipt,
  RefreshCw,
  Package,
  Menu,
  X,
  Search,
  ChevronsLeft,
  Bell,
} from 'lucide-react'

type SessionInfo = { email: string; role: string }

const NAV: ReadonlyArray<{
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  exact?: boolean
}> = [
  { href: '/dashboard', icon: LayoutDashboard, label: "Vue d'ensemble", exact: true },
  { href: '/dashboard/tenants', icon: Users, label: 'Clients' },
  { href: '/dashboard/updates', icon: RefreshCw, label: 'Déploiements' },
  { href: '/dashboard/plans', icon: Package, label: 'Plans' },
  { href: '/dashboard/billing', icon: Receipt, label: 'Facturation' },
  { href: '/dashboard/settings', icon: Settings, label: 'Paramètres' },
]

export function Shell({
  session,
  children,
}: {
  session: SessionInfo
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Persiste la préférence collapsed
  useEffect(() => {
    const saved = localStorage.getItem('master-sidebar-collapsed')
    if (saved === '1') setCollapsed(true)
  }, [])
  useEffect(() => {
    localStorage.setItem('master-sidebar-collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  // Ferme le drawer quand on navigue
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  const current = NAV.find(n => (n.exact ? pathname === n.href : pathname.startsWith(n.href)))
  const pageTitle = current?.label ?? 'Master Console'

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <DesktopSidebar
        session={session}
        pathname={pathname}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(v => !v)}
      />

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <MobileDrawer
            session={session}
            pathname={pathname}
            onClose={() => setDrawerOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar pageTitle={pageTitle} session={session} onOpenDrawer={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-x-auto">{children}</main>
      </div>
    </div>
  )
}

// ─── Desktop sidebar ──────────────────────────────────────────────────────────
function DesktopSidebar({
  session,
  pathname,
  collapsed,
  onToggleCollapse,
}: {
  session: SessionInfo
  pathname: string
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  return (
    <aside
      className={`hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-300 lg:flex ${
        collapsed ? 'w-[76px]' : 'w-64'
      }`}
    >
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
        <div className="relative flex-shrink-0">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 opacity-30 blur-md" />
          <img src="/logo.svg" alt="Sakafio" className="relative h-9 w-9" />
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <div className="font-display text-sm font-extrabold text-slate-900">Sakafio</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">
              Master
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.map(item => (
          <SideLink
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            active={item.exact ? pathname === item.href : pathname.startsWith(item.href)}
            collapsed={collapsed}
          />
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <button
          onClick={onToggleCollapse}
          className="flex w-full items-center justify-center gap-2 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label={collapsed ? 'Étendre' : 'Réduire'}
        >
          <ChevronsLeft className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          {!collapsed && <span className="text-xs font-medium">Réduire</span>}
        </button>
      </div>

      <div className="border-t border-slate-200 p-3">
        <UserCard session={session} collapsed={collapsed} />
      </div>
    </aside>
  )
}

// ─── Mobile drawer ────────────────────────────────────────────────────────────
function MobileDrawer({
  session,
  pathname,
  onClose,
}: {
  session: SessionInfo
  pathname: string
  onClose: () => void
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
      />
      <motion.aside
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85%] flex-col border-r border-slate-200 bg-white lg:hidden"
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="Sakafio" className="h-9 w-9" />
            <div className="leading-tight">
              <div className="font-display text-sm font-extrabold text-slate-900">Sakafio</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">
                Master
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map(item => (
            <SideLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={item.exact ? pathname === item.href : pathname.startsWith(item.href)}
              collapsed={false}
            />
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <UserCard session={session} collapsed={false} />
        </div>
      </motion.aside>
    </>
  )
}

// ─── Topbar ───────────────────────────────────────────────────────────────────
function Topbar({
  pageTitle,
  session,
  onOpenDrawer,
}: {
  pageTitle: string
  session: SessionInfo
  onOpenDrawer: () => void
}) {
  const initials = session.email.slice(0, 2).toUpperCase()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur-xl lg:px-8">
      <button
        onClick={onOpenDrawer}
        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        aria-label="Menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-base font-bold text-slate-900 sm:text-lg">
          {pageTitle}
        </h1>
      </div>

      <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-white sm:flex">
        <Search className="h-4 w-4" />
        <span>Rechercher…</span>
        <span className="ml-3 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500">
          ⌘K
        </span>
      </div>

      <button
        className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
      </button>

      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white shadow-sm">
        {initials}
      </div>
    </header>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SideLink({
  href,
  icon: Icon,
  label,
  active,
  collapsed,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  active: boolean
  collapsed: boolean
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-brand-50 text-brand-700'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      } ${collapsed ? 'justify-center' : ''}`}
    >
      {active && (
        <motion.span
          layoutId="active-pill"
          className="absolute inset-y-1 left-0 w-1 rounded-full bg-gradient-to-b from-brand-500 to-brand-700"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
      <Icon className={`h-[18px] w-[18px] flex-shrink-0 ${active ? 'text-brand-600' : ''}`} />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )
}

function UserCard({ session, collapsed }: { session: SessionInfo; collapsed: boolean }) {
  const initials = session.email.slice(0, 2).toUpperCase()
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white shadow-sm">
          {initials}
        </div>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
            title="Déconnexion"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white shadow-sm">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900">{session.email}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">
            {session.role}
          </div>
        </div>
      </div>
      <form action="/api/auth/logout" method="post">
        <button
          type="submit"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-3.5 w-3.5" />
          Déconnexion
        </button>
      </form>
    </div>
  )
}

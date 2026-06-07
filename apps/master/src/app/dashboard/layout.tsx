import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Users, LogOut, Settings, Receipt, RefreshCw } from 'lucide-react'
import { readSession } from '@/lib/auth'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = readSession()
  if (!session) redirect('/login')

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <div className="border-b border-slate-200 px-5 py-4 flex items-center gap-3">
          <img src="/logo.svg" alt="Sakafio" className="h-11 w-11 flex-shrink-0" />
          <div className="leading-tight">
            <div className="text-sm font-bold text-slate-900">Sakafio</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Master Console</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          <SideLink href="/dashboard" icon={LayoutDashboard} label="Vue d'ensemble" />
          <SideLink href="/dashboard/tenants" icon={Users} label="Clients" />
          <SideLink href="/dashboard/updates" icon={RefreshCw} label="Déploiements" />
          <SideLink href="/dashboard/billing" icon={Receipt} label="Facturation" disabled />
          <SideLink href="/dashboard/settings" icon={Settings} label="Paramètres" />
        </nav>
        <form action="/api/auth/logout" method="post" className="border-t border-slate-200 p-3">
          <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </form>
        <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
          {session.email}
          <div className="text-[10px] uppercase tracking-wider text-brand-600">
            {session.role}
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-x-auto">{children}</main>
    </div>
  )
}

function SideLink({
  href,
  icon: Icon,
  label,
  disabled,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  disabled?: boolean
}) {
  if (disabled) {
    return (
      <span className="flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300">
        <Icon className="h-4 w-4" />
        {label}
        <span className="ml-auto text-[10px] uppercase">Sprint 2</span>
      </span>
    )
  }
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  )
}

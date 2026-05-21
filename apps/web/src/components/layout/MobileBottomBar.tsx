'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ShoppingCart, Table2, ChefHat, Menu } from 'lucide-react'
import { useAuthStore } from '@/store/auth'

type NavItem = {
  href: string
  label: string
  icon: any
  roles?: string[]
}

const ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Accueil',  icon: LayoutDashboard },
  { href: '/orders',    label: 'Cmdes',    icon: ShoppingCart },
  { href: '/tables',    label: 'Salle',    icon: Table2 },
  { href: '/kds',       label: 'Cuisine',  icon: ChefHat, roles: ['cuisinier', 'manager', 'superadmin'] },
]

interface MobileBottomBarProps {
  onMenuToggle: () => void
}

export function MobileBottomBar({ onMenuToggle }: MobileBottomBarProps) {
  const pathname = usePathname()
  const { user } = useAuthStore()
  const role = user?.role?.name ?? ''

  const visible = ITEMS.filter(i => !i.roles || i.roles.includes(role))

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-brand-card/95 backdrop-blur-md border-t border-brand-border safe-area-pb">
      <div className="grid grid-cols-5 h-14">
        {visible.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'text-brand-orange' : 'text-brand-muted'
              }`}>
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
        <button onClick={onMenuToggle}
          className="flex flex-col items-center justify-center gap-0.5 text-brand-muted hover:text-white transition-colors">
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">Menu</span>
        </button>
      </div>
    </nav>
  )
}

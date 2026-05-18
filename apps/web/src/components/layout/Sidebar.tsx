'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, UtensilsCrossed, ShoppingCart, Table2,
  Package, Users, Calendar, BarChart3, Settings, ChefHat,
  Monitor, LogOut, ChevronLeft, ChevronRight,
  CreditCard, Tag, UserCog, X, Truck, TrendingUp, Printer,
  Warehouse, Landmark, Building2, FileText, AlertCircle, Clock, Shield,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { initials } from '@restaurant/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard',         icon: LayoutDashboard },
  { href: '/orders',    label: 'Commandes',          icon: ShoppingCart },
  { href: '/menu',      label: 'Menu',               icon: UtensilsCrossed,  roles: ['manager', 'superadmin'] },
  { href: '/tables',    label: 'Plan de salle',      icon: Table2 },
  { href: '/waiting',   label: 'Liste d\'attente',   icon: Clock,            roles: ['manager', 'superadmin', 'serveur'] },
  { href: '/reservations', label: 'Réservations',   icon: Calendar,         roles: ['manager', 'superadmin', 'serveur'] },
  { href: '/kds',       label: 'Cuisine (KDS)',      icon: Monitor,          roles: ['cuisinier', 'manager', 'superadmin'] },
  { href: '/stock',     label: 'Stock',              icon: Package,          roles: ['manager', 'superadmin'] },
  { href: '/warehouses',label: 'Entrepôts',          icon: Warehouse,        roles: ['manager', 'superadmin'] },
  { href: '/suppliers', label: 'Fournisseurs',       icon: Truck,            roles: ['manager', 'superadmin'] },
  { href: '/customers', label: 'Clients',            icon: Users,            roles: ['manager', 'superadmin', 'caissier'] },
  { href: '/dettes',    label: 'Dettes clients',     icon: AlertCircle,      roles: ['manager', 'superadmin', 'caissier'] },
  { href: '/employees', label: 'Employés',           icon: UserCog,          roles: ['manager', 'superadmin'] },
  { href: '/coupons',   label: 'Promotions',         icon: Tag,              roles: ['manager', 'superadmin'] },
  { href: '/caisse',    label: 'Caisse',             icon: Landmark,         roles: ['manager', 'superadmin', 'caissier'] },
  { href: '/terminaux', label: 'Terminaux POS',      icon: Monitor,          roles: ['manager', 'superadmin'] },
  { href: '/bank',      label: 'Banque',             icon: Building2,        roles: ['manager', 'superadmin'] },
  { href: '/finances',  label: 'Finances',           icon: TrendingUp,       roles: ['manager', 'superadmin'] },
  { href: '/rapport',   label: 'Rapport journalier', icon: FileText,         roles: ['manager', 'superadmin'] },
  { href: '/analytics', label: 'Analytics',          icon: BarChart3,        roles: ['manager', 'superadmin'] },
  { href: '/settings/printer', label: 'Imprimante', icon: Printer,          roles: ['manager', 'superadmin'] },
  { href: '/settings',  label: 'Paramètres',         icon: Settings,         roles: ['manager', 'superadmin'] },
  { href: '/audit',     label: 'Journal d\'audit',   icon: Shield,           roles: ['manager', 'superadmin'] },
]

const POS_URL = process.env.NEXT_PUBLIC_POS_URL || 'https://pos.restaurant.dago-it.com'

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const { user, logout, accessToken } = useAuthStore()
  const router = useRouter()

  async function handleLogout() {
    try { await api.post('/auth/logout') } catch {}
    logout()
    router.push('/login')
    toast.success('Déconnexion réussie')
  }

  const userRole = (user as any)?.role?.name || 'caissier'
  const filteredItems = navItems.filter(item =>
    !item.roles || item.roles.includes(userRole)
  )

  // Lire token + terminal au clic pour éviter les problèmes d'hydration Zustand
  function handlePosClick(e: React.MouseEvent<HTMLAnchorElement>) {
    const token = localStorage.getItem('accessToken')
    const terminalId = localStorage.getItem('pos_terminal_id')
    if (token) {
      const params = new URLSearchParams({ token })
      if (terminalId) params.set('terminal', terminalId)
      e.currentTarget.href = `${POS_URL}/?${params.toString()}`
    }
    onClose()
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-brand-border">
        <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #FF4D00 0%, #FF6B00 100%)' }}>
          <ChefHat className="w-4 h-4 text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
              className="font-bold text-sm"
            >
              Restaurant<span className="text-brand-orange">OS</span>
            </motion.span>
          )}
        </AnimatePresence>
        <button onClick={onClose} className="md:hidden ml-auto text-brand-muted hover:text-white p-1">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Bouton POS — ouvre pos.restaurant.dago-it.com avec auth auto */}
      <div className="px-2 py-2 border-b border-brand-border">
        <a
          href={POS_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handlePosClick}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-brand-orange/10 border border-brand-orange/40 hover:bg-brand-orange/20 transition-colors text-brand-orange font-semibold text-sm w-full"
        >
          <CreditCard className="w-5 h-5 flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1">
                Ouvrir le POS
              </motion.span>
            )}
          </AnimatePresence>
          {!collapsed && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-brand-orange text-white">↗</span>
          )}
        </a>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {filteredItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} onClick={onClose}>
              <motion.div
                whileHover={{ x: collapsed ? 0 : 4 }}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-brand-orange' : ''}`} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-sm font-medium"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-2 border-t border-brand-border">
        <div className={`flex items-center gap-3 px-3 py-2 rounded-xl ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
            style={{ background: 'linear-gradient(135deg, #FF4D00 0%, #FFB800 100%)' }}>
            {user ? initials(user.firstName, user.lastName) : '??'}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-brand-muted capitalize">{userRole}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {!collapsed && (
              <motion.button
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={handleLogout}
                className="text-brand-muted hover:text-red-400 transition-colors p-1"
              >
                <LogOut className="w-4 h-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Collapse toggle — desktop only */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden md:flex absolute top-1/2 -right-3 w-6 h-6 rounded-full bg-brand-border border border-brand-card items-center justify-center text-brand-muted hover:text-white transition-colors z-20"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 240 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="hidden md:flex h-full bg-brand-card border-r border-brand-border flex-col relative z-10 overflow-hidden"
      >
        {sidebarContent}
      </motion.aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="md:hidden fixed left-0 top-0 h-full w-[280px] bg-brand-card border-r border-brand-border flex flex-col z-30 overflow-hidden"
          >
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}

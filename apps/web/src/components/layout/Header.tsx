'use client'

import { useState, useEffect } from 'react'
import { Bell, Search, Menu, Sun, Moon, Wifi, WifiOff } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { formatDate } from '@restaurant/utils'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/orders': 'Commandes',
  '/menu': 'Gestion du Menu',
  '/tables': 'Plan de Salle',
  '/reservations': 'Réservations',
  '/pos': 'Point de Vente',
  '/kds': 'Affichage Cuisine',
  '/stock': 'Gestion des Stocks',
  '/customers': 'Clients',
  '/employees': 'Ressources Humaines',
  '/analytics': 'Analytics',
  '/settings': 'Paramètres',
  '/coupons': 'Promotions & Coupons',
}

interface HeaderProps {
  onMenuToggle: () => void
}

export function Header({ onMenuToggle }: HeaderProps) {
  const pathname = usePathname()
  const { user } = useAuthStore()
  const [notifications] = useState(3)
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const title = Object.entries(pageTitles).find(([path]) => pathname.startsWith(path))?.[1] || 'Dashboard'

  return (
    <header className="h-16 bg-brand-card/50 border-b border-brand-border flex items-center justify-between px-4 md:px-6 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 hover:bg-white/5 rounded-xl transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-semibold text-lg leading-tight">{title}</h1>
          <p className="text-xs text-brand-muted hidden sm:block">
            {formatDate(time, 'EEEE d MMMM yyyy')} — {time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-brand-muted" />
          <input
            type="search"
            placeholder="Rechercher..."
            className="pl-9 pr-4 py-2 text-sm bg-brand-darker border border-brand-border rounded-xl w-64 focus:outline-none focus:border-brand-orange/50 transition-all"
          />
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-1.5 text-xs text-green-400">
          <Wifi className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">En ligne</span>
        </div>

        {/* Notifications */}
        <button className="relative p-2 hover:bg-white/5 rounded-xl transition-colors">
          <Bell className="w-5 h-5 text-brand-muted" />
          {notifications > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-brand-orange rounded-full text-xs flex items-center justify-center font-bold">
              {notifications}
            </span>
          )}
        </button>

        {/* User avatar */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #FF4D00 0%, #FFB800 100%)' }}>
          {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
        </div>
      </div>
    </header>
  )
}

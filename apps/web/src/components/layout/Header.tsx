'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, Search, Menu, Wifi } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { formatDate, formatRelative } from '@restaurant/utils'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/orders': 'Commandes',
  '/menu': 'Gestion du Menu',
  '/tables': 'Plan de Salle',
  '/reservations': 'Réservations',
  '/waiting': 'Liste d\'attente',
  '/pos': 'Point de Vente',
  '/kds': 'Affichage Cuisine',
  '/stock': 'Gestion des Stocks',
  '/customers': 'Clients',
  '/employees': 'Ressources Humaines',
  '/analytics': 'Analytics',
  '/settings': 'Paramètres',
  '/coupons': 'Promotions & Coupons',
  '/dettes': 'Dettes clients',
  '/audit': 'Journal d\'audit',
}

type Notification = {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

interface HeaderProps {
  onMenuToggle: () => void
}

const TYPE_ICON: Record<string, string> = {
  ORDER: '🛒',
  STOCK: '📦',
  RESERVATION: '📅',
  EMPLOYEE: '👤',
  SYSTEM: '⚙️',
}

export function Header({ onMenuToggle }: HeaderProps) {
  const pathname = usePathname()
  const { user } = useAuthStore()
  const [time, setTime] = useState(new Date())
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { data } = useQuery<{ data: Notification[]; unreadCount: number }>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data),
    refetchInterval: 30_000,
  })

  const notifications = data?.data ?? []
  const unreadCount = data?.unreadCount ?? 0

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllRead = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

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
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen(o => !o)}
            className="relative p-2 hover:bg-white/5 rounded-xl transition-colors"
          >
            <Bell className="w-5 h-5 text-brand-muted" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-brand-orange rounded-full text-xs flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-80 bg-brand-card border border-brand-border rounded-2xl shadow-2xl z-50 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border">
                  <p className="font-semibold text-sm">Notifications {unreadCount > 0 && <span className="text-brand-orange">({unreadCount})</span>}</p>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllRead.mutate()}
                      className="text-xs text-brand-muted hover:text-brand-orange transition-colors"
                    >
                      Tout lire
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-brand-border">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-brand-muted">
                      <Bell className="w-6 h-6 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Aucune notification</p>
                    </div>
                  ) : notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => { if (!n.isRead) markRead.mutate(n.id) }}
                      className={`px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors ${!n.isRead ? 'bg-brand-orange/5' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-lg flex-shrink-0">{TYPE_ICON[n.type] ?? '🔔'}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium leading-tight ${!n.isRead ? 'text-white' : 'text-brand-muted'}`}>{n.title}</p>
                          <p className="text-xs text-brand-muted mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-xs text-brand-muted/60 mt-1">{formatRelative(new Date(n.createdAt))}</p>
                        </div>
                        {!n.isRead && <div className="w-2 h-2 bg-brand-orange rounded-full flex-shrink-0 mt-1" />}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User avatar */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #FF4D00 0%, #FFB800 100%)' }}>
          {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
        </div>
      </div>
    </header>
  )
}

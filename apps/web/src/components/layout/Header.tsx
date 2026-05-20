'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, Search, Menu, Wifi } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePathname, useRouter } from 'next/navigation'

const NOTIF_TYPE_TO_PATH: Record<string, string> = {
  ORDER: '/orders',
  STOCK: '/stock',
  RESERVATION: '/reservations',
  EMPLOYEE: '/employees',
  WAITING: '/waiting',
  REVIEW: '/reviews',
}
import { useAuthStore } from '@/store/auth'
import { formatDate, formatRelative } from '@restaurant/utils'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { io as socketIO } from 'socket.io-client'

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
  WAITING: '⏳',
  REVIEW: '⭐',
  SYSTEM: '⚙️',
}

function GlobalSearch() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: customers } = useQuery({
    queryKey: ['global-search-customers', q],
    queryFn: () => api.get(`/customers?search=${encodeURIComponent(q)}&limit=5`).then(r => r.data.data ?? []),
    enabled: q.length >= 2,
    staleTime: 30_000,
  })
  const { data: products } = useQuery({
    queryKey: ['global-search-products', q],
    queryFn: () => api.get(`/products?search=${encodeURIComponent(q)}&limit=5`).then(r => r.data.data ?? []),
    enabled: q.length >= 2,
    staleTime: 30_000,
  })

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const hasResults = (customers?.length ?? 0) + (products?.length ?? 0) > 0

  return (
    <div ref={ref} className="relative hidden md:flex items-center">
      <Search className="absolute left-3 w-4 h-4 text-brand-muted z-10" />
      <input
        type="search" placeholder="Rechercher client, produit…" value={q}
        onChange={e => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => { if (e.key === 'Enter' && q.trim()) { router.push(`/customers?search=${encodeURIComponent(q)}`); setOpen(false) } }}
        className="pl-9 pr-4 py-2 text-sm bg-brand-darker border border-brand-border rounded-xl w-72 focus:outline-none focus:border-brand-orange/50 transition-all"
      />
      {open && q.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-brand-darker border border-brand-border rounded-xl shadow-xl overflow-hidden z-50">
          {!hasResults ? (
            <p className="p-4 text-sm text-brand-muted text-center">Aucun résultat</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {(customers?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-brand-muted px-3 pt-2 pb-1">Clients</p>
                  {customers.map((c: any) => (
                    <button key={c.id} onClick={() => { router.push(`/customers?search=${encodeURIComponent(c.firstName)}`); setOpen(false); setQ('') }}
                      className="w-full px-3 py-2 flex items-center gap-3 hover:bg-white/5 text-left">
                      <span className="text-sm">👤</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.firstName} {c.lastName}</p>
                        <p className="text-xs text-brand-muted truncate">{c.phone || c.email || ''}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {(products?.length ?? 0) > 0 && (
                <div className="border-t border-brand-border">
                  <p className="text-[10px] uppercase tracking-wider text-brand-muted px-3 pt-2 pb-1">Produits</p>
                  {products.map((p: any) => (
                    <button key={p.id} onClick={() => { router.push('/menu'); setOpen(false); setQ('') }}
                      className="w-full px-3 py-2 flex items-center gap-3 hover:bg-white/5 text-left">
                      <span className="text-sm">🍽️</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-brand-muted">{p.category?.name ?? ''} · {p.price} Ar</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function Header({ onMenuToggle }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuthStore()
  const [time, setTime] = useState(new Date())
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  function handleNotifClick(n: Notification) {
    if (!n.isRead) markRead.mutate(n.id)
    const path = NOTIF_TYPE_TO_PATH[n.type]
    if (path) { router.push(path); setOpen(false) }
  }

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Real-time socket listeners
  useEffect(() => {
    if (!user?.restaurantId) return
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
    const socket = socketIO(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', {
      auth: { token },
      transports: ['websocket'],
    })

    socket.on('table:call_waiter', (data: { tableNumber: number; message: string }) => {
      toast('🔔 Appel serveur', {
        description: data.message || `Table ${data.tableNumber} demande un serveur`,
        duration: 15_000,
        position: 'top-right',
      })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    })

    socket.on('stock:alert', (data: { message: string; type: string }) => {
      toast.warning(`📦 ${data.type === 'OUT_OF_STOCK' ? 'Rupture de stock' : 'Stock faible'}`, {
        description: data.message,
        duration: 10_000,
        position: 'top-right',
      })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    })

    socket.on('order:created', (data: { orderNumber: string; type: string }) => {
      const typeLabel = data.type === 'DINE_IN' ? 'Sur place' : data.type === 'DELIVERY' ? 'Livraison' : 'À emporter'
      toast.info(`🛒 Nouvelle commande — ${typeLabel}`, {
        description: data.orderNumber,
        duration: 8_000,
        position: 'top-right',
      })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    })

    socket.on('order:status_changed', (data: { orderId: string; status: string; order?: { orderNumber: string } }) => {
      if (data.status === 'READY') {
        const num = data.order?.orderNumber
        toast.success(`🛎️ Commande prête${num ? ` — ${num}` : ''}`, {
          description: 'À récupérer ou à servir',
          duration: 10_000,
          position: 'top-right',
          action: { label: 'Voir', onClick: () => router.push('/orders') },
        })
      }
      qc.invalidateQueries({ queryKey: ['orders'] })
    })

    socket.on('notification:new', () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    })

    return () => { socket.disconnect() }
  }, [user?.restaurantId, qc])

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

  const clearRead = useMutation({
    mutationFn: () => api.delete('/notifications/read'),
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
        <GlobalSearch />


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
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllRead.mutate()}
                        className="text-xs text-brand-muted hover:text-brand-orange transition-colors"
                      >
                        Tout lire
                      </button>
                    )}
                    {notifications.some(n => n.isRead) && (
                      <button
                        onClick={() => clearRead.mutate()}
                        className="text-xs text-brand-muted hover:text-red-400 transition-colors"
                      >
                        Effacer lues
                      </button>
                    )}
                  </div>
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
                      onClick={() => handleNotifClick(n)}
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
        <button onClick={() => router.push('/profile')}
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer hover:scale-105 transition-transform"
          style={{ background: 'linear-gradient(135deg, #FF4D00 0%, #FFB800 100%)' }}
          title="Mon profil">
          {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
        </button>
      </div>
    </header>
  )
}

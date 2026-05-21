'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Building2, TrendingUp, ShoppingCart, Table2, AlertTriangle, Calendar, ArrowUpRight } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { formatCurrency } from '@restaurant/utils'

type RestaurantWithStats = {
  id: string
  name: string
  slug: string
  city: string
  country: string
  phone: string
  email: string
  monthlyRevenueTarget: number | null
  createdAt: string
  stats: {
    revenueToday: number
    ordersToday: number
    activeOrders: number
    tablesOccupied: number
    stockAlerts: number
    pendingReservations: number
  }
}

export default function SuperadminPage() {
  const { user } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (user && user.role?.name !== 'superadmin') {
      router.push('/dashboard')
    }
  }, [user, router])

  const { data: restaurants, isLoading } = useQuery<RestaurantWithStats[]>({
    queryKey: ['superadmin', 'restaurants'],
    queryFn: () => api.get('/superadmin/restaurants').then(r => r.data.data),
    refetchInterval: 60_000,
  })

  if (user && user.role?.name !== 'superadmin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-brand-muted">Accès refusé</p>
      </div>
    )
  }

  const list = restaurants ?? []
  const totalRevenue = list.reduce((s, r) => s + r.stats.revenueToday, 0)
  const totalOrders = list.reduce((s, r) => s + r.stats.ordersToday, 0)
  const totalAlerts = list.reduce((s, r) => s + r.stats.stockAlerts, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Building2 className="w-6 h-6 text-brand-orange" />
          Vue Superadmin
        </h1>
        <p className="text-brand-muted text-sm mt-1">
          {list.length} établissement{list.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 text-xs text-brand-muted uppercase tracking-wider mb-2">
            <TrendingUp className="w-3.5 h-3.5" />
            CA Aujourd'hui (tous restaurants)
          </div>
          <p className="text-2xl font-bold text-brand-orange">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 text-xs text-brand-muted uppercase tracking-wider mb-2">
            <ShoppingCart className="w-3.5 h-3.5" />
            Commandes Aujourd'hui
          </div>
          <p className="text-2xl font-bold">{totalOrders}</p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 text-xs text-brand-muted uppercase tracking-wider mb-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            Alertes Stock
          </div>
          <p className={`text-2xl font-bold ${totalAlerts > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{totalAlerts}</p>
        </div>
      </div>

      {/* Restaurants list */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card p-5 h-40 skeleton" />
          ))
        ) : list.length === 0 ? (
          <div className="glass-card p-10 text-center text-brand-muted">
            <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Aucun restaurant à afficher</p>
          </div>
        ) : list.map((r, i) => (
          <motion.div key={r.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.05 }}
            className="glass-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-semibold">{r.name}</h2>
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-brand-muted border border-brand-border">
                    {r.slug}
                  </span>
                </div>
                <p className="text-xs text-brand-muted">
                  {r.city}{r.country ? `, ${r.country}` : ''}
                  {r.phone && ` · ${r.phone}`}
                </p>
              </div>
              <a href={`/dashboard?restaurant=${r.id}`}
                className="flex items-center gap-1 text-xs text-brand-orange hover:text-orange-400 transition-colors">
                Voir le dashboard <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
              <Stat label="CA Aujourd'hui" value={formatCurrency(r.stats.revenueToday)} color="text-brand-orange" highlight />
              <Stat label="Commandes" value={r.stats.ordersToday} />
              <Stat label="En cours" value={r.stats.activeOrders} color={r.stats.activeOrders > 0 ? 'text-amber-400' : ''} />
              <Stat label="Tables occupées" value={r.stats.tablesOccupied} />
              <Stat label="Alertes stock" value={r.stats.stockAlerts} color={r.stats.stockAlerts > 0 ? 'text-amber-400' : 'text-emerald-400'} />
            </div>

            {/* Monthly target progress */}
            {r.monthlyRevenueTarget && r.monthlyRevenueTarget > 0 && (
              <div className="text-xs text-brand-muted">
                Objectif mensuel : <span className="font-semibold text-white">{formatCurrency(r.monthlyRevenueTarget)}</span>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value, color, highlight }: { label: string; value: any; color?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? 'bg-brand-orange/5 border border-brand-orange/20' : 'bg-white/3 border border-brand-border'}`}>
      <p className="text-[10px] text-brand-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-bold text-base ${color ?? ''}`}>{value}</p>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, CheckCircle, ChefHat, Bell, Flame } from 'lucide-react'
import { api } from '@/lib/api'
import { formatRelative } from '@restaurant/utils'
import { toast } from 'sonner'

const KDS_STATIONS = [
  { value: '', label: 'Toutes les stations' },
  { value: 'hot', label: '🔥 Chaud' },
  { value: 'cold', label: '❄️ Froid' },
  { value: 'drinks', label: '🥤 Boissons' },
  { value: 'desserts', label: '🍰 Desserts' },
]

function OrderCard({ order, onItemReady }: { order: any; onItemReady: (orderId: string, itemId: string) => void }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = new Date(order.createdAt).getTime()
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [order.createdAt])

  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  const isUrgent = elapsed > 900 // 15 min
  const isWarning = elapsed > 600 // 10 min

  const allReady = order.items?.every((item: any) => item.status === 'READY')
  const pendingItems = order.items?.filter((item: any) => item.status !== 'READY') || []

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`glass-card overflow-hidden ${isUrgent ? 'border-red-500/50' : isWarning ? 'border-yellow-500/50' : ''}`}
    >
      {/* Header */}
      <div className={`p-4 border-b border-brand-border flex items-center justify-between ${
        isUrgent ? 'bg-red-500/10' : isWarning ? 'bg-yellow-500/10' : ''
      }`}>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg">{order.orderNumber}</span>
            <span className="text-xs px-2 py-0.5 rounded-lg bg-white/10 font-medium">
              {order.type === 'DINE_IN' ? `🪑 Table ${order.table?.number || '?'}` :
               order.type === 'TAKEAWAY' ? '🥡 Emporté' : '🚴 Livraison'}
            </span>
          </div>
          <p className="text-xs text-brand-muted mt-0.5">
            {order.guestCount} couvert{order.guestCount > 1 ? 's' : ''}
          </p>
        </div>

        <div className={`text-right font-mono font-bold text-lg ${
          isUrgent ? 'text-red-400 animate-pulse' : isWarning ? 'text-yellow-400' : 'text-white'
        }`}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          {isUrgent && <Flame className="w-4 h-4 inline ml-1" />}
        </div>
      </div>

      {/* Items */}
      <div className="p-4 space-y-2">
        {order.items?.map((item: any) => (
          <motion.div
            key={item.id}
            className={`flex items-center justify-between p-2.5 rounded-xl transition-all ${
              item.status === 'READY' ? 'bg-green-500/10 border border-green-500/20' : 'bg-white/3'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold ${
                item.status === 'READY' ? 'bg-green-500/20 text-green-400' : 'bg-brand-border text-white'
              }`}>
                {item.quantity}
              </span>
              <div>
                <p className={`text-sm font-medium ${item.status === 'READY' ? 'line-through text-brand-muted' : ''}`}>
                  {item.product?.name}
                </p>
                {item.notes && (
                  <p className="text-xs text-yellow-400">⚠️ {item.notes}</p>
                )}
              </div>
            </div>
            {item.status !== 'READY' && (
              <button
                onClick={() => onItemReady(order.id, item.id)}
                className="p-1.5 text-green-400 hover:bg-green-400/20 rounded-lg transition-colors"
              >
                <CheckCircle className="w-5 h-5" />
              </button>
            )}
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      {allReady && (
        <div className="p-3 border-t border-brand-border bg-green-500/10">
          <div className="flex items-center justify-center gap-2 text-green-400 text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Commande prête à servir !
          </div>
        </div>
      )}
    </motion.div>
  )
}

export default function KDSPage() {
  const [station, setStation] = useState('')
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['kds-orders'],
    queryFn: () => api.get('/orders?status=CONFIRMED&status=PREPARING&limit=50').then(r => r.data.data),
    refetchInterval: 10000,
  })

  const markItemReady = useMutation({
    mutationFn: ({ orderId, itemId }: { orderId: string; itemId: string }) =>
      api.patch(`/orders/${orderId}/status`, { status: 'PREPARING' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kds-orders'] })
      toast.success('Article marqué comme prêt')
    },
  })

  const orders = (data || []).filter((order: any) =>
    ['CONFIRMED', 'PREPARING'].includes(order.status)
  )

  return (
    <div className="space-y-6">
      {/* KDS Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-orange/20 flex items-center justify-center">
            <ChefHat className="w-5 h-5 text-brand-orange" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Affichage Cuisine</h1>
            <p className="text-brand-muted text-sm">
              <span className="text-green-400 font-medium">{orders.length}</span> commande{orders.length > 1 ? 's' : ''} en cours
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs text-brand-muted">Temps réel</span>
        </div>
      </div>

      {/* Station filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {KDS_STATIONS.map(s => (
          <button key={s.value}
            onClick={() => setStation(s.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap border transition-all ${
              station === s.value ? 'bg-brand-orange text-white border-brand-orange' : 'border-brand-border text-brand-muted'
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Orders grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-64 rounded-2xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <ChefHat className="w-16 h-16 mx-auto mb-4 text-brand-muted opacity-30" />
          <h2 className="text-xl font-semibold text-brand-muted mb-2">Pas de commandes en cours</h2>
          <p className="text-brand-muted text-sm">Les nouvelles commandes apparaîtront ici automatiquement</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {orders.map((order: any) => (
              <OrderCard
                key={order.id}
                order={order}
                onItemReady={(orderId, itemId) => markItemReady.mutate({ orderId, itemId })}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

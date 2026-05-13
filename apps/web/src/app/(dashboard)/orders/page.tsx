'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingCart, Filter, Search, Plus, RefreshCw, Eye,
  Clock, CheckCircle, XCircle, ChefHat, Package, Truck
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency, formatRelative } from '@restaurant/utils'
import { toast } from 'sonner'

const ORDER_STATUSES = [
  { value: '', label: 'Toutes', color: '#6B7280' },
  { value: 'PENDING', label: 'En attente', color: '#F59E0B' },
  { value: 'CONFIRMED', label: 'Confirmée', color: '#3B82F6' },
  { value: 'PREPARING', label: 'En préparation', color: '#8B5CF6' },
  { value: 'READY', label: 'Prête', color: '#10B981' },
  { value: 'DELIVERED', label: 'Livrée', color: '#10B981' },
  { value: 'COMPLETED', label: 'Terminée', color: '#6B7280' },
  { value: 'CANCELLED', label: 'Annulée', color: '#EF4444' },
]

const ORDER_TYPES = {
  DINE_IN: { label: 'Sur place', icon: '🪑' },
  TAKEAWAY: { label: 'Emporté', icon: '🥡' },
  DELIVERY: { label: 'Livraison', icon: '🚴' },
  ONLINE: { label: 'En ligne', icon: '📱' },
}

const STATUS_NEXT: Record<string, string> = {
  PENDING: 'CONFIRMED',
  CONFIRMED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'COMPLETED',
}

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const qc = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders', statusFilter],
    queryFn: () => api.get(`/orders?${statusFilter ? `status=${statusFilter}&` : ''}limit=50`).then(r => r.data),
    refetchInterval: 15000,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      toast.success('Statut mis à jour')
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  })

  const orders = data?.data || []
  const filtered = search
    ? orders.filter((o: any) => o.orderNumber.toLowerCase().includes(search.toLowerCase()))
    : orders

  function getStatusConfig(status: string) {
    return ORDER_STATUSES.find(s => s.value === status) || ORDER_STATUSES[0]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Commandes</h1>
          <p className="text-brand-muted text-sm">{data?.pagination?.total || 0} commandes</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
          <button className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nouvelle commande
          </button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {ORDER_STATUSES.map(status => (
          <button
            key={status.value}
            onClick={() => setStatusFilter(status.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap border transition-all ${
              statusFilter === status.value
                ? 'text-white border-transparent'
                : 'text-brand-muted border-brand-border hover:border-brand-orange/30'
            }`}
            style={statusFilter === status.value ? { background: status.color, borderColor: status.color } : {}}
          >
            {status.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par numéro..."
          className="input-field pl-10"
        />
      </div>

      {/* Orders list */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="glass-card p-4 skeleton h-24" />
            ))
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 text-brand-muted"
            >
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Aucune commande trouvée</p>
            </motion.div>
          ) : (
            filtered.map((order: any) => {
              const statusConf = getStatusConfig(order.status)
              const nextStatus = STATUS_NEXT[order.status]
              const orderType = ORDER_TYPES[order.type as keyof typeof ORDER_TYPES]

              return (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="glass-card p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="text-2xl">{orderType?.icon || '📋'}</div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-bold text-sm">{order.orderNumber}</span>
                          {order.table && (
                            <span className="text-xs text-brand-muted">
                              Table {order.table.number}
                            </span>
                          )}
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: `${statusConf.color}20`, color: statusConf.color }}>
                            {statusConf.label}
                          </span>
                        </div>
                        <p className="text-xs text-brand-muted mb-2">
                          {order.items?.length} article{order.items?.length > 1 ? 's' : ''} •{' '}
                          {order.guestCount} couvert{order.guestCount > 1 ? 's' : ''} •{' '}
                          {formatRelative(order.createdAt)}
                        </p>
                        <div className="flex gap-1.5 flex-wrap">
                          {order.items?.slice(0, 4).map((item: any) => (
                            <span key={item.id} className="text-xs px-2 py-0.5 bg-white/5 rounded-lg">
                              {item.quantity}× {item.product?.name || '?'}
                            </span>
                          ))}
                          {order.items?.length > 4 && (
                            <span className="text-xs px-2 py-0.5 bg-white/5 rounded-lg text-brand-muted">
                              +{order.items.length - 4}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="font-bold text-brand-orange">{formatCurrency(order.totalAmount)}</p>
                        <p className="text-xs text-brand-muted">{orderType?.label}</p>
                      </div>
                      {nextStatus && (
                        <button
                          onClick={() => updateStatus.mutate({ id: order.id, status: nextStatus })}
                          disabled={updateStatus.isPending}
                          className="btn-primary px-3 py-1.5 text-xs"
                        >
                          {nextStatus === 'CONFIRMED' ? 'Confirmer' :
                           nextStatus === 'PREPARING' ? 'En cuisine' :
                           nextStatus === 'READY' ? 'Prête' : 'Terminer'}
                        </button>
                      )}
                      {order.status === 'PENDING' && (
                        <button
                          onClick={() => updateStatus.mutate({ id: order.id, status: 'CANCELLED' })}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

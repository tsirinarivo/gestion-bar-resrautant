'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingCart, Search, Plus, RefreshCw, XCircle, X, ChevronRight
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

interface CartItem { productId: string; name: string; price: number; quantity: number }

function NewOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'>('DINE_IN')
  const [tableId, setTableId] = useState('')
  const [notes, setNotes] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [catFilter, setCatFilter] = useState('')
  const [productSearch, setProductSearch] = useState('')

  const { data: catData } = useQuery({
    queryKey: ['modal-categories'],
    queryFn: () => api.get('/categories').then(r => r.data.data),
  })
  const { data: productData } = useQuery({
    queryKey: ['modal-products', catFilter],
    queryFn: () => api.get(`/products?isAvailable=true${catFilter ? `&categoryId=${catFilter}` : ''}&limit=100`).then(r => r.data.data),
  })
  const { data: tableData } = useQuery({
    queryKey: ['modal-tables'],
    queryFn: () => api.get('/tables?status=AVAILABLE').then(r => r.data.data),
    enabled: orderType === 'DINE_IN',
  })

  const createOrder = useMutation({
    mutationFn: () => api.post('/orders', {
      type: orderType,
      tableId: orderType === 'DINE_IN' && tableId ? tableId : undefined,
      notes: notes || undefined,
      items: cart.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.price })),
    }),
    onSuccess: () => { toast.success('Commande créée'); onCreated(); onClose(); },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Erreur création commande'),
  })

  const addItem = (p: any) => setCart(prev => {
    const idx = prev.findIndex(i => i.productId === p.id)
    if (idx >= 0) return prev.map((i, n) => n === idx ? { ...i, quantity: i.quantity + 1 } : i)
    return [...prev, { productId: p.id, name: p.name, price: p.price, quantity: 1 }]
  })
  const removeItem = (productId: string) => setCart(prev =>
    prev.map(i => i.productId === productId ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0)
  )

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const categories: any[] = catData ?? []
  const products: any[] = (productData ?? []).filter((p: any) =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#111118] border border-[#1E1E2E] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1E1E2E]">
          <h2 className="text-lg font-bold">Nouvelle commande</h2>
          <button onClick={onClose} className="p-1 hover:text-red-400 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: products */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-[#1E1E2E]">
            {/* Categories */}
            <div className="flex gap-2 p-3 overflow-x-auto border-b border-[#1E1E2E]">
              <button
                onClick={() => setCatFilter('')}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${!catFilter ? 'bg-orange-500 text-white' : 'bg-white/5 text-brand-muted'}`}
              >
                Tous
              </button>
              {categories.map((c: any) => (
                <button key={c.id} onClick={() => setCatFilter(c.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${catFilter === c.id ? 'bg-orange-500 text-white' : 'bg-white/5 text-brand-muted'}`}
                >
                  {c.icon} {c.name}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="p-3 border-b border-[#1E1E2E]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-muted" />
                <input
                  value={productSearch} onChange={e => setProductSearch(e.target.value)}
                  placeholder="Rechercher un produit..."
                  className="w-full bg-white/5 rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* Products grid */}
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {products.map((p: any) => {
                  const inCart = cart.find(i => i.productId === p.id)
                  return (
                    <button key={p.id} onClick={() => addItem(p)}
                      className={`bg-white/5 hover:bg-white/10 rounded-xl p-3 text-left transition-all relative ${inCart ? 'ring-1 ring-orange-500' : ''}`}
                    >
                      {inCart && (
                        <span className="absolute top-2 right-2 bg-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                          {inCart.quantity}
                        </span>
                      )}
                      <p className="font-medium text-xs leading-tight line-clamp-2 mb-1 pr-6">{p.name}</p>
                      <p className="text-orange-400 text-xs font-bold">{formatCurrency(p.price)}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right: cart + options */}
          <div className="w-72 flex flex-col">
            {/* Order type */}
            <div className="p-4 border-b border-[#1E1E2E]">
              <p className="text-xs text-brand-muted mb-2 font-medium">TYPE</p>
              <div className="flex gap-1">
                {(['DINE_IN', 'TAKEAWAY', 'DELIVERY'] as const).map(t => (
                  <button key={t} onClick={() => setOrderType(t)}
                    className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${orderType === t ? 'bg-orange-500 text-white' : 'bg-white/5 text-brand-muted'}`}
                  >
                    {ORDER_TYPES[t].icon}
                  </button>
                ))}
              </div>
              <p className="text-xs text-brand-muted mt-1 text-center">{ORDER_TYPES[orderType].label}</p>
            </div>

            {/* Table selector */}
            {orderType === 'DINE_IN' && (
              <div className="p-4 border-b border-[#1E1E2E]">
                <p className="text-xs text-brand-muted mb-2 font-medium">TABLE</p>
                <select
                  value={tableId} onChange={e => setTableId(e.target.value)}
                  className="w-full bg-white/5 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500"
                >
                  <option value="">— Sans table —</option>
                  {(tableData ?? []).map((t: any) => (
                    <option key={t.id} value={t.id}>Table {t.number}{t.name ? ` — ${t.name}` : ''}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cart.length === 0 ? (
                <p className="text-center text-brand-muted text-xs mt-8">Aucun article</p>
              ) : cart.map(item => (
                <div key={item.productId} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.name}</p>
                    <p className="text-xs text-orange-400">{formatCurrency(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => removeItem(item.productId)} className="w-6 h-6 rounded-full bg-white/10 hover:bg-red-500/30 flex items-center justify-center text-xs">−</button>
                    <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                    <button onClick={() => addItem({ id: item.productId, name: item.name, price: item.price })} className="w-6 h-6 rounded-full bg-white/10 hover:bg-green-500/30 flex items-center justify-center text-xs">+</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Notes */}
            <div className="px-3 pb-2">
              <input
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Note..."
                className="w-full bg-white/5 rounded-xl px-3 py-2 text-xs placeholder-gray-600 outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            {/* Total + submit */}
            <div className="p-4 border-t border-[#1E1E2E]">
              <div className="flex justify-between font-bold mb-3">
                <span>Total</span>
                <span className="text-orange-400">{formatCurrency(total)}</span>
              </div>
              <button
                onClick={() => createOrder.mutate()}
                disabled={cart.length === 0 || createOrder.isPending}
                className="w-full btn-primary py-3 rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <ChevronRight className="w-4 h-4" />
                {createOrder.isPending ? 'Création...' : 'Créer la commande'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
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
    return ORDER_STATUSES.find(s => s.value === status) ?? { value: status, label: status, color: '#6b7280' }
  }

  return (
    <div className="space-y-6">
      {showNew && (
        <NewOrderModal
          onClose={() => setShowNew(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['orders'] })}
        />
      )}

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
          <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2">
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
                            <span className="text-xs text-brand-muted">Table {order.table.number}</span>
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

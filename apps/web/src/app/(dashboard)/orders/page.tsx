'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingCart, Plus, RefreshCw, XCircle, X, ChefHat,
  Check, Clock, Utensils, CheckCircle2, Search, ChevronDown, Trash2
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency, formatRelative } from '@restaurant/utils'
import { toast } from 'sonner'

// ─── Constants ────────────────────────────────────────────────────────────────

const ORDER_STATUSES = [
  { value: '', label: 'Toutes', color: '#6B7280' },
  { value: 'PENDING', label: 'En attente', color: '#F59E0B' },
  { value: 'CONFIRMED', label: 'Confirmée', color: '#3B82F6' },
  { value: 'PREPARING', label: 'En cuisine', color: '#8B5CF6' },
  { value: 'READY', label: 'Prête', color: '#10B981' },
  { value: 'DELIVERED', label: 'Livrée', color: '#10B981' },
  { value: 'COMPLETED', label: 'Terminée', color: '#6B7280' },
  { value: 'CANCELLED', label: 'Annulée', color: '#EF4444' },
]

const STATUS_ICONS: Record<string, any> = {
  PENDING: Clock,
  CONFIRMED: Check,
  PREPARING: ChefHat,
  READY: CheckCircle2,
  DELIVERED: CheckCircle2,
  COMPLETED: CheckCircle2,
}

const STATUS_NEXT: Record<string, { label: string; status: string }> = {
  PENDING:   { label: 'Envoyer en cuisine', status: 'CONFIRMED' },
  CONFIRMED: { label: 'En préparation',     status: 'PREPARING' },
  PREPARING: { label: 'Prête à servir',     status: 'READY' },
  READY:     { label: 'Servie',             status: 'COMPLETED' },
}

const ORDER_TYPES = {
  DINE_IN:  { label: 'Sur place', icon: '🪑' },
  TAKEAWAY: { label: 'Emporté',   icon: '🥡' },
  DELIVERY: { label: 'Livraison', icon: '🚴' },
}

interface CartItem { productId: string; name: string; price: number; quantity: number; notes: string }

// ─── New Order Modal (mobile-first) ──────────────────────────────────────────

function NewOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [tab, setTab] = useState<'menu' | 'cart'>('menu')
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'>('DINE_IN')
  const [tableId, setTableId] = useState('')
  const [globalNotes, setGlobalNotes] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [catFilter, setCatFilter] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [editingNote, setEditingNote] = useState<string | null>(null)

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
    queryFn: () => api.get('/tables').then(r => r.data.data),
    enabled: orderType === 'DINE_IN',
  })

  const createOrder = useMutation({
    mutationFn: () => api.post('/orders', {
      type: orderType,
      tableId: orderType === 'DINE_IN' && tableId ? tableId : undefined,
      notes: globalNotes || undefined,
      items: cart.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.price,
        notes: i.notes || undefined,
      })),
    }),
    onSuccess: () => { toast.success('Commande envoyée en cuisine !'); onCreated(); onClose() },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Erreur création commande'),
  })

  const addItem = (p: any) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.productId === p.id)
      if (idx >= 0) return prev.map((i, n) => n === idx ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { productId: p.id, name: p.name, price: p.price, quantity: 1, notes: '' }]
    })
  }
  const removeItem = (productId: string) => setCart(prev =>
    prev.map(i => i.productId === productId ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0)
  )
  const deleteItem = (productId: string) => setCart(prev => prev.filter(i => i.productId !== productId))
  const updateNote = (productId: string, note: string) => setCart(prev =>
    prev.map(i => i.productId === productId ? { ...i, notes: note } : i)
  )

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const categories: any[] = catData ?? []
  const products: any[] = (productData ?? []).filter((p: any) =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())
  )
  const tables: any[] = tableData ?? []

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        className="bg-[#0E0E18] w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl flex flex-col"
        style={{ height: '92dvh', maxHeight: '92dvh' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
          <h2 className="text-lg font-bold">Nouvelle commande</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/8 active:bg-white/15">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Type + Table ── */}
        <div className="px-4 pt-3 pb-2 flex-shrink-0 space-y-3">
          {/* Type selector */}
          <div className="grid grid-cols-3 gap-2">
            {(['DINE_IN', 'TAKEAWAY', 'DELIVERY'] as const).map(t => (
              <button key={t} onClick={() => setOrderType(t)}
                className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                  orderType === t ? 'bg-brand-orange text-white' : 'bg-white/6 text-brand-muted active:bg-white/10'
                }`}>
                {ORDER_TYPES[t].icon} {ORDER_TYPES[t].label}
              </button>
            ))}
          </div>

          {/* Table selector (visual grid) */}
          {orderType === 'DINE_IN' && tables.length > 0 && (
            <div>
              <p className="text-xs text-brand-muted mb-2">Table</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setTableId('')}
                  className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                    !tableId ? 'bg-brand-orange text-white border-brand-orange' : 'border-white/10 text-brand-muted'
                  }`}>
                  Sans table
                </button>
                {tables.map((t: any) => (
                  <button key={t.id} onClick={() => setTableId(t.id)}
                    className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                      tableId === t.id
                        ? 'bg-brand-orange text-white border-brand-orange'
                        : t.status === 'OCCUPIED'
                        ? 'border-red-500/40 text-red-400 bg-red-500/10'
                        : 'border-white/10 text-brand-muted'
                    }`}>
                    T{t.number}{t.name ? ` ${t.name}` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Tab bar ── */}
        <div className="flex border-b border-white/8 flex-shrink-0">
          <button onClick={() => setTab('menu')}
            className={`flex-1 py-3 text-sm font-semibold transition-all border-b-2 ${
              tab === 'menu' ? 'border-brand-orange text-white' : 'border-transparent text-brand-muted'
            }`}>
            🍽️ Menu
          </button>
          <button onClick={() => setTab('cart')}
            className={`flex-1 py-3 text-sm font-semibold transition-all border-b-2 relative ${
              tab === 'cart' ? 'border-brand-orange text-white' : 'border-transparent text-brand-muted'
            }`}>
            🛒 Panier
            {cartCount > 0 && (
              <span className="absolute top-2 right-8 bg-brand-orange text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Menu tab ── */}
        {tab === 'menu' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Category pills */}
            <div className="flex gap-2 px-4 py-3 overflow-x-auto flex-shrink-0">
              <button onClick={() => setCatFilter('')}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium ${
                  !catFilter ? 'bg-brand-orange text-white' : 'bg-white/6 text-brand-muted'
                }`}>
                Tout
              </button>
              {categories.map((c: any) => (
                <button key={c.id} onClick={() => setCatFilter(c.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium ${
                    catFilter === c.id ? 'bg-brand-orange text-white' : 'bg-white/6 text-brand-muted'
                  }`}>
                  {c.icon} {c.name}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="px-4 pb-3 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                <input value={productSearch} onChange={e => setProductSearch(e.target.value)}
                  placeholder="Rechercher..." className="input-field pl-10 text-sm" />
              </div>
            </div>

            {/* Products grid */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                {products.map((p: any) => {
                  const inCart = cart.find(i => i.productId === p.id)
                  return (
                    <button key={p.id} onClick={() => addItem(p)}
                      className={`relative bg-white/5 active:bg-white/10 rounded-2xl p-4 text-left transition-all ${
                        inCart ? 'ring-2 ring-brand-orange' : ''
                      }`}>
                      {inCart && (
                        <span className="absolute top-2.5 right-2.5 bg-brand-orange text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
                          {inCart.quantity}
                        </span>
                      )}
                      <p className="font-medium text-sm leading-tight mb-2 pr-7 line-clamp-2">{p.name}</p>
                      <p className="text-brand-orange font-bold text-sm">{formatCurrency(p.price)}</p>
                      {p.prepTime && <p className="text-xs text-brand-muted mt-0.5">{p.prepTime}min</p>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Floating cart button */}
            {cartCount > 0 && (
              <div className="flex-shrink-0 px-4 pb-4">
                <button onClick={() => setTab('cart')}
                  className="w-full bg-brand-orange text-white py-4 rounded-2xl font-bold text-base flex items-center justify-between px-5 active:opacity-80">
                  <span className="bg-white/20 rounded-xl px-2.5 py-1 text-sm">{cartCount} article{cartCount > 1 ? 's' : ''}</span>
                  <span>Voir le panier →</span>
                  <span>{formatCurrency(total)}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Cart tab ── */}
        {tab === 'cart' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {cart.length === 0 ? (
                <div className="text-center py-16 text-brand-muted">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Panier vide</p>
                  <button onClick={() => setTab('menu')} className="mt-3 text-brand-orange text-sm underline">
                    Ajouter des articles
                  </button>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.productId} className="bg-white/5 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      {/* Quantity controls */}
                      <div className="flex items-center gap-3">
                        <button onClick={() => removeItem(item.productId)}
                          className="w-9 h-9 rounded-full bg-white/10 active:bg-red-500/30 flex items-center justify-center text-lg font-bold">
                          −
                        </button>
                        <span className="text-lg font-bold w-6 text-center">{item.quantity}</span>
                        <button onClick={() => addItem({ id: item.productId, name: item.name, price: item.price })}
                          className="w-9 h-9 rounded-full bg-white/10 active:bg-green-500/30 flex items-center justify-center text-lg font-bold">
                          +
                        </button>
                      </div>
                      {/* Name + price */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{item.name}</p>
                        <p className="text-brand-orange text-sm">{formatCurrency(item.price * item.quantity)}</p>
                      </div>
                      {/* Delete */}
                      <button onClick={() => deleteItem(item.productId)}
                        className="w-9 h-9 flex items-center justify-center text-red-400 active:bg-red-500/20 rounded-xl">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Note */}
                    {editingNote === item.productId ? (
                      <input autoFocus value={item.notes}
                        onChange={e => updateNote(item.productId, e.target.value)}
                        onBlur={() => setEditingNote(null)}
                        placeholder="Note spéciale (sans sucre, bien cuit...)"
                        className="mt-2 w-full bg-white/8 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-brand-orange" />
                    ) : (
                      <button onClick={() => setEditingNote(item.productId)}
                        className="mt-1.5 text-xs text-brand-muted active:text-white flex items-center gap-1">
                        {item.notes ? `⚠️ ${item.notes}` : '+ Ajouter une note'}
                      </button>
                    )}
                  </div>
                ))
              )}

              {/* Global note */}
              {cart.length > 0 && (
                <div className="bg-white/5 rounded-2xl p-4">
                  <p className="text-xs text-brand-muted mb-2">Note générale (optionnel)</p>
                  <input value={globalNotes} onChange={e => setGlobalNotes(e.target.value)}
                    placeholder="Allergies, préférences..."
                    className="w-full bg-white/8 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-brand-orange" />
                </div>
              )}
            </div>

            {/* Submit bar */}
            {cart.length > 0 && (
              <div className="flex-shrink-0 px-4 pb-6 pt-3 border-t border-white/8">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-brand-muted text-sm">{cartCount} article{cartCount > 1 ? 's' : ''}</span>
                  <span className="text-xl font-bold text-brand-orange">{formatCurrency(total)}</span>
                </div>
                <button
                  onClick={() => createOrder.mutate()}
                  disabled={createOrder.isPending}
                  className="w-full bg-brand-orange text-white py-4 rounded-2xl font-bold text-base active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2">
                  <ChefHat className="w-5 h-5" />
                  {createOrder.isPending ? 'Envoi...' : 'Envoyer en cuisine'}
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ─── Order card ───────────────────────────────────────────────────────────────

function OrderCard({ order, onStatusChange }: { order: any; onStatusChange: (id: string, status: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const statusConf = ORDER_STATUSES.find(s => s.value === order.status) ?? ORDER_STATUSES[0]!
  const nextAction = STATUS_NEXT[order.status]
  const Icon = STATUS_ICONS[order.status] ?? Clock
  const orderType = ORDER_TYPES[order.type as keyof typeof ORDER_TYPES]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
      className="bg-white/4 rounded-2xl overflow-hidden border border-white/5"
    >
      {/* Status bar */}
      <div className="h-1 w-full" style={{ background: statusConf.color }} />

      {/* Main row */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-bold text-base">{orderType?.icon} {order.orderNumber}</span>
              {order.table && (
                <span className="text-sm font-semibold bg-white/10 px-2.5 py-0.5 rounded-lg">
                  Table {order.table.number}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-sm text-brand-muted">
              <span className="flex items-center gap-1" style={{ color: statusConf.color }}>
                <Icon className="w-3.5 h-3.5" /> {statusConf.label}
              </span>
              <span>·</span>
              <span>{formatRelative(order.createdAt)}</span>
              <span>·</span>
              <span>{order.items?.length} article{order.items?.length > 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-bold text-lg text-brand-orange">{formatCurrency(order.totalAmount)}</p>
          </div>
        </div>

        {/* Items preview */}
        <div className="flex gap-1.5 flex-wrap mb-3">
          {order.items?.slice(0, expanded ? 999 : 3).map((item: any) => (
            <span key={item.id}
              className="text-xs px-2.5 py-1 bg-white/7 rounded-lg font-medium">
              {item.quantity}× {item.product?.name || '?'}
            </span>
          ))}
          {!expanded && order.items?.length > 3 && (
            <button onClick={() => setExpanded(true)}
              className="text-xs px-2.5 py-1 bg-white/5 rounded-lg text-brand-muted">
              +{order.items.length - 3} autres
            </button>
          )}
        </div>

        {/* Notes */}
        {expanded && order.notes && (
          <p className="text-xs text-yellow-400 bg-yellow-400/10 px-3 py-2 rounded-xl mb-3">
            ⚠️ {order.notes}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {nextAction && (
            <button
              onClick={() => onStatusChange(order.id, nextAction.status)}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-brand-orange text-white active:opacity-80 transition-opacity">
              {nextAction.label}
            </button>
          )}
          {order.status === 'PENDING' && (
            <button
              onClick={() => onStatusChange(order.id, 'CANCELLED')}
              className="w-12 flex items-center justify-center rounded-xl bg-red-500/15 text-red-400 active:bg-red-500/30">
              <XCircle className="w-5 h-5" />
            </button>
          )}
          <button onClick={() => setExpanded(v => !v)}
            className="w-12 flex items-center justify-center rounded-xl bg-white/7 text-brand-muted active:bg-white/12">
            <ChevronDown className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [showNew, setShowNew] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['orders', statusFilter],
    queryFn: () => api.get(`/orders?${statusFilter ? `status=${statusFilter}&` : ''}limit=80`).then(r => r.data),
    refetchInterval: 20000,
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

  const orders: any[] = data?.data ?? []

  // Active orders count for badge
  const activeCount = orders.filter(o => ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'].includes(o.status)).length

  return (
    <div className="pb-24">
      <AnimatePresence>
        {showNew && (
          <NewOrderModal
            onClose={() => setShowNew(false)}
            onCreated={() => qc.invalidateQueries({ queryKey: ['orders'] })}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">Commandes</h1>
          {activeCount > 0 && (
            <p className="text-sm text-yellow-400 font-medium">
              {activeCount} commande{activeCount > 1 ? 's' : ''} active{activeCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button onClick={() => refetch()}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/6 active:bg-white/12 text-brand-muted">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Status filter — big touch targets */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
        {ORDER_STATUSES.map(s => {
          const count = s.value ? orders.filter(o => o.status === s.value).length : orders.length
          return (
            <button key={s.value} onClick={() => setStatusFilter(s.value)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all flex items-center gap-2 ${
                statusFilter === s.value
                  ? 'text-white'
                  : 'bg-white/5 text-brand-muted active:bg-white/10'
              }`}
              style={statusFilter === s.value ? { background: s.color } : {}}>
              {s.label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-md font-bold ${
                  statusFilter === s.value ? 'bg-white/20' : 'bg-white/10'
                }`}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Orders list */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-36 rounded-2xl" />
            ))
          ) : orders.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center py-20 text-brand-muted">
              <Utensils className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">Aucune commande</p>
              <p className="text-sm mt-1">Appuyez sur + pour prendre une commande</p>
            </motion.div>
          ) : (
            orders.map((order: any) => (
              <OrderCard key={order.id} order={order}
                onStatusChange={(id, status) => updateStatus.mutate({ id, status })} />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* FAB — fixed bottom right, large touch target */}
      <button
        onClick={() => setShowNew(true)}
        className="fixed bottom-6 right-4 w-16 h-16 bg-brand-orange rounded-2xl shadow-lg shadow-brand-orange/30 flex items-center justify-center active:scale-95 transition-transform z-40">
        <Plus className="w-8 h-8 text-white" />
      </button>
    </div>
  )
}

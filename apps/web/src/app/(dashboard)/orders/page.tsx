'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingCart, Plus, RefreshCw, XCircle, X, ChefHat,
  Check, Clock, Utensils, CheckCircle2, Search, ChevronDown, Trash2,
  Banknote, CreditCard, Split, CalendarDays, Printer,
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
  PENDING:   { label: 'Envoyer la commande', status: 'CONFIRMED' },
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

const PAYMENT_METHODS_MG = [
  { value: 'CASH',         label: '💵 Espèces' },
  { value: 'MVOLA',        label: '📱 MVola' },
  { value: 'ORANGE_MONEY', label: '🟠 Orange Money' },
  { value: 'AIRTEL_MONEY', label: '🔴 Airtel Money' },
  { value: 'CARD',         label: '💳 Carte bancaire' },
  { value: 'BNI_MOBILE',   label: '🏦 BNI Mobile' },
  { value: 'BOA_MOBILE',   label: '🏦 BOA Mobile' },
  { value: 'VIREMENT',     label: '🔁 Virement' },
  { value: 'CHEQUE',       label: '📄 Chèque' },
  { value: 'VOUCHER',      label: '🎟️ Bon' },
]

const PAYMENT_METHOD_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS_MG.map(m => [m.value, m.label])
)

// ─── Payment Modal (tip + split bill) ────────────────────────────────────────

function PaymentModal({ orderId, onClose, onDone }: { orderId: string; onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient()
  const [payAmount, setPayAmount] = useState('')
  const [method, setMethod] = useState<string>('CASH')
  const [tip, setTip] = useState('')
  const [tipSaved, setTipSaved] = useState(false)
  const [notes, setNotes] = useState('')

  const { data, refetch } = useQuery({
    queryKey: ['order-payments', orderId],
    queryFn: () => api.get(`/orders/${orderId}/payments`).then(r => r.data.data),
  })

  const saveTip = useMutation({
    mutationFn: (t: number) => api.patch(`/orders/${orderId}/tip`, { tip: t }),
    onSuccess: () => { setTipSaved(true); refetch(); qc.invalidateQueries({ queryKey: ['orders'] }) },
    onError: () => toast.error('Erreur pourboire'),
  })

  const addPayment = useMutation({
    mutationFn: (body: any) => api.post('/payments', body),
    onSuccess: () => {
      setPayAmount('')
      setNotes('')
      refetch().then((result) => {
        const freshRemaining: number = (result.data as any)?.remaining ?? 1
        if (freshRemaining <= 0) { toast.success('Commande entièrement réglée'); onDone() }
        else toast.success('Paiement partiel enregistré')
      })
      qc.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur paiement'),
  })

  const order = data?.order
  const payments: any[] = data?.payments ?? []
  const paid = data?.paid ?? 0
  const remaining = data?.remaining ?? 0
  const totalAmount = order?.totalAmount ?? 0
  const tipAmount = order?.tipAmount ?? 0

  function handlePayAll() { setPayAmount(String(remaining.toFixed(0))) }

  function handleApplyTip(): void {
    const t = parseFloat(tip)
    if (isNaN(t) || t < 0) { toast.error('Montant invalide'); return }
    saveTip.mutate(t)
    setTip('')
  }

  function handlePay(): void {
    const amount = parseFloat(payAmount)
    if (isNaN(amount) || amount <= 0) { toast.error('Montant invalide'); return }
    if (amount > remaining + 0.01) { toast.error(`Maximum encaissable: ${formatCurrency(remaining)}`); return }
    addPayment.mutate({ orderId, amount, method, notes: notes || undefined })
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        className="bg-brand-card border border-brand-border rounded-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-brand-border">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Banknote className="w-5 h-5 text-brand-orange" /> Encaissement
            </h2>
            {order && <p className="text-xs text-brand-muted mt-0.5">Commande {order.orderNumber}</p>}
          </div>
          <button onClick={onClose} className="text-brand-muted hover:text-white p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Totaux */}
          <div className="bg-black/20 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between text-brand-muted">
              <span>Sous-total</span>
              <span>{formatCurrency((order?.subtotal ?? 0) + (order?.taxAmount ?? 0) - (order?.discountAmount ?? 0))}</span>
            </div>
            {tipAmount > 0 && (
              <div className="flex justify-between text-yellow-400">
                <span>Pourboire</span>
                <span>+{formatCurrency(tipAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t border-white/10 pt-2">
              <span>Total</span>
              <span className="text-brand-orange">{formatCurrency(totalAmount)}</span>
            </div>
            <div className="flex justify-between text-emerald-400">
              <span>Déjà payé</span>
              <span>{formatCurrency(paid)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t border-white/10 pt-2">
              <span>Reste à payer</span>
              <span className={remaining <= 0 ? 'text-emerald-400' : 'text-white'}>{formatCurrency(remaining)}</span>
            </div>
          </div>

          {/* Pourboire */}
          {remaining > 0 && (
            <div>
              <p className="text-xs font-semibold text-brand-muted uppercase tracking-wide mb-2">Ajouter un pourboire</p>
              <div className="flex gap-2">
                <input
                  type="number" min="0" placeholder="Montant pourboire"
                  value={tip} onChange={e => { setTip(e.target.value); setTipSaved(false) }}
                  className="flex-1 bg-black/30 border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white"
                />
                <button
                  onClick={handleApplyTip} disabled={!tip || saveTip.isPending}
                  className="px-4 py-2.5 rounded-xl bg-yellow-500/20 text-yellow-400 text-sm font-semibold border border-yellow-500/30 hover:bg-yellow-500/30 disabled:opacity-40"
                >
                  {tipSaved ? '✓' : 'Appliquer'}
                </button>
              </div>
            </div>
          )}

          {/* Historique paiements partiels */}
          {payments.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-brand-muted uppercase tracking-wide mb-2 flex items-center gap-1">
                <Split className="w-3 h-3" /> Paiements enregistrés
              </p>
              <div className="space-y-1.5">
                {payments.map((p: any) => (
                  <div key={p.id} className="flex justify-between items-center text-sm bg-black/20 rounded-lg px-3 py-2">
                    <span className="text-brand-muted">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span>
                    <span className="font-semibold text-emerald-400">{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nouveau paiement */}
          {remaining > 0 && (
            <div>
              <p className="text-xs font-semibold text-brand-muted uppercase tracking-wide mb-2">
                {payments.length > 0 ? 'Paiement supplémentaire' : 'Mode de paiement'}
              </p>
              {/* Méthode */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                {PAYMENT_METHODS_MG.map(m => (
                  <button key={m.value} onClick={() => setMethod(m.value)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-all border text-left ${method === m.value ? 'bg-brand-orange/20 border-brand-orange text-brand-orange' : 'bg-black/20 border-brand-border text-brand-muted hover:border-white/20'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
              {/* Montant */}
              <div className="flex gap-2 mb-2">
                <input
                  type="number" min="0" placeholder="Montant"
                  value={payAmount} onChange={e => setPayAmount(e.target.value)}
                  className="flex-1 bg-black/30 border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white"
                />
                <button onClick={handlePayAll}
                  className="px-3 py-2.5 rounded-xl bg-white/10 text-xs font-semibold text-brand-muted hover:text-white border border-brand-border">
                  Tout
                </button>
              </div>
              <input
                type="text" placeholder="Notes (optionnel)"
                value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full bg-black/30 border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white mb-3"
              />
              <button
                onClick={handlePay} disabled={!payAmount || addPayment.isPending}
                className="w-full py-3.5 rounded-xl bg-brand-orange text-white font-bold text-base disabled:opacity-40 hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
              >
                <CreditCard className="w-5 h-5" />
                {addPayment.isPending ? 'Traitement...' : `Encaisser ${payAmount ? formatCurrency(parseFloat(payAmount)) : ''}`}
              </button>
            </div>
          )}

          {remaining <= 0 && (
            <div className="text-center py-4">
              <p className="text-emerald-400 font-bold text-lg">✓ Commande entièrement réglée</p>
              <button onClick={onDone} className="mt-3 px-6 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 text-sm font-semibold border border-emerald-500/30">
                Fermer
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

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
      status: 'CONFIRMED',
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
                  {createOrder.isPending ? 'Envoi...' : 'Envoyer la commande'}
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

function OrderCard({ order, onStatusChange, onPay }: { order: any; onStatusChange: (id: string, status: string) => void; onPay: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState(order.notes ?? '')
  const qc = useQueryClient()
  const statusConf = ORDER_STATUSES.find(s => s.value === order.status) ?? ORDER_STATUSES[0]!
  const nextAction = STATUS_NEXT[order.status]
  const Icon = STATUS_ICONS[order.status] ?? Clock
  const orderType = ORDER_TYPES[order.type as keyof typeof ORDER_TYPES]

  const saveNotes = useMutation({
    mutationFn: () => api.patch(`/orders/${order.id}`, { notes: notesValue.trim() || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); setEditingNotes(false); toast.success('Note mise à jour') },
  })

  const deleteItem = useMutation({
    mutationFn: (itemId: string) => api.delete(`/orders/${order.id}/items/${itemId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast.success('Article supprimé') },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Erreur'),
  })

  const changeQty = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      api.patch(`/orders/${order.id}/items/${itemId}`, { quantity }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Erreur'),
  })

  const reprintReceipt = useMutation({
    mutationFn: () => api.post('/printer/receipt', {
      orderNumber: order.orderNumber,
      tableLabel: order.table?.number ? `Table ${order.table.number}` : order.type === 'TAKEAWAY' ? 'À emporter' : order.type === 'DELIVERY' ? 'Livraison' : 'En ligne',
      items: (order.items ?? []).map((i: any) => ({
        name: i.product?.name ?? '?',
        qty: i.quantity,
        unitPrice: i.unitPrice,
        total: i.totalPrice,
      })),
      subtotal: order.subtotal ?? order.totalAmount,
      grandTotal: order.totalAmount,
    }),
    onSuccess: () => toast.success('Reçu envoyé à l\'imprimante'),
    onError: () => toast.error('Erreur d\'impression'),
  })

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
              {order.estimatedTime && order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                <>
                  <span>·</span>
                  <span className="text-amber-400">⏱ ~{order.estimatedTime} min</span>
                </>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-bold text-lg text-brand-orange">{formatCurrency(order.totalAmount)}</p>
          </div>
        </div>

        {/* Items preview */}
        <div className={expanded ? 'space-y-1.5 mb-3' : 'flex gap-1.5 flex-wrap mb-3'}>
          {order.items?.slice(0, expanded ? 999 : 3).map((item: any) => (
            expanded ? (
              <div key={item.id} className="text-xs px-2.5 py-1.5 bg-white/7 rounded-lg flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{item.product?.name || '?'}</p>
                  {item.modifiers?.length > 0 && (
                    <p className="text-[10px] text-brand-muted mt-0.5">
                      + {item.modifiers.map((m: any) => m.name).join(', ')}
                    </p>
                  )}
                  {item.notes && <p className="text-[10px] text-yellow-400 mt-0.5">⚠️ {item.notes}</p>}
                </div>
                {order.status === 'PENDING' ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => item.quantity > 1 ? changeQty.mutate({ itemId: item.id, quantity: item.quantity - 1 }) : (order.items.length > 1 && confirm(`Supprimer "${item.product?.name}" ?`) && deleteItem.mutate(item.id))}
                      className="w-5 h-5 rounded flex items-center justify-center bg-white/10 hover:bg-white/20 text-brand-muted hover:text-white transition-colors font-bold">
                      −
                    </button>
                    <span className="w-6 text-center font-bold">{item.quantity}</span>
                    <button onClick={() => changeQty.mutate({ itemId: item.id, quantity: item.quantity + 1 })}
                      className="w-5 h-5 rounded flex items-center justify-center bg-white/10 hover:bg-white/20 text-brand-muted hover:text-white transition-colors font-bold">
                      +
                    </button>
                    <button onClick={() => { if (confirm(`Supprimer "${item.product?.name}" ?`)) deleteItem.mutate(item.id) }}
                      className="ml-1 text-red-400/60 hover:text-red-400 transition-colors"
                      title="Supprimer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-brand-muted flex-shrink-0">{item.quantity}×</span>
                )}
              </div>
            ) : (
              <span key={item.id} className="text-xs px-2.5 py-1 bg-white/7 rounded-lg font-medium">
                {item.quantity}× {item.product?.name || '?'}
                {item.modifiers?.length > 0 && <span className="text-brand-muted"> +{item.modifiers.length}</span>}
              </span>
            )
          ))}
          {!expanded && order.items?.length > 3 && (
            <button onClick={() => setExpanded(true)}
              className="text-xs px-2.5 py-1 bg-white/5 rounded-lg text-brand-muted">
              +{order.items.length - 3} autres
            </button>
          )}
        </div>

        {/* Timeline */}
        {expanded && (
          <div className="mb-3 flex gap-1.5 flex-wrap">
            {[
              { label: 'Créée', time: order.createdAt, color: 'text-brand-muted' },
              { label: 'Confirmée', time: order.confirmedAt, color: 'text-blue-400' },
              { label: 'Prête', time: order.readyAt, color: 'text-green-400' },
              { label: 'Livrée', time: (order as any).deliveredAt, color: 'text-purple-400' },
              { label: 'Terminée', time: order.completedAt, color: 'text-emerald-400' },
              { label: 'Annulée', time: (order as any).cancelledAt, color: 'text-red-400' },
            ].filter(s => s.time).map((s, i) => (
              <div key={i} className="flex items-center gap-1 text-[10px]">
                {i > 0 && <span className="text-brand-muted/30">→</span>}
                <span className={`${s.color} font-medium`}>{s.label}</span>
                <span className="text-brand-muted/60">{new Date(s.time!).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
            {(order as any).tipAmount > 0 && (
              <span className="ml-auto text-[10px] text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">🫶 Pourboire {(order as any).tipAmount} Ar</span>
            )}
          </div>
        )}

        {/* Notes */}
        {expanded && (
          <div className="mb-3">
            {editingNotes ? (
              <div className="flex items-start gap-2">
                <textarea autoFocus value={notesValue} onChange={e => setNotesValue(e.target.value)}
                  rows={2} placeholder="Ajouter une note..."
                  className="input-field text-xs resize-none flex-1 py-1.5" />
                <div className="flex flex-col gap-1">
                  <button onClick={() => saveNotes.mutate()} className="px-2 py-1 bg-green-500/20 text-green-400 rounded-lg text-xs">✓</button>
                  <button onClick={() => { setEditingNotes(false); setNotesValue(order.notes ?? '') }} className="px-2 py-1 bg-red-400/20 text-red-400 rounded-lg text-xs">✕</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setEditingNotes(true)}
                className={`w-full text-left text-xs px-3 py-2 rounded-xl transition-colors ${order.notes ? 'text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20' : 'text-brand-muted bg-white/5 hover:bg-white/10'}`}>
                {order.notes ? `⚠️ ${order.notes}` : '+ Ajouter une note'}
              </button>
            )}
          </div>
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
          {!['COMPLETED', 'CANCELLED'].includes(order.status) && (
            <button
              onClick={() => onPay(order.id)}
              className="flex items-center gap-1.5 px-3 py-3 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-semibold active:bg-emerald-500/25">
              <Banknote className="w-4 h-4" /> Payer
            </button>
          )}
          {order.status === 'PENDING' && (
            <button
              onClick={() => { if (confirm(`Annuler la commande ${order.orderNumber} ?`)) onStatusChange(order.id, 'CANCELLED') }}
              className="w-12 flex items-center justify-center rounded-xl bg-red-500/15 text-red-400 active:bg-red-500/30"
              title="Annuler la commande">
              <XCircle className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => reprintReceipt.mutate()}
            disabled={reprintReceipt.isPending}
            title="Réimprimer le reçu"
            className="w-12 flex items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 active:bg-blue-500/30 disabled:opacity-50">
            <Printer className="w-5 h-5" />
          </button>
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
  const [statusFilter, setStatusFilter] = useState<string>(() =>
    typeof window === 'undefined' ? '' : (localStorage.getItem('orders-filter-status') ?? '')
  )
  const [dateFilter, setDateFilter] = useState<string>(() =>
    typeof window === 'undefined' ? '' : (localStorage.getItem('orders-filter-date') ?? '')
  )
  const [customerFilter, setCustomerFilter] = useState<string>('')

  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('orders-filter-status', statusFilter) }, [statusFilter])
  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('orders-filter-date', dateFilter) }, [dateFilter])
  const [showNew, setShowNew] = useState(false)
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = useState<string>('')
  const qc = useQueryClient()

  const { data, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['orders', statusFilter, dateFilter, customerFilter, sourceFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '80' })
      if (statusFilter) params.set('status', statusFilter)
      if (dateFilter) params.set('date', dateFilter)
      if (customerFilter) params.set('customerName', customerFilter)
      if (sourceFilter) params.set('source', sourceFilter)
      return api.get(`/orders?${params}`).then(r => r.data)
    },
    refetchInterval: 60_000,
    staleTime: 20_000,
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
        {payingOrderId && (
          <PaymentModal
            orderId={payingOrderId}
            onClose={() => setPayingOrderId(null)}
            onDone={() => { setPayingOrderId(null); qc.invalidateQueries({ queryKey: ['orders'] }) }}
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
        <div className="flex gap-2">
          <button onClick={() => refetch()}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/6 active:bg-white/12 text-brand-muted">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowNew(true)}
            className="btn-primary flex items-center gap-2 px-4">
            <Plus className="w-4 h-4" /> Nouvelle
          </button>
        </div>
      </div>

      {/* Customer search */}
      <div className="flex items-center gap-2 mb-2">
        <Search className="w-4 h-4 text-brand-muted flex-shrink-0" />
        <input
          type="search"
          value={customerFilter}
          onChange={e => setCustomerFilter(e.target.value)}
          placeholder="Rechercher par nom client…"
          className="bg-brand-darker border border-brand-border rounded-xl px-3 py-1.5 text-sm outline-none focus:border-brand-orange/50 transition-colors flex-1 max-w-64"
        />
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="w-4 h-4 text-brand-muted flex-shrink-0" />
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="bg-brand-darker border border-brand-border rounded-xl px-3 py-1.5 text-sm outline-none focus:border-brand-orange/50 transition-colors"
        />
        {dateFilter && (
          <button
            onClick={() => setDateFilter('')}
            className="text-xs text-brand-muted hover:text-white flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-3 h-3" /> Effacer
          </button>
        )}
        <button
          onClick={() => setDateFilter(new Date().toISOString().slice(0, 10))}
          className={`text-xs px-3 py-1.5 rounded-xl border transition-colors ${
            dateFilter === new Date().toISOString().slice(0, 10)
              ? 'border-brand-orange text-brand-orange bg-brand-orange/10'
              : 'border-brand-border text-brand-muted hover:border-brand-orange/40'
          }`}
        >
          Aujourd'hui
        </button>
      </div>

      {/* Source filter */}
      <div className="flex gap-2 mb-3">
        {[{ value: '', label: 'Tous canaux' }, { value: 'POS', label: '🖥️ POS' }, { value: 'ONLINE', label: '🌐 En ligne' }, { value: 'PHONE', label: '📞 Téléphone' }, { value: 'KIOSK', label: '📟 Kiosque' }].map(s => (
          <button key={s.value} onClick={() => setSourceFilter(s.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${sourceFilter === s.value ? 'bg-brand-orange text-white' : 'bg-white/5 text-brand-muted hover:bg-white/10'}`}>
            {s.label}
          </button>
        ))}
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
                onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
                onPay={(id) => setPayingOrderId(id)} />
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

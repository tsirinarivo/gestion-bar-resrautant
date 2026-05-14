'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard,
  Banknote, Receipt, Table2, X, ChevronLeft, Users, Clock,
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency, formatRelative } from '@restaurant/utils'
import { toast } from 'sonner'

interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
}

const TABLE_STATUS_STYLE: Record<string, { border: string; bg: string; text: string; label: string }> = {
  AVAILABLE: { border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Libre' },
  OCCUPIED:  { border: 'border-red-500/40',     bg: 'bg-red-500/10',     text: 'text-red-400',     label: 'Occupée' },
  RESERVED:  { border: 'border-blue-500/40',    bg: 'bg-blue-500/10',    text: 'text-blue-400',    label: 'Réservée' },
  CLEANING:  { border: 'border-amber-500/40',   bg: 'bg-amber-500/10',   text: 'text-amber-400',   label: 'Nettoyage' },
  BLOCKED:   { border: 'border-gray-500/40',    bg: 'bg-gray-500/10',    text: 'text-gray-400',    label: 'Bloquée' },
}

export default function POSPage() {
  const [activeTable, setActiveTable] = useState<any>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [search, setSearch] = useState('')
  const [showPayment, setShowPayment] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH')
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY'>('DINE_IN')
  const qc = useQueryClient()

  // ── Data fetching ─────────────────────────────────────────────────────────
  const { data: tables = [] } = useQuery({
    queryKey: ['pos-tables'],
    queryFn: () => api.get('/tables').then(r => r.data.data ?? []),
    refetchInterval: 15_000,
  })

  const { data: openOrders = [] } = useQuery({
    queryKey: ['pos-table-orders', activeTable?.id],
    queryFn: () =>
      api.get(`/orders?tableId=${activeTable!.id}&status=PENDING,CONFIRMED,PREPARING,READY&limit=50`)
        .then(r => r.data.data ?? []),
    enabled: !!activeTable?.id,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then(r => r.data.data ?? []),
  })

  const { data: products = [] } = useQuery({
    queryKey: ['products', selectedCategory],
    queryFn: () =>
      api.get(`/products?isAvailable=true&limit=100${selectedCategory ? `&categoryId=${selectedCategory}` : ''}`)
        .then(r => r.data.data ?? []),
  })

  // ── Derived values ────────────────────────────────────────────────────────
  const filteredProducts = useMemo(() =>
    (products as any[]).filter((p: any) =>
      !search || p.name.toLowerCase().includes(search.toLowerCase())),
    [products, search])

  // Open orders items merged for display
  const existingItems = useMemo(() =>
    (openOrders as any[]).flatMap((o: any) => o.items ?? []),
    [openOrders])

  const existingTotal = useMemo(() =>
    (openOrders as any[]).reduce((s: number, o: any) => s + (o.totalAmount ?? 0), 0),
    [openOrders])

  const cartSubtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const cartTax = cartSubtotal * 0.1
  const cartTotal = cartSubtotal + cartTax
  const grandTotal = existingTotal + cartTotal

  // ── Table stats for display ───────────────────────────────────────────────
  const tableStats = useMemo(() => {
    const map: Record<string, { total: number; items: number }> = {}
    return map
  }, [])

  // ── Cart helpers ─────────────────────────────────────────────────────────
  function addToCart(product: any) {
    setCart(prev => {
      const ex = prev.find(i => i.productId === product.id)
      if (ex) return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1 }]
    })
  }

  function updateQty(productId: string, qty: number) {
    setCart(prev => qty <= 0
      ? prev.filter(i => i.productId !== productId)
      : prev.map(i => i.productId === productId ? { ...i, quantity: qty } : i))
  }

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createOrderMutation = useMutation({
    mutationFn: (data: any) => api.post('/orders', data),
    onSuccess: async (res) => {
      const order = res.data.data
      // Confirm then pay
      await api.patch(`/orders/${order.id}/status`, { status: 'CONFIRMED' })
      await api.post('/payments', { orderId: order.id, amount: order.totalAmount, method: paymentMethod })
    },
  })

  // Pay all open orders on the table + new cart items
  async function handleFullPayment() {
    try {
      // 1. If cart has items, create a new order first
      if (cart.length > 0) {
        const res = await api.post('/orders', {
          type: activeTable ? 'DINE_IN' : orderType,
          tableId: activeTable?.id,
          guestCount: activeTable?.capacity ?? 1,
          items: cart.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.price })),
        })
        const newOrder = res.data.data
        await api.patch(`/orders/${newOrder.id}/status`, { status: 'CONFIRMED' })
        await api.post('/payments', { orderId: newOrder.id, amount: newOrder.totalAmount, method: paymentMethod })
      }

      // 2. Pay all existing open orders
      for (const order of openOrders as any[]) {
        await api.patch(`/orders/${order.id}/status`, { status: 'CONFIRMED' })
        await api.post('/payments', { orderId: order.id, amount: order.totalAmount, method: paymentMethod })
        await api.patch(`/orders/${order.id}/status`, { status: 'COMPLETED' })
      }

      toast.success(`Table ${activeTable?.number} — ticket encaissé (${formatCurrency(grandTotal)})`)
      setCart([])
      setShowPayment(false)
      setActiveTable(null)
      qc.invalidateQueries({ queryKey: ['pos-tables'] })
      qc.invalidateQueries({ queryKey: ['pos-table-orders'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
    } catch {
      toast.error('Erreur lors du paiement')
    }
  }

  // ── Views ─────────────────────────────────────────────────────────────────

  // VIEW 1: Table grid
  if (!activeTable && orderType === 'DINE_IN') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Table2 className="w-6 h-6 text-brand-orange" /> Plan de salle</h1>
            <p className="text-brand-muted text-sm">Sélectionnez une table pour ouvrir un ticket</p>
          </div>
          <button
            onClick={() => setOrderType('TAKEAWAY')}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            🥡 Commande à emporter
          </button>
        </div>

        {/* Legend */}
        <div className="flex gap-3 flex-wrap">
          {Object.entries(TABLE_STATUS_STYLE).map(([status, s]) => (
            <div key={status} className="flex items-center gap-1.5 text-xs text-brand-muted">
              <div className={`w-3 h-3 rounded-full ${s.bg} border ${s.border}`} />
              {s.label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {(tables as any[]).map((table: any) => {
            const s = TABLE_STATUS_STYLE[table.status] ?? TABLE_STATUS_STYLE['AVAILABLE']!
            return (
              <motion.button
                key={table.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setActiveTable(table)
                  setCart([])
                  setSearch('')
                  setSelectedCategory('')
                }}
                className={`glass-card p-4 text-center border-2 ${s.border} ${s.bg} transition-all`}
              >
                <p className="text-xl font-bold mb-1">{table.number}</p>
                {table.name && <p className="text-xs text-brand-muted truncate mb-1">{table.name}</p>}
                <p className={`text-xs font-medium ${s.text}`}>{s.label}</p>
                <div className="flex items-center justify-center gap-1 mt-1 text-xs text-brand-muted">
                  <Users className="w-3 h-3" />
                  {table.capacity}
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>
    )
  }

  // VIEW 2: Takeaway quick order (no table)
  if (!activeTable && orderType === 'TAKEAWAY') {
    return (
      <div className="flex h-[calc(100vh-10rem)] gap-4">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setOrderType('DINE_IN')} className="p-2 rounded-xl hover:bg-brand-border transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-bold text-lg">🥡 Commande à emporter</h2>
              <p className="text-brand-muted text-xs">Créez la commande et encaissez</p>
            </div>
          </div>
          <ProductPanel
            search={search} onSearch={setSearch}
            categories={categories} selectedCategory={selectedCategory} onCategory={setSelectedCategory}
            products={filteredProducts} onAdd={addToCart} cart={cart}
          />
        </div>
        <CartPanel
          cart={cart} onUpdateQty={updateQty} onClear={() => setCart([])}
          existingItems={[]} existingTotal={0}
          cartSubtotal={cartSubtotal} cartTax={cartTax} cartTotal={cartTotal} grandTotal={cartTotal}
          onPay={() => {
            if (cart.length === 0) { toast.error('Panier vide'); return }
            setShowPayment(true)
          }}
          label="Emporté"
        />
        <PaymentModal
          show={showPayment} onClose={() => setShowPayment(false)}
          total={cartTotal} method={paymentMethod} onMethod={setPaymentMethod}
          onConfirm={async () => {
            try {
              const res = await api.post('/orders', {
                type: 'TAKEAWAY', guestCount: 1,
                items: cart.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.price })),
              })
              const order = res.data.data
              await api.patch(`/orders/${order.id}/status`, { status: 'CONFIRMED' })
              await api.post('/payments', { orderId: order.id, amount: order.totalAmount, method: paymentMethod })
              await api.patch(`/orders/${order.id}/status`, { status: 'COMPLETED' })
              toast.success(`Commande ${order.orderNumber} encaissée !`)
              setCart([])
              setShowPayment(false)
              qc.invalidateQueries({ queryKey: ['orders'] })
            } catch { toast.error('Erreur paiement') }
          }}
        />
      </div>
    )
  }

  // VIEW 3: Table ticket view
  const tableStyle = TABLE_STATUS_STYLE[activeTable?.status] ?? TABLE_STATUS_STYLE['AVAILABLE']!

  return (
    <div className="flex h-[calc(100vh-10rem)] gap-4">
      {/* Products */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Table header */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => { setActiveTable(null); setCart([]); setOrderType('DINE_IN') }}
            className="p-2 rounded-xl hover:bg-brand-border transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className={`px-3 py-1.5 rounded-xl border ${tableStyle.border} ${tableStyle.bg} flex items-center gap-2`}>
            <Table2 className={`w-4 h-4 ${tableStyle.text}`} />
            <span className="font-bold">Table {activeTable?.number}</span>
            {activeTable?.name && <span className="text-brand-muted text-sm">— {activeTable.name}</span>}
            <span className={`text-xs ${tableStyle.text}`}>{tableStyle.label}</span>
          </div>
          {(openOrders as any[]).length > 0 && (
            <span className="text-xs text-brand-muted">
              {(openOrders as any[]).length} commande(s) ouverte(s)
            </span>
          )}
        </div>

        <ProductPanel
          search={search} onSearch={setSearch}
          categories={categories} selectedCategory={selectedCategory} onCategory={setSelectedCategory}
          products={filteredProducts} onAdd={addToCart} cart={cart}
        />
      </div>

      {/* Ticket */}
      <CartPanel
        cart={cart} onUpdateQty={updateQty} onClear={() => setCart([])}
        existingItems={existingItems} existingTotal={existingTotal}
        cartSubtotal={cartSubtotal} cartTax={cartTax} cartTotal={cartTotal} grandTotal={grandTotal}
        onPay={() => {
          if (cart.length === 0 && (openOrders as any[]).length === 0) {
            toast.error('Aucun article sur cette table')
            return
          }
          setShowPayment(true)
        }}
        label={`Table ${activeTable?.number}`}
      />

      <PaymentModal
        show={showPayment} onClose={() => setShowPayment(false)}
        total={grandTotal} method={paymentMethod} onMethod={setPaymentMethod}
        onConfirm={handleFullPayment}
      />
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProductPanel({ search, onSearch, categories, selectedCategory, onCategory, products, onAdd, cart }: any) {
  return (
    <>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
        <input value={search} onChange={e => onSearch(e.target.value)}
          placeholder="Rechercher un produit..." className="input-field pl-10" />
      </div>
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 flex-shrink-0">
        <button onClick={() => onCategory('')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap border transition-all ${!selectedCategory ? 'bg-brand-orange text-white border-brand-orange' : 'border-brand-border text-brand-muted'}`}>
          Tout
        </button>
        {(categories as any[]).map((cat: any) => (
          <button key={cat.id} onClick={() => onCategory(cat.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap border transition-all flex items-center gap-1.5 ${selectedCategory === cat.id ? 'bg-brand-orange text-white border-brand-orange' : 'border-brand-border text-brand-muted'}`}>
            {cat.icon && <span>{cat.icon}</span>}{cat.name}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {(products as any[]).map((product: any) => {
            const inCart = (cart as CartItem[]).find((i: CartItem) => i.productId === product.id)
            return (
              <motion.button key={product.id} whileTap={{ scale: 0.95 }}
                onClick={() => onAdd(product)}
                className="glass-card p-3 text-left hover:border-brand-orange/50 transition-all relative group">
                {inCart && (
                  <span className="absolute top-2 right-2 w-5 h-5 bg-brand-orange rounded-full text-xs font-bold text-white flex items-center justify-center z-10">
                    {inCart.quantity}
                  </span>
                )}
                <div className="h-16 bg-brand-darker rounded-xl mb-2 flex items-center justify-center">
                  <span className="text-2xl opacity-50">🍽️</span>
                </div>
                <p className="text-xs font-medium line-clamp-2 mb-1">{product.name}</p>
                <p className="text-sm font-bold text-brand-orange">{formatCurrency(product.price)}</p>
              </motion.button>
            )
          })}
        </div>
      </div>
    </>
  )
}

interface CartPanelProps {
  cart: CartItem[]; onUpdateQty: (id: string, qty: number) => void; onClear: () => void
  existingItems: any[]; existingTotal: number
  cartSubtotal: number; cartTax: number; cartTotal: number; grandTotal: number
  onPay: () => void; label: string
}

function CartPanel({ cart, onUpdateQty, onClear, existingItems, existingTotal, cartSubtotal, cartTax, cartTotal, grandTotal, onPay, label }: CartPanelProps) {
  return (
    <div className="w-80 flex flex-col bg-brand-card border border-brand-border rounded-2xl overflow-hidden flex-shrink-0">
      <div className="p-4 border-b border-brand-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-brand-orange" />
          <span className="font-semibold text-sm">Ticket — {label}</span>
        </div>
        {cart.length > 0 && (
          <button onClick={onClear} className="text-xs text-red-400 hover:text-red-300">Vider</button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {/* Existing open orders items */}
        {existingItems.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-brand-muted font-medium mb-2 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Déjà commandé
            </p>
            {existingItems.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between py-1 text-xs text-brand-muted">
                <span className="flex-1 truncate">{item.quantity}× {item.product?.name}</span>
                <span className="ml-2">{formatCurrency(item.totalPrice)}</span>
              </div>
            ))}
            <div className="flex justify-between text-xs font-medium text-brand-muted border-t border-brand-border pt-1 mt-1">
              <span>Sous-total existant</span>
              <span>{formatCurrency(existingTotal)}</span>
            </div>
          </div>
        )}

        {/* New cart items */}
        {cart.length > 0 && (
          <div>
            {existingItems.length > 0 && (
              <p className="text-xs text-brand-muted font-medium mb-2 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Nouveaux articles
              </p>
            )}
            <AnimatePresence>
              {cart.map((item) => (
                <motion.div key={item.productId}
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-2 p-2 rounded-xl bg-white/3 mb-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.name}</p>
                    <p className="text-xs text-brand-orange">{formatCurrency(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => onUpdateQty(item.productId, item.quantity - 1)}
                      className="w-6 h-6 rounded-lg bg-brand-border flex items-center justify-center hover:bg-red-500/20">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-5 text-center text-xs font-bold">{item.quantity}</span>
                    <button onClick={() => onUpdateQty(item.productId, item.quantity + 1)}
                      className="w-6 h-6 rounded-lg bg-brand-border flex items-center justify-center hover:bg-brand-orange/20">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-xs font-bold w-14 text-right">{formatCurrency(item.price * item.quantity)}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {existingItems.length === 0 && cart.length === 0 && (
          <div className="text-center py-10 text-brand-muted">
            <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-xs">Aucun article</p>
            <p className="text-xs opacity-60">Ajoutez des produits</p>
          </div>
        )}
      </div>

      {(existingItems.length > 0 || cart.length > 0) && (
        <div className="p-4 border-t border-brand-border space-y-1.5">
          {cart.length > 0 && (
            <>
              <div className="flex justify-between text-xs text-brand-muted">
                <span>Nouveaux articles</span><span>{formatCurrency(cartSubtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-brand-muted">
                <span>TVA (10%)</span><span>{formatCurrency(cartTax)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-bold text-base border-t border-brand-border pt-2">
            <span>Total ticket</span>
            <span className="text-brand-orange">{formatCurrency(grandTotal)}</span>
          </div>
          <button onClick={onPay} className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-1">
            <CreditCard className="w-4 h-4" /> Encaisser
          </button>
        </div>
      )}
    </div>
  )
}

function PaymentModal({ show, onClose, total, method, onMethod, onConfirm }: {
  show: boolean; onClose: () => void; total: number
  method: 'CASH' | 'CARD'; onMethod: (m: 'CASH' | 'CARD') => void
  onConfirm: () => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
            className="glass-card p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-xl">Paiement</h2>
              <button onClick={onClose} className="text-brand-muted hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="text-center mb-6">
              <p className="text-brand-muted text-sm mb-1">Total à encaisser</p>
              <p className="text-4xl font-bold text-brand-orange">{formatCurrency(total)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {([['CASH', '💵', 'Espèces'], ['CARD', '💳', 'Carte']] as const).map(([m, icon, label]) => (
                <button key={m} onClick={() => onMethod(m)}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${method === m ? 'border-brand-orange bg-brand-orange/10' : 'border-brand-border'}`}>
                  <p className="text-2xl mb-1">{icon}</p>
                  <p className="text-sm font-medium">{label}</p>
                </button>
              ))}
            </div>
            <button
              disabled={loading}
              onClick={async () => { setLoading(true); await onConfirm(); setLoading(false) }}
              className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? 'Traitement...' : `Confirmer — ${formatCurrency(total)}`}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

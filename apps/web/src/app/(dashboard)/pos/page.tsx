'use client'

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Plus, Minus, ShoppingCart, CreditCard,
  Banknote, Receipt, Table2, X, ChevronLeft, Users,
  ChefHat, CheckCircle2, Clock, Send,
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency } from '@restaurant/utils'
import { toast } from 'sonner'

interface CartItem { productId: string; name: string; price: number; quantity: number }

const TABLE_STATUS_STYLE: Record<string, { border: string; bg: string; text: string; label: string }> = {
  AVAILABLE: { border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Libre' },
  OCCUPIED:  { border: 'border-red-500/40',     bg: 'bg-red-500/10',     text: 'text-red-400',     label: 'Occupée' },
  RESERVED:  { border: 'border-blue-500/40',    bg: 'bg-blue-500/10',    text: 'text-blue-400',    label: 'Réservée' },
  CLEANING:  { border: 'border-amber-500/40',   bg: 'bg-amber-500/10',   text: 'text-amber-400',   label: 'Nettoyage' },
  BLOCKED:   { border: 'border-gray-500/40',    bg: 'bg-gray-500/10',    text: 'text-gray-400',    label: 'Bloquée' },
}

const ORDER_STATUS_STYLE: Record<string, { label: string; color: string; icon: any }> = {
  PENDING:   { label: 'En attente',     color: 'text-amber-400',  icon: Clock },
  CONFIRMED: { label: 'Confirmée',      color: 'text-blue-400',   icon: ChefHat },
  PREPARING: { label: 'En préparation', color: 'text-purple-400', icon: ChefHat },
  READY:     { label: 'Prête',          color: 'text-emerald-400',icon: CheckCircle2 },
}

export default function POSPage() {
  const [activeTable, setActiveTable]         = useState<any>(null)
  const [cart, setCart]                       = useState<CartItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [search, setSearch]                   = useState('')
  const [showPayment, setShowPayment]         = useState(false)
  const [paymentMethod, setPaymentMethod]     = useState<'CASH' | 'CARD'>('CASH')
  const [orderType, setOrderType]             = useState<'DINE_IN' | 'TAKEAWAY'>('DINE_IN')
  const [sending, setSending]                 = useState(false)
  const [paying, setPaying]                   = useState(false)
  const qc = useQueryClient()

  const { data: tables = [] } = useQuery({
    queryKey: ['pos-tables'],
    queryFn: () => api.get('/tables').then(r => r.data.data ?? []),
    refetchInterval: 15_000,
  })

  const { data: openOrders = [], refetch: refetchOrders } = useQuery({
    queryKey: ['pos-table-orders', activeTable?.id],
    queryFn: () =>
      api.get(`/orders?tableId=${activeTable!.id}&status=PENDING,CONFIRMED,PREPARING,READY&limit=50`)
        .then(r => r.data.data ?? []),
    enabled: !!activeTable?.id,
    refetchInterval: 20_000,
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

  const filteredProducts = useMemo(() =>
    (products as any[]).filter((p: any) => !search || p.name.toLowerCase().includes(search.toLowerCase())),
    [products, search])

  // Ticket summary
  const existingItems   = useMemo(() => (openOrders as any[]).flatMap((o: any) => o.items ?? []), [openOrders])
  const existingTotal   = useMemo(() => (openOrders as any[]).reduce((s: number, o: any) => s + (o.totalAmount ?? 0), 0), [openOrders])
  const cartSubtotal    = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const cartTax         = cartSubtotal * 0.1
  const cartTotal       = cartSubtotal + cartTax
  const grandTotal      = existingTotal + cartTotal

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

  // ── ENVOYER EN CUISINE — crée la commande sans payer ─────────────────────
  async function sendToKitchen() {
    if (cart.length === 0) { toast.error('Panier vide'); return }
    setSending(true)
    try {
      const res = await api.post('/orders', {
        type: activeTable ? 'DINE_IN' : orderType,
        tableId: activeTable?.id,
        guestCount: activeTable?.capacity ?? 1,
        items: cart.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.price })),
      })
      const order = res.data.data
      await api.patch(`/orders/${order.id}/status`, { status: 'CONFIRMED' })
      setCart([])
      await refetchOrders()
      qc.invalidateQueries({ queryKey: ['pos-tables'] })
      toast.success(`Commande ${order.orderNumber} envoyée en cuisine`)
    } catch {
      toast.error('Erreur lors de l\'envoi en cuisine')
    } finally {
      setSending(false)
    }
  }

  // ── ENCAISSER — paye toutes les commandes ouvertes ────────────────────────
  async function handleFullPayment() {
    setPaying(true)
    try {
      // 1. Si articles dans le panier, créer + confirmer d'abord
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
        await api.patch(`/orders/${newOrder.id}/status`, { status: 'COMPLETED' })
      }

      // 2. Payer toutes les commandes ouvertes existantes
      for (const order of openOrders as any[]) {
        if (!['PENDING','CONFIRMED','PREPARING','READY'].includes(order.status)) continue
        await api.post('/payments', { orderId: order.id, amount: order.totalAmount, method: paymentMethod })
        await api.patch(`/orders/${order.id}/status`, { status: 'COMPLETED' })
      }

      toast.success(`Table ${activeTable?.number ?? ''} — ${formatCurrency(grandTotal)} encaissé`)
      setCart([])
      setShowPayment(false)
      setActiveTable(null)
      setOrderType('DINE_IN')
      qc.invalidateQueries({ queryKey: ['pos-tables'] })
      qc.invalidateQueries({ queryKey: ['pos-table-orders'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
    } catch {
      toast.error('Erreur lors du paiement')
    } finally {
      setPaying(false)
    }
  }

  // ── VIEW 1 : grille de tables ─────────────────────────────────────────────
  if (!activeTable && orderType === 'DINE_IN') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Table2 className="w-6 h-6 text-brand-orange" /> Plan de salle
            </h1>
            <p className="text-brand-muted text-sm">Sélectionnez une table pour ouvrir son ticket</p>
          </div>
          <button onClick={() => setOrderType('TAKEAWAY')} className="btn-secondary flex items-center gap-2 text-sm">
            🥡 À emporter
          </button>
        </div>

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
              <motion.button key={table.id} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => { setActiveTable(table); setCart([]); setSearch(''); setSelectedCategory('') }}
                className={`glass-card p-4 text-center border-2 ${s.border} ${s.bg} transition-all`}
              >
                <p className="text-xl font-bold mb-1">{table.number}</p>
                {table.name && <p className="text-xs text-brand-muted truncate mb-1">{table.name}</p>}
                <p className={`text-xs font-medium ${s.text}`}>{s.label}</p>
                <div className="flex items-center justify-center gap-1 mt-1 text-xs text-brand-muted">
                  <Users className="w-3 h-3" />{table.capacity}
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── VIEW 2 : ticket table ou à emporter ───────────────────────────────────
  const tableStyle = TABLE_STATUS_STYLE[activeTable?.status] ?? TABLE_STATUS_STYLE['AVAILABLE']!

  return (
    <div className="flex h-[calc(100vh-10rem)] gap-4">

      {/* Produits */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => { setActiveTable(null); setCart([]); setOrderType('DINE_IN') }}
            className="p-2 rounded-xl hover:bg-brand-border transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          {activeTable ? (
            <div className={`px-3 py-1.5 rounded-xl border ${tableStyle.border} ${tableStyle.bg} flex items-center gap-2`}>
              <Table2 className={`w-4 h-4 ${tableStyle.text}`} />
              <span className="font-bold">Table {activeTable.number}</span>
              {activeTable.name && <span className="text-brand-muted text-sm">— {activeTable.name}</span>}
              <span className={`text-xs ${tableStyle.text}`}>{tableStyle.label}</span>
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-xl border border-brand-border bg-brand-border/30 flex items-center gap-2">
              <span className="font-bold">🥡 À emporter</span>
            </div>
          )}
          {(openOrders as any[]).length > 0 && (
            <span className="text-xs text-brand-muted">
              {(openOrders as any[]).length} commande(s) en cours
            </span>
          )}
        </div>

        {/* Recherche */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un produit..." className="input-field pl-10" />
        </div>

        {/* Catégories */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 flex-shrink-0">
          <button onClick={() => setSelectedCategory('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap border transition-all ${!selectedCategory ? 'bg-brand-orange text-white border-brand-orange' : 'border-brand-border text-brand-muted'}`}>
            Tout
          </button>
          {(categories as any[]).map((cat: any) => (
            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap border transition-all flex items-center gap-1.5 ${selectedCategory === cat.id ? 'bg-brand-orange text-white border-brand-orange' : 'border-brand-border text-brand-muted'}`}>
              {cat.icon && <span>{cat.icon}</span>}{cat.name}
            </button>
          ))}
        </div>

        {/* Grille produits */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredProducts.map((product: any) => {
              const inCart = cart.find(i => i.productId === product.id)
              return (
                <motion.button key={product.id} whileTap={{ scale: 0.95 }}
                  onClick={() => addToCart(product)}
                  className="glass-card p-3 text-left hover:border-brand-orange/50 transition-all relative">
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
      </div>

      {/* Ticket */}
      <div className="w-80 flex flex-col bg-brand-card border border-brand-border rounded-2xl overflow-hidden flex-shrink-0">

        {/* En-tête ticket */}
        <div className="p-4 border-b border-brand-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-brand-orange" />
            <span className="font-semibold text-sm">
              {activeTable ? `Ticket — Table ${activeTable.number}` : 'À emporter'}
            </span>
          </div>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-xs text-red-400 hover:text-red-300">Vider</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">

          {/* Commandes déjà envoyées en cuisine */}
          {(openOrders as any[]).length > 0 && (
            <div>
              <p className="text-xs text-brand-muted font-medium mb-2 flex items-center gap-1">
                <ChefHat className="w-3 h-3" /> En cuisine
              </p>
              {(openOrders as any[]).map((order: any) => {
                const st = ORDER_STATUS_STYLE[order.status] ?? ORDER_STATUS_STYLE['CONFIRMED']!
                const Icon = st.icon
                return (
                  <div key={order.id} className="mb-2 bg-white/3 rounded-xl p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-brand-muted">{order.orderNumber}</span>
                      <span className={`text-xs flex items-center gap-1 ${st.color}`}>
                        <Icon className="w-3 h-3" /> {st.label}
                      </span>
                    </div>
                    {(order.items ?? []).map((item: any) => (
                      <div key={item.id} className="flex justify-between text-xs py-0.5 text-brand-muted">
                        <span>{item.quantity}× {item.product?.name}</span>
                        <span>{formatCurrency(item.totalPrice)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-medium pt-1 border-t border-brand-border mt-1">
                      <span>Sous-total</span>
                      <span>{formatCurrency(order.totalAmount)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Nouveaux articles dans le panier */}
          {cart.length > 0 && (
            <div>
              <p className="text-xs text-brand-muted font-medium mb-2 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Nouvelle commande
              </p>
              <AnimatePresence>
                {cart.map(item => (
                  <motion.div key={item.productId}
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    className="flex items-center gap-2 p-2 rounded-xl bg-brand-orange/5 border border-brand-orange/20 mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.name}</p>
                      <p className="text-xs text-brand-orange">{formatCurrency(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.productId, item.quantity - 1)}
                        className="w-6 h-6 rounded-lg bg-brand-border flex items-center justify-center hover:bg-red-500/20">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-5 text-center text-xs font-bold">{item.quantity}</span>
                      <button onClick={() => updateQty(item.productId, item.quantity + 1)}
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

          {(openOrders as any[]).length === 0 && cart.length === 0 && (
            <div className="text-center py-10 text-brand-muted">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-xs">Table vide</p>
              <p className="text-xs opacity-60">Ajoutez des articles</p>
            </div>
          )}
        </div>

        {/* Total + boutons */}
        <div className="p-4 border-t border-brand-border space-y-2">
          {(openOrders as any[]).length > 0 && (
            <div className="flex justify-between text-xs text-brand-muted">
              <span>Déjà commandé</span>
              <span>{formatCurrency(existingTotal)}</span>
            </div>
          )}
          {cart.length > 0 && (
            <div className="flex justify-between text-xs text-brand-muted">
              <span>Panier actuel (TVA incl.)</span>
              <span>{formatCurrency(cartTotal)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base border-t border-brand-border pt-2">
            <span>Total ticket</span>
            <span className="text-brand-orange">{formatCurrency(grandTotal)}</span>
          </div>

          {/* Envoyer en cuisine — visible si panier non vide */}
          {cart.length > 0 && (
            <button onClick={sendToKitchen} disabled={sending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold transition-colors">
              <Send className="w-4 h-4" />
              {sending ? 'Envoi...' : 'Envoyer en cuisine'}
            </button>
          )}

          {/* Encaisser — visible si commandes ouvertes */}
          {((openOrders as any[]).length > 0 || (!activeTable && cart.length > 0)) && (
            <button
              onClick={() => {
                if ((openOrders as any[]).length === 0 && cart.length === 0) return
                setShowPayment(true)
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl btn-primary font-semibold">
              <CreditCard className="w-4 h-4" />
              L'addition — {formatCurrency(grandTotal)}
            </button>
          )}
        </div>
      </div>

      {/* Modal paiement */}
      <AnimatePresence>
        {showPayment && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="glass-card p-6 w-full max-w-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-bold text-xl">L'addition</h2>
                <button onClick={() => setShowPayment(false)} className="text-brand-muted hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {activeTable && (
                <p className="text-center text-brand-muted text-sm mb-2">Table {activeTable.number}</p>
              )}
              <div className="text-center mb-6">
                <p className="text-brand-muted text-xs mb-1">Total à encaisser</p>
                <p className="text-4xl font-bold text-brand-orange">{formatCurrency(grandTotal)}</p>
                {(openOrders as any[]).length > 0 && (
                  <p className="text-xs text-brand-muted mt-1">{(openOrders as any[]).length} commande(s) soldée(s)</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {([['CASH', '💵', 'Espèces'], ['CARD', '💳', 'Carte']] as const).map(([m, icon, label]) => (
                  <button key={m} onClick={() => setPaymentMethod(m)}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${paymentMethod === m ? 'border-brand-orange bg-brand-orange/10' : 'border-brand-border'}`}>
                    <p className="text-2xl mb-1">{icon}</p>
                    <p className="text-sm font-medium">{label}</p>
                  </button>
                ))}
              </div>

              <button onClick={handleFullPayment} disabled={paying}
                className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2 disabled:opacity-50">
                {paying ? 'Traitement...' : `Confirmer — ${formatCurrency(grandTotal)}`}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

'use client'

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Plus, Minus, ShoppingCart, CreditCard,
  Receipt, Table2, X, Users, ChefHat, CheckCircle2, Clock, Send,
  ArrowLeft,
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency } from '@restaurant/utils'
import { toast } from 'sonner'

interface CartItem { productId: string; name: string; price: number; quantity: number }

const TABLE_COLOR: Record<string, string> = {
  AVAILABLE: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
  OCCUPIED:  'border-red-500/50 bg-red-500/10 text-red-300',
  RESERVED:  'border-blue-500/50 bg-blue-500/10 text-blue-300',
  CLEANING:  'border-amber-500/50 bg-amber-500/10 text-amber-300',
  BLOCKED:   'border-gray-500/50 bg-gray-500/10 text-gray-400',
}

const TABLE_LABEL: Record<string, string> = {
  AVAILABLE: 'Libre', OCCUPIED: 'Occupée', RESERVED: 'Réservée',
  CLEANING: 'Nettoyage', BLOCKED: 'Bloquée',
}

const ORDER_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  PENDING:   { label: 'En attente',     color: 'text-amber-400',  icon: Clock },
  CONFIRMED: { label: 'Confirmée',      color: 'text-blue-400',   icon: ChefHat },
  PREPARING: { label: 'En préparation', color: 'text-purple-400', icon: ChefHat },
  READY:     { label: 'Prête',          color: 'text-emerald-400',icon: CheckCircle2 },
}

export default function POSPage() {
  const [activeTable, setActiveTable]           = useState<any>(null)
  const [orderType, setOrderType]               = useState<'DINE_IN' | 'TAKEAWAY'>('DINE_IN')
  const [cart, setCart]                         = useState<CartItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [search, setSearch]                     = useState('')
  const [showPayment, setShowPayment]           = useState(false)
  const [paymentMethod, setPaymentMethod]       = useState<string>('CASH')
  const [sending, setSending]                   = useState(false)
  const [paying, setPaying]                     = useState(false)
  const [mobileView, setMobileView]             = useState<'products' | 'cart'>('products')
  const qc = useQueryClient()

  const { data: tables = [] } = useQuery({
    queryKey: ['pos-tables'],
    queryFn: () => api.get('/tables').then(r => r.data.data ?? []),
    refetchInterval: 120_000,
    staleTime: 30_000,
  })

  const { data: openOrders = [], refetch: refetchOrders } = useQuery({
    queryKey: ['pos-table-orders', activeTable?.id],
    queryFn: () =>
      api.get(`/orders?tableId=${activeTable!.id}&status=PENDING,CONFIRMED,PREPARING,READY&limit=50`)
        .then(r => r.data.data ?? []),
    enabled: !!activeTable?.id,
    refetchInterval: 60_000,
    staleTime: 20_000,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then(r => r.data.data ?? []),
    staleTime: 600_000,
  })

  const { data: products = [] } = useQuery({
    queryKey: ['products', selectedCategory],
    queryFn: () =>
      api.get(`/products?isAvailable=true&limit=100${selectedCategory ? `&categoryId=${selectedCategory}` : ''}`)
        .then(r => r.data.data ?? []),
    staleTime: 300_000,
  })

  const filteredProducts = useMemo(() =>
    (products as any[]).filter((p: any) => !search || p.name.toLowerCase().includes(search.toLowerCase())),
    [products, search])

  const existingTotal = useMemo(() =>
    (openOrders as any[]).reduce((s: number, o: any) => s + (o.totalAmount ?? 0), 0), [openOrders])

  const cartSubtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const cartTax      = cartSubtotal * 0.1
  const cartTotal    = cartSubtotal + cartTax
  const grandTotal   = existingTotal + cartTotal

  function selectTable(table: any) {
    if (activeTable?.id === table.id) return
    setActiveTable(table)
    setCart([])
    setOrderType('DINE_IN')
  }

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

  async function sendToKitchen() {
    if (cart.length === 0) { toast.error('Panier vide'); return }
    if (orderType === 'DINE_IN' && !activeTable) { toast.error('Sélectionnez une table'); return }
    setSending(true)
    try {
      const res = await api.post('/orders', {
        type: orderType,
        status: 'CONFIRMED',
        tableId: activeTable?.id,
        guestCount: activeTable?.capacity > 0 ? activeTable.capacity : 1,
        items: cart.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.price })),
      })
      setCart([])
      await refetchOrders()
      qc.invalidateQueries({ queryKey: ['pos-tables'] })
      toast.success(`Commande ${res.data.data.orderNumber} envoyée en cuisine`)
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? 'Erreur lors de l\'envoi'
      toast.error(msg)
    } finally {
      setSending(false)
    }
  }

  async function handleFullPayment() {
    setPaying(true)
    try {
      if (cart.length > 0) {
        const res = await api.post('/orders', {
          type: orderType,
          status: 'CONFIRMED',
          tableId: activeTable?.id,
          guestCount: activeTable?.capacity > 0 ? activeTable.capacity : 1,
          items: cart.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.price })),
        })
        const newOrder = res.data.data
        await api.post('/payments', { orderId: newOrder.id, amount: newOrder.totalAmount, method: paymentMethod })
        await api.patch(`/orders/${newOrder.id}/status`, { status: 'COMPLETED' })
      }
      for (const order of openOrders as any[]) {
        await api.post('/payments', { orderId: order.id, amount: order.totalAmount, method: paymentMethod })
        await api.patch(`/orders/${order.id}/status`, { status: 'COMPLETED' })
      }
      toast.success(`${activeTable ? `Table ${activeTable.number}` : 'Commande'} — ${formatCurrency(grandTotal)} encaissé`)
      setCart([])
      setShowPayment(false)
      setActiveTable(null)
      setOrderType('DINE_IN')
      qc.invalidateQueries({ queryKey: ['pos-tables'] })
      qc.invalidateQueries({ queryKey: ['pos-table-orders'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? 'Erreur lors du paiement'
      toast.error(msg)
    } finally {
      setPaying(false)
    }
  }

  // Ticket panel content — shared between desktop sidebar and mobile drawer
  const ticketContent = (
    <>
      {/* En-tête ticket */}
      <div className="p-3 border-b border-brand-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Back button on mobile */}
          <button onClick={() => setMobileView('products')}
            className="md:hidden p-1 text-brand-muted hover:text-white mr-1">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Receipt className="w-4 h-4 text-brand-orange" />
          <span className="font-semibold text-sm">
            {activeTable ? `Table ${activeTable.number}` : orderType === 'TAKEAWAY' ? '🥡 Emporté' : 'Aucune table'}
          </span>
        </div>
        {cart.length > 0 && (
          <button onClick={() => setCart([])} className="text-xs text-red-400 hover:text-red-300">Vider</button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Commandes en cuisine */}
        {(openOrders as any[]).length > 0 && (
          <div>
            <p className="text-xs text-brand-muted font-medium mb-2 flex items-center gap-1">
              <ChefHat className="w-3 h-3" /> En cuisine
            </p>
            {(openOrders as any[]).map((order: any) => {
              const st = ORDER_STATUS[order.status] ?? ORDER_STATUS['CONFIRMED']!
              const Icon = st.icon
              return (
                <div key={order.id} className="mb-2 bg-white/3 rounded-xl p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-brand-muted">{order.orderNumber}</span>
                    <span className={`text-xs flex items-center gap-1 ${st.color}`}>
                      <Icon className="w-3 h-3" />{st.label}
                    </span>
                  </div>
                  {(order.items ?? []).map((item: any) => (
                    <div key={item.id} className="flex justify-between text-xs py-0.5 text-brand-muted">
                      <span>{item.quantity}× {item.product?.name}</span>
                      <span>{formatCurrency(item.totalPrice)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-medium pt-1 border-t border-brand-border mt-1">
                    <span>S-total</span><span>{formatCurrency(order.totalAmount)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Panier actuel */}
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
                      className="w-7 h-7 rounded-lg bg-brand-border flex items-center justify-center hover:bg-red-500/20 active:scale-95">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                    <button onClick={() => updateQty(item.productId, item.quantity + 1)}
                      className="w-7 h-7 rounded-lg bg-brand-border flex items-center justify-center hover:bg-brand-orange/20 active:scale-95">
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
            <p className="text-xs">{activeTable ? 'Table vide' : 'Sélectionnez une table'}</p>
          </div>
        )}
      </div>

      {/* Totaux + boutons */}
      <div className="p-3 border-t border-brand-border space-y-2 flex-shrink-0">
        {(openOrders as any[]).length > 0 && (
          <div className="flex justify-between text-xs text-brand-muted">
            <span>En cuisine</span><span>{formatCurrency(existingTotal)}</span>
          </div>
        )}
        {cart.length > 0 && (
          <div className="flex justify-between text-xs text-brand-muted">
            <span>Panier (TVA incl.)</span><span>{formatCurrency(cartTotal)}</span>
          </div>
        )}
        {((openOrders as any[]).length > 0 || cart.length > 0) && (
          <div className="flex justify-between font-bold text-sm border-t border-brand-border pt-2">
            <span>Total ticket</span>
            <span className="text-brand-orange">{formatCurrency(grandTotal)}</span>
          </div>
        )}
        {cart.length > 0 && (
          <button onClick={sendToKitchen} disabled={sending}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors active:scale-98">
            <Send className="w-4 h-4" />
            {sending ? 'Envoi...' : 'Envoyer la commande'}
          </button>
        )}
        {((openOrders as any[]).length > 0 || (orderType === 'TAKEAWAY' && cart.length > 0)) && (
          <button onClick={() => setShowPayment(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl btn-primary text-sm font-semibold active:scale-98">
            <CreditCard className="w-4 h-4" />
            L'addition — {formatCurrency(grandTotal)}
          </button>
        )}
      </div>
    </>
  )

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)] gap-3">

      {/* ── Sélecteur de tables ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-shrink-0 scrollbar-hide">
        <button
          onClick={() => { setActiveTable(null); setOrderType('TAKEAWAY'); setCart([]) }}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
            orderType === 'TAKEAWAY' && !activeTable
              ? 'bg-brand-orange border-brand-orange text-white'
              : 'border-brand-border text-brand-muted hover:border-brand-orange/40'
          }`}
        >
          🥡 Emporté
        </button>
        <div className="w-px h-6 bg-brand-border flex-shrink-0" />
        {(tables as any[]).map((table: any) => {
          const isActive = activeTable?.id === table.id
          const colorClass = isActive
            ? 'bg-brand-orange border-brand-orange text-white'
            : (TABLE_COLOR[table.status] ?? TABLE_COLOR['AVAILABLE']!)
          return (
            <button key={table.id} onClick={() => selectTable(table)}
              className={`flex-shrink-0 flex flex-col items-center px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${colorClass}`}>
              <span className="flex items-center gap-1">
                <Table2 className="w-3 h-3" />T{table.number}
              </span>
              <span className="font-normal opacity-80">{TABLE_LABEL[table.status] ?? ''}</span>
            </button>
          )
        })}
      </div>

      {/* ── Corps principal ─────────────────────────────────────────────── */}
      <div className="flex flex-1 gap-4 overflow-hidden min-h-0">

        {/* ── Colonne produits (desktop: toujours visible; mobile: masqué quand cart ouvert) */}
        <div className={`flex-1 flex flex-col min-w-0 overflow-hidden ${mobileView === 'cart' ? 'hidden md:flex' : 'flex'}`}>
          {/* Recherche */}
          <div className="relative mb-3 flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un produit..." className="input-field pl-10" />
          </div>

          {/* Catégories */}
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1 flex-shrink-0 scrollbar-hide">
            <button onClick={() => setSelectedCategory('')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap border transition-all ${!selectedCategory ? 'bg-brand-orange text-white border-brand-orange' : 'border-brand-border text-brand-muted'}`}>
              Tout
            </button>
            {(categories as any[]).map((cat: any) => (
              <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap border transition-all flex items-center gap-1 ${selectedCategory === cat.id ? 'bg-brand-orange text-white border-brand-orange' : 'border-brand-border text-brand-muted'}`}>
                {cat.icon && <span>{cat.icon}</span>}{cat.name}
              </button>
            ))}
          </div>

          {/* Grille produits */}
          <div className="flex-1 overflow-y-auto pb-20 md:pb-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
              {filteredProducts.map((product: any) => {
                const inCart = cart.find(i => i.productId === product.id)
                return (
                  <motion.button key={product.id} whileTap={{ scale: 0.93 }}
                    onClick={() => addToCart(product)}
                    className="glass-card p-2.5 sm:p-3 text-left hover:border-brand-orange/50 transition-all relative active:scale-95">
                    {inCart && (
                      <span className="absolute top-2 right-2 w-5 h-5 bg-brand-orange rounded-full text-xs font-bold text-white flex items-center justify-center z-10">
                        {inCart.quantity}
                      </span>
                    )}
                    <div className="h-14 sm:h-16 bg-brand-darker rounded-xl mb-2 flex items-center justify-center">
                      <span className="text-xl sm:text-2xl opacity-50">🍽️</span>
                    </div>
                    <p className="text-xs font-medium line-clamp-2 mb-1 leading-tight">{product.name}</p>
                    <p className="text-sm font-bold text-brand-orange">{formatCurrency(product.price)}</p>
                  </motion.button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Ticket — desktop sidebar (toujours visible ≥ md) */}
        <div className="hidden md:flex w-64 lg:w-72 flex-col bg-brand-card border border-brand-border rounded-2xl overflow-hidden flex-shrink-0">
          {ticketContent}
        </div>
      </div>

      {/* ── Ticket — mobile drawer (visible uniquement en mode cart) */}
      <AnimatePresence>
        {mobileView === 'cart' && (
          <motion.div
            key="mobile-cart"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="md:hidden fixed inset-0 z-40 flex flex-col bg-brand-card"
          >
            {ticketContent}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FAB mobile — bouton panier flottant */}
      {mobileView === 'products' && (cart.length > 0 || (openOrders as any[]).length > 0) && (
        <div className="md:hidden fixed bottom-4 left-4 right-4 z-30">
          <motion.button
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            onClick={() => setMobileView('cart')}
            className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl bg-brand-orange shadow-lg shadow-brand-orange/30 text-white font-semibold">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              <span className="text-sm">
                {cart.length > 0 ? `${cart.reduce((s, i) => s + i.quantity, 0)} article${cart.reduce((s, i) => s + i.quantity, 0) > 1 ? 's' : ''}` : 'Voir le ticket'}
              </span>
            </div>
            <span className="text-sm font-bold">{formatCurrency(grandTotal)}</span>
          </motion.button>
        </div>
      )}

      {/* ── Modal paiement */}
      <AnimatePresence>
        {showPayment && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ y: '100%', scale: 1 }} animate={{ y: 0, scale: 1 }} exit={{ y: '100%', scale: 1 }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="glass-card p-6 w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl">
              <div className="w-10 h-1 bg-brand-border rounded-full mx-auto mb-5 sm:hidden" />
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-bold text-xl">L'addition</h2>
                <button onClick={() => setShowPayment(false)} className="text-brand-muted hover:text-white p-1"><X className="w-5 h-5" /></button>
              </div>
              {activeTable && <p className="text-center text-brand-muted text-sm mb-2">Table {activeTable.number}</p>}
              <div className="text-center mb-6">
                <p className="text-brand-muted text-xs mb-1">Total à encaisser</p>
                <p className="text-4xl font-bold text-brand-orange">{formatCurrency(grandTotal)}</p>
                {(openOrders as any[]).length > 0 && (
                  <p className="text-xs text-brand-muted mt-1">{(openOrders as any[]).length} commande(s) soldée(s)</p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 mb-6 max-h-48 overflow-y-auto">
                {([
                  ['CASH',         '💵', 'Espèces'],
                  ['MVOLA',        '📱', 'MVola'],
                  ['ORANGE_MONEY', '🟠', 'Orange Money'],
                  ['AIRTEL_MONEY', '🔴', 'Airtel Money'],
                  ['CARD',         '💳', 'Carte'],
                  ['BNI_MOBILE',   '🏦', 'BNI Mobile'],
                  ['BOA_MOBILE',   '🏦', 'BOA Mobile'],
                  ['VIREMENT',     '🔁', 'Virement'],
                  ['CHEQUE',       '📄', 'Chèque'],
                  ['VOUCHER',      '🎟️', 'Bon'],
                  ['WALLET',       '👜', 'Wallet'],
                ] as const).map(([m, icon, label]) => (
                  <button key={m} onClick={() => setPaymentMethod(m)}
                    className={`p-2.5 rounded-xl border-2 text-center transition-all ${paymentMethod === m ? 'border-brand-orange bg-brand-orange/10' : 'border-brand-border hover:border-brand-orange/40'}`}>
                    <p className="text-xl mb-0.5">{icon}</p>
                    <p className="text-xs font-medium leading-tight">{label}</p>
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

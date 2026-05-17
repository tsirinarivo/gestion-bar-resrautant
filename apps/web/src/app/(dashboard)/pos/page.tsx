'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Plus, Minus, ShoppingCart, CreditCard,
  Receipt, Table2, X, ChefHat, CheckCircle2, Clock, Send,
  ArrowLeft,
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency } from '@restaurant/utils'
import { toast } from 'sonner'

interface CartItem { productId: string; name: string; price: number; quantity: number }

const POS_PAYMENT_METHODS = [
  { value: 'CASH',         label: '💵 Cash' },
  { value: 'MVOLA',        label: '📱 MVola' },
  { value: 'ORANGE_MONEY', label: '🟠 Orange' },
  { value: 'AIRTEL_MONEY', label: '🔴 Airtel' },
  { value: 'CARD',         label: '💳 Carte' },
  { value: 'BNI_MOBILE',   label: '🏦 BNI' },
  { value: 'BOA_MOBILE',   label: '🏦 BOA' },
  { value: 'VIREMENT',     label: '🔁 Virement' },
  { value: 'CHEQUE',       label: '📄 Chèque' },
  { value: 'VOUCHER',      label: '🎟️ Bon' },
  { value: 'WALLET',       label: '👜 Wallet' },
]

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
  const [showReceipt, setShowReceipt]           = useState(false)
  const [sending, setSending]                   = useState(false)
  const [mobileView, setMobileView]             = useState<'products' | 'cart'>('products')

  // Multi-method payment state
  const [paymentMethod, setPaymentMethod]       = useState('CASH')
  const [paymentAmountStr, setPaymentAmountStr] = useState('')
  const [payments, setPayments]                 = useState<{method: string; amount: number}[]>([])
  const [orderQueue, setOrderQueue]             = useState<{id: string; remaining: number}[]>([])
  const [payReady, setPayReady]                 = useState(false)
  const [payDone, setPayDone]                   = useState(false)
  const [paying, setPaying]                     = useState(false)

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

  const cartTotal  = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const grandTotal = existingTotal + cartTotal

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
  const remaining = Math.max(0, grandTotal - totalPaid)

  const methodLabel = (v: string) => POS_PAYMENT_METHODS.find(m => m.value === v)?.label ?? v

  // Init payment queue when modal opens
  useEffect(() => {
    if (!showPayment) return
    setPayments([])
    setPayDone(false)
    setPayReady(false)
    setPaying(true)

    ;(async () => {
      try {
        const queue: {id: string; remaining: number}[] = []
        if (cart.length > 0) {
          const res = await api.post('/orders', {
            type: orderType,
            status: 'CONFIRMED',
            tableId: activeTable?.id,
            guestCount: activeTable?.capacity > 0 ? activeTable.capacity : 1,
            items: cart.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.price })),
          })
          const newOrder = res.data.data
          queue.push({ id: newOrder.id, remaining: newOrder.totalAmount })
        }
        for (const order of openOrders as any[]) {
          queue.push({ id: order.id, remaining: order.totalAmount })
        }
        setOrderQueue(queue)
        const total = queue.reduce((s, q) => s + q.remaining, 0)
        setPaymentAmountStr(String(total))
        setPayReady(true)
      } catch (err: any) {
        toast.error(err?.response?.data?.error ?? err?.message ?? 'Erreur préparation')
        setShowPayment(false)
      } finally {
        setPaying(false)
      }
    })()
  }, [showPayment]) // eslint-disable-line react-hooks/exhaustive-deps

  async function addPayment() {
    const amount = parseFloat(paymentAmountStr)
    if (isNaN(amount) || amount <= 0) { toast.error('Montant invalide'); return }
    if (amount > remaining + 0.01) { toast.error(`Maximum: ${formatCurrency(remaining)}`); return }

    setPaying(true)
    try {
      let toDistribute = amount
      const newQueue = [...orderQueue]

      for (let i = 0; i < newQueue.length && toDistribute > 0.01; i++) {
        if ((newQueue[i]?.remaining ?? 0) <= 0.01) continue
        const pay = Math.min(newQueue[i]!.remaining, toDistribute)
        await api.post('/payments', { orderId: newQueue[i]!.id, amount: pay, method: paymentMethod })
        newQueue[i] = { ...newQueue[i]!, remaining: newQueue[i]!.remaining - pay }
        toDistribute -= pay
      }

      setOrderQueue(newQueue)
      setPayments(prev => [...prev, { method: paymentMethod, amount }])
      const newRemaining = remaining - amount
      setPaymentAmountStr(newRemaining > 0.01 ? String(Math.round(newRemaining)) : '')

      if (newRemaining <= 0.01) {
        setCart([])
        await refetchOrders()
        qc.invalidateQueries({ queryKey: ['pos-tables'] })
        qc.invalidateQueries({ queryKey: ['orders'] })
        setPayDone(true)
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? err?.message ?? 'Erreur paiement')
    } finally {
      setPaying(false)
    }
  }

  function closePayment() {
    if (payDone) {
      setActiveTable(null)
      setOrderType('DINE_IN')
    }
    setShowPayment(false)
  }

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
      toast.error(err?.response?.data?.error ?? err?.message ?? 'Erreur')
    } finally {
      setSending(false)
    }
  }

  // Receipt data
  const allReceiptItems = [
    ...(openOrders as any[]).flatMap((o: any) =>
      (o.items ?? []).map((item: any) => ({
        name: item.product?.name ?? '', qty: item.quantity,
        unitPrice: item.totalPrice / item.quantity, total: item.totalPrice,
      }))),
    ...cart.map(i => ({ name: i.name, qty: i.quantity, unitPrice: i.price, total: i.price * i.quantity })),
  ]

  // Ticket panel content
  const ticketContent = (
    <>
      <div className="p-3 border-b border-brand-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
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

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
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

      <div className="p-3 border-t border-brand-border space-y-2 flex-shrink-0">
        {(openOrders as any[]).length > 0 && (
          <div className="flex justify-between text-xs text-brand-muted">
            <span>En cuisine</span><span>{formatCurrency(existingTotal)}</span>
          </div>
        )}
        {cart.length > 0 && (
          <div className="flex justify-between text-xs text-brand-muted">
            <span>Panier</span><span>{formatCurrency(cartTotal)}</span>
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
            {sending ? 'Envoi...' : 'Envoyer en cuisine'}
          </button>
        )}
        {((openOrders as any[]).length > 0 || cart.length > 0) && (
          <div className="flex gap-2">
            <button onClick={() => setShowReceipt(true)}
              className="flex items-center justify-center gap-1 px-3 py-3 rounded-xl bg-brand-card border border-brand-border hover:border-brand-orange/40 text-sm font-semibold whitespace-nowrap">
              🧾 Reçu
            </button>
            {((openOrders as any[]).length > 0 || (orderType === 'TAKEAWAY' && cart.length > 0)) && (
              <button onClick={() => setShowPayment(true)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl btn-primary text-sm font-semibold active:scale-98">
                <CreditCard className="w-4 h-4" />
                L'addition — {formatCurrency(grandTotal)}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)] gap-3">

      {/* ── Sélecteur de tables */}
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
          return (
            <button key={table.id} onClick={() => selectTable(table)}
              className={`flex-shrink-0 flex flex-col items-center px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                isActive ? 'bg-brand-orange border-brand-orange text-white' : (TABLE_COLOR[table.status] ?? TABLE_COLOR['AVAILABLE']!)
              }`}>
              <span className="flex items-center gap-1"><Table2 className="w-3 h-3" />T{table.number}</span>
              <span className="font-normal opacity-80">{TABLE_LABEL[table.status] ?? ''}</span>
            </button>
          )
        })}
      </div>

      {/* ── Corps principal */}
      <div className="flex flex-1 gap-4 overflow-hidden min-h-0">

        <div className={`flex-1 flex flex-col min-w-0 overflow-hidden ${mobileView === 'cart' ? 'hidden md:flex' : 'flex'}`}>
          <div className="relative mb-3 flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un produit..." className="input-field pl-10" />
          </div>

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

        {/* Desktop sidebar */}
        <div className="hidden md:flex w-64 lg:w-72 flex-col bg-brand-card border border-brand-border rounded-2xl overflow-hidden flex-shrink-0">
          {ticketContent}
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileView === 'cart' && (
          <motion.div key="mobile-cart"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="md:hidden fixed inset-0 z-40 flex flex-col bg-brand-card">
            {ticketContent}
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB mobile */}
      {mobileView === 'products' && (cart.length > 0 || (openOrders as any[]).length > 0) && (
        <div className="md:hidden fixed bottom-4 left-4 right-4 z-30">
          <motion.button
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            onClick={() => setMobileView('cart')}
            className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl bg-brand-orange shadow-lg shadow-brand-orange/30 text-white font-semibold">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              <span className="text-sm">
                {cart.length > 0 ? `${cart.reduce((s, i) => s + i.quantity, 0)} article(s)` : 'Voir le ticket'}
              </span>
            </div>
            <span className="text-sm font-bold">{formatCurrency(grandTotal)}</span>
          </motion.button>
        </div>
      )}

      {/* ── Modal reçu */}
      <AnimatePresence>
        {showReceipt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="w-full sm:max-w-sm bg-white text-gray-900 rounded-t-3xl sm:rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-100">
                <span className="text-sm font-semibold text-gray-600">Reçu</span>
                <button onClick={() => setShowReceipt(false)} className="text-gray-400 hover:text-gray-700 text-xl w-8 h-8 flex items-center justify-center">&times;</button>
              </div>
              <div className="p-5 font-mono text-sm">
                <div className="text-center mb-4">
                  <p className="text-lg font-bold">🍽️ RestaurantOS</p>
                  <p className="text-xs text-gray-500">{activeTable ? `Table ${activeTable.number}` : 'Emporté'}</p>
                </div>
                <div className="border-t border-dashed border-gray-400 my-3" />
                {allReceiptItems.map((item, i) => (
                  <div key={i} className="flex justify-between py-0.5">
                    <span>{item.qty}× {item.name}</span>
                    <span className="font-semibold">{formatCurrency(item.total)}</span>
                  </div>
                ))}
                <div className="border-t border-dashed border-gray-400 my-3" />
                <div className="flex justify-between font-bold text-base">
                  <span>TOTAL</span><span>{formatCurrency(grandTotal)}</span>
                </div>
                <div className="border-t border-dashed border-gray-400 my-3" />
                <p className="text-center text-xs text-gray-400">Merci de votre visite !</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal paiement multi-méthodes */}
      <AnimatePresence>
        {showPayment && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="glass-card w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl max-h-[95vh] overflow-y-auto">
              <div className="p-4">
                <div className="w-10 h-1 bg-brand-border rounded-full mx-auto mb-3 sm:hidden" />

                {payDone ? (
                  <div className="text-center py-2">
                    <p className="text-4xl mb-2">✅</p>
                    <p className="text-lg font-bold mb-0.5">Addition soldée</p>
                    <p className="text-brand-muted text-sm mb-3">{formatCurrency(grandTotal)} encaissé</p>
                    <div className="bg-white/5 rounded-xl p-3 mb-4 text-left space-y-1">
                      {payments.map((p, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-brand-muted">{methodLabel(p.method)}</span>
                          <span className="font-semibold">{formatCurrency(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={closePayment} className="btn-primary w-full py-3">Fermer</button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-bold text-base">
                        L'addition{activeTable ? ` — Table ${activeTable.number}` : ''}
                      </h2>
                      <button onClick={() => setShowPayment(false)} className="text-brand-muted hover:text-white p-1">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Totaux */}
                    <div className="grid grid-cols-3 gap-1 bg-white/5 rounded-xl px-3 py-2 mb-3 text-center">
                      <div>
                        <p className="text-brand-muted text-[10px]">Total</p>
                        <p className="font-bold text-sm">{formatCurrency(grandTotal)}</p>
                      </div>
                      <div>
                        <p className="text-brand-muted text-[10px]">Payé</p>
                        <p className="font-bold text-sm text-green-400">{formatCurrency(totalPaid)}</p>
                      </div>
                      <div>
                        <p className="text-brand-muted text-[10px]">Reste</p>
                        <p className="font-bold text-sm text-brand-orange">{formatCurrency(remaining)}</p>
                      </div>
                    </div>

                    {/* Paiements ajoutés */}
                    {payments.length > 0 && (
                      <div className="bg-white/5 rounded-xl px-2 py-1.5 mb-2 space-y-1">
                        {payments.map((p, i) => (
                          <div key={i} className="flex justify-between text-xs px-1">
                            <span className="text-brand-muted">{methodLabel(p.method)}</span>
                            <span className="text-green-400 font-semibold">{formatCurrency(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {!payReady ? (
                      <p className="text-center text-brand-muted py-4 text-sm">
                        {paying ? '⏳ Préparation…' : ''}
                      </p>
                    ) : (
                      <>
                        <div className="mb-2">
                          <label className="text-[10px] text-brand-muted mb-0.5 block">Montant (Ar)</label>
                          <input type="number" min="1" step="1"
                            value={paymentAmountStr}
                            onChange={e => setPaymentAmountStr(e.target.value)}
                            placeholder={String(Math.round(remaining))}
                            className="input-field text-lg font-bold" />
                        </div>

                        {/* Grille méthodes — 4 colonnes, tout visible sans scroll */}
                        <div className="grid grid-cols-4 gap-1 mb-3">
                          {POS_PAYMENT_METHODS.map(m => (
                            <button key={m.value} onClick={() => setPaymentMethod(m.value)}
                              className={`py-2 px-1 rounded-lg border text-center text-[11px] font-semibold transition-all leading-tight ${
                                paymentMethod === m.value
                                  ? 'border-brand-orange bg-brand-orange/10 text-white'
                                  : 'border-brand-border text-brand-muted hover:border-brand-orange/40'
                              }`}>
                              {m.label}
                            </button>
                          ))}
                        </div>

                        <button onClick={addPayment} disabled={paying || remaining <= 0}
                          className="btn-primary w-full py-3.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                          {paying ? '⏳ Traitement...' : `➕ Encaisser ${paymentAmountStr ? formatCurrency(parseFloat(paymentAmountStr) || 0) : '…'}`}
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

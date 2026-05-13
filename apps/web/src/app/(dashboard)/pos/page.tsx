'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard,
  Banknote, Receipt, Table2, Package, ChevronRight, X
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency } from '@restaurant/utils'
import { toast } from 'sonner'

interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
  image?: string
  notes?: string
}

export default function POSPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'>('DINE_IN')
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [showPayment, setShowPayment] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CARD')
  const qc = useQueryClient()

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then(r => r.data.data),
  })

  const { data: products } = useQuery({
    queryKey: ['products', selectedCategory],
    queryFn: () => api.get(`/products?isAvailable=true${selectedCategory ? `&categoryId=${selectedCategory}` : ''}&limit=100`).then(r => r.data.data),
  })

  const { data: tables } = useQuery({
    queryKey: ['tables', 'available'],
    queryFn: () => api.get('/tables?status=AVAILABLE').then(r => r.data.data),
  })

  const createOrder = useMutation({
    mutationFn: (data: any) => api.post('/orders', data),
    onSuccess: (res) => {
      // Create payment
      if (res.data.data) {
        api.post('/payments', {
          orderId: res.data.data.id,
          amount: res.data.data.totalAmount,
          method: paymentMethod,
        }).then(() => {
          setCart([])
          setShowPayment(false)
          toast.success(`Commande ${res.data.data.orderNumber} créée et payée !`)
          qc.invalidateQueries({ queryKey: ['tables'] })
          qc.invalidateQueries({ queryKey: ['orders'] })
        })
      }
    },
    onError: () => toast.error('Erreur lors de la création de la commande'),
  })

  const filteredProducts = useMemo(() =>
    (products || []).filter((p: any) =>
      !search || p.name.toLowerCase().includes(search.toLowerCase())
    ), [products, search])

  function addToCart(product: any) {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id)
      if (existing) {
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1, image: product.image }]
    })
  }

  function updateQuantity(productId: string, qty: number) {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => i.productId !== productId))
    } else {
      setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity: qty } : i))
    }
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const tax = subtotal * 0.1
  const total = subtotal + tax

  function handleOrder() {
    if (cart.length === 0) return
    if (orderType === 'DINE_IN' && !selectedTable) {
      toast.error('Sélectionnez une table')
      return
    }
    setShowPayment(true)
  }

  function confirmPayment() {
    createOrder.mutate({
      type: orderType,
      tableId: selectedTable || undefined,
      guestCount: 1,
      items: cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.price,
      })),
    })
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] gap-4">
      {/* Left: Products */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Order type selector */}
        <div className="flex gap-2 mb-4">
          {[
            { value: 'DINE_IN', label: 'Sur place', icon: '🪑' },
            { value: 'TAKEAWAY', label: 'Emporté', icon: '🥡' },
            { value: 'DELIVERY', label: 'Livraison', icon: '🚴' },
          ].map(type => (
            <button
              key={type.value}
              onClick={() => setOrderType(type.value as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                orderType === type.value ? 'bg-brand-orange text-white border-brand-orange' : 'border-brand-border text-brand-muted hover:border-brand-orange/30'
              }`}
            >
              <span>{type.icon}</span>
              {type.label}
            </button>
          ))}
        </div>

        {/* Table selector (DINE_IN only) */}
        {orderType === 'DINE_IN' && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-brand-muted">Table</label>
            <div className="flex gap-2 flex-wrap">
              {(tables || []).slice(0, 12).map((table: any) => (
                <button
                  key={table.id}
                  onClick={() => setSelectedTable(selectedTable === table.id ? '' : table.id)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                    selectedTable === table.id ? 'bg-brand-orange text-white border-brand-orange' : 'border-brand-border text-brand-muted'
                  }`}
                >
                  T{table.number}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un produit..." className="input-field pl-10" />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 flex-shrink-0">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap border transition-all ${
              !selectedCategory ? 'bg-brand-orange text-white border-brand-orange' : 'border-brand-border text-brand-muted'
            }`}
          >
            Tout
          </button>
          {(categories || []).map((cat: any) => (
            <button key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap border transition-all flex items-center gap-1.5 ${
                selectedCategory === cat.id ? 'bg-brand-orange text-white border-brand-orange' : 'border-brand-border text-brand-muted'
              }`}
            >
              {cat.icon && <span>{cat.icon}</span>}
              {cat.name}
            </button>
          ))}
        </div>

        {/* Products grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {(filteredProducts || []).map((product: any) => (
              <motion.button
                key={product.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => addToCart(product)}
                className="glass-card p-3 text-left hover:border-brand-orange/50 transition-all duration-200 group"
              >
                <div className="h-20 bg-brand-darker rounded-xl mb-2 flex items-center justify-center overflow-hidden">
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <span className="text-3xl opacity-50">🍽️</span>
                  )}
                </div>
                <p className="text-xs font-medium line-clamp-2 mb-1">{product.name}</p>
                <p className="text-sm font-bold text-brand-orange">{formatCurrency(product.price)}</p>

                {/* Add indicator */}
                <div className="absolute inset-0 flex items-center justify-center bg-brand-orange/10 opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-80 flex flex-col bg-brand-card border border-brand-border rounded-2xl overflow-hidden flex-shrink-0">
        <div className="p-4 border-b border-brand-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-brand-orange" />
            <span className="font-semibold">Panier</span>
          </div>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-xs text-red-400 hover:text-red-300">
              Vider
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <AnimatePresence>
            {cart.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 text-brand-muted"
              >
                <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Panier vide</p>
                <p className="text-xs">Ajoutez des produits</p>
              </motion.div>
            ) : (
              cart.map((item) => (
                <motion.div
                  key={item.productId}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-2 p-2 rounded-xl bg-white/3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.name}</p>
                    <p className="text-xs text-brand-orange">{formatCurrency(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="w-6 h-6 rounded-lg bg-brand-border flex items-center justify-center hover:bg-brand-orange/20 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="w-6 h-6 rounded-lg bg-brand-border flex items-center justify-center hover:bg-brand-orange/20 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-xs font-bold w-14 text-right">
                    {formatCurrency(item.price * item.quantity)}
                  </p>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Totals */}
        {cart.length > 0 && (
          <div className="p-4 border-t border-brand-border space-y-2">
            <div className="flex justify-between text-sm text-brand-muted">
              <span>Sous-total</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-brand-muted">
              <span>TVA (10%)</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t border-brand-border pt-2">
              <span>Total</span>
              <span className="text-brand-orange">{formatCurrency(total)}</span>
            </div>
            <button
              onClick={handleOrder}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2"
            >
              <Receipt className="w-4 h-4" />
              Passer la commande
            </button>
          </div>
        )}
      </div>

      {/* Payment modal */}
      <AnimatePresence>
        {showPayment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="glass-card p-6 w-full max-w-md"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-bold text-xl">Paiement</h2>
                <button onClick={() => setShowPayment(false)} className="text-brand-muted hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-center mb-6">
                <p className="text-brand-muted text-sm mb-1">Total à payer</p>
                <p className="text-4xl font-bold text-brand-orange">{formatCurrency(total)}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => setPaymentMethod('CARD')}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                    paymentMethod === 'CARD' ? 'border-brand-orange bg-brand-orange/10' : 'border-brand-border'
                  }`}
                >
                  <CreditCard className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm font-medium">Carte</p>
                </button>
                <button
                  onClick={() => setPaymentMethod('CASH')}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                    paymentMethod === 'CASH' ? 'border-brand-orange bg-brand-orange/10' : 'border-brand-border'
                  }`}
                >
                  <Banknote className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm font-medium">Espèces</p>
                </button>
              </div>

              <button
                onClick={confirmPayment}
                disabled={createOrder.isPending}
                className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2"
              >
                {createOrder.isPending ? 'Traitement...' : `Confirmer — ${formatCurrency(total)}`}
                <ChevronRight className="w-5 h-5" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

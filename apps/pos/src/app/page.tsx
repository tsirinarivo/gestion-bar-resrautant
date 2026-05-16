'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { formatCurrency } from '@restaurant/utils';

interface Category { id: string; name: string; icon?: string }
interface Product { id: string; name: string; price: number; categoryId: string }
interface CartItem { product: Product; quantity: number }

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json()) as { success: boolean; data?: { accessToken: string }; error?: string };
  if (!data.success) throw new Error(data.error ?? 'Identifiants incorrects');
  return data.data!.accessToken;
}

async function fetchCategories(token: string): Promise<Category[]> {
  const res = await fetch(`${API_URL}/api/categories`, { headers: authHeaders(token) });
  const data = (await res.json()) as { data: Category[] };
  return data.data ?? [];
}

async function fetchProducts(token: string, categoryId?: string): Promise<Product[]> {
  const url = categoryId
    ? `${API_URL}/api/products?categoryId=${categoryId}&isAvailable=true`
    : `${API_URL}/api/products?isAvailable=true`;
  const res = await fetch(url, { headers: authHeaders(token) });
  const data = (await res.json()) as { data: Product[] };
  return data.data ?? [];
}

type PaymentMethod = 'CASH' | 'MVOLA' | 'ORANGE_MONEY' | 'AIRTEL_MONEY' | 'CARD' | 'BNI_MOBILE' | 'BOA_MOBILE' | 'VIREMENT' | 'CHEQUE' | 'VOUCHER'

const POS_PAYMENT_METHODS: { value: PaymentMethod; label: string; color: string }[] = [
  { value: 'CASH',         label: '💵 Espèces',      color: 'bg-green-600 hover:bg-green-500' },
  { value: 'MVOLA',        label: '📱 MVola',         color: 'bg-red-600 hover:bg-red-500' },
  { value: 'ORANGE_MONEY', label: '🟠 Orange Money',  color: 'bg-orange-500 hover:bg-orange-400' },
  { value: 'AIRTEL_MONEY', label: '🔴 Airtel Money',  color: 'bg-red-700 hover:bg-red-600' },
  { value: 'CARD',         label: '💳 Carte',         color: 'bg-blue-600 hover:bg-blue-500' },
  { value: 'BNI_MOBILE',   label: '🏦 BNI Mobile',    color: 'bg-indigo-600 hover:bg-indigo-500' },
  { value: 'BOA_MOBILE',   label: '🏦 BOA Mobile',    color: 'bg-violet-600 hover:bg-violet-500' },
  { value: 'VIREMENT',     label: '🔁 Virement',      color: 'bg-cyan-600 hover:bg-cyan-500' },
  { value: 'CHEQUE',       label: '📄 Chèque',        color: 'bg-gray-500 hover:bg-gray-400' },
  { value: 'VOUCHER',      label: '🎟️ Bon',           color: 'bg-yellow-600 hover:bg-yellow-500' },
]

async function createOrder(token: string, cart: CartItem[], note: string, method: PaymentMethod) {
  const items = cart.map(i => ({
    productId: i.product.id,
    quantity: i.quantity,
    unitPrice: i.product.price,
  }));

  const orderRes = await fetch(`${API_URL}/api/orders`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ type: 'DINE_IN', items, notes: note || undefined }),
  });
  const orderData = (await orderRes.json()) as { success: boolean; data?: { id: string; totalAmount: number }; error?: string };
  if (!orderData.success) throw new Error(orderData.error ?? 'Erreur création commande');

  const order = orderData.data!;

  await fetch(`${API_URL}/api/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ status: 'CONFIRMED' }),
  });

  const payRes = await fetch(`${API_URL}/api/payments`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ orderId: order.id, amount: order.totalAmount, method }),
  });
  const payData = (await payRes.json()) as { success: boolean; error?: string };
  if (!payData.success) throw new Error(payData.error ?? 'Erreur paiement');

  return order;
}

function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState('caissier@demo.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const token = await login(email, password);
      onLogin(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-2xl p-8 w-full max-w-sm space-y-4 shadow-xl">
        <h1 className="text-2xl font-bold text-center mb-6">Caisse POS</h1>
        {error && <p className="bg-red-900/50 text-red-300 text-sm rounded-xl px-4 py-2">{error}</p>}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Email</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)} required
            className="w-full bg-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Mot de passe</label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)} required
            className="w-full bg-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <button
          type="submit" disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}

function PaymentMethodModal({
  total, onPay, onClose, processing,
}: {
  total: number; onPay: (m: PaymentMethod) => void; onClose: () => void; processing: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-gray-800 rounded-t-2xl sm:rounded-2xl p-5 z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">Mode de paiement</h3>
            <p className="text-orange-400 font-bold text-xl">{formatCurrency(total)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none w-9 h-9 flex items-center justify-center">&times;</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {POS_PAYMENT_METHODS.map(m => (
            <button
              key={m.value}
              onClick={() => { onPay(m.value); onClose(); }}
              disabled={processing}
              className={`${m.color} disabled:opacity-40 text-white py-4 rounded-xl text-sm font-bold transition-colors active:scale-95`}
            >
              {processing ? '...' : m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CartPanel({
  cart, total, orderNote, status, statusMsg,
  onAdd, onRemove, onNoteChange, onPay, onClear, onClose, isMobile,
}: {
  cart: CartItem[]; total: number; orderNote: string; status: string; statusMsg: string;
  onAdd: (p: Product) => void; onRemove: (id: string) => void;
  onNoteChange: (v: string) => void; onPay: (m: PaymentMethod) => void;
  onClear: () => void; onClose?: () => void; isMobile?: boolean;
}) {
  const [showPayModal, setShowPayModal] = useState(false);

  return (
    <>
      {showPayModal && (
        <PaymentMethodModal
          total={total}
          onPay={onPay}
          onClose={() => setShowPayModal(false)}
          processing={status === 'processing'}
        />
      )}
      <div className={`flex flex-col ${isMobile ? 'h-full' : 'w-96 border-l border-gray-700'} bg-gray-800`}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Commande en cours</h2>
            <p className="text-sm text-gray-400">{cart.reduce((s, i) => s + i.quantity, 0)} article(s)</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <p className="text-4xl mb-3">🛒</p>
              <p className="text-sm">Panier vide</p>
            </div>
          ) : cart.map(item => (
            <div key={item.product.id} className="flex items-center gap-2 bg-gray-700/50 rounded-xl p-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.product.name}</p>
                <p className="text-xs text-gray-400">{formatCurrency(item.product.price)} × {item.quantity}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => onRemove(item.product.id)} className="w-7 h-7 rounded-full bg-gray-600 hover:bg-red-600 flex items-center justify-center text-sm">−</button>
                <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                <button onClick={() => onAdd(item.product)} className="w-7 h-7 rounded-full bg-gray-600 hover:bg-green-600 flex items-center justify-center text-sm">+</button>
              </div>
              <span className="text-orange-400 font-bold text-sm w-24 text-right">{formatCurrency(item.product.price * item.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="px-4 pb-2">
          <input
            type="text" placeholder="Note..." value={orderNote}
            onChange={e => onNoteChange(e.target.value)}
            className="w-full bg-gray-700 rounded-xl px-3 py-2 text-sm placeholder-gray-500 outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div className="px-4 pt-2 border-t border-gray-700">
          <div className="flex justify-between font-bold text-xl py-3">
            <span>Total TTC</span>
            <span className="text-orange-400">{formatCurrency(total)}</span>
          </div>
        </div>

        {status === 'success' && (
          <div className="mx-4 mb-2 bg-green-900/60 text-green-300 text-sm rounded-xl px-4 py-3">{statusMsg}</div>
        )}
        {status === 'error' && (
          <div className="mx-4 mb-2 bg-red-900/60 text-red-300 text-sm rounded-xl px-4 py-3">{statusMsg}</div>
        )}

        <div className="p-4 flex gap-2">
          <button
            onClick={() => setShowPayModal(true)}
            disabled={cart.length === 0 || status === 'processing'}
            className="flex-1 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white py-4 rounded-xl font-bold text-base transition-colors"
          >
            {status === 'processing' ? 'Traitement...' : '💳 Payer'}
          </button>
          <button
            onClick={onClear}
            disabled={cart.length === 0}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 px-4 py-4 rounded-xl text-sm"
          >
            ✕
          </button>
        </div>
      </div>
    </>
  );
}

export default function POSPage() {
  const [token, setToken] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNote, setOrderNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [cartOpen, setCartOpen] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['pos-categories', token],
    queryFn: () => fetchCategories(token!),
    enabled: !!token,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['pos-products', token, selectedCategory],
    queryFn: () => fetchProducts(token!, selectedCategory),
    enabled: !!token,
  });

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0));
  }, []);

  const total = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const handlePay = async (method: PaymentMethod) => {
    if (cart.length === 0 || !token) return;
    setStatus('processing');
    setStatusMsg('');
    try {
      const order = await createOrder(token, cart, orderNote, method);
      setStatus('success');
      setStatusMsg(`Commande ${order.id.slice(-6).toUpperCase()} encaissée — ${formatCurrency(order.totalAmount)}`);
      setCart([]);
      setOrderNote('');
      setCartOpen(false);
      setTimeout(() => setStatus('idle'), 4000);
    } catch (err) {
      setStatus('error');
      setStatusMsg(err instanceof Error ? err.message : 'Erreur');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  if (!token) return <LoginScreen onLogin={setToken} />;

  const cartProps = {
    cart, total, orderNote, status, statusMsg,
    onAdd: addToCart, onRemove: removeFromCart,
    onNoteChange: setOrderNote, onPay: handlePay, onClear: () => setCart([]),
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-900 text-white">
      {/* Products panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-3 md:p-4 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
          <h1 className="text-lg md:text-xl font-bold">Caisse POS</h1>
          <button onClick={() => setToken(null)} className="text-xs text-gray-500 hover:text-gray-300">Déconnexion</button>
        </div>

        {/* Categories */}
        <div className="flex gap-2 p-3 overflow-x-auto border-b border-gray-700 bg-gray-800/50 flex-shrink-0">
          <button
            onClick={() => setSelectedCategory(undefined)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap ${!selectedCategory ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            Tous
          </button>
          {categories.map(cat => (
            <button
              key={cat.id} onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap ${selectedCategory === cat.id ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-300'}`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 pb-24 md:pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
            {products.map(product => {
              const inCart = cart.find(i => i.product.id === product.id);
              return (
                <button
                  key={product.id} onClick={() => addToCart(product)}
                  className="bg-gray-800 hover:bg-gray-700 rounded-xl p-3 md:p-4 text-left transition-all active:scale-95 relative"
                >
                  {inCart && (
                    <span className="absolute top-2 right-2 w-5 h-5 bg-orange-500 rounded-full text-xs font-bold flex items-center justify-center">
                      {inCart.quantity}
                    </span>
                  )}
                  <div className="aspect-square bg-gray-700 rounded-lg mb-2 md:mb-3 flex items-center justify-center text-2xl md:text-3xl">🍽️</div>
                  <p className="font-medium text-xs md:text-sm leading-tight line-clamp-2">{product.name}</p>
                  <p className="text-orange-400 font-bold mt-1 text-xs md:text-sm">{formatCurrency(product.price)}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Desktop: static cart panel */}
      <div className="hidden md:flex">
        <CartPanel {...cartProps} />
      </div>

      {/* Mobile: floating cart bar */}
      {!cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="md:hidden fixed bottom-4 left-4 right-4 bg-orange-500 hover:bg-orange-400 text-white py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-between px-6 z-20"
        >
          <span>🛒 {cartCount} article{cartCount !== 1 ? 's' : ''}</span>
          <span>{formatCurrency(total)}</span>
        </button>
      )}

      {/* Mobile: cart drawer */}
      {cartOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex flex-col">
          <div className="flex-1 bg-black/60" onClick={() => setCartOpen(false)} />
          <div className="bg-gray-800 rounded-t-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <CartPanel {...cartProps} isMobile onClose={() => setCartOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

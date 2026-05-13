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

async function createOrder(token: string, cart: CartItem[], note: string, method: 'CASH' | 'CARD') {
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

  // Confirm then pay
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
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
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

export default function POSPage() {
  const [token, setToken] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNote, setOrderNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

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

  const handlePay = async (method: 'CASH' | 'CARD') => {
    if (cart.length === 0 || !token) return;
    setStatus('processing');
    setStatusMsg('');
    try {
      const order = await createOrder(token, cart, orderNote, method);
      setStatus('success');
      setStatusMsg(`Commande ${order.id.slice(-6).toUpperCase()} encaissée — ${formatCurrency(order.totalAmount)}`);
      setCart([]);
      setOrderNote('');
      setTimeout(() => setStatus('idle'), 4000);
    } catch (err) {
      setStatus('error');
      setStatusMsg(err instanceof Error ? err.message : 'Erreur');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  if (!token) return <LoginScreen onLogin={setToken} />;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left: Products */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
          <h1 className="text-xl font-bold">Caisse POS</h1>
          <button onClick={() => setToken(null)} className="text-xs text-gray-500 hover:text-gray-300">Déconnexion</button>
        </div>

        {/* Categories */}
        <div className="flex gap-2 p-4 overflow-x-auto border-b border-gray-700 bg-gray-800/50">
          <button
            onClick={() => setSelectedCategory(undefined)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${!selectedCategory ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            Tous
          </button>
          {categories.map(cat => (
            <button
              key={cat.id} onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${selectedCategory === cat.id ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-300'}`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.map(product => (
              <button
                key={product.id} onClick={() => addToCart(product)}
                className="bg-gray-800 hover:bg-gray-700 rounded-xl p-4 text-left transition-all active:scale-95"
              >
                <div className="aspect-square bg-gray-700 rounded-lg mb-3 flex items-center justify-center text-3xl">🍽️</div>
                <p className="font-medium text-sm leading-tight line-clamp-2">{product.name}</p>
                <p className="text-orange-400 font-bold mt-1">{formatCurrency(product.price)}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-bold">Commande en cours</h2>
          <p className="text-sm text-gray-400">{cart.reduce((s, i) => s + i.quantity, 0)} article(s)</p>
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
                <button onClick={() => removeFromCart(item.product.id)} className="w-7 h-7 rounded-full bg-gray-600 hover:bg-red-600 flex items-center justify-center text-sm">−</button>
                <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                <button onClick={() => addToCart(item.product)} className="w-7 h-7 rounded-full bg-gray-600 hover:bg-green-600 flex items-center justify-center text-sm">+</button>
              </div>
              <span className="text-orange-400 font-bold text-sm w-20 text-right">{formatCurrency(item.product.price * item.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="px-4 pb-2">
          <input
            type="text" placeholder="Note..." value={orderNote}
            onChange={e => setOrderNote(e.target.value)}
            className="w-full bg-gray-700 rounded-xl px-3 py-2 text-sm placeholder-gray-500 outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div className="p-4 border-t border-gray-700 space-y-2">
          <div className="flex justify-between font-bold text-xl pt-1">
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

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handlePay('CASH')}
              disabled={cart.length === 0 || status === 'processing'}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white py-4 rounded-xl font-bold transition-colors"
            >
              {status === 'processing' ? '...' : '💵 Espèces'}
            </button>
            <button
              onClick={() => handlePay('CARD')}
              disabled={cart.length === 0 || status === 'processing'}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-4 rounded-xl font-bold transition-colors"
            >
              {status === 'processing' ? '...' : '💳 Carte'}
            </button>
          </div>
          <button
            onClick={() => setCart([])}
            disabled={cart.length === 0}
            className="w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 py-3 rounded-xl text-sm"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

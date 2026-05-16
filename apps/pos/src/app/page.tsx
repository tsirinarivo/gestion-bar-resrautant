'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';
import { formatCurrency } from '@restaurant/utils';

interface Category  { id: string; name: string; icon?: string }
interface Product   { id: string; name: string; price: number; categoryId: string }
interface CartItem  { product: Product; quantity: number }
interface Table     { id: string; number: number; status: string; capacity: number }
interface OrderItem { id: string; quantity: number; totalPrice: number; product: { name: string } }
interface Order     { id: string; orderNumber: string; status: string; totalAmount: number; items: OrderItem[] }

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const TABLE_COLOR: Record<string, string> = {
  AVAILABLE: 'border-emerald-500 bg-emerald-500/10 text-emerald-300',
  OCCUPIED:  'border-red-500   bg-red-500/10   text-red-300',
  RESERVED:  'border-blue-500  bg-blue-500/10  text-blue-300',
  CLEANING:  'border-amber-500 bg-amber-500/10 text-amber-300',
  BLOCKED:   'border-gray-600  bg-gray-600/10  text-gray-400',
}
const TABLE_LABEL: Record<string, string> = {
  AVAILABLE: 'Libre', OCCUPIED: 'Occupée', RESERVED: 'Réservée',
  CLEANING: 'Nettoyage', BLOCKED: 'Bloquée',
}

const POS_PAYMENT_METHODS = [
  { value: 'CASH',         label: '💵 Espèces',      color: 'bg-green-700  hover:bg-green-600' },
  { value: 'MVOLA',        label: '📱 MVola',         color: 'bg-red-700    hover:bg-red-600' },
  { value: 'ORANGE_MONEY', label: '🟠 Orange Money',  color: 'bg-orange-600 hover:bg-orange-500' },
  { value: 'AIRTEL_MONEY', label: '🔴 Airtel Money',  color: 'bg-red-800    hover:bg-red-700' },
  { value: 'CARD',         label: '💳 Carte',         color: 'bg-blue-700   hover:bg-blue-600' },
  { value: 'BNI_MOBILE',   label: '🏦 BNI Mobile',    color: 'bg-indigo-700 hover:bg-indigo-600' },
  { value: 'BOA_MOBILE',   label: '🏦 BOA Mobile',    color: 'bg-violet-700 hover:bg-violet-600' },
  { value: 'VIREMENT',     label: '🔁 Virement',      color: 'bg-cyan-700   hover:bg-cyan-600' },
  { value: 'CHEQUE',       label: '📄 Chèque',        color: 'bg-gray-600   hover:bg-gray-500' },
  { value: 'VOUCHER',      label: '🎟️ Bon',           color: 'bg-yellow-700 hover:bg-yellow-600' },
  { value: 'WALLET',       label: '👜 Wallet',        color: 'bg-pink-700   hover:bg-pink-600' },
]

// ─── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, { headers: authHeaders(token) });
  const data = await res.json() as { success: boolean; data: T; error?: string };
  if (!data.success) throw new Error(data.error ?? 'Erreur API');
  return data.data;
}

async function apiPost<T>(token: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const data = await res.json() as { success: boolean; data: T; error?: string };
  if (!data.success) throw new Error(data.error ?? 'Erreur API');
  return data.data;
}

async function apiPatch(token: string, path: string, body: unknown): Promise<void> {
  await fetch(`${API_URL}/api${path}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
}

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json() as { success: boolean; data?: { accessToken: string }; error?: string };
  if (!data.success) throw new Error(data.error ?? 'Identifiants incorrects');
  return data.data!.accessToken;
}

// ─── Login ────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [email,    setEmail]    = useState('caissier@demo.com');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try   { onLogin(await login(email, password)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Erreur'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-2xl p-8 w-full max-w-sm space-y-4 shadow-xl">
        <div className="text-center mb-4">
          <p className="text-3xl mb-1">🍽️</p>
          <h1 className="text-2xl font-bold">Caisse POS</h1>
        </div>
        {error && <p className="bg-red-900/50 text-red-300 text-sm rounded-xl px-4 py-2">{error}</p>}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
            className="w-full bg-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Mot de passe</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
            className="w-full bg-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
        <button type="submit" disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors">
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}

// ─── Receipt modal ─────────────────────────────────────────────────────────────

function ReceiptModal({
  token, activeTable, orderType, openOrders, cart, onClose,
}: {
  token: string; activeTable: Table | null; orderType: 'DINE_IN' | 'TAKEAWAY'; openOrders: Order[]; cart: CartItem[]; onClose: () => void;
}) {
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');

  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const tableLabel = activeTable ? `Table ${activeTable.number}` : orderType === 'TAKEAWAY' ? 'Emporté' : 'Commande';

  const kitchenTotal = openOrders.reduce((s, o) => s + o.totalAmount, 0);
  const cartTotal    = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const grandTotal   = kitchenTotal + cartTotal;

  const allItems = [
    ...openOrders.flatMap(o => o.items.map(i => ({
      name: i.product.name, qty: i.quantity,
      unitPrice: i.totalPrice / i.quantity, total: i.totalPrice,
    }))),
    ...cart.map(i => ({
      name: i.product.name, qty: i.quantity,
      unitPrice: i.product.price, total: i.product.price * i.quantity,
    })),
  ];

  async function printOnCloud() {
    setCloudStatus('sending');
    try {
      const res = await fetch(`${API_URL}/api/printer/receipt`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          tableNumber:  activeTable?.number,
          tableLabel,
          orderNumber:  openOrders[0]?.orderNumber,
          items:        allItems,
          subtotal:     grandTotal,
          grandTotal,
        }),
      });
      const data = await res.json() as { success: boolean };
      setCloudStatus(data.success ? 'ok' : 'err');
    } catch {
      setCloudStatus('err');
    }
    setTimeout(() => setCloudStatus('idle'), 3000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 print:hidden" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-white text-gray-900 rounded-t-2xl sm:rounded-2xl z-10 overflow-hidden">

        {/* Header actions — hidden when printing */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-100 print:hidden">
          <span className="text-sm font-semibold text-gray-600">Reçu</span>
          <div className="flex gap-2">
            <button onClick={printOnCloud} disabled={cloudStatus === 'sending'}
              className={`text-white text-sm font-bold px-3 py-1.5 rounded-xl transition-colors disabled:opacity-60 ${
                cloudStatus === 'ok'  ? 'bg-green-600' :
                cloudStatus === 'err' ? 'bg-red-600'   :
                'bg-blue-600 hover:bg-blue-500'
              }`}>
              {cloudStatus === 'sending' ? '⏳' : cloudStatus === 'ok' ? '✅ Envoyé' : cloudStatus === 'err' ? '❌ Erreur' : '☁️ Imprimer'}
            </button>
            <button onClick={() => window.print()}
              className="bg-gray-600 hover:bg-gray-500 text-white text-sm font-bold px-3 py-1.5 rounded-xl transition-colors">
              🖨️
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl w-8 h-8 flex items-center justify-center">&times;</button>
          </div>
        </div>

        {/* Receipt body */}
        <div className="p-5 font-mono text-sm" id="receipt-content">
          <div className="text-center mb-4">
            <p className="text-lg font-bold tracking-wide">🍽️ RestaurantOS</p>
            <p className="text-xs text-gray-500">{dateStr} à {timeStr}</p>
            <p className="text-xs text-gray-500">{tableLabel}</p>
          </div>

          <div className="border-t border-dashed border-gray-400 my-3" />

          {/* Items from kitchen orders */}
          {openOrders.map(order => (
            <div key={order.id}>
              <p className="text-[10px] text-gray-400 mb-1">Commande {order.orderNumber}</p>
              {order.items.map(item => (
                <div key={item.id} className="flex justify-between py-0.5">
                  <span>{item.quantity}× {item.product.name}</span>
                  <span className="font-semibold">{formatCurrency(item.totalPrice)}</span>
                </div>
              ))}
            </div>
          ))}

          {/* Pending cart items */}
          {cart.length > 0 && (
            <div>
              {openOrders.length > 0 && <p className="text-[10px] text-gray-400 mt-2 mb-1">En cours</p>}
              {cart.map(item => (
                <div key={item.product.id} className="flex justify-between py-0.5">
                  <span>{item.quantity}× {item.product.name}</span>
                  <span className="font-semibold">{formatCurrency(item.product.price * item.quantity)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-dashed border-gray-400 my-3" />

          <div className="flex justify-between font-bold text-base">
            <span>TOTAL</span>
            <span>{formatCurrency(grandTotal)}</span>
          </div>

          <div className="border-t border-dashed border-gray-400 my-3" />
          <p className="text-center text-xs text-gray-400">Merci de votre visite !</p>
        </div>
      </div>
    </div>
  );
}

// ─── Payment modal ─────────────────────────────────────────────────────────────

function PaymentModal({
  total, tableLabel, orderCount, paying,
  onConfirm, onClose,
}: {
  total: number; tableLabel: string; orderCount: number; paying: boolean;
  onConfirm: (method: string) => void; onClose: () => void;
}) {
  const [selected, setSelected] = useState('CASH');
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-gray-800 rounded-t-2xl sm:rounded-2xl p-5 z-10">
        <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-4 sm:hidden" />
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold">L'addition</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl w-8 h-8 flex items-center justify-center">&times;</button>
        </div>
        <p className="text-gray-400 text-sm mb-1">{tableLabel}{orderCount > 0 ? ` · ${orderCount} commande(s)` : ''}</p>
        <p className="text-4xl font-bold text-orange-400 mb-5">{formatCurrency(total)}</p>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {POS_PAYMENT_METHODS.map(m => (
            <button key={m.value} onClick={() => setSelected(m.value)}
              className={`py-3 px-1 rounded-xl border-2 text-center text-xs font-semibold transition-all ${
                selected === m.value
                  ? 'border-orange-500 bg-orange-500/20 text-white'
                  : 'border-gray-600 text-gray-300 hover:border-gray-500'
              }`}>
              <span className="block text-lg mb-0.5">{m.label.split(' ')[0]}</span>
              {m.label.split(' ').slice(1).join(' ')}
            </button>
          ))}
        </div>
        <button onClick={() => onConfirm(selected)} disabled={paying}
          className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white py-4 rounded-xl font-bold text-base transition-colors">
          {paying ? 'Traitement...' : `✅ Confirmer — ${formatCurrency(total)}`}
        </button>
      </div>
    </div>
  );
}

// ─── Cart / Ticket panel ───────────────────────────────────────────────────────

function CartPanel({
  token, cart, orderNote, activeTable, orderType, openOrders,
  onAdd, onRemove, onNoteChange, onSendToKitchen, onShowPayment, onShowReceipt, onClearCart, onClose,
  sending, isMobile,
}: {
  token: string; cart: CartItem[]; orderNote: string;
  activeTable: Table | null; orderType: 'DINE_IN' | 'TAKEAWAY';
  openOrders: Order[];
  onAdd: (p: Product) => void; onRemove: (id: string) => void;
  onNoteChange: (v: string) => void;
  onSendToKitchen: () => void; onShowPayment: () => void; onShowReceipt: () => void; onClearCart: () => void;
  onClose?: () => void; sending: boolean; isMobile?: boolean;
}) {
  const existingTotal = openOrders.reduce((s, o) => s + o.totalAmount, 0);
  const cartTotal     = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const grandTotal    = existingTotal + cartTotal;

  const tableLabel = activeTable
    ? `Table ${activeTable.number}`
    : orderType === 'TAKEAWAY' ? '🥡 Emporté' : 'Aucune table';

  return (
    <div className={`flex flex-col ${isMobile ? 'h-full' : 'w-80 lg:w-96 border-l border-gray-700'} bg-gray-800`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="font-bold">{tableLabel}</h2>
          <p className="text-xs text-gray-400">
            {cart.reduce((s, i) => s + i.quantity, 0)} nouv. · {openOrders.length} en cuisine
          </p>
        </div>
        <div className="flex items-center gap-2">
          {cart.length > 0 && (
            <button onClick={onClearCart} className="text-xs text-red-400 hover:text-red-300">Vider</button>
          )}
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl w-7 h-7 flex items-center justify-center">&times;</button>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Open orders in kitchen */}
        {openOrders.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">👨‍🍳 En cuisine</p>
            {openOrders.map(order => (
              <div key={order.id} className="bg-gray-700/40 rounded-xl p-3 mb-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-400">{order.orderNumber}</span>
                  <span className="text-xs text-amber-400">{order.status}</span>
                </div>
                {order.items.map(item => (
                  <div key={item.id} className="flex justify-between text-xs text-gray-400 py-0.5">
                    <span>{item.quantity}× {item.product.name}</span>
                    <span>{formatCurrency(item.totalPrice)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs font-semibold pt-1 border-t border-gray-600 mt-1">
                  <span>Sous-total</span><span>{formatCurrency(order.totalAmount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New cart items */}
        {cart.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">➕ Nouvelle commande</p>
            {cart.map(item => (
              <div key={item.product.id} className="flex items-center gap-2 bg-orange-500/5 border border-orange-500/20 rounded-xl p-2.5 mb-1">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.product.name}</p>
                  <p className="text-xs text-orange-400">{formatCurrency(item.product.price)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => onRemove(item.product.id)}
                    className="w-7 h-7 rounded-full bg-gray-600 hover:bg-red-700 flex items-center justify-center text-sm">−</button>
                  <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                  <button onClick={() => onAdd(item.product)}
                    className="w-7 h-7 rounded-full bg-gray-600 hover:bg-green-700 flex items-center justify-center text-sm">+</button>
                </div>
                <span className="text-orange-400 font-bold text-sm w-20 text-right">
                  {formatCurrency(item.product.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
        )}

        {openOrders.length === 0 && cart.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-600">
            <p className="text-3xl mb-2">🛒</p>
            <p className="text-sm">{activeTable ? 'Table vide' : 'Sélectionnez une table'}</p>
          </div>
        )}
      </div>

      {/* Note */}
      <div className="px-3 pb-2 flex-shrink-0">
        <input type="text" placeholder="Note pour la cuisine..." value={orderNote}
          onChange={e => onNoteChange(e.target.value)}
          className="w-full bg-gray-700 rounded-xl px-3 py-2 text-sm placeholder-gray-500 outline-none focus:ring-1 focus:ring-orange-500" />
      </div>

      {/* Totals */}
      <div className="px-3 border-t border-gray-700 flex-shrink-0">
        {openOrders.length > 0 && (
          <div className="flex justify-between text-xs text-gray-500 pt-2">
            <span>En cuisine</span><span>{formatCurrency(existingTotal)}</span>
          </div>
        )}
        {cart.length > 0 && (
          <div className="flex justify-between text-xs text-gray-500 pt-1">
            <span>Panier</span><span>{formatCurrency(cartTotal)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-lg py-3">
          <span>Total ticket</span>
          <span className="text-orange-400">{formatCurrency(grandTotal)}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="p-3 space-y-2 flex-shrink-0">
        {cart.length > 0 && (
          <button onClick={onSendToKitchen} disabled={sending}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3.5 rounded-xl font-bold transition-colors">
            {sending ? '⏳ Envoi...' : '👨‍🍳 Envoyer en cuisine'}
          </button>
        )}
        {(openOrders.length > 0 || cart.length > 0) && (
          <div className="flex gap-2">
            <button onClick={onShowReceipt}
              className="flex items-center justify-center gap-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-3.5 rounded-xl font-bold transition-colors text-sm whitespace-nowrap">
              🧾 Reçu
            </button>
            {(openOrders.length > 0 || (orderType === 'TAKEAWAY' && cart.length > 0)) && (
              <button onClick={onShowPayment}
                className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white py-3.5 rounded-xl font-bold transition-colors text-sm">
                💳 L'addition — {formatCurrency(grandTotal)}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main POS ─────────────────────────────────────────────────────────────────

export default function POSPage() {
  const [token,            setToken]           = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [search,           setSearch]           = useState('');
  const [cart,             setCart]             = useState<CartItem[]>([]);
  const [orderNote,        setOrderNote]        = useState('');
  const [activeTable,      setActiveTable]      = useState<Table | null>(null);
  const [orderType,        setOrderType]        = useState<'DINE_IN' | 'TAKEAWAY'>('DINE_IN');
  const [sending,          setSending]          = useState(false);
  const [paying,           setPaying]           = useState(false);
  const [showPayModal,     setShowPayModal]      = useState(false);
  const [showReceipt,      setShowReceipt]       = useState(false);
  const [cartOpen,         setCartOpen]          = useState(false);
  const [toast,            setToast]            = useState<{ msg: string; ok: boolean } | null>(null);
  const qc = useQueryClient();

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  const { data: tables = [] } = useQuery<Table[]>({
    queryKey: ['pos-tables', token],
    queryFn: () => apiFetch<Table[]>(token!, '/tables'),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['pos-categories', token],
    queryFn: () => apiFetch<Category[]>(token!, '/categories'),
    enabled: !!token,
    staleTime: 600_000,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['pos-products', token, selectedCategory],
    queryFn: () => apiFetch<Product[]>(token!,
      `/products?isAvailable=true&limit=200${selectedCategory ? `&categoryId=${selectedCategory}` : ''}`),
    enabled: !!token,
    staleTime: 300_000,
  });

  const { data: openOrders = [], refetch: refetchOrders } = useQuery<Order[]>({
    queryKey: ['pos-open-orders', token, activeTable?.id],
    queryFn: () => apiFetch<Order[]>(token!,
      `/orders?tableId=${activeTable!.id}&status=PENDING,CONFIRMED,PREPARING,READY&limit=50`),
    enabled: !!token && !!activeTable?.id,
    refetchInterval: 30_000,
  });

  const filteredProducts = useMemo(() =>
    products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase())),
    [products, search]);

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const ex = prev.find(i => i.product.id === product.id);
      if (ex) return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev =>
      prev.map(i => i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i)
          .filter(i => i.quantity > 0));
  }, []);

  function selectTable(table: Table) {
    if (activeTable?.id === table.id) return;
    setActiveTable(table);
    setOrderType('DINE_IN');
    setCart([]);
  }

  async function sendToKitchen() {
    if (cart.length === 0) return;
    if (orderType === 'DINE_IN' && !activeTable) { showToast('Sélectionnez une table', false); return; }
    setSending(true);
    try {
      const order = await apiPost<{ orderNumber: string }>(token!, '/orders', {
        type: orderType,
        status: 'CONFIRMED',
        tableId: activeTable?.id,
        notes: orderNote || undefined,
        items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity, unitPrice: i.product.price })),
      });
      setCart([]);
      setOrderNote('');
      await refetchOrders();
      qc.invalidateQueries({ queryKey: ['pos-tables'] });
      showToast(`Commande ${order.orderNumber} envoyée en cuisine`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur envoi', false);
    } finally {
      setSending(false);
    }
  }

  async function handlePayment(method: string) {
    setPaying(true);
    try {
      // If cart has items, create & confirm them first
      if (cart.length > 0) {
        const order = await apiPost<{ id: string; totalAmount: number }>(token!, '/orders', {
          type: orderType,
          status: 'CONFIRMED',
          tableId: activeTable?.id,
          notes: orderNote || undefined,
          items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity, unitPrice: i.product.price })),
        });
        await apiPost(token!, '/payments', { orderId: order.id, amount: order.totalAmount, method });
        await apiPatch(token!, `/orders/${order.id}/status`, { status: 'COMPLETED' });
      }
      // Pay all open orders
      for (const order of openOrders) {
        await apiPost(token!, '/payments', { orderId: order.id, amount: order.totalAmount, method });
        await apiPatch(token!, `/orders/${order.id}/status`, { status: 'COMPLETED' });
      }
      const total = openOrders.reduce((s, o) => s + o.totalAmount, 0)
                  + cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
      showToast(`${activeTable ? `Table ${activeTable.number}` : 'Emporté'} — ${formatCurrency(total)} encaissé`);
      setCart([]);
      setOrderNote('');
      setShowPayModal(false);
      setCartOpen(false);
      if (activeTable) {
        setActiveTable(null);
        qc.invalidateQueries({ queryKey: ['pos-tables'] });
      }
      await refetchOrders();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur paiement', false);
    } finally {
      setPaying(false);
    }
  }

  const existingTotal = openOrders.reduce((s, o) => s + o.totalAmount, 0);
  const cartTotal     = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const grandTotal    = existingTotal + cartTotal;
  const cartCount     = cart.reduce((s, i) => s + i.quantity, 0);
  const tableLabel    = activeTable ? `Table ${activeTable.number}` : orderType === 'TAKEAWAY' ? 'Emporté' : '';

  if (!token) return <LoginScreen onLogin={setToken} />;

  const cartPanelProps = {
    token: token!, cart, orderNote, activeTable, orderType,
    openOrders: openOrders as Order[],
    onAdd: addToCart, onRemove: removeFromCart, onNoteChange: setOrderNote,
    onSendToKitchen: sendToKitchen, onShowPayment: () => setShowPayModal(true),
    onShowReceipt: () => setShowReceipt(true),
    onClearCart: () => setCart([]), sending,
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-900 text-white">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold shadow-xl ${toast.ok ? 'bg-green-800 text-green-100' : 'bg-red-800 text-red-100'}`}>
          {toast.msg}
        </div>
      )}

      {/* Receipt modal */}
      {showReceipt && (
        <ReceiptModal
          token={token!}
          activeTable={activeTable}
          orderType={orderType}
          openOrders={openOrders as Order[]}
          cart={cart}
          onClose={() => setShowReceipt(false)}
        />
      )}

      {/* Payment modal */}
      {showPayModal && (
        <PaymentModal
          total={grandTotal} tableLabel={tableLabel}
          orderCount={openOrders.length} paying={paying}
          onConfirm={handlePayment} onClose={() => setShowPayModal(false)}
        />
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <h1 className="text-lg font-bold">🍽️ Caisse POS</h1>
        <button onClick={() => setToken(null)} className="text-xs text-gray-500 hover:text-gray-300">Déconnexion</button>
      </div>

      {/* Table selector */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/60 border-b border-gray-700 overflow-x-auto flex-shrink-0 scrollbar-hide">
        <button
          onClick={() => { setActiveTable(null); setOrderType('TAKEAWAY'); setCart([]); }}
          className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
            orderType === 'TAKEAWAY' && !activeTable
              ? 'bg-orange-500 border-orange-500 text-white'
              : 'border-gray-600 text-gray-400 hover:border-orange-500/40'
          }`}>
          🥡 Emporté
        </button>
        <div className="w-px h-5 bg-gray-700 flex-shrink-0" />
        {(tables as Table[]).map(table => {
          const isActive = activeTable?.id === table.id;
          return (
            <button key={table.id} onClick={() => selectTable(table)}
              className={`flex-shrink-0 flex flex-col items-center px-3 py-1 rounded-xl border text-xs font-semibold transition-all ${
                isActive ? 'bg-orange-500 border-orange-500 text-white' : (TABLE_COLOR[table.status] ?? TABLE_COLOR['AVAILABLE']!)
              }`}>
              <span>T{table.number}</span>
              <span className="font-normal text-[10px] opacity-75">{TABLE_LABEL[table.status] ?? ''}</span>
            </button>
          );
        })}
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">

        {/* Products panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search + categories */}
          <div className="px-3 pt-3 pb-2 space-y-2 flex-shrink-0">
            <input
              type="text" placeholder="🔍 Rechercher..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-800 rounded-xl px-4 py-2 text-sm placeholder-gray-500 outline-none focus:ring-1 focus:ring-orange-500"
            />
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button onClick={() => setSelectedCategory(undefined)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${!selectedCategory ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-700 text-gray-400'}`}>
                Tous
              </button>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all whitespace-nowrap ${selectedCategory === cat.id ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-700 text-gray-400'}`}>
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto px-3 pb-24 md:pb-3">
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-1.5">
              {filteredProducts.map(product => {
                const inCart = cart.find(i => i.product.id === product.id);
                return (
                  <button key={product.id} onClick={() => addToCart(product)}
                    className="bg-gray-800 hover:bg-gray-700 rounded-xl p-2 text-left transition-all active:scale-95 relative border border-transparent hover:border-orange-500/30">
                    {inCart && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-orange-500 rounded-full text-[10px] font-bold flex items-center justify-center z-10">
                        {inCart.quantity}
                      </span>
                    )}
                    <div className="w-full h-12 bg-gray-700 rounded-lg mb-1.5 flex items-center justify-center text-xl">🍽️</div>
                    <p className="font-medium text-[11px] leading-tight line-clamp-2 mb-0.5 pr-3">{product.name}</p>
                    <p className="text-orange-400 font-bold text-xs">{formatCurrency(product.price)}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Desktop cart panel */}
        <div className="hidden md:flex">
          <CartPanel {...cartPanelProps} />
        </div>
      </div>

      {/* Mobile: floating cart button */}
      {!cartOpen && (cartCount > 0 || openOrders.length > 0) && (
        <button
          onClick={() => setCartOpen(true)}
          className="md:hidden fixed bottom-4 left-4 right-4 bg-orange-500 hover:bg-orange-400 text-white py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-between px-6 z-20">
          <span>
            🛒 {cartCount > 0 ? `${cartCount} article${cartCount > 1 ? 's' : ''}` : `${openOrders.length} en cuisine`}
            {activeTable ? ` · Table ${activeTable.number}` : ''}
          </span>
          <span>{formatCurrency(grandTotal)}</span>
        </button>
      )}

      {/* Mobile: cart drawer */}
      {cartOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex flex-col">
          <div className="flex-1 bg-black/60" onClick={() => setCartOpen(false)} />
          <div className="bg-gray-800 rounded-t-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <CartPanel {...cartPanelProps} isMobile onClose={() => setCartOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

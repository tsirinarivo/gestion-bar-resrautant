'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { formatDistance } from 'date-fns';
import { fr } from 'date-fns/locale';
import { io } from 'socket.io-client';

const queryClient = new QueryClient();

interface OrderItem {
  id: string;
  status: string;
  quantity: number;
  notes?: string;
  product: { name: string };
  modifiers: Array<{ name: string; price: number }>;
}

interface KDSOrder {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  table?: { number: number; name?: string };
  guestCount: number;
  notes?: string;
  createdAt: string;
  items: OrderItem[];
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function loginKDS(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json()) as { success: boolean; data?: { accessToken: string }; error?: string };
  if (!data.success) throw new Error(data.error ?? 'Identifiants incorrects');
  return data.data!.accessToken;
}

async function fetchKDSOrders(token: string): Promise<KDSOrder[]> {
  const res = await fetch(`${API_URL}/api/orders?status=PENDING,CONFIRMED,PREPARING`, {
    headers: authHeader(token),
  });
  if (res.status === 401) throw new Error('401');
  const data = (await res.json()) as { data: KDSOrder[] };
  return data.data ?? [];
}

async function updateOrderStatus(token: string, orderId: string, status: string) {
  await fetch(`${API_URL}/api/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify({ status }),
  });
}

function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState('cuisinier@demo.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const token = await loginKDS(email, password);
      onLogin(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm space-y-4">
        <div className="text-center mb-6">
          <p className="text-4xl mb-2">🍳</p>
          <h1 className="text-2xl font-bold">Cuisine — KDS</h1>
        </div>
        {error && <p className="bg-red-900/50 text-red-300 text-sm rounded-xl px-4 py-2">{error}</p>}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Email</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)} required
            className="w-full bg-gray-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Mot de passe</label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)} required
            className="w-full bg-gray-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <button
          type="submit" disabled={loading}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition-colors"
        >
          {loading ? 'Connexion...' : 'Accéder à la cuisine'}
        </button>
      </form>
    </div>
  );
}

function KDSPageInner() {
  const [token, setToken] = useState<string | null>(null);
  const qc = useQueryClient();
  const [now, setNow] = useState(new Date());

  const { data: orders = [], error } = useQuery({
    queryKey: ['kds-orders', token],
    queryFn: () => fetchKDSOrders(token!),
    enabled: !!token,
    refetchInterval: 10_000,
  });

  // Auto-logout on 401
  useEffect(() => {
    if (error && (error as Error).message === '401') setToken(null);
  }, [error]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!token) return;
    const socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    // BUG 7 — rejoindre explicitement la room KDS (le serveur utilise restaurantId du JWT)
    socket.on('connect', () => socket.emit('join:kds'));
    socket.on('kds:new_order', () => void qc.invalidateQueries({ queryKey: ['kds-orders'] }));
    socket.on('order:status_changed', () => void qc.invalidateQueries({ queryKey: ['kds-orders'] }));
    return () => { socket.disconnect(); };
  }, [qc, token]);

  const preparingMutation = useMutation({
    mutationFn: (orderId: string) => updateOrderStatus(token!, orderId, 'PREPARING'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['kds-orders'] }),
  });

  const readyMutation = useMutation({
    mutationFn: (orderId: string) => updateOrderStatus(token!, orderId, 'READY'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['kds-orders'] }),
  });

  if (!token) return <LoginScreen onLogin={setToken} />;

  const getWaitTime = (createdAt: string) =>
    Math.floor((now.getTime() - new Date(createdAt).getTime()) / 60000);

  const getTimerClass = (minutes: number) => {
    if (minutes < 10) return 'timer-ok';
    if (minutes < 20) return 'timer-warn';
    return 'timer-danger';
  };

  const pendingOrders = orders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED');
  const preparingOrders = orders.filter(o => o.status === 'PREPARING');

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
          <h1 className="text-base md:text-xl font-bold">Cuisine — KDS</h1>
        </div>
        <div className="flex items-center gap-3 md:gap-6">
          <p className="text-xs text-gray-500 hidden sm:block">
            {pendingOrders.length} attente · {preparingOrders.length} en cours
          </p>
          <p className="text-lg md:text-2xl font-mono font-bold text-amber-400">
            {now.toLocaleTimeString('fr-FR')}
          </p>
          <button onClick={() => setToken(null)} className="text-xs text-gray-600 hover:text-gray-400">
            Déco.
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600">
            <p className="text-6xl mb-4">🍳</p>
            <p className="text-xl font-medium">Cuisine calme...</p>
            <p className="text-sm mt-2">En attente de nouvelles commandes</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orders.map(order => {
              const waitMinutes = getWaitTime(order.createdAt);
              const timerClass = getTimerClass(waitMinutes);
              const cardClass = order.status === 'PREPARING' ? 'kds-card-preparing' : 'kds-card-pending';

              return (
                <div key={order.id} className={`kds-card ${cardClass}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-lg">
                        {order.table ? `Table ${order.table.number}` : order.type}
                      </p>
                      <p className="text-xs text-gray-400">{order.orderNumber}</p>
                    </div>
                    <div className={`text-right ${timerClass}`}>
                      <p className="text-xl font-mono font-bold">{waitMinutes}&apos;</p>
                      <p className="text-xs">
                        {formatDistance(new Date(order.createdAt), now, { addSuffix: false, locale: fr })}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    {order.items.map(item => (
                      <div key={item.id} className="flex gap-2">
                        <span className="font-bold text-amber-400 min-w-[24px]">{item.quantity}×</span>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.product.name}</p>
                          {item.modifiers.length > 0 && (
                            <p className="text-xs text-gray-400">{item.modifiers.map(m => m.name).join(', ')}</p>
                          )}
                          {item.notes && (
                            <p className="text-xs text-amber-300 italic">{item.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {order.notes && (
                    <p className="text-xs bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 text-amber-300 mb-3">
                      {order.notes}
                    </p>
                  )}

                  {order.status === 'PENDING' || order.status === 'CONFIRMED' ? (
                    <button
                      onClick={() => preparingMutation.mutate(order.id)}
                      disabled={preparingMutation.isPending}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl text-sm font-bold transition-colors"
                    >
                      {order.status === 'PENDING' ? '✅ Accepter & préparer' : 'Commencer la préparation'}
                    </button>
                  ) : (
                    <button
                      onClick={() => readyMutation.mutate(order.id)}
                      disabled={readyMutation.isPending}
                      className="w-full py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-xl text-sm font-bold transition-colors"
                    >
                      Marquer comme prête ✓
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function KDSPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <KDSPageInner />
    </QueryClientProvider>
  );
}

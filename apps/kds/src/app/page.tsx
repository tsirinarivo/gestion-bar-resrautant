'use client';

import { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { formatDistance } from 'date-fns';
import { fr } from 'date-fns/locale';
import { io } from 'socket.io-client';

interface OrderItem {
  id: string;
  status: string;
  quantity: number;
  notes?: string;
  kdsStation?: string;
  product: { name: string } | null;
  productName?: string | null;
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

const STATIONS = [
  { key: 'all',      label: 'Tout',      emoji: '🍽️' },
  { key: 'hot',      label: 'Chaud',     emoji: '🔥' },
  { key: 'cold',     label: 'Froid',     emoji: '❄️' },
  { key: 'drinks',   label: 'Boissons',  emoji: '🍹' },
  { key: 'desserts', label: 'Desserts',  emoji: '🍰' },
]

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

async function updateItemStatus(token: string, orderId: string, itemId: string, status: string) {
  await fetch(`${API_URL}/api/orders/${orderId}/items/${itemId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify({ status }),
  });
}

async function updateOrderStatus(token: string, orderId: string, status: string) {
  await fetch(`${API_URL}/api/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify({ status }),
  });
}

function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState('');
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
  // Lecture localStorage AU MOUNT (useEffect) pour éviter les hydration mismatch SSR/client.
  const [token, setToken] = useState<string | null>(null);
  const [station, setStation] = useState<string>('all');
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [hydrated, setHydrated] = useState(false);
  const qc = useQueryClient();
  const [now, setNow] = useState(new Date());
  const [banner, setBanner] = useState<string | null>(null);
  function showError(msg: string) {
    setBanner(msg);
    setTimeout(() => setBanner(null), 6000);
  }

  useEffect(() => {
    setToken(localStorage.getItem('kds-token'));
    setStation(localStorage.getItem('kds-station') ?? 'all');
    setSoundOn(localStorage.getItem('kds-sound') !== 'off');
    setHydrated(true);
  }, []);

  useEffect(() => { if (hydrated) localStorage.setItem('kds-station', station) }, [station, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem('kds-sound', soundOn ? 'on' : 'off') }, [soundOn, hydrated]);

  const { data: orders = [], error } = useQuery({
    queryKey: ['kds-orders', token],
    queryFn: () => fetchKDSOrders(token!),
    enabled: !!token,
    // Socket.io invalide la query sur kds:new_order / order:status_changed
    // (cf useEffect plus bas). Le polling 60s est un filet de sécurité au
    // cas où la socket se déconnecte silencieusement.
    refetchInterval: 60_000,
  });

  function handleSetToken(t: string | null) {
    if (t) localStorage.setItem('kds-token', t)
    else localStorage.removeItem('kds-token')
    setToken(t)
  }

  useEffect(() => {
    if (error && (error as Error).message === '401') handleSetToken(null);
  }, [error]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  function playBeep() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.value = 880;
      oscillator.type = 'sine';
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.4);
    } catch {}
  }

  useEffect(() => {
    if (!token) return;
    const socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socket.on('connect', () => socket.emit('join:kds'));
    socket.on('kds:new_order', () => {
      if (soundOn) playBeep();
      void qc.invalidateQueries({ queryKey: ['kds-orders'] });
    });
    socket.on('order:status_changed', () => void qc.invalidateQueries({ queryKey: ['kds-orders'] }));
    socket.on('order:updated', () => void qc.invalidateQueries({ queryKey: ['kds-orders'] }));
    return () => { socket.disconnect(); };
  }, [qc, token, soundOn]);

  const preparingMutation = useMutation({
    mutationFn: (orderId: string) => updateOrderStatus(token!, orderId, 'PREPARING'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['kds-orders'] }),
    onError: (err: unknown) => { console.error('[KDS prep]', err); showError(`Erreur préparation : ${err instanceof Error ? err.message : 'réseau'}`) },
  });

  const onMutationError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : 'Erreur réseau';
    console.error('[KDS mutation]', err);
    showError(`Action échouée : ${msg} — vérifiez avant de servir.`);
  };

  const readyMutation = useMutation({
    mutationFn: (orderId: string) => updateOrderStatus(token!, orderId, 'READY'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['kds-orders'] }),
    onError: onMutationError,
  });

  const itemReadyMutation = useMutation({
    mutationFn: ({ orderId, itemId }: { orderId: string; itemId: string }) =>
      updateItemStatus(token!, orderId, itemId, 'READY'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['kds-orders'] }),
    onError: onMutationError,
  });

  // Filter orders by station: show order only if it has at least one item in the selected station
  const filteredOrders = useMemo(() => {
    if (station === 'all') return orders;
    return orders
      .map(order => ({
        ...order,
        items: order.items.filter(item => item.product && (item.kdsStation ?? 'hot') === station),
      }))
      .filter(order => order.items.length > 0);
  }, [orders, station]);

  if (!token) return <LoginScreen onLogin={handleSetToken} />;

  const getWaitTime = (createdAt: string) =>
    Math.floor((now.getTime() - new Date(createdAt).getTime()) / 60000);

  const getTimerClass = (minutes: number) => {
    if (minutes < 10) return 'timer-ok';
    if (minutes < 20) return 'timer-warn';
    return 'timer-danger';
  };

  const pendingOrders = filteredOrders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED');
  const preparingOrders = filteredOrders.filter(o => o.status === 'PREPARING');

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {banner && (
        <div className="bg-red-600 text-white text-sm font-semibold px-4 py-2 flex items-center justify-between gap-3">
          <span>❌ {banner}</span>
          <button onClick={() => setBanner(null)} className="text-white/80 hover:text-white text-lg leading-none">&times;</button>
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-gray-800 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
          <h1 className="text-base md:text-xl font-bold">Cuisine — KDS</h1>
        </div>

        {/* Station filter */}
        <div className="flex items-center gap-1">
          {STATIONS.map(s => (
            <button
              key={s.key}
              onClick={() => setStation(s.key)}
              className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                station === s.key
                  ? 'bg-amber-500 text-black'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {s.emoji} {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          <p className="text-xs text-gray-500 hidden sm:block">
            {pendingOrders.length} attente · {preparingOrders.length} en cours
          </p>
          <p className="text-lg md:text-2xl font-mono font-bold text-amber-400">
            {now.toLocaleTimeString('fr-FR')}
          </p>
          <button onClick={() => setSoundOn(s => !s)}
            className={`text-lg ${soundOn ? 'text-amber-400' : 'text-gray-600'} hover:opacity-80 transition-opacity`}
            title={soundOn ? 'Couper le son' : 'Activer le son'}>
            {soundOn ? '🔔' : '🔕'}
          </button>
          <button onClick={() => handleSetToken(null)} className="text-xs text-gray-600 hover:text-gray-400">
            Déco.
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="text-8xl mb-6 animate-pulse">✨</div>
            <p className="text-3xl font-bold text-green-400 mb-2">Tout est servi !</p>
            <p className="text-sm text-gray-500">Aucune commande en attente — chapeau au chef 👨‍🍳</p>
            <p className="text-xs text-gray-600 mt-6">
              {station !== 'all' ? `Filtre actif : ${STATIONS.find(s => s.key === station)?.label}` : 'Toutes stations'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredOrders.map(order => {
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
                    {order.items.map(item => {
                      const itemReady = item.status === 'READY'
                      return (
                        <div key={item.id} className={`flex gap-2 ${itemReady ? 'opacity-50' : ''}`}>
                          <span className="font-bold text-amber-400 min-w-[24px]">{item.quantity}×</span>
                          <div className="flex-1">
                            <p className={`font-medium text-sm ${itemReady ? 'line-through' : ''}`}>{item.product?.name ?? item.productName ?? '?'}</p>
                            {item.modifiers.length > 0 && (
                              <p className="text-xs text-gray-400">{item.modifiers.map(m => m.name).join(', ')}</p>
                            )}
                            {item.notes && (
                              <p className="text-xs text-amber-300 italic">{item.notes}</p>
                            )}
                          </div>
                          {item.kdsStation && item.kdsStation !== 'hot' && (
                            <span className="text-xs bg-gray-700 rounded px-1 h-fit self-start mt-0.5 text-gray-400">
                              {STATIONS.find(s => s.key === item.kdsStation)?.emoji ?? item.kdsStation}
                            </span>
                          )}
                          {!itemReady && order.status === 'PREPARING' && (
                            <button
                              onClick={() => itemReadyMutation.mutate({ orderId: order.id, itemId: item.id })}
                              disabled={itemReadyMutation.isPending}
                              title="Marquer cet article comme prêt"
                              className="text-lg hover:scale-110 transition-transform">
                              ✓
                            </button>
                          )}
                          {itemReady && <span className="text-green-400 text-lg">✓</span>}
                        </div>
                      )
                    })}
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
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <KDSPageInner />
    </QueryClientProvider>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { formatDistance } from 'date-fns';
import { fr } from 'date-fns/locale';

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
  kitchenNotes?: string;
  createdAt: string;
  items: OrderItem[];
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function fetchKDSOrders(): Promise<KDSOrder[]> {
  const res = await fetch(`${API_URL}/api/orders?status=CONFIRMED,PREPARING&type=DINE_IN,TAKEAWAY`, {
    credentials: 'include',
  });
  const data = (await res.json()) as { data: KDSOrder[] };
  return data.data ?? [];
}

async function markOrderPreparing(orderId: string) {
  await fetch(`${API_URL}/api/orders/${orderId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ status: 'PREPARING' }),
  });
}

async function markOrderReady(orderId: string) {
  await fetch(`${API_URL}/api/orders/${orderId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ status: 'READY' }),
  });
}

function KDSPageInner() {
  const qc = useQueryClient();
  const [now, setNow] = useState(new Date());

  const { data: orders = [] } = useQuery({
    queryKey: ['kds-orders'],
    queryFn: fetchKDSOrders,
    refetchInterval: 10_000,
  });

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const preparingMutation = useMutation({
    mutationFn: markOrderPreparing,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['kds-orders'] }),
  });

  const readyMutation = useMutation({
    mutationFn: markOrderReady,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['kds-orders'] }),
  });

  const getWaitTime = (createdAt: string) => {
    const minutes = Math.floor((now.getTime() - new Date(createdAt).getTime()) / 60000);
    return minutes;
  };

  const getTimerClass = (minutes: number) => {
    if (minutes < 10) return 'timer-ok';
    if (minutes < 20) return 'timer-warn';
    return 'timer-danger';
  };

  const pendingOrders = orders.filter((o) => o.status === 'CONFIRMED');
  const preparingOrders = orders.filter((o) => o.status === 'PREPARING');

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900/80 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          <h1 className="text-xl font-bold">Cuisine — Kitchen Display</h1>
        </div>
        <div className="text-right">
          <p className="text-2xl font-mono font-bold text-amber-400">
            {now.toLocaleTimeString('fr-FR')}
          </p>
          <p className="text-xs text-gray-500">
            {pendingOrders.length} en attente · {preparingOrders.length} en préparation
          </p>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600">
            <p className="text-6xl mb-4">🍳</p>
            <p className="text-xl font-medium">Cuisine calme...</p>
            <p className="text-sm mt-2">En attente de nouvelles commandes</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orders.map((order) => {
              const waitMinutes = getWaitTime(order.createdAt);
              const timerClass = getTimerClass(waitMinutes);
              const cardClass =
                order.status === 'PREPARING' ? 'kds-card-preparing' : 'kds-card-pending';

              return (
                <div key={order.id} className={`kds-card ${cardClass}`}>
                  {/* Order Header */}
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

                  {/* Items */}
                  <div className="space-y-2 mb-4">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex gap-2">
                        <span className="font-bold text-amber-400 min-w-[24px]">{item.quantity}×</span>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.product.name}</p>
                          {item.modifiers.length > 0 && (
                            <p className="text-xs text-gray-400">
                              {item.modifiers.map((m) => m.name).join(', ')}
                            </p>
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

                  {/* Action Button */}
                  {order.status === 'CONFIRMED' ? (
                    <button
                      onClick={() => preparingMutation.mutate(order.id)}
                      disabled={preparingMutation.isPending}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl text-sm font-bold transition-colors"
                    >
                      Commencer la préparation
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

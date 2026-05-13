'use client';

import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@restaurant/utils';

interface DashboardStats {
  revenue: { today: number; thisMonth: number; trend: number };
  orders: { today: number; pending: number; inProgress: number; completed: number };
  tables: { total: number; occupied: number; available: number; occupancyRate: number };
  averageTicket: number;
  totalCovers: number;
}

async function fetchDashboard(): Promise<DashboardStats> {
  const res = await fetch('/api/dashboard/stats', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch dashboard');
  const data = (await res.json()) as { data: DashboardStats };
  return data.data;
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Tableau de Bord</h1>
        <p className="text-gray-400 mt-1">Vue d&apos;ensemble en temps réel</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          title="Chiffre d'affaires aujourd'hui"
          value={formatCurrency(stats?.revenue.today ?? 0)}
          trend={stats?.revenue.trend}
          icon="💰"
        />
        <KpiCard
          title="Commandes du jour"
          value={String(stats?.orders.today ?? 0)}
          subtitle={`${stats?.orders.pending ?? 0} en attente`}
          icon="📋"
        />
        <KpiCard
          title="Tables occupées"
          value={`${stats?.tables.occupied ?? 0}/${stats?.tables.total ?? 0}`}
          subtitle={`${Math.round(stats?.tables.occupancyRate ?? 0)}% d'occupation`}
          icon="🍽️"
        />
        <KpiCard
          title="Ticket moyen"
          value={formatCurrency(stats?.averageTicket ?? 0)}
          icon="🧾"
        />
      </div>

      {/* Active Orders Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <StatusCard label="En attente" count={stats?.orders.pending ?? 0} color="amber" />
        <StatusCard label="En préparation" count={stats?.orders.inProgress ?? 0} color="blue" />
        <StatusCard label="Prêtes" count={0} color="green" />
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  trend,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  trend?: number;
  subtitle?: string;
  icon: string;
}) {
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
          {trend !== undefined && (
            <p className={`text-xs mt-2 ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}% vs hier
            </p>
          )}
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
}

function StatusCard({ label, count, color }: { label: string; count: number; color: string }) {
  const colors: Record<string, string> = {
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    green: 'bg-green-500/10 border-green-500/30 text-green-400',
  };

  return (
    <div className={`rounded-xl border p-6 ${colors[color] ?? colors['amber']}`}>
      <p className="text-sm opacity-80">{label}</p>
      <p className="text-4xl font-bold mt-2">{count}</p>
    </div>
  );
}

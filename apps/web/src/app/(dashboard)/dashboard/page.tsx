'use client'

import { useQuery } from '@tanstack/react-query'
import { memo } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, TrendingDown, ShoppingCart, Users, Table2,
  Euro, Clock, Star, AlertTriangle, ArrowUp, ArrowDown,
  BarChart2, Activity, Utensils, Package, CalendarX
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { api } from '@/lib/api'
import { formatCurrency, formatPercent } from '@restaurant/utils'

const stagger = {
  container: { animate: { transition: { staggerChildren: 0.08 } } },
  item: { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } },
}

const PIE_COLORS = ['#FF4D00', '#FFB800', '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B']

const KPICard = memo(function KPICard({
  title, value, trend, trendLabel, icon: Icon, color = 'orange', format = 'number', delay = 0
}: any) {
  const isPositive = trend >= 0
  const colorMap: Record<string, string> = {
    orange: '#FF4D00',
    gold: '#FFB800',
    green: '#10B981',
    blue: '#3B82F6',
    purple: '#8B5CF6',
  }
  const c = colorMap[color] || colorMap.orange

  return (
    <motion.div
      variants={stagger.item}
      transition={{ duration: 0.4, delay }}
      className="kpi-card"
    >
      <div className="absolute inset-0 rounded-2xl opacity-5"
        style={{ background: `radial-gradient(circle at 80% 20%, ${c}, transparent 60%)` }} />

      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-brand-muted text-xs font-medium uppercase tracking-wider">{title}</p>
          <motion.p
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: delay + 0.2 }}
            className="text-2xl font-bold mt-1"
          >
            {format === 'currency' ? formatCurrency(value) : value?.toLocaleString('fr-FR')}
          </motion.p>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${c}20`, border: `1px solid ${c}30` }}>
          <Icon className="w-5 h-5" style={{ color: c }} />
        </div>
      </div>

      {trend !== undefined && (
        <div className="flex items-center gap-2 text-xs">
          <span className={`flex items-center gap-0.5 font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
          <span className="text-brand-muted">{trendLabel || 'vs hier'}</span>
        </div>
      )}
    </motion.div>
  )
})

function SkeletonKPI() {
  return (
    <div className="kpi-card">
      <div className="skeleton h-4 w-24 mb-4 rounded" />
      <div className="skeleton h-8 w-32 mb-4 rounded" />
      <div className="skeleton h-3 w-20 rounded" />
    </div>
  )
}

export default function DashboardPage() {
  const { data: kpisData, isLoading: kpisLoading } = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => api.get('/dashboard/kpis').then(r => r.data.data),
    refetchInterval: 300_000,
    staleTime: 60_000,
  })

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['dashboard', 'revenue', 'week'],
    queryFn: () => api.get('/dashboard/revenue-chart?period=week').then(r => r.data.data),
    refetchInterval: 300_000,
    staleTime: 120_000,
  })

  const { data: hourlyData } = useQuery({
    queryKey: ['dashboard', 'hourly'],
    queryFn: () => api.get('/dashboard/hourly-stats').then(r => r.data.data),
    refetchInterval: 300_000,
    staleTime: 120_000,
  })

  const { data: categoryData } = useQuery({
    queryKey: ['dashboard', 'categories'],
    queryFn: () => api.get('/dashboard/category-stats').then(r => r.data.data),
    staleTime: 300_000,
  })

  const { data: expiringItems } = useQuery({
    queryKey: ['stock', 'expiring'],
    queryFn: () => api.get('/stock/expiring?days=7').then(r => r.data.data),
    staleTime: 300_000,
    refetchInterval: 600_000,
  })

  const kpis = kpisData

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <motion.div
        variants={stagger.container}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {kpisLoading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonKPI key={i} />)
        ) : (
          <>
            <KPICard
              title="CA Aujourd'hui"
              value={kpis?.revenue?.today || 0}
              trend={kpis?.revenue?.trend}
              icon={Euro}
              color="orange"
              format="currency"
              delay={0}
            />
            <KPICard
              title="Commandes"
              value={kpis?.orders?.today || 0}
              trend={5.2}
              trendLabel="vs hier"
              icon={ShoppingCart}
              color="blue"
              delay={0.05}
            />
            <KPICard
              title="Ticket Moyen"
              value={kpis?.averageTicket || 0}
              trend={2.1}
              icon={BarChart2}
              color="gold"
              format="currency"
              delay={0.1}
            />
            <KPICard
              title="Couverts"
              value={kpis?.totalCovers || 0}
              trend={8.4}
              icon={Users}
              color="green"
              delay={0.15}
            />
            <KPICard
              title="CA Semaine"
              value={kpis?.revenue?.thisWeek || 0}
              icon={TrendingUp}
              color="purple"
              format="currency"
              delay={0.2}
            />
            <KPICard
              title="CA Mois"
              value={kpis?.revenue?.thisMonth || 0}
              icon={Activity}
              color="orange"
              format="currency"
              delay={0.25}
            />
            <KPICard
              title="Tables Occupées"
              value={`${kpis?.tables?.occupied || 0}/${kpis?.tables?.total || 0}`}
              icon={Table2}
              color="gold"
              delay={0.3}
            />
            <KPICard
              title="Taux Remplissage"
              value={`${kpis?.tables?.occupancyRate || 0}%`}
              trend={kpis?.tables?.occupancyRate > 70 ? 5 : -3}
              icon={Utensils}
              color="green"
              delay={0.35}
            />
          </>
        )}
      </motion.div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="lg:col-span-2 glass-card p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-semibold">Chiffre d'affaires</h2>
              <p className="text-xs text-brand-muted">7 derniers jours</p>
            </div>
            <div className="flex gap-2">
              {['7j', '30j', '12m'].map(p => (
                <button key={p} className="text-xs px-2.5 py-1 rounded-lg border border-brand-border hover:border-brand-orange/50 transition-colors first:bg-brand-orange/10 first:border-brand-orange/30 first:text-brand-orange">
                  {p}
                </button>
              ))}
            </div>
          </div>
          {revenueLoading ? (
            <div className="skeleton h-48 rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={revenueData || []}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF4D00" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#FF4D00" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" />
                <XAxis dataKey="date" stroke="#6B7280" tick={{ fontSize: 11 }}
                  tickFormatter={(v) => v.slice(5)} />
                <YAxis stroke="#6B7280" tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `Ar ${v}`} />
                <Tooltip
                  contentStyle={{ background: '#111118', border: '1px solid #1E1E2E', borderRadius: 12 }}
                  formatter={(v: any) => [`Ar ${Math.round(v).toLocaleString('fr-FR')}`, 'CA']}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#FF4D00"
                  strokeWidth={2.5}
                  dot={{ fill: '#FF4D00', r: 3 }}
                  activeDot={{ r: 5, fill: '#FFB800' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Category Pie */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="glass-card p-6"
        >
          <h2 className="font-semibold mb-1">Ventes par catégorie</h2>
          <p className="text-xs text-brand-muted mb-6">Ce mois</p>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie
                data={categoryData || []}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                dataKey="revenue"
                nameKey="name"
              >
                {(categoryData || []).map((_: any, i: number) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#111118', border: '1px solid #1E1E2E', borderRadius: 12 }}
                formatter={(v: any) => [`Ar ${Math.round(v).toLocaleString('fr-FR')}`]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {(categoryData || []).slice(0, 4).map((cat: any, i: number) => (
              <div key={cat.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-brand-muted">{cat.name}</span>
                </div>
                <span className="font-medium">{formatCurrency(cat.revenue)}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hourly bar chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="glass-card p-6"
        >
          <h2 className="font-semibold mb-1">Heures de pointe</h2>
          <p className="text-xs text-brand-muted mb-6">Commandes par heure aujourd'hui</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={(hourlyData || []).filter((h: any) => h.hour >= 9 && h.hour <= 23)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" />
              <XAxis dataKey="hour" stroke="#6B7280" tick={{ fontSize: 10 }}
                tickFormatter={(h) => `${h}h`} />
              <YAxis stroke="#6B7280" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#111118', border: '1px solid #1E1E2E', borderRadius: 12 }}
              />
              <Bar dataKey="orders" fill="#FF4D00" radius={[4, 4, 0, 0]} name="Commandes" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Top Products */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="glass-card p-6"
        >
          <h2 className="font-semibold mb-1">Top Produits</h2>
          <p className="text-xs text-brand-muted mb-4">Par revenu aujourd'hui</p>
          <div className="space-y-3">
            {kpisLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton w-6 h-6 rounded" />
                  <div className="flex-1 skeleton h-4 rounded" />
                  <div className="skeleton w-16 h-4 rounded" />
                </div>
              ))
            ) : (
              (kpis?.topProducts || []).slice(0, 6).map((product: any, i: number) => (
                <div key={product.productId} className="flex items-center gap-3">
                  <span className="w-5 text-xs text-brand-muted text-center font-mono">#{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-xs text-brand-muted">{product.quantity} vendus</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-brand-orange">{formatCurrency(product.revenue)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Expiring Stock Alert */}
      {expiringItems && expiringItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.75 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <CalendarX className="w-4 h-4 text-amber-400" />
            <h2 className="font-semibold">Stocks expirant bientôt</h2>
            <span className="ml-auto text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
              {expiringItems.length} article{expiringItems.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {expiringItems.slice(0, 6).map((item: any) => {
              const expiry = new Date(item.expiryDate)
              const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / 86_400_000)
              const expired = daysLeft < 0
              return (
                <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border ${expired ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                  <Package className={`w-4 h-4 flex-shrink-0 ${expired ? 'text-red-400' : 'text-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-brand-muted">{item.quantity} {item.unit}</p>
                  </div>
                  <span className={`text-xs font-semibold flex-shrink-0 ${expired ? 'text-red-400' : 'text-amber-400'}`}>
                    {expired ? 'Expiré' : `${daysLeft}j`}
                  </span>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Live Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.8 }}
        className="glass-card p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <h2 className="font-semibold">Statut en temps réel</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'En attente', value: kpis?.orders?.pending || 0, color: '#F59E0B', icon: Clock },
            { label: 'En préparation', value: kpis?.orders?.inProgress || 0, color: '#8B5CF6', icon: Utensils },
            { label: 'Tables libres', value: kpis?.tables?.available || 0, color: '#10B981', icon: Table2 },
            { label: 'Réservations', value: kpis?.tables?.reserved || 0, color: '#3B82F6', icon: Users },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="text-center p-4 rounded-xl" style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
              <Icon className="w-6 h-6 mx-auto mb-2" style={{ color }} />
              <p className="text-2xl font-bold mb-1" style={{ color }}>{value}</p>
              <p className="text-xs text-brand-muted">{label}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

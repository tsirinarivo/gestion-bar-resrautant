'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  TrendingUp, Euro, ShoppingCart, BarChart2,
  ArrowUp, ArrowDown, Clock, Users, UtensilsCrossed, Package, UserCheck, Download,
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { api } from '@/lib/api'
import { formatCurrency, formatCurrencyCompact } from '@restaurant/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = ['#FF4D00', '#FFB800', '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B']

const ORDER_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  DINE_IN: { label: 'Sur place', color: '#FF4D00' },
  TAKEAWAY: { label: 'À emporter', color: '#FFB800' },
  DELIVERY: { label: 'Livraison', color: '#10B981' },
  ONLINE: { label: 'En ligne', color: '#3B82F6' },
}

const stagger = {
  container: { animate: { transition: { staggerChildren: 0.08 } } },
  item: { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortDate(dateStr: string) {
  // "2026-05-14" → "14/05"
  const parts = dateStr.split('-')
  return `${parts[2]}/${parts[1]}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="kpi-card">
      <div className="skeleton h-4 w-28 mb-3 rounded" />
      <div className="skeleton h-8 w-36 mb-3 rounded" />
      <div className="skeleton h-3 w-20 rounded" />
    </div>
  )
}

function SkeletonChart({ height = 200 }: { height?: number }) {
  return <div className="skeleton rounded-xl" style={{ height }} />
}

interface KPICardProps {
  title: string
  value: number | string
  trend?: number
  trendLabel?: string
  icon: React.ElementType
  color?: string
  format?: 'currency' | 'number' | 'raw'
  delay?: number
}

function KPICard({
  title, value, trend, trendLabel, icon: Icon,
  color = '#FF4D00', format = 'number', delay = 0,
}: KPICardProps) {
  const isPositive = (trend ?? 0) >= 0

  const displayValue =
    format === 'currency'
      ? formatCurrency(value as number)
      : format === 'raw'
      ? value
      : (value as number).toLocaleString('fr-FR')

  return (
    <motion.div
      variants={stagger.item}
      transition={{ duration: 0.4, delay }}
      className="kpi-card relative overflow-hidden"
    >
      <div
        className="absolute inset-0 rounded-2xl opacity-5"
        style={{ background: `radial-gradient(circle at 80% 20%, ${color}, transparent 60%)` }}
      />

      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-brand-muted text-xs font-medium uppercase tracking-wider">{title}</p>
          <motion.p
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: delay + 0.2 }}
            className="text-2xl font-bold mt-1"
          >
            {displayValue}
          </motion.p>
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}20`, border: `1px solid ${color}30` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>

      {trend !== undefined && (
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`flex items-center gap-0.5 font-semibold ${
              isPositive ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
          <span className="text-brand-muted">{trendLabel ?? 'vs hier'}</span>
        </div>
      )}
    </motion.div>
  )
}

const tooltipStyle = {
  contentStyle: {
    background: '#111118',
    border: '1px solid #1E1E2E',
    borderRadius: 12,
    fontSize: 12,
  },
}

// ─── Custom tooltip for revenue chart ────────────────────────────────────────

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-brand-darker border border-brand-border rounded-xl p-3 text-xs shadow-xl">
      <p className="text-brand-muted mb-2">{label}</p>
      <p className="font-semibold text-brand-orange">{formatCurrency(payload[0]?.value ?? 0)}</p>
      {payload[1] && (
        <p className="text-blue-400 mt-1">{payload[1].value} commandes</p>
      )}
    </div>
  )
}

// ─── Period toggle ─────────────────────────────────────────────────────────────

interface PeriodToggleProps {
  options: { label: string; value: string }[]
  value: string
  onChange: (v: string) => void
}

function PeriodToggle({ options, value, onChange }: PeriodToggleProps) {
  return (
    <div className="flex gap-1">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
            value === opt.value
              ? 'bg-brand-orange/10 border-brand-orange/30 text-brand-orange'
              : 'border-brand-border text-brand-muted hover:border-brand-orange/50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [revenuePeriod, setRevenuePeriod] = useState<string>('week')

  function exportCSV() {
    const rows: (string | number)[][] = []
    // Revenue chart data
    if (revenueChart?.length) {
      rows.push(['--- CA par jour ---'])
      rows.push(['Date', 'CA (Ar)', 'Commandes'])
      revenueChart.forEach((d: any) => rows.push([d.date, d.revenue ?? 0, d.orders ?? 0]))
      rows.push([])
    }
    // Top products
    if (kpis?.topProducts?.length) {
      rows.push(['--- Top produits ---'])
      rows.push(['Produit', 'Ventes', 'CA (Ar)'])
      kpis.topProducts.forEach((p: any) => rows.push([p.name, p.count ?? 0, p.revenue ?? 0]))
      rows.push([])
    }
    // Staff performance
    if (staffPerf?.length) {
      rows.push(['--- Performance équipe ---'])
      rows.push(['Employé', 'Commandes', 'CA (Ar)', 'Panier moyen (Ar)'])
      staffPerf.forEach((s: any) => rows.push([`${s.firstName} ${s.lastName}`, s.orderCount ?? 0, s.totalRevenue ?? 0, s.avgOrderValue ?? 0]))
    }
    if (!rows.length) return
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `analytiques-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // KPIs
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => api.get('/dashboard/kpis').then(r => r.data.data),
    refetchInterval: 60_000,
  })

  // Analytics (daily revenue 30d, hourly, ordersByType)
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['dashboard', 'analytics'],
    queryFn: () => api.get('/dashboard/analytics').then(r => r.data.data),
    refetchInterval: 120_000,
  })

  // Staff performance
  const { data: staffPerf, isLoading: staffLoading } = useQuery({
    queryKey: ['dashboard', 'staff-performance'],
    queryFn: () => api.get('/dashboard/staff-performance').then(r => r.data.data),
    staleTime: 300_000,
  })

  // Revenue chart period
  const { data: revenueChart, isLoading: revenueChartLoading } = useQuery({
    queryKey: ['dashboard', 'revenue-chart', revenuePeriod],
    queryFn: () =>
      api.get(`/dashboard/revenue-chart?period=${revenuePeriod}`).then(r => r.data.data),
    refetchInterval: 120_000,
  })

  // ── Derived values ──────────────────────────────────────────────────────────

  const todayRevenue = kpis?.revenue?.today ?? 0
  const weekRevenue = kpis?.revenue?.thisWeek ?? 0
  const monthRevenue = kpis?.revenue?.thisMonth ?? 0
  const todayOrders = kpis?.orders?.today ?? 0
  const revenueTrend = kpis?.revenue?.trend ?? 0

  // Top 5 products for bar chart
  const top5Products = (kpis?.topProducts ?? []).slice(0, 5)

  // Orders by type for pie chart
  const ordersByType: { type: string; count: number; revenue: number }[] =
    analytics?.ordersByType ?? []
  const totalTypeCount = ordersByType.reduce((s: number, t: any) => s + t.count, 0)

  // Hourly orders (7-day rolling)
  const hourlyOrders: { hour: number; count: number }[] = analytics?.hourlyOrders ?? []
  // Only show hours with activity, or at minimum the service window 9-23
  const hourlyFiltered = hourlyOrders.filter((h: any) => h.hour >= 9 && h.hour <= 23)

  // Daily revenue for line chart (use revenue-chart endpoint driven by period selector)
  const lineData = (revenueChart ?? []).map((d: any) => ({
    ...d,
    dateLabel: shortDate(d.date),
  }))

  // Revenue change vs previous period (simple comparison of first vs last half)
  const avgRevenue30d =
    analytics?.dailyRevenue?.length
      ? analytics.dailyRevenue.reduce((s: number, d: any) => s + d.revenue, 0) /
        analytics.dailyRevenue.length
      : 0

  const periodOptions = [
    { label: '7j', value: 'week' },
    { label: '30j', value: 'month' },
    { label: '1an', value: 'year' },
  ]

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold">Analytiques</h1>
          <p className="text-sm text-brand-muted mt-0.5">
            Performances et tendances de votre établissement
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-brand-border text-brand-muted hover:border-brand-orange/40 hover:text-brand-orange text-xs transition-colors">
            <Download className="w-3.5 h-3.5" /> Exporter CSV
          </button>
          <div className="flex items-center gap-2 text-xs text-brand-muted">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Données en temps réel
          </div>
        </div>
      </motion.div>

      {/* ── KPI Cards ── */}
      <motion.div
        variants={stagger.container}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {kpisLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <KPICard
              title="CA Aujourd'hui"
              value={todayRevenue}
              trend={revenueTrend}
              trendLabel="vs hier"
              icon={Euro}
              color="#FF4D00"
              format="currency"
              delay={0}
            />
            <KPICard
              title="CA Semaine"
              value={weekRevenue}
              icon={TrendingUp}
              color="#8B5CF6"
              format="currency"
              delay={0.08}
            />
            <KPICard
              title="CA Mois"
              value={monthRevenue}
              icon={BarChart2}
              color="#FFB800"
              format="currency"
              delay={0.16}
            />
            <KPICard
              title="Commandes Aujourd'hui"
              value={todayOrders}
              trend={5.2}
              trendLabel="vs hier"
              icon={ShoppingCart}
              color="#10B981"
              format="number"
              delay={0.24}
            />
          </>
        )}
      </motion.div>

      {/* ── Revenue Line Chart ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="glass-card p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h2 className="font-semibold">Chiffre d'affaires</h2>
            <p className="text-xs text-brand-muted">
              {revenuePeriod === 'week'
                ? '7 derniers jours'
                : revenuePeriod === 'month'
                ? '30 derniers jours'
                : '12 derniers mois'}
            </p>
          </div>
          <PeriodToggle
            options={periodOptions}
            value={revenuePeriod}
            onChange={setRevenuePeriod}
          />
        </div>

        {revenueChartLoading ? (
          <SkeletonChart height={220} />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={lineData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF4D00" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#FF4D00" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" />
              <XAxis
                dataKey="dateLabel"
                stroke="#6B7280"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#6B7280"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => formatCurrencyCompact(v)}
                width={70}
              />
              <Tooltip content={<RevenueTooltip />} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#FF4D00"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: '#FFB800', strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="orders"
                stroke="#3B82F6"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="4 2"
                activeDot={{ r: 4, fill: '#3B82F6', strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        <div className="flex items-center gap-4 mt-3 text-xs text-brand-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-0.5 bg-brand-orange rounded" />
            CA (Ar)
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-6 rounded"
              style={{ height: 2, background: '#3B82F6', opacity: 0.7 }}
            />
            Commandes
          </span>
        </div>
      </motion.div>

      {/* ── Bar + Pie Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 5 Produits — Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="glass-card p-6"
        >
          <h2 className="font-semibold mb-1">Top 5 Produits vendus</h2>
          <p className="text-xs text-brand-muted mb-6">Par revenu — aujourd'hui</p>

          {kpisLoading ? (
            <SkeletonChart height={220} />
          ) : top5Products.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-brand-muted text-sm">
              Aucune donnée disponible aujourd'hui
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={top5Products}
                layout="vertical"
                margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="#6B7280"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => formatCurrencyCompact(v)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#6B7280"
                  tick={{ fontSize: 11 }}
                  width={100}
                  tickFormatter={(v: string) =>
                    v.length > 14 ? v.slice(0, 13) + '…' : v
                  }
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v: any, name: string) => [
                    name === 'revenue' ? formatCurrency(v) : `${v} unités`,
                    name === 'revenue' ? 'Revenu' : 'Qté',
                  ]}
                />
                <Bar dataKey="revenue" fill="#FF4D00" radius={[0, 4, 4, 0]} name="revenue">
                  {top5Products.map((_: any, i: number) => (
                    <Cell
                      key={i}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Répartition par type — Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.55 }}
          className="glass-card p-6"
        >
          <h2 className="font-semibold mb-1">Répartition par type de commande</h2>
          <p className="text-xs text-brand-muted mb-4">30 derniers jours</p>

          {analyticsLoading ? (
            <SkeletonChart height={220} />
          ) : ordersByType.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-brand-muted text-sm">
              Aucune donnée disponible
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={ordersByType}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="count"
                    nameKey="type"
                    paddingAngle={3}
                  >
                    {ordersByType.map((entry: any, i: number) => (
                      <Cell
                        key={entry.type}
                        fill={
                          ORDER_TYPE_LABELS[entry.type]?.color ??
                          CHART_COLORS[i % CHART_COLORS.length]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(v: any, _: any, props: any) => [
                      `${v} commandes (${
                        totalTypeCount > 0 ? Math.round((v / totalTypeCount) * 100) : 0
                      }%)`,
                      ORDER_TYPE_LABELS[props.payload.type]?.label ?? props.payload.type,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="space-y-3 min-w-[140px] w-full sm:w-auto">
                {ordersByType.map((entry: any, i: number) => {
                  const info = ORDER_TYPE_LABELS[entry.type]
                  const pct =
                    totalTypeCount > 0
                      ? Math.round((entry.count / totalTypeCount) * 100)
                      : 0
                  const color =
                    info?.color ?? CHART_COLORS[i % CHART_COLORS.length]
                  return (
                    <div key={entry.type} className="flex items-center justify-between text-xs gap-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: color }}
                        />
                        <span className="text-brand-muted">
                          {info?.label ?? entry.type}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">{entry.count}</span>
                        <span className="text-brand-muted ml-1">({pct}%)</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Heures de pointe ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.65 }}
        className="glass-card p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-orange" />
              Heures de pointe
            </h2>
            <p className="text-xs text-brand-muted mt-0.5">
              Volume de commandes par heure — 7 derniers jours
            </p>
          </div>

          {/* Peak hour badge */}
          {!analyticsLoading && hourlyFiltered.length > 0 && (() => {
            const peak = [...hourlyFiltered].sort((a: any, b: any) => b.count - a.count)[0]
            if (!peak) return null
            return (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium"
                style={{ background: '#FF4D0015', border: '1px solid #FF4D0030', color: '#FF4D00' }}>
                <Clock className="w-3.5 h-3.5" />
                Pic : {peak.hour}h–{peak.hour + 1}h ({peak.count} cmd)
              </div>
            )
          })()}
        </div>

        {analyticsLoading ? (
          <SkeletonChart height={200} />
        ) : hourlyFiltered.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-brand-muted text-sm">
            Aucune donnée disponible
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={hourlyFiltered}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" />
              <XAxis
                dataKey="hour"
                stroke="#6B7280"
                tick={{ fontSize: 11 }}
                tickFormatter={(h) => `${h}h`}
              />
              <YAxis stroke="#6B7280" tick={{ fontSize: 11 }} />
              <Tooltip
                {...tooltipStyle}
                formatter={(v: any) => [`${v} commandes`, 'Volume']}
                labelFormatter={(h) => `${h}h–${Number(h) + 1}h`}
              />
              <Bar dataKey="count" name="Commandes" radius={[4, 4, 0, 0]}>
                {hourlyFiltered.map((entry: any, i: number) => {
                  const maxCount = Math.max(...hourlyFiltered.map((h: any) => h.count))
                  const intensity = maxCount > 0 ? entry.count / maxCount : 0
                  // Gradient from muted to orange based on intensity
                  const r = Math.round(255 * intensity + 59 * (1 - intensity))
                  const g = Math.round(77 * intensity + 130 * (1 - intensity))
                  const b = Math.round(0 * intensity + 246 * (1 - intensity))
                  const fill = intensity > 0.7
                    ? '#FF4D00'
                    : intensity > 0.4
                    ? '#FFB800'
                    : '#3B82F6'
                  return <Cell key={i} fill={fill} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-xs text-brand-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-brand-orange" />
            Forte activité (&gt;70%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#FFB800' }} />
            Activité moyenne (40–70%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#3B82F6' }} />
            Faible activité (&lt;40%)
          </span>
        </div>
      </motion.div>

      {/* ── Revenue by type detail table ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.75 }}
        className="glass-card p-6"
      >
        <h2 className="font-semibold mb-1">Détail par type de commande</h2>
        <p className="text-xs text-brand-muted mb-5">Revenu et volume — 30 derniers jours</p>

        {analyticsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-12 rounded-xl" />
            ))}
          </div>
        ) : ordersByType.length === 0 ? (
          <p className="text-sm text-brand-muted">Aucune donnée disponible</p>
        ) : (
          <div className="space-y-3">
            {ordersByType
              .slice()
              .sort((a: any, b: any) => b.revenue - a.revenue)
              .map((entry: any, i: number) => {
                const info = ORDER_TYPE_LABELS[entry.type]
                const color = info?.color ?? CHART_COLORS[i % CHART_COLORS.length]
                const pct =
                  totalTypeCount > 0 ? (entry.count / totalTypeCount) * 100 : 0
                const totalRevenue = ordersByType.reduce(
                  (s: number, t: any) => s + t.revenue, 0,
                )
                const revPct =
                  totalRevenue > 0 ? (entry.revenue / totalRevenue) * 100 : 0

                return (
                  <div
                    key={entry.type}
                    className="flex items-center gap-4 p-4 rounded-xl"
                    style={{
                      background: `${color}08`,
                      border: `1px solid ${color}20`,
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                      style={{ background: `${color}20` }}
                    >
                      {entry.type === 'DINE_IN'
                        ? '🪑'
                        : entry.type === 'TAKEAWAY'
                        ? '🥡'
                        : entry.type === 'DELIVERY'
                        ? '🚴'
                        : '📱'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-medium">
                          {info?.label ?? entry.type}
                        </p>
                        <p className="text-sm font-bold" style={{ color }}>
                          {formatCurrency(entry.revenue)}
                        </p>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-brand-border overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${revPct}%`, background: color }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-brand-muted">
                          {entry.count} commandes ({Math.round(pct)}%)
                        </p>
                        <p className="text-xs text-brand-muted">
                          {Math.round(revPct)}% du CA
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </motion.div>

      {/* ── Performance du personnel ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.85 }}
        className="glass-card p-6"
      >
        <div className="flex items-center gap-2 mb-1">
          <UserCheck className="w-4 h-4 text-brand-orange" />
          <h2 className="font-semibold">Performance du personnel</h2>
        </div>
        <p className="text-xs text-brand-muted mb-5">Commandes et CA générés par employé — 30 derniers jours</p>

        {staffLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-14 rounded-xl" />
            ))}
          </div>
        ) : !staffPerf || staffPerf.length === 0 ? (
          <p className="text-sm text-brand-muted">Aucune donnée disponible</p>
        ) : (
          <div className="space-y-3">
            {staffPerf.slice(0, 8).map((emp: any, i: number) => {
              const maxRev = staffPerf[0]?.totalRevenue ?? 1
              const pct = maxRev > 0 ? (emp.totalRevenue / maxRev) * 100 : 0
              const color = i === 0 ? '#FF4D00' : i === 1 ? '#FFB800' : i === 2 ? '#10B981' : '#3B82F6'
              return (
                <div key={emp.userId} className="flex items-center gap-4 p-3 rounded-xl bg-brand-surface border border-brand-border">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium truncate">{emp.name}</p>
                      <p className="text-sm font-bold text-brand-orange ml-2 flex-shrink-0">
                        {emp.totalRevenue.toLocaleString('fr-FR')} Ar
                      </p>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-brand-border overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <p className="text-xs text-brand-muted mt-1">
                      {emp.orderCount} commandes · panier moy. {Math.round(emp.avgTicket).toLocaleString('fr-FR')} Ar
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </motion.div>
    </div>
  )
}

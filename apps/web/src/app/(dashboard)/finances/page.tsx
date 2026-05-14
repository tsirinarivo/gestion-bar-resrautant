'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingBag, AlertCircle,
  Plus, Edit2, Trash2, X, ChevronDown, Target,
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency } from '@restaurant/utils'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'today' | 'week' | 'month' | 'year' | 'custom'

type Summary = {
  period: { start: string; end: string }
  orders: number
  revenue: number
  subtotal: number
  tax: number
  discount: number
  delivery: number
  cogs: number
  grossMargin: number
  grossMarginPct: number
  totalExpenses: number
  netMargin: number
  netMarginPct: number
  expensesByCategory: Record<string, number>
}

type TrendPoint = {
  date: string
  revenue: number
  cogs: number
  expenses: number
  grossMargin: number
  netMargin: number
}

type CategoryRow = {
  id: string; name: string; icon?: string
  revenue: number; cogs: number; grossMargin: number; grossMarginPct: number; itemsSold: number
}

type Expense = {
  id: string; category: string; amount: number; date: string; description?: string
}

const EXPENSE_CATEGORIES: { value: string; label: string; icon: string }[] = [
  { value: 'PERSONNEL',    label: 'Personnel',      icon: '👥' },
  { value: 'LOYER',        label: 'Loyer',          icon: '🏠' },
  { value: 'ENERGIE',      label: 'Énergie',        icon: '⚡' },
  { value: 'FOURNITURES',  label: 'Fournitures',    icon: '📦' },
  { value: 'MARKETING',    label: 'Marketing',      icon: '📣' },
  { value: 'MAINTENANCE',  label: 'Maintenance',    icon: '🔧' },
  { value: 'AUTRE',        label: 'Autre',          icon: '📋' },
]

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(v: number) { return `${v.toFixed(1)}%` }

function kpiColor(val: number, warn = 20, danger = 0) {
  if (val >= warn) return '#10B981'
  if (val >= danger) return '#F59E0B'
  return '#EF4444'
}

// ─── Expense Modal ────────────────────────────────────────────────────────────

function ExpenseModal({
  expense, onClose, onSave,
}: { expense: Expense | null; onClose: () => void; onSave: (d: any) => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    category: expense?.category ?? 'PERSONNEL',
    amount: expense?.amount?.toString() ?? '',
    date: expense?.date ? expense.date.slice(0, 10) : today,
    description: expense?.description ?? '',
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Montant requis'); return }
    onSave({ ...form, amount: parseFloat(form.amount) })
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-brand-border">
          <h2 className="font-bold text-lg">{expense ? 'Modifier la charge' : 'Nouvelle charge'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs text-brand-muted mb-1 block">Catégorie</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="input-field">
              {EXPENSE_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-brand-muted mb-1 block">Montant (Ar) *</label>
              <input type="number" min="0" step="1" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="input-field" placeholder="0" required />
            </div>
            <div>
              <label className="text-xs text-brand-muted mb-1 block">Date *</label>
              <input type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="input-field" required />
            </div>
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1 block">Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="input-field" placeholder="Ex: Salaire Mars 2025" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Annuler</button>
            <button type="submit" className="flex-1 btn-primary">
              {expense ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card px-3 py-2 text-xs space-y-1 border border-brand-border">
      <p className="text-brand-muted font-medium mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-brand-muted">{p.name}:</span>
          <span className="font-semibold" style={{ color: p.color }}>{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FinancesPage() {
  const qc = useQueryClient()
  const now = new Date()

  const [period, setPeriod] = useState<Period>('month')
  const [year, setYear]     = useState(now.getFullYear())
  const [month, setMonth]   = useState(now.getMonth() + 1)
  const [from, setFrom]     = useState('')
  const [to, setTo]         = useState('')
  const [chart, setChart]   = useState<'area' | 'bar'>('area')
  const [expenseModal, setExpenseModal] = useState<{ open: boolean; expense: Expense | null }>({ open: false, expense: null })

  const qParams = new URLSearchParams({ period, year: String(year), month: String(month) })
  if (period === 'custom') { if (from) qParams.set('from', from); if (to) qParams.set('to', to) }

  const { data: summary, isLoading: loadingSummary } = useQuery<Summary>({
    queryKey: ['finances-summary', period, year, month, from, to],
    queryFn: () => api.get(`/finances/summary?${qParams}`).then(r => r.data.data),
    staleTime: 60_000,
  })

  const granularity = period === 'year' ? 'month' : 'day'
  const { data: trend = [] } = useQuery<TrendPoint[]>({
    queryKey: ['finances-trend', period, year, month, from, to, granularity],
    queryFn: () => api.get(`/finances/trend?${qParams}&granularity=${granularity}`).then(r => r.data.data),
    staleTime: 60_000,
  })

  const { data: byCategory = [] } = useQuery<CategoryRow[]>({
    queryKey: ['finances-category', period, year, month, from, to],
    queryFn: () => api.get(`/finances/by-category?${qParams}`).then(r => r.data.data),
    staleTime: 60_000,
  })

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ['finances-expenses', period, year, month, from, to],
    queryFn: () => api.get(`/finances/expenses?${qParams}`).then(r => r.data.data),
    staleTime: 30_000,
  })

  const createExpense = useMutation({
    mutationFn: (d: any) => api.post('/finances/expenses', d),
    onSuccess: () => { invalidateAll(); toast.success('Charge ajoutée'); setExpenseModal({ open: false, expense: null }) },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  const updateExpense = useMutation({
    mutationFn: ({ id, d }: { id: string; d: any }) => api.put(`/finances/expenses/${id}`, d),
    onSuccess: () => { invalidateAll(); toast.success('Charge mise à jour'); setExpenseModal({ open: false, expense: null }) },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  const deleteExpense = useMutation({
    mutationFn: (id: string) => api.delete(`/finances/expenses/${id}`),
    onSuccess: () => { invalidateAll(); toast.success('Charge supprimée') },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ['finances-summary'] })
    qc.invalidateQueries({ queryKey: ['finances-trend'] })
    qc.invalidateQueries({ queryKey: ['finances-expenses'] })
  }

  function handleExpenseSave(data: any) {
    if (expenseModal.expense) {
      updateExpense.mutate({ id: expenseModal.expense.id, d: data })
    } else {
      createExpense.mutate(data)
    }
  }

  const s = summary

  const KPIS = s ? [
    {
      label: "Chiffre d'affaires",
      value: formatCurrency(s.revenue),
      sub: `${s.orders} commande${s.orders > 1 ? 's' : ''} complétée${s.orders > 1 ? 's' : ''}`,
      icon: DollarSign, color: '#3B82F6',
    },
    {
      label: 'Coût des ventes (COGS)',
      value: formatCurrency(s.cogs),
      sub: s.revenue > 0 ? `${pct(s.cogs / s.revenue * 100)} du CA` : '—',
      icon: ShoppingBag, color: '#F59E0B',
    },
    {
      label: 'Marge brute',
      value: formatCurrency(s.grossMargin),
      sub: pct(s.grossMarginPct),
      icon: TrendingUp, color: kpiColor(s.grossMarginPct, 50, 20),
    },
    {
      label: 'Charges opérationnelles',
      value: formatCurrency(s.totalExpenses),
      sub: s.revenue > 0 ? `${pct(s.totalExpenses / s.revenue * 100)} du CA` : '—',
      icon: AlertCircle, color: s.totalExpenses > s.grossMargin ? '#EF4444' : '#6B7280',
    },
    {
      label: 'Marge nette',
      value: formatCurrency(s.netMargin),
      sub: pct(s.netMarginPct),
      icon: s.netMargin >= 0 ? TrendingUp : TrendingDown,
      color: kpiColor(s.netMarginPct, 15, 0),
    },
  ] : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Finances</h1>
          <p className="text-brand-muted text-sm">Analyse de la rentabilité globale</p>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['today', 'week', 'month', 'year', 'custom'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-xl text-sm border transition-all ${period === p ? 'bg-brand-orange text-white border-brand-orange' : 'border-brand-border text-brand-muted'}`}>
              {p === 'today' ? "Aujourd'hui" : p === 'week' ? '7 jours' : p === 'month' ? 'Mois' : p === 'year' ? 'Année' : 'Personnalisé'}
            </button>
          ))}

          {period === 'month' && (
            <>
              <select value={month} onChange={e => setMonth(Number(e.target.value))} className="input-field py-1.5 text-sm w-auto">
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className="input-field py-1.5 text-sm w-auto">
                {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </>
          )}

          {period === 'year' && (
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="input-field py-1.5 text-sm w-auto">
              {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}

          {period === 'custom' && (
            <>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input-field py-1.5 text-sm w-auto" />
              <span className="text-brand-muted text-sm">→</span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input-field py-1.5 text-sm w-auto" />
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      {loadingSummary ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-card h-24 skeleton rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {KPIS.map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="glass-card p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs text-brand-muted leading-tight">{label}</p>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}20` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
              </div>
              <p className="text-xl font-bold truncate" style={{ color }}>{value}</p>
              <p className="text-xs text-brand-muted mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Marge summary bar */}
      {s && s.revenue > 0 && (
        <div className="glass-card p-4">
          <p className="text-xs text-brand-muted mb-2 uppercase tracking-wide">Décomposition du CA</p>
          <div className="flex h-6 rounded-full overflow-hidden gap-px">
            {[
              { label: 'COGS', value: s.cogs, color: '#F59E0B' },
              { label: 'Charges', value: s.totalExpenses, color: '#EF4444' },
              { label: 'Marge nette', value: Math.max(0, s.netMargin), color: '#10B981' },
            ].map(({ label, value, color }) => {
              const w = (value / s.revenue) * 100
              if (w < 1) return null
              return (
                <div key={label} className="flex items-center justify-center text-xs font-bold text-white"
                  style={{ width: `${w}%`, background: color, minWidth: 0 }}
                  title={`${label}: ${formatCurrency(value)} (${pct(w)})`}>
                  {w > 8 && pct(w)}
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 mt-2 flex-wrap">
            {[
              { label: 'COGS', color: '#F59E0B', value: s.cogs },
              { label: 'Charges', color: '#EF4444', value: s.totalExpenses },
              { label: 'Marge nette', color: '#10B981', value: Math.max(0, s.netMargin) },
            ].map(({ label, color, value }) => (
              <div key={label} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                <span className="text-brand-muted">{label}:</span>
                <span className="font-semibold" style={{ color }}>{formatCurrency(value)}</span>
                <span className="text-brand-muted">({pct((value / s.revenue) * 100)})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trend chart */}
      {trend.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Évolution financière</h2>
            <div className="flex gap-1">
              {(['area', 'bar'] as const).map(t => (
                <button key={t} onClick={() => setChart(t)}
                  className={`px-3 py-1 rounded-lg text-xs border transition-all ${chart === t ? 'bg-brand-orange text-white border-brand-orange' : 'border-brand-border text-brand-muted'}`}>
                  {t === 'area' ? 'Courbe' : 'Barres'}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            {chart === 'area' ? (
              <AreaChart data={trend} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <defs>
                  {[['rev','#3B82F6'],['gm','#10B981'],['nm','#8B5CF6']].map(([id, c]) => (
                    <linearGradient key={id} id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={c} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={c} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6B7280' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} tickLine={false} axisLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="revenue"    name="CA"          stroke="#3B82F6" fill="url(#g-rev)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="cogs"       name="COGS"        stroke="#F59E0B" fill="none"        strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                <Area type="monotone" dataKey="grossMargin" name="Marge brute" stroke="#10B981" fill="url(#g-gm)"  strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="netMargin"  name="Marge nette" stroke="#8B5CF6" fill="url(#g-nm)"  strokeWidth={2} dot={false} />
              </AreaChart>
            ) : (
              <BarChart data={trend} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6B7280' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} tickLine={false} axisLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="revenue"     name="CA"          fill="#3B82F6" radius={[3,3,0,0]} />
                <Bar dataKey="cogs"        name="COGS"        fill="#F59E0B" radius={[3,3,0,0]} />
                <Bar dataKey="grossMargin" name="Marge brute" fill="#10B981" radius={[3,3,0,0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {/* Two columns: by-category + expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* By category */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-brand-border">
            <h2 className="font-semibold">Marge par catégorie</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-xs text-brand-muted">
                  <th className="px-4 py-2 text-left">Catégorie</th>
                  <th className="px-4 py-2 text-right">CA</th>
                  <th className="px-4 py-2 text-right">COGS</th>
                  <th className="px-4 py-2 text-right">Marge</th>
                  <th className="px-4 py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {byCategory.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-brand-muted text-sm">Aucune donnée</td></tr>
                ) : byCategory.map(row => (
                  <tr key={row.id} className="border-b border-brand-border/30 hover:bg-white/2 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{row.icon} {row.name}</span>
                      <span className="text-xs text-brand-muted ml-1">({row.itemsSold} vendus)</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(row.revenue)}</td>
                    <td className="px-4 py-2.5 text-right text-brand-muted">{formatCurrency(row.cogs)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={row.grossMargin >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {formatCurrency(row.grossMargin)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-12 h-1.5 bg-brand-border rounded-full overflow-hidden">
                          <div className="h-full rounded-full"
                            style={{ width: `${Math.min(100, Math.max(0, row.grossMarginPct))}%`,
                              background: kpiColor(row.grossMarginPct, 50, 20) }} />
                        </div>
                        <span className="font-semibold text-xs" style={{ color: kpiColor(row.grossMarginPct, 50, 20) }}>
                          {pct(row.grossMarginPct)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expenses */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-brand-border flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Charges opérationnelles</h2>
              <p className="text-xs text-brand-muted mt-0.5">
                Total : <span className="text-white font-medium">{formatCurrency(s?.totalExpenses ?? 0)}</span>
              </p>
            </div>
            <button onClick={() => setExpenseModal({ open: true, expense: null })}
              className="btn-primary flex items-center gap-1.5 text-sm py-1.5 px-3">
              <Plus className="w-4 h-4" /> Ajouter
            </button>
          </div>

          {/* Category breakdown */}
          {s && Object.keys(s.expensesByCategory).length > 0 && (
            <div className="px-4 py-3 border-b border-brand-border grid grid-cols-3 gap-2">
              {EXPENSE_CATEGORIES.filter(c => s.expensesByCategory[c.value]).map(cat => (
                <div key={cat.value} className="text-center">
                  <p className="text-xs text-brand-muted">{cat.icon} {cat.label}</p>
                  <p className="font-semibold text-sm">{formatCurrency(s.expensesByCategory[cat.value] ?? 0)}</p>
                </div>
              ))}
            </div>
          )}

          <div className="divide-y divide-brand-border/30 max-h-80 overflow-y-auto">
            {expenses.length === 0 ? (
              <div className="px-4 py-8 text-center text-brand-muted text-sm">
                Aucune charge enregistrée pour cette période
              </div>
            ) : expenses.map(exp => {
              const cat = EXPENSE_CATEGORIES.find(c => c.value === exp.category)
              return (
                <div key={exp.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/2 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{cat?.icon ?? '📋'}</span>
                    <div>
                      <p className="text-sm font-medium">{exp.description || cat?.label}</p>
                      <p className="text-xs text-brand-muted">{new Date(exp.date).toLocaleDateString('fr-FR')} · {cat?.label}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-red-400">−{formatCurrency(exp.amount)}</span>
                    <button onClick={() => setExpenseModal({ open: true, expense: exp })}
                      className="p-1 text-brand-muted hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { if (confirm('Supprimer cette charge ?')) deleteExpense.mutate(exp.id) }}
                      className="p-1 text-brand-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Détail CA */}
      {s && (
        <div className="glass-card p-5">
          <h2 className="font-semibold mb-4">Détail du chiffre d&apos;affaires</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Sous-total HT', value: formatCurrency(s.subtotal) },
              { label: 'Remises', value: `−${formatCurrency(s.discount)}`, neg: true },
              { label: 'TVA (10%)', value: formatCurrency(s.tax) },
              { label: 'Livraison', value: formatCurrency(s.delivery) },
            ].map(({ label, value, neg }) => (
              <div key={label} className="bg-white/3 rounded-xl p-3 text-center">
                <p className="text-xs text-brand-muted mb-1">{label}</p>
                <p className={`font-bold text-lg ${neg ? 'text-red-400' : ''}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expense modal */}
      <AnimatePresence>
        {expenseModal.open && (
          <ExpenseModal
            expense={expenseModal.expense}
            onClose={() => setExpenseModal({ open: false, expense: null })}
            onSave={handleExpenseSave}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

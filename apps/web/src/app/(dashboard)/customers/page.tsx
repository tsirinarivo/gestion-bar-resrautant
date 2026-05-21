'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Users, Search, X, TrendingUp, TrendingDown, ShoppingBag,
  Calendar, Phone, Mail, Star, Award, Plus, Minus, Clock, Download, Filter, ArrowUpDown, ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { exportToXLSX } from '@/lib/xlsx'
import { formatDate, formatDateTime, formatCurrency, initials } from '@restaurant/utils'

const TIER_CONFIG = {
  BRONZE:   { label: 'Bronze',  color: '#CD7F32', bg: 'rgba(205,127,50,0.12)',  icon: '🥉' },
  SILVER:   { label: 'Argent',  color: '#C0C0C0', bg: 'rgba(192,192,192,0.12)', icon: '🥈' },
  GOLD:     { label: 'Or',      color: '#FFD700', bg: 'rgba(255,215,0,0.12)',   icon: '🥇' },
  PLATINUM: { label: 'Platine', color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', icon: '💎' },
}

type Customer = {
  id: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  city?: string
  notes?: string
  createdAt: string
  loyaltyAccount?: {
    id: string
    points: number
    totalEarned: number
    totalSpent: number
    tier: string
    transactions?: LoyaltyTx[]
  }
  orders?: Order[]
  addresses?: { id: string; label: string; address: string; city: string; postalCode: string; isDefault: boolean }[]
  _count?: { orders: number }
}

type LoyaltyTx = {
  id: string
  type: string
  points: number
  balance: number
  description?: string
  createdAt: string
}

type Order = {
  id: string
  total: number
  status: string
  createdAt: string
  items?: { quantity: number; product?: { name: string } }[]
}

// ─── New Customer Modal ───────────────────────────────────────────────────────
function NewCustomerModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', city: '', birthDate: '', acceptsMarketing: false })
  const [loading, setLoading] = useState(false)
  const [duplicate, setDuplicate] = useState<{ id: string; firstName: string; lastName: string; phone?: string; email?: string } | null>(null)
  const [error, setError] = useState('')

  async function checkDuplicate(phone: string, email: string) {
    if (!phone && !email) { setDuplicate(null); return }
    try {
      const params = new URLSearchParams()
      if (phone) params.set('phone', phone)
      if (email) params.set('email', email)
      const res = await api.get(`/customers/check-duplicate?${params}`)
      setDuplicate(res.data.data ?? null)
    } catch { setDuplicate(null) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.firstName.trim() || !form.lastName.trim()) { setError('Prénom et nom requis'); return }
    setLoading(true)
    try {
      await api.post('/customers', {
        firstName: form.firstName.trim(), lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined, email: form.email.trim() || undefined,
        city: form.city.trim() || undefined,
        birthDate: form.birthDate || undefined,
        acceptsMarketing: form.acceptsMarketing,
      })
      onSaved(); onClose()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la création')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-brand-surface rounded-2xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">Nouveau client</h2>
          <button onClick={onClose} className="p-2 hover:bg-brand-muted/10 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-brand-muted mb-1">Prénom *</label>
              <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} className="input-field text-sm" placeholder="Jean" />
            </div>
            <div>
              <label className="block text-xs font-medium text-brand-muted mb-1">Nom *</label>
              <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} className="input-field text-sm" placeholder="Dupont" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-muted mb-1">Téléphone</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              onBlur={() => checkDuplicate(form.phone, form.email)}
              className="input-field text-sm" placeholder="+261 34 00 000 00" />
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-muted mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              onBlur={() => checkDuplicate(form.phone, form.email)}
              className="input-field text-sm" placeholder="jean@email.com" />
          </div>
          {duplicate && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-600">
              ⚠️ Client similaire existant : <strong>{duplicate.firstName} {duplicate.lastName}</strong>
              {duplicate.phone && ` — ${duplicate.phone}`}
              {duplicate.email && ` — ${duplicate.email}`}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-brand-muted mb-1">Ville</label>
              <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className="input-field text-sm" placeholder="Antananarivo" />
            </div>
            <div>
              <label className="block text-xs font-medium text-brand-muted mb-1">Date de naissance</label>
              <input type="date" value={form.birthDate} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} className="input-field text-sm" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.acceptsMarketing} onChange={e => setForm(f => ({ ...f, acceptsMarketing: e.target.checked }))} className="w-4 h-4 accent-brand-orange" />
            <span>Accepte les communications marketing</span>
          </label>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Enregistrement...' : 'Créer le client'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Tier Badge ───────────────────────────────────────────────────────────────
function TierBadge({ tier, size = 'sm' }: { tier: string; size?: 'sm' | 'lg' }) {
  const conf = TIER_CONFIG[tier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG.BRONZE
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'}`}
      style={{ color: conf.color, background: conf.bg, border: `1px solid ${conf.color}40` }}
    >
      {conf.icon} {conf.label}
    </span>
  )
}

// ─── Points Adjustment Form ───────────────────────────────────────────────────
function PointsAdjustForm({ customerId, currentPoints, onSuccess }: {
  customerId: string
  currentPoints: number
  onSuccess: () => void
}) {
  const [mode, setMode] = useState<'add' | 'deduct'>('add')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const qc = useQueryClient()

  const adjust = useMutation({
    mutationFn: (body: { points: number; reason: string }) =>
      api.post(`/customers/${customerId}/loyalty/adjust`, body).then(r => r.data),
    onSuccess: () => {
      toast.success('Points mis à jour')
      qc.invalidateQueries({ queryKey: ['customer', customerId] })
      qc.invalidateQueries({ queryKey: ['customers'] })
      setAmount('')
      setReason('')
      onSuccess()
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error ?? 'Erreur lors de l\'ajustement'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const pts = parseInt(amount, 10)
    if (!pts || pts <= 0) { toast.error('Entrez un nombre de points valide'); return }
    if (!reason.trim()) { toast.error('Veuillez indiquer une raison'); return }
    adjust.mutate({ points: mode === 'add' ? pts : -pts, reason: reason.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('add')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border transition-all ${
            mode === 'add'
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
              : 'border-brand-border text-brand-muted hover:border-brand-border/80'
          }`}
        >
          <Plus className="w-3.5 h-3.5" /> Ajouter
        </button>
        <button
          type="button"
          onClick={() => setMode('deduct')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border transition-all ${
            mode === 'deduct'
              ? 'bg-red-500/10 border-red-500/40 text-red-400'
              : 'border-brand-border text-brand-muted hover:border-brand-border/80'
          }`}
        >
          <Minus className="w-3.5 h-3.5" /> Déduire
        </button>
      </div>
      <input
        type="number"
        min={1}
        value={amount}
        onChange={e => setAmount(e.target.value)}
        placeholder="Nombre de points"
        className="input-field"
      />
      <input
        type="text"
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Raison (ex: geste commercial)"
        className="input-field"
      />
      <button
        type="submit"
        disabled={adjust.isPending}
        className="w-full btn-primary justify-center disabled:opacity-50"
      >
        {adjust.isPending ? 'En cours…' : mode === 'add' ? `Ajouter des points` : `Déduire des points`}
      </button>
    </form>
  )
}

// ─── Customer Detail Panel ────────────────────────────────────────────────────
function CustomerPanel({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const [showAdjust, setShowAdjust] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => api.get(`/customers/${customerId}`).then(r => r.data.data) as Promise<Customer>,
    enabled: !!customerId,
  })

  const customer = data as Customer | undefined
  const loyalty = customer?.loyaltyAccount
  const tier = loyalty?.tier ?? 'BRONZE'
  const tierConf = TIER_CONFIG[tier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG.BRONZE
  const orders = customer?.orders?.slice(0, 5) ?? []
  const transactions = loyalty?.transactions ?? []
  const addresses = customer?.addresses ?? []

  const saveNotes = useMutation({
    mutationFn: () => api.put(`/customers/${customerId}`, { ...customer, notes: notesValue.trim() || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer', customerId] })
      qc.invalidateQueries({ queryKey: ['customers'] })
      setEditingNotes(false)
      toast.success('Notes mises à jour')
    },
    onError: () => toast.error('Erreur'),
  })

  return (
    <motion.div
      key="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        className="absolute right-0 top-0 h-full w-full max-w-lg bg-brand-darker border-l border-brand-border flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border flex-shrink-0">
          <h2 className="text-base font-semibold">Détail client</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-brand-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-brand-muted">
            <div className="space-y-3 w-full px-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton h-8 rounded-xl" />
              ))}
            </div>
          </div>
        ) : !customer ? (
          <div className="flex-1 flex items-center justify-center text-brand-muted">Client introuvable</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Customer identity */}
            <div className="px-6 py-5 border-b border-brand-border/50">
              <div className="flex items-start gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #FF4D00, #FFB800)' }}
                >
                  {initials(customer.firstName, customer.lastName)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg leading-tight">
                    {customer.firstName} {customer.lastName}
                  </h3>
                  <TierBadge tier={tier} size="sm" />
                  <div className="mt-2 space-y-1">
                    {customer.email && (
                      <p className="text-xs text-brand-muted flex items-center gap-1.5">
                        <Mail className="w-3 h-3" /> {customer.email}
                      </p>
                    )}
                    {customer.phone && (
                      <p className="text-xs text-brand-muted flex items-center gap-1.5">
                        <Phone className="w-3 h-3" /> {customer.phone}
                      </p>
                    )}
                    <p className="text-xs text-brand-muted flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" /> Client depuis {formatDate(customer.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Loyalty stats */}
            <div className="px-6 py-5 border-b border-brand-border/50">
              <h4 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5" /> Fidélité
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="glass-card p-3 text-center">
                  <p className="text-xl font-bold" style={{ color: tierConf.color }}>
                    {loyalty?.points ?? 0}
                  </p>
                  <p className="text-xs text-brand-muted mt-0.5">Points</p>
                </div>
                <div className="glass-card p-3 text-center">
                  <p className="text-sm font-bold text-white leading-tight">
                    {formatCurrency(loyalty?.totalSpent ?? 0)}
                  </p>
                  <p className="text-xs text-brand-muted mt-0.5">Dépensé</p>
                </div>
                <div className="glass-card p-3 text-center">
                  <p className="text-xl font-bold text-white">{customer._count?.orders ?? orders.length}</p>
                  <p className="text-xs text-brand-muted mt-0.5">Commandes</p>
                </div>
              </div>
            </div>

            {/* Points adjustment */}
            <div className="px-6 py-5 border-b border-brand-border/50">
              <button
                onClick={() => setShowAdjust(v => !v)}
                className="w-full flex items-center justify-between text-xs font-semibold text-brand-muted uppercase tracking-wider"
              >
                <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5" /> Ajustement manuel</span>
                <span className="text-brand-muted">{showAdjust ? '▲' : '▼'}</span>
              </button>
              <AnimatePresence>
                {showAdjust && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3">
                      <PointsAdjustForm
                        customerId={customer.id}
                        currentPoints={loyalty?.points ?? 0}
                        onSuccess={() => setShowAdjust(false)}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Notes (allergies, preferences) */}
            <div className="px-6 py-5 border-b border-brand-border/50">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-brand-muted uppercase tracking-wider flex items-center gap-1.5">
                  📝 Notes internes
                </h4>
                {!editingNotes && (
                  <button onClick={() => { setEditingNotes(true); setNotesValue(customer?.notes ?? '') }}
                    className="text-xs text-brand-orange hover:underline">
                    {customer?.notes ? 'Modifier' : 'Ajouter'}
                  </button>
                )}
              </div>
              {editingNotes ? (
                <div className="space-y-2">
                  <textarea autoFocus value={notesValue} onChange={e => setNotesValue(e.target.value)}
                    rows={3} placeholder="Allergies, préférences, notes pour l'équipe..."
                    className="w-full input-field text-sm resize-none" />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditingNotes(false)} className="btn-secondary text-xs px-3 py-1">Annuler</button>
                    <button onClick={() => saveNotes.mutate()} disabled={saveNotes.isPending} className="btn-primary text-xs px-3 py-1">
                      {saveNotes.isPending ? '…' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-brand-muted italic">
                  {customer?.notes || 'Aucune note. Cliquez sur "Ajouter" pour signaler des allergies ou préférences.'}
                </p>
              )}
            </div>

            {/* Insights */}
            {orders.length > 0 && (() => {
              const lastOrder = orders[0]
              const avgOrder = orders.reduce((s, o) => s + o.total, 0) / orders.length
              const productFreq: Record<string, number> = {}
              orders.forEach(o => o.items?.forEach(i => {
                const name = i.product?.name ?? '?'
                productFreq[name] = (productFreq[name] ?? 0) + i.quantity
              }))
              const favorite = Object.entries(productFreq).sort((a, b) => b[1] - a[1])[0]
              return (
                <div className="px-6 py-5 border-b border-brand-border/50">
                  <h4 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3">💡 Insights</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-brand-muted mb-0.5">Dernière visite</p>
                      <p className="font-medium">{lastOrder ? formatDate(lastOrder.createdAt) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-brand-muted mb-0.5">Panier moyen</p>
                      <p className="font-medium">{formatCurrency(avgOrder)}</p>
                    </div>
                    {favorite && (
                      <div className="col-span-2">
                        <p className="text-xs text-brand-muted mb-0.5">Produit préféré</p>
                        <p className="font-medium">⭐ {favorite[0]} <span className="text-xs text-brand-muted">({favorite[1]}× commandé)</span></p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Addresses */}
            {addresses.length > 0 && (
              <div className="px-6 py-5 border-b border-brand-border/50">
                <h4 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  📍 Adresses
                </h4>
                <div className="space-y-2">
                  {addresses.map(addr => (
                    <div key={addr.id} className="glass-card px-3 py-2.5">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold capitalize">{addr.label}</span>
                        {addr.isDefault && <span className="text-xs bg-brand-orange/20 text-brand-orange px-2 py-0.5 rounded-full">par défaut</span>}
                      </div>
                      <p className="text-sm">{addr.address}</p>
                      <p className="text-xs text-brand-muted">{addr.postalCode} {addr.city}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent orders */}
            {orders.length > 0 && (
              <div className="px-6 py-5 border-b border-brand-border/50">
                <h4 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5" /> Dernières commandes
                </h4>
                <div className="space-y-2">
                  {orders.map(order => (
                    <div key={order.id} className="glass-card px-3 py-2.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {order.items?.map(i => i.product?.name ?? '?').join(', ').slice(0, 40) ||
                            `Commande #${order.id.slice(-6)}`}
                        </p>
                        <p className="text-xs text-brand-muted">{formatDateTime(order.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(order.total)}</p>
                        <p className="text-xs text-brand-muted capitalize">{order.status.toLowerCase()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Loyalty transaction history */}
            {transactions.length > 0 && (
              <div className="px-6 py-5">
                <h4 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Historique points
                </h4>
                <div className="space-y-2">
                  {transactions.map(tx => {
                    const isEarn = tx.points > 0
                    return (
                      <div key={tx.id} className="glass-card px-3 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isEarn ? 'bg-emerald-500/10' : 'bg-red-500/10'
                            }`}
                          >
                            {isEarn
                              ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                              : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                          </div>
                          <div>
                            <p className="text-xs font-medium">{tx.description || tx.type}</p>
                            <p className="text-xs text-brand-muted">{formatDateTime(tx.createdAt)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-semibold ${isEarn ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isEarn ? '+' : ''}{tx.points} pts
                          </p>
                          <p className="text-xs text-brand-muted">Solde: {tx.balance}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [tierFilter, setTierFilter] = useState('')
  const [marketingFilter, setMarketingFilter] = useState('')
  const [sortBy, setSortBy] = useState('')
  const qc = useQueryClient()

  function buildParams() {
    const p = new URLSearchParams({ page: String(page), limit: '20' })
    if (search) p.set('search', search)
    if (tierFilter) p.set('tier', tierFilter)
    if (marketingFilter) p.set('acceptsMarketing', marketingFilter)
    if (sortBy) p.set('sortBy', sortBy)
    return p.toString()
  }

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, page, tierFilter, marketingFilter, sortBy],
    queryFn: () => api.get(`/customers?${buildParams()}`).then(r => r.data),
  })

  const customers: Customer[] = data?.data ?? []

  async function fetchAllForExport(): Promise<Customer[]> {
    const exportParams = new URLSearchParams({ limit: '500' })
    if (search) exportParams.set('search', search)
    if (tierFilter) exportParams.set('tier', tierFilter)
    if (marketingFilter) exportParams.set('acceptsMarketing', marketingFilter)
    const res = await api.get(`/customers?${exportParams}`)
    return res.data.data ?? []
  }

  async function exportCSV() {
    try {
      const all = await fetchAllForExport()
      const rows = [
        ['Prénom', 'Nom', 'Email', 'Téléphone', 'Ville', 'Fidélité', 'Points', 'Total pts gagnés', 'Commandes', 'Depuis'],
        ...all.map(c => [
          c.firstName,
          c.lastName,
          c.email ?? '',
          c.phone ?? '',
          c.city ?? '',
          c.loyaltyAccount?.tier ?? '',
          c.loyaltyAccount?.points ?? 0,
          c.loyaltyAccount?.totalEarned ?? 0,
          c._count?.orders ?? 0,
          c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-FR') : '',
        ]),
      ]
      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Erreur lors de l\'export') }
  }

  async function exportXLSX() {
    try {
      const all = await fetchAllForExport()
      const rows = all.map(c => ({
        'Prénom': c.firstName,
        'Nom': c.lastName,
        'Email': c.email ?? '',
        'Téléphone': c.phone ?? '',
        'Ville': c.city ?? '',
        'Fidélité': c.loyaltyAccount?.tier ?? '',
        'Points': c.loyaltyAccount?.points ?? 0,
        'Total pts gagnés': c.loyaltyAccount?.totalEarned ?? 0,
        'Commandes': c._count?.orders ?? 0,
        'Depuis': c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-FR') : '',
      }))
      exportToXLSX('clients', rows, 'Clients')
    } catch { toast.error('Erreur lors de l\'export') }
  }

  return (
    <div className="space-y-6">
      {showNew && <NewCustomerModal onClose={() => setShowNew(false)} onSaved={() => qc.invalidateQueries({ queryKey: ['customers'] })} />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-brand-muted text-sm">{data?.pagination?.total ?? 0} clients</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-brand-border text-brand-muted hover:border-brand-orange/40 hover:text-brand-orange text-sm transition-colors">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={exportXLSX} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-brand-border text-brand-muted hover:border-emerald-500/40 hover:text-emerald-400 text-sm transition-colors">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2">
            <Users className="w-4 h-4" />
            Nouveau client
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Rechercher par nom, email, téléphone…"
            className="input-field pl-10"
          />
        </div>
        {/* Tier filter */}
        <select value={tierFilter} onChange={e => { setTierFilter(e.target.value); setPage(1) }}
          className="input-field text-sm w-auto min-w-[120px]">
          <option value="">Tous niveaux</option>
          <option value="BRONZE">🥉 Bronze</option>
          <option value="SILVER">🥈 Argent</option>
          <option value="GOLD">🥇 Or</option>
          <option value="PLATINUM">💎 Platine</option>
        </select>
        {/* Marketing filter */}
        <select value={marketingFilter} onChange={e => { setMarketingFilter(e.target.value); setPage(1) }}
          className="input-field text-sm w-auto min-w-[130px]">
          <option value="">Marketing : tous</option>
          <option value="true">✅ Consentis</option>
          <option value="false">❌ Non consentis</option>
        </select>
        {/* Sort */}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="input-field text-sm w-auto min-w-[120px]">
          <option value="">Trier : récents</option>
          <option value="orders">Nb commandes</option>
          <option value="points">Points fidélité</option>
        </select>
        {/* Clear filters */}
        {(tierFilter || marketingFilter || sortBy) && (
          <button onClick={() => { setTierFilter(''); setMarketingFilter(''); setSortBy(''); setPage(1) }}
            className="flex items-center gap-1 px-3 py-2 text-sm rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors whitespace-nowrap">
            <X className="w-3.5 h-3.5" /> Réinitialiser
          </button>
        )}
      </div>
      {/* Active filter summary */}
      {(tierFilter || marketingFilter) && (
        <div className="flex items-center gap-2 text-xs text-amber-400">
          <Filter className="w-3.5 h-3.5" />
          <span>Filtres actifs : {[tierFilter && `Niveau ${tierFilter}`, marketingFilter === 'true' && 'Consentis marketing', marketingFilter === 'false' && 'Non consentis'].filter(Boolean).join(' · ')}</span>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-brand-muted uppercase">Client</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-brand-muted uppercase">Contact</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-brand-muted uppercase">Fidélité</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-brand-muted uppercase">Dépensé</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-brand-muted uppercase">Commandes</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-brand-muted uppercase">Depuis</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-brand-border/30">
                  <td colSpan={6} className="px-4 py-3">
                    <div className="skeleton h-8 rounded" />
                  </td>
                </tr>
              ))
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-brand-muted">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Aucun client trouvé
                </td>
              </tr>
            ) : (
              customers.map(customer => {
                const tier = customer.loyaltyAccount?.tier ?? 'BRONZE'
                const tierConf = TIER_CONFIG[tier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG.BRONZE
                return (
                  <motion.tr
                    key={customer.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => setSelectedId(customer.id)}
                    className="border-b border-brand-border/30 hover:bg-white/[0.02] transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #FF4D00, #FFB800)' }}
                        >
                          {initials(customer.firstName, customer.lastName)}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{customer.firstName} {customer.lastName}</p>
                          <p className="text-xs text-brand-muted">{customer.city || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-brand-muted">
                      <p>{customer.email || '—'}</p>
                      <p>{customer.phone || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <TierBadge tier={tier} size="sm" />
                        <p className="text-xs text-brand-muted pl-0.5">
                          {customer.loyaltyAccount?.points ?? 0} pts
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {formatCurrency(customer.loyaltyAccount?.totalSpent ?? 0)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold">{customer._count?.orders ?? 0}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-brand-muted">
                      {formatDate(customer.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/customers/${customer.id}`} onClick={e => e.stopPropagation()}
                        className="p-1.5 text-brand-muted hover:text-brand-orange hover:bg-brand-orange/10 rounded-lg transition-colors inline-flex"
                        title="Voir la fiche client">
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </td>
                  </motion.tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="btn-primary disabled:opacity-40"
          >
            ← Précédent
          </button>
          <span className="text-sm text-brand-muted px-3">
            Page {page} / {data.pagination.totalPages}
          </span>
          <button
            disabled={page >= data.pagination.totalPages}
            onClick={() => setPage(p => p + 1)}
            className="btn-primary disabled:opacity-40"
          >
            Suivant →
          </button>
        </div>
      )}

      {/* Detail slide-over */}
      <AnimatePresence>
        {selectedId && (
          <CustomerPanel key={selectedId} customerId={selectedId} onClose={() => setSelectedId(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

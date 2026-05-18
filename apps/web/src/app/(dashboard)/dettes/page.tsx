'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle, CheckCircle2, Clock, XCircle, Plus, X,
  CreditCard, Search, Phone, ChevronDown, ChevronUp, Banknote,
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@restaurant/utils'
import { toast } from 'sonner'

const DEBT_STATUS: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  PENDING:   { label: 'En attente', color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/30',  icon: Clock },
  PARTIAL:   { label: 'Partiel',    color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30',    icon: ChevronDown },
  PAID:      { label: 'Soldé',      color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/30',  icon: CheckCircle2 },
  CANCELLED: { label: 'Annulé',     color: 'text-gray-400',   bg: 'bg-gray-500/10 border-gray-500/30',    icon: XCircle },
}

const PAYMENT_METHODS = [
  { value: 'CASH',         label: 'Espèces' },
  { value: 'MVOLA',        label: 'MVola' },
  { value: 'ORANGE_MONEY', label: 'Orange Money' },
  { value: 'AIRTEL_MONEY', label: 'Airtel Money' },
  { value: 'CARD',         label: 'Carte' },
  { value: 'BNI_MOBILE',   label: 'BNI Mobile' },
  { value: 'BOA_MOBILE',   label: 'BOA Mobile' },
  { value: 'VIREMENT',     label: 'Virement' },
  { value: 'CHEQUE',       label: 'Chèque' },
]

type Customer = { id: string; firstName: string; lastName: string; phone?: string }
type DebtPayment = { id: string; amount: number; method: string; notes?: string; createdAt: string }
type Debt = {
  id: string; amount: number; paidAmount: number; status: string
  dueDate?: string; notes?: string; orderRef?: string; createdAt: string
  customer: Customer
  payments: DebtPayment[]
}

// ─── Create Debt Modal ────────────────────────────────────────────────────────

function CreateDebtModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [search, setSearch]     = useState('')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [amount, setAmount]     = useState('')
  const [dueDate, setDueDate]   = useState('')
  const [orderRef, setOrderRef] = useState('')
  const [notes, setNotes]       = useState('')

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers-search', search],
    queryFn: () => api.get(`/customers?search=${encodeURIComponent(search)}&limit=10`).then(r => r.data.data),
    enabled: search.length >= 2,
  })

  const create = useMutation({
    mutationFn: (data: any) => api.post('/debts', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debts'] })
      qc.invalidateQueries({ queryKey: ['debt-stats'] })
      toast.success('Dette enregistrée')
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!customer) { toast.error('Sélectionnez un client'); return }
    if (!amount || parseFloat(amount) <= 0) { toast.error('Montant invalide'); return }
    create.mutate({
      customerId: customer.id,
      amount: parseFloat(amount),
      dueDate: dueDate || undefined,
      orderRef: orderRef.trim() || undefined,
      notes: notes.trim() || undefined,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-brand-border">
          <h2 className="text-xl font-bold">Nouvelle dette</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Customer search */}
          <div>
            <label className="text-sm text-brand-muted mb-1 block">Client *</label>
            {customer ? (
              <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                <div>
                  <p className="font-medium">{customer.firstName} {customer.lastName}</p>
                  {customer.phone && <p className="text-xs text-brand-muted">{customer.phone}</p>}
                </div>
                <button type="button" onClick={() => setCustomer(null)} className="text-brand-muted hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  className="input-field pl-10" placeholder="Rechercher un client..." />
                {search.length >= 2 && customers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 glass-card border border-brand-border rounded-xl overflow-hidden z-10 max-h-48 overflow-y-auto">
                    {customers.map(c => (
                      <button key={c.id} type="button" onClick={() => { setCustomer(c); setSearch('') }}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 text-left text-sm">
                        <span className="font-medium">{c.firstName} {c.lastName}</span>
                        {c.phone && <span className="text-brand-muted text-xs flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {search.length >= 2 && customers.length === 0 && (
                  <p className="text-xs text-brand-muted mt-1 px-1">Aucun client trouvé</p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-brand-muted mb-1 block">Montant (Ar) *</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                min="1" className="input-field" placeholder="0" />
            </div>
            <div>
              <label className="text-sm text-brand-muted mb-1 block">Échéance</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="input-field" />
            </div>
          </div>

          <div>
            <label className="text-sm text-brand-muted mb-1 block">N° commande / référence</label>
            <input value={orderRef} onChange={e => setOrderRef(e.target.value)}
              className="input-field" placeholder="CMD-xxx ou autre référence" />
          </div>

          <div>
            <label className="text-sm text-brand-muted mb-1 block">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              className="input-field resize-none" rows={2} placeholder="Motif, remarques..." />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Annuler</button>
            <button type="submit" disabled={create.isPending} className="flex-1 btn-primary disabled:opacity-50">
              {create.isPending ? 'Enregistrement...' : 'Créer la dette'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Pay Debt Modal ───────────────────────────────────────────────────────────

function PayDebtModal({ debt, onClose }: { debt: Debt; onClose: () => void }) {
  const qc = useQueryClient()
  const remaining = debt.amount - debt.paidAmount
  const [amount, setAmount] = useState(String(Math.round(remaining)))
  const [method, setMethod] = useState('CASH')
  const [notes, setNotes]   = useState('')

  const pay = useMutation({
    mutationFn: (data: any) => api.post(`/debts/${debt.id}/pay`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debts'] })
      qc.invalidateQueries({ queryKey: ['debt-stats'] })
      toast.success('Paiement enregistré')
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error('Montant invalide'); return }
    pay.mutate({ amount: amt, method, notes: notes.trim() || undefined })
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-brand-border">
          <div>
            <h2 className="text-xl font-bold">Encaisser un remboursement</h2>
            <p className="text-brand-muted text-sm mt-0.5">
              {debt.customer.firstName} {debt.customer.lastName} — reste dû : <strong className="text-amber-400">{formatCurrency(remaining)}</strong>
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm text-brand-muted mb-1 block">Montant encaissé (Ar) *</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              min="1" max={remaining} className="input-field text-lg font-bold" />
          </div>

          <div>
            <label className="text-sm text-brand-muted mb-2 block">Moyen de paiement</label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(m => (
                <button key={m.value} type="button" onClick={() => setMethod(m.value)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                    method === m.value ? 'bg-brand-orange border-brand-orange text-white' : 'border-brand-border text-brand-muted hover:border-brand-orange/40'
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-brand-muted mb-1 block">Notes (optionnel)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              className="input-field" placeholder="Remarque..." />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Annuler</button>
            <button type="submit" disabled={pay.isPending} className="flex-1 btn-primary disabled:opacity-50">
              {pay.isPending ? 'Traitement...' : `Encaisser ${amount ? formatCurrency(parseFloat(amount) || 0) : '…'}`}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Debt Row ────────────────────────────────────────────────────────────────

function DebtRow({ debt, onPay, onCancel, onDelete }: {
  debt: Debt
  onPay: () => void
  onCancel: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const st = DEBT_STATUS[debt.status] ?? { label: debt.status, color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/30', icon: AlertCircle }
  const remaining = debt.amount - debt.paidAmount
  const progress = debt.amount > 0 ? (debt.paidAmount / debt.amount) * 100 : 0
  const isOverdue = debt.dueDate && debt.status !== 'PAID' && debt.status !== 'CANCELLED'
    && new Date(debt.dueDate) < new Date()

  return (
    <div className={`glass-card overflow-hidden border ${isOverdue ? 'border-red-500/30' : 'border-transparent'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold truncate">
                {debt.customer.firstName} {debt.customer.lastName}
              </p>
              {debt.customer.phone && (
                <span className="text-xs text-brand-muted flex items-center gap-1 flex-shrink-0">
                  <Phone className="w-3 h-3" />{debt.customer.phone}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-muted">
              {debt.orderRef && <span>Réf : {debt.orderRef}</span>}
              <span>Créée le {formatDate(debt.createdAt)}</span>
              {debt.dueDate && (
                <span className={isOverdue ? 'text-red-400 font-medium' : ''}>
                  {isOverdue ? '⚠️ ' : ''}Échéance : {formatDate(debt.dueDate)}
                </span>
              )}
            </div>
            {debt.notes && <p className="text-xs text-brand-muted mt-1 italic">{debt.notes}</p>}
          </div>

          <div className="text-right flex-shrink-0">
            <p className="font-bold text-lg">{formatCurrency(debt.amount)}</p>
            {debt.status !== 'PAID' && debt.status !== 'CANCELLED' && (
              <p className="text-amber-400 text-sm font-medium">reste {formatCurrency(remaining)}</p>
            )}
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border mt-1 ${st.bg} ${st.color}`}>
              <st.icon className="w-3 h-3" /> {st.label}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        {debt.paidAmount > 0 && debt.status !== 'CANCELLED' && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-brand-muted mb-1">
              <span>Payé : {formatCurrency(debt.paidAmount)}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-brand-orange rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          {['PENDING', 'PARTIAL'].includes(debt.status) && (
            <button onClick={onPay}
              className="flex items-center gap-1.5 text-sm font-medium bg-brand-orange/10 border border-brand-orange/30 text-brand-orange hover:bg-brand-orange/20 px-3 py-1.5 rounded-xl transition-colors">
              <Banknote className="w-4 h-4" /> Encaisser remboursement
            </button>
          )}
          {['PENDING', 'PARTIAL'].includes(debt.status) && (
            <button onClick={onCancel}
              className="text-xs text-brand-muted hover:text-red-400 px-2 py-1.5 rounded-xl hover:bg-red-500/10 transition-colors">
              Annuler
            </button>
          )}
          {['PAID', 'CANCELLED'].includes(debt.status) && (
            <button onClick={onDelete}
              className="text-xs text-brand-muted hover:text-red-400 px-2 py-1.5 rounded-xl hover:bg-red-500/10 transition-colors">
              Supprimer
            </button>
          )}
          {debt.payments.length > 0 && (
            <button onClick={() => setExpanded(e => !e)}
              className="ml-auto flex items-center gap-1 text-xs text-brand-muted hover:text-white transition-colors">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {debt.payments.length} paiement{debt.payments.length > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>

      {/* Payment history */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden border-t border-brand-border/50">
            <div className="p-3 space-y-1.5">
              {debt.payments.map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm px-2 py-1.5 bg-white/3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5 text-brand-muted" />
                    <span className="text-brand-muted text-xs">{formatDate(p.createdAt)}</span>
                    <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded">
                      {PAYMENT_METHODS.find(m => m.value === p.method)?.label ?? p.method}
                    </span>
                    {p.notes && <span className="text-xs text-brand-muted italic">{p.notes}</span>}
                  </div>
                  <span className="font-semibold text-green-400">+{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DettesPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch]             = useState('')
  const [showCreate, setShowCreate]     = useState(false)
  const [payDebt, setPayDebt]           = useState<Debt | null>(null)

  const { data: debts = [], isLoading } = useQuery<Debt[]>({
    queryKey: ['debts', statusFilter],
    queryFn: () => api.get(`/debts${statusFilter ? `?status=${statusFilter}` : ''}`).then(r => r.data.data),
    refetchInterval: 30_000,
  })

  const { data: stats } = useQuery({
    queryKey: ['debt-stats'],
    queryFn: () => api.get('/debts/stats').then(r => r.data.data),
    refetchInterval: 30_000,
  })

  const cancelDebt = useMutation({
    mutationFn: (id: string) => api.patch(`/debts/${id}/cancel`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['debts'] }); qc.invalidateQueries({ queryKey: ['debt-stats'] }); toast.success('Dette annulée') },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  const deleteDebt = useMutation({
    mutationFn: (id: string) => api.delete(`/debts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['debts'] }); qc.invalidateQueries({ queryKey: ['debt-stats'] }); toast.success('Dette supprimée') },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  const filtered = debts.filter(d =>
    !search || `${d.customer.firstName} ${d.customer.lastName} ${d.customer.phone ?? ''} ${d.orderRef ?? ''}`
      .toLowerCase().includes(search.toLowerCase())
  )

  const outstandingDebts = debts.filter(d => ['PENDING', 'PARTIAL'].includes(d.status))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dettes clients</h1>
          <p className="text-brand-muted text-sm">
            {stats?.debtorCount ?? 0} débiteur{stats?.debtorCount !== 1 ? 's' : ''} ·{' '}
            {outstandingDebts.length > 0
              ? <span className="text-amber-400">{outstandingDebts.length} en attente</span>
              : 'Aucune dette en cours'}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Nouvelle dette
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-4 text-center">
            <p className="text-xs text-brand-muted mb-1">Total dû</p>
            <p className="text-2xl font-bold text-amber-400">{formatCurrency(stats.totalOutstanding ?? 0)}</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-xs text-brand-muted mb-1">Débiteurs</p>
            <p className="text-2xl font-bold">{stats.debtorCount ?? 0}</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-xs text-brand-muted mb-1">En attente</p>
            <p className="text-2xl font-bold text-amber-400">{stats.pendingCount ?? 0}</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-xs text-brand-muted mb-1">Soldées</p>
            <p className="text-2xl font-bold text-green-400">{stats.paidCount ?? 0}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher client, référence..." className="input-field pl-10" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[{ value: '', label: 'Toutes' }, ...Object.entries(DEBT_STATUS).map(([k, v]) => ({ value: k, label: v.label }))].map(s => (
            <button key={s.value} onClick={() => setStatusFilter(s.value)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                statusFilter === s.value ? 'bg-brand-orange text-white border-brand-orange' : 'border-brand-border text-brand-muted hover:text-white'
              }`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-brand-muted">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucune dette trouvée</p>
          <p className="text-sm mt-1">
            {statusFilter || search ? 'Modifiez vos filtres' : 'Créez une dette pour commencer le suivi'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(debt => (
            <DebtRow
              key={debt.id}
              debt={debt}
              onPay={() => setPayDebt(debt)}
              onCancel={() => {
                if (confirm(`Annuler la dette de ${formatCurrency(debt.amount)} de ${debt.customer.firstName} ${debt.customer.lastName} ?`))
                  cancelDebt.mutate(debt.id)
              }}
              onDelete={() => {
                if (confirm('Supprimer définitivement cette dette ?'))
                  deleteDebt.mutate(debt.id)
              }}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showCreate && <CreateDebtModal onClose={() => setShowCreate(false)} />}
        {payDebt && <PayDebtModal debt={payDebt} onClose={() => setPayDebt(null)} />}
      </AnimatePresence>
    </div>
  )
}

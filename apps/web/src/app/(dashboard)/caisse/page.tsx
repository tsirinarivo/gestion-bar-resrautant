'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Landmark, Plus, X, Clock, CheckCircle2, AlertCircle,
  ChevronLeft, ChevronRight, ArrowUpCircle, ArrowDownCircle,
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency } from '@restaurant/utils'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ─────────────────────────────────────────────────────────────────────

type TransactionType = 'SALE' | 'REFUND' | 'EXPENSE' | 'DEPOSIT' | 'WITHDRAWAL' | 'ADJUSTMENT'
type SessionStatus = 'OPEN' | 'CLOSED'

type CaisseTransaction = {
  id: string
  type: TransactionType
  amount: number
  description?: string
  reference?: string
  createdAt: string
}

type CaisseSession = {
  id: string
  status: SessionStatus
  openingFloat: number
  closingFloat?: number
  expectedCash?: number
  difference?: number
  notes?: string
  openedAt: string
  closedAt?: string
  transactions: CaisseTransaction[]
}

type Meta = { page: number; perPage: number; total: number; totalPages: number }

// ─── Constants ─────────────────────────────────────────────────────────────────

const TX_TYPES: { value: TransactionType; label: string; sign: 1 | -1 }[] = [
  { value: 'SALE',       label: 'Vente cash',       sign:  1 },
  { value: 'REFUND',     label: 'Remboursement',    sign: -1 },
  { value: 'EXPENSE',    label: 'Dépense',          sign: -1 },
  { value: 'DEPOSIT',    label: 'Dépôt en banque',  sign: -1 },
  { value: 'WITHDRAWAL', label: 'Retrait banque',   sign:  1 },
  { value: 'ADJUSTMENT', label: 'Ajustement',       sign:  1 },
]

function txLabel(type: TransactionType) {
  return TX_TYPES.find(t => t.value === type)?.label ?? type
}

function txSign(type: TransactionType) {
  return TX_TYPES.find(t => t.value === type)?.sign ?? 1
}

// ─── Status Badge ──────────────────────────────────────────────────────────────

function SessionBadge({ status }: { status: SessionStatus }) {
  if (status === 'OPEN') {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border bg-green-500/15 text-green-400 border-green-500/30">
        Ouverte
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border bg-gray-500/15 text-gray-400 border-gray-500/30">
      Fermée
    </span>
  )
}

// ─── Open Session Modal ────────────────────────────────────────────────────────

function OpenSessionModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (data: { openingFloat: number; notes: string }) => void
}) {
  const [openingFloat, setOpeningFloat] = useState('0')
  const [notes, setNotes] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const float = parseFloat(openingFloat)
    if (isNaN(float) || float < 0) { toast.error('Montant invalide'); return }
    onSave({ openingFloat: float, notes })
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-brand-card border border-brand-border rounded-2xl shadow-xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-brand-border">
          <h2 className="font-bold text-lg">Ouvrir la caisse</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs text-brand-muted mb-1 block">Fond de caisse initial (Ar)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={openingFloat}
              onChange={e => setOpeningFloat(e.target.value)}
              className="input-field text-lg font-semibold"
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1 block">Notes</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="input-field"
              placeholder="Remarques optionnelles"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Annuler</button>
            <button type="submit" className="flex-1 btn-primary">Ouvrir la session</button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Close Session Modal ───────────────────────────────────────────────────────

function CloseSessionModal({
  session,
  onClose,
  onSave,
}: {
  session: CaisseSession
  onClose: () => void
  onSave: (data: { closingFloat: number; notes: string }) => void
}) {
  const [closingFloat, setClosingFloat] = useState('')
  const [notes, setNotes] = useState('')

  const expectedCash = session.expectedCash ?? 0
  const closing = parseFloat(closingFloat) || 0
  const difference = closing - expectedCash

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const float = parseFloat(closingFloat)
    if (isNaN(float) || float < 0) { toast.error('Montant invalide'); return }
    onSave({ closingFloat: float, notes })
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-brand-card border border-brand-border rounded-2xl shadow-xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-brand-border">
          <h2 className="font-bold text-lg">Fermer la session</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 bg-white/3 rounded-xl p-3 text-sm">
            <div>
              <p className="text-xs text-brand-muted mb-0.5">Fond initial</p>
              <p className="font-semibold">{formatCurrency(session.openingFloat)}</p>
            </div>
            <div>
              <p className="text-xs text-brand-muted mb-0.5">Espèces attendues</p>
              <p className="font-semibold">{formatCurrency(expectedCash)}</p>
            </div>
          </div>

          <div>
            <label className="text-xs text-brand-muted mb-1 block">Comptage physique (Ar) *</label>
            <input
              type="number"
              min="0"
              step="1"
              value={closingFloat}
              onChange={e => setClosingFloat(e.target.value)}
              className="input-field text-lg font-semibold"
              placeholder="Saisissez le montant compté"
              required
            />
          </div>

          {closingFloat !== '' && (
            <div className={`flex items-center justify-between p-3 rounded-xl border ${
              difference < 0
                ? 'bg-red-500/10 border-red-500/30'
                : difference > 0
                ? 'bg-yellow-500/10 border-yellow-500/30'
                : 'bg-green-500/10 border-green-500/30'
            }`}>
              <span className="text-sm font-medium">Écart</span>
              <span className={`font-bold text-lg ${
                difference < 0 ? 'text-red-400' : difference > 0 ? 'text-yellow-400' : 'text-green-400'
              }`}>
                {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
              </span>
            </div>
          )}

          <div>
            <label className="text-xs text-brand-muted mb-1 block">Notes de clôture</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="input-field"
              placeholder="Remarques optionnelles"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Annuler</button>
            <button type="submit" className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-xl transition-colors text-sm">
              Fermer la session
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Add Transaction Modal ─────────────────────────────────────────────────────

function AddTransactionModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (data: { type: TransactionType; amount: number; description: string; reference: string }) => void
}) {
  const [form, setForm] = useState({
    type: 'SALE' as TransactionType,
    amount: '',
    description: '',
    reference: '',
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) { toast.error('Montant requis'); return }
    onSave({ ...form, amount })
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-brand-card border border-brand-border rounded-2xl shadow-xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-brand-border">
          <h2 className="font-bold text-lg">Nouvelle transaction</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs text-brand-muted mb-1 block">Type *</label>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as TransactionType }))}
              className="input-field"
            >
              {TX_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1 block">Montant (Ar) *</label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="input-field"
              placeholder="0"
              required
            />
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1 block">Description</label>
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="input-field"
              placeholder="Ex: Vente table 5"
            />
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1 block">Référence</label>
            <input
              value={form.reference}
              onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
              className="input-field"
              placeholder="Ex: CMD-0042"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Annuler</button>
            <button type="submit" className="flex-1 btn-primary">Enregistrer</button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Time Since ────────────────────────────────────────────────────────────────

function timeSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}min`
  return `${m}min`
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CaissePage() {
  const qc = useQueryClient()
  const [openModal, setOpenModal] = useState(false)
  const [closeModal, setCloseModal] = useState(false)
  const [txModal, setTxModal] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)

  // Current session
  const { data: currentSession, isLoading: loadingCurrent } = useQuery<CaisseSession | null>({
    queryKey: ['caisse-current'],
    queryFn: () => api.get('/caisse/current').then(r => r.data.data),
    refetchInterval: 30_000,
  })

  // Sessions history
  const { data: sessionsRes, isLoading: loadingHistory } = useQuery<{ data: CaisseSession[]; meta: Meta }>({
    queryKey: ['caisse-sessions', historyPage],
    queryFn: () => api.get(`/caisse/sessions?page=${historyPage}&perPage=10`).then(r => r.data),
    placeholderData: prev => prev,
  })

  // Detail of expanded session
  const { data: expandedDetail } = useQuery<CaisseSession>({
    queryKey: ['caisse-session-detail', expandedSession],
    queryFn: () => api.get(`/caisse/sessions/${expandedSession}`).then(r => r.data.data),
    enabled: !!expandedSession,
  })

  const sessions = sessionsRes?.data ?? []
  const sessionsMeta = sessionsRes?.meta

  const openSession = useMutation({
    mutationFn: (d: { openingFloat: number; notes: string }) => api.post('/caisse/open', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caisse-current'] })
      qc.invalidateQueries({ queryKey: ['caisse-sessions'] })
      toast.success('Session ouverte')
      setOpenModal(false)
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  const closeSession = useMutation({
    mutationFn: ({ id, d }: { id: string; d: { closingFloat: number; notes: string } }) =>
      api.post(`/caisse/sessions/${id}/close`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caisse-current'] })
      qc.invalidateQueries({ queryKey: ['caisse-sessions'] })
      toast.success('Session fermée')
      setCloseModal(false)
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  const addTransaction = useMutation({
    mutationFn: ({ id, d }: { id: string; d: any }) =>
      api.post(`/caisse/sessions/${id}/transaction`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caisse-current'] })
      toast.success('Transaction enregistrée')
      setTxModal(false)
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  const session = currentSession

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Caisse</h1>
          <p className="text-brand-muted text-sm">Gestion des sessions de caisse</p>
        </div>
        {!session && !loadingCurrent && (
          <button
            onClick={() => setOpenModal(true)}
            className="btn-primary flex items-center gap-1.5 text-sm"
          >
            <Plus className="w-4 h-4" /> Ouvrir une session
          </button>
        )}
      </div>

      {/* Current session card */}
      {loadingCurrent ? (
        <div className="bg-brand-card border border-brand-border rounded-2xl h-32 animate-pulse" />
      ) : session ? (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5">
          <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="font-bold text-green-400">Session ouverte</p>
                <div className="flex items-center gap-1.5 text-xs text-brand-muted mt-0.5">
                  <Clock className="w-3 h-3" />
                  <span>Ouverte depuis {timeSince(session.openedAt)}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setTxModal(true)}
                className="btn-secondary flex items-center gap-1.5 text-sm py-1.5 px-3"
              >
                <Plus className="w-4 h-4" /> Ajouter transaction
              </button>
              <button
                onClick={() => setCloseModal(true)}
                className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 font-semibold px-3 py-1.5 rounded-xl text-sm transition-colors flex items-center gap-1.5"
              >
                <X className="w-4 h-4" /> Fermer la session
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Fond initial', value: formatCurrency(session.openingFloat) },
              { label: 'Transactions', value: session.transactions.length.toString() },
              { label: 'Espèces attendues', value: session.expectedCash != null ? formatCurrency(session.expectedCash) : '—' },
              { label: 'Ouverte à', value: new Date(session.openedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-xs text-brand-muted mb-0.5">{label}</p>
                <p className="font-bold">{value}</p>
              </div>
            ))}
          </div>

          {/* Transactions list */}
          {session.transactions.length > 0 && (
            <div className="bg-brand-card/60 rounded-xl overflow-hidden">
              <div className="px-4 py-2 border-b border-brand-border">
                <p className="text-xs text-brand-muted uppercase tracking-wide font-medium">Transactions de la session</p>
              </div>
              <div className="divide-y divide-brand-border/30 max-h-64 overflow-y-auto">
                {session.transactions.map(tx => {
                  const sign = txSign(tx.type)
                  return (
                    <div key={tx.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/2 transition-colors">
                      <div className="flex items-center gap-3">
                        {sign > 0 ? (
                          <ArrowUpCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                        ) : (
                          <ArrowDownCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{txLabel(tx.type)}</p>
                          {tx.description && <p className="text-xs text-brand-muted">{tx.description}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold text-sm ${sign > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {sign > 0 ? '+' : '−'}{formatCurrency(tx.amount)}
                        </p>
                        <p className="text-xs text-brand-muted">
                          {new Date(tx.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-8 text-center">
          <Landmark className="w-12 h-12 text-brand-muted mx-auto mb-3 opacity-50" />
          <p className="font-medium mb-1">Aucune session ouverte</p>
          <p className="text-brand-muted text-sm mb-4">Ouvrez une session pour commencer à enregistrer les transactions.</p>
          <button onClick={() => setOpenModal(true)} className="btn-primary">
            Ouvrir une session
          </button>
        </div>
      )}

      {/* Sessions history */}
      <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-brand-border">
          <h2 className="font-semibold">Historique des sessions</h2>
        </div>
        {loadingHistory ? (
          <div className="p-8 text-center text-brand-muted">Chargement…</div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-brand-muted">Aucune session dans l'historique.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-border text-xs text-brand-muted">
                    <th className="px-4 py-3 text-left">Ouverture</th>
                    <th className="px-4 py-3 text-left">Fermeture</th>
                    <th className="px-4 py-3 text-right">Fond initial</th>
                    <th className="px-4 py-3 text-right">Fond final</th>
                    <th className="px-4 py-3 text-right">Attendu</th>
                    <th className="px-4 py-3 text-right">Écart</th>
                    <th className="px-4 py-3 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => {
                    const diff = (s.closingFloat ?? 0) - (s.expectedCash ?? 0)
                    const isExpanded = expandedSession === s.id
                    const detail = isExpanded ? expandedDetail : null
                    const totalSales = detail?.transactions.filter(t => t.type === 'SALE').reduce((sum, t) => sum + t.amount, 0) ?? 0
                    return (
                      <>
                        <tr
                          key={s.id}
                          onClick={() => setExpandedSession(isExpanded ? null : s.id)}
                          className="border-b border-brand-border/30 hover:bg-white/2 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3 text-xs">
                            <span className="mr-1 text-brand-muted">{isExpanded ? '▼' : '▶'}</span>
                            {new Date(s.openedAt).toLocaleString('fr-FR', {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                            })}
                          </td>
                          <td className="px-4 py-3 text-xs text-brand-muted">
                            {s.closedAt
                              ? new Date(s.closedAt).toLocaleString('fr-FR', {
                                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                                })
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">{formatCurrency(s.openingFloat)}</td>
                          <td className="px-4 py-3 text-right">
                            {s.closingFloat !== undefined ? formatCurrency(s.closingFloat) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-brand-muted">
                            {s.expectedCash !== undefined ? formatCurrency(s.expectedCash) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {s.status === 'CLOSED' ? (
                              <span className={diff < 0 ? 'text-red-400 font-semibold' : diff > 0 ? 'text-yellow-400 font-semibold' : 'text-green-400'}>
                                {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <SessionBadge status={s.status} />
                          </td>
                        </tr>

                        {/* Expanded transactions */}
                        {isExpanded && (
                          <tr key={`${s.id}-detail`} className="bg-white/2">
                            <td colSpan={7} className="px-4 pb-4 pt-2">
                              {!detail ? (
                                <p className="text-xs text-brand-muted py-2">Chargement…</p>
                              ) : detail.transactions.length === 0 ? (
                                <p className="text-xs text-brand-muted py-2">Aucune transaction enregistrée pour cette session.</p>
                              ) : (
                                <div className="rounded-xl border border-brand-border overflow-hidden">
                                  <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-brand-border">
                                    <span className="text-xs font-semibold text-brand-muted uppercase tracking-wide">
                                      {detail.transactions.length} transaction(s)
                                    </span>
                                    <span className="text-xs text-green-400 font-semibold">
                                      Ventes : {formatCurrency(totalSales)}
                                    </span>
                                  </div>
                                  <div className="divide-y divide-brand-border/30 max-h-72 overflow-y-auto">
                                    {detail.transactions.map(tx => {
                                      const sign = txSign(tx.type)
                                      return (
                                        <div key={tx.id} className="flex items-center justify-between px-3 py-2 hover:bg-white/3 transition-colors">
                                          <div className="flex items-center gap-2 min-w-0">
                                            {sign > 0
                                              ? <ArrowUpCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                                              : <ArrowDownCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                                            <div className="min-w-0">
                                              <p className="text-xs font-medium">{txLabel(tx.type)}</p>
                                              {tx.description && (
                                                <p className="text-[11px] text-brand-muted truncate">{tx.description}</p>
                                              )}
                                            </div>
                                          </div>
                                          <div className="text-right flex-shrink-0 ml-4">
                                            <p className={`text-xs font-semibold ${sign > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                              {sign > 0 ? '+' : '−'}{formatCurrency(tx.amount)}
                                            </p>
                                            <p className="text-[11px] text-brand-muted">
                                              {new Date(tx.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {sessionsMeta && sessionsMeta.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-brand-border">
                <span className="text-xs text-brand-muted">
                  {((sessionsMeta.page - 1) * sessionsMeta.perPage) + 1}–
                  {Math.min(sessionsMeta.page * sessionsMeta.perPage, sessionsMeta.total)} sur {sessionsMeta.total}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                    disabled={historyPage === 1}
                    className="p-1.5 rounded-lg border border-brand-border text-brand-muted hover:text-white disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setHistoryPage(p => Math.min(sessionsMeta.totalPages, p + 1))}
                    disabled={historyPage === sessionsMeta.totalPages}
                    className="p-1.5 rounded-lg border border-brand-border text-brand-muted hover:text-white disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {openModal && (
          <OpenSessionModal
            onClose={() => setOpenModal(false)}
            onSave={d => openSession.mutate(d)}
          />
        )}
        {closeModal && session && (
          <CloseSessionModal
            session={session}
            onClose={() => setCloseModal(false)}
            onSave={d => closeSession.mutate({ id: session.id, d })}
          />
        )}
        {txModal && session && (
          <AddTransactionModal
            onClose={() => setTxModal(false)}
            onSave={d => addTransaction.mutate({ id: session.id, d })}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

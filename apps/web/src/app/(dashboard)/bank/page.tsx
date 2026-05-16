'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2, Plus, X, Edit2, Trash2,
  ArrowUpCircle, ArrowDownCircle, CheckSquare, Square,
  ChevronLeft, ChevronRight, Wallet,
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency } from '@restaurant/utils'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ─────────────────────────────────────────────────────────────────────

type AccountType = 'CHECKING' | 'SAVINGS'
type TransactionType = 'CREDIT' | 'DEBIT'

const PAYMENT_METHODS = [
  { value: 'CASH',    label: '💵 Espèces' },
  { value: 'CARD',    label: '💳 Carte bancaire' },
  { value: 'STRIPE',  label: '🌐 Stripe' },
  { value: 'PAYPAL',  label: '🅿️ PayPal' },
  { value: 'VOUCHER', label: '🎟️ Bon / Chèque' },
  { value: 'WALLET',  label: '👜 Wallet' },
]

type BankAccount = {
  id: string
  name: string
  bankName: string
  accountNumber?: string
  type: AccountType
  balance: number
  currency: string
  isActive: boolean
  paymentMethod?: string | null
  transactionCount?: number
}

type BankTransaction = {
  id: string
  type: TransactionType
  amount: number
  description?: string
  reference?: string
  date: string
  reconciled: boolean
}

type Meta = { page: number; perPage: number; total: number; totalPages: number }

// ─── Helpers ───────────────────────────────────────────────────────────────────

function accountTypeLabel(type: AccountType) {
  return type === 'CHECKING' ? 'Courant' : 'Épargne'
}

function txTypeLabel(type: TransactionType) {
  return type === 'CREDIT' ? 'Crédit (entrée)' : 'Débit (sortie)'
}

// ─── Account Modal ─────────────────────────────────────────────────────────────

function AccountModal({
  account,
  onClose,
  onSave,
}: {
  account: BankAccount | null
  onClose: () => void
  onSave: (data: any) => void
}) {
  const [form, setForm] = useState({
    name: account?.name ?? '',
    bankName: account?.bankName ?? '',
    accountNumber: account?.accountNumber ?? '',
    type: account?.type ?? ('CHECKING' as AccountType),
    initialBalance: account?.balance?.toString() ?? '0',
    currency: account?.currency ?? 'MGA',
    isActive: account?.isActive ?? true,
    paymentMethod: account?.paymentMethod ?? '',
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Le nom est requis'); return }
    onSave({
      ...form,
      paymentMethod: form.paymentMethod || null,
      initialBalance: parseFloat(form.initialBalance) || 0,
    })
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
          <h2 className="font-bold text-lg">{account ? 'Modifier le compte' : 'Nouveau compte bancaire'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs text-brand-muted mb-1 block">Nom du compte *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input-field"
              placeholder="Ex: Compte principal BNI"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-brand-muted mb-1 block">Banque</label>
              <input
                value={form.bankName}
                onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))}
                className="input-field"
                placeholder="Ex: BNI Madagascar"
              />
            </div>
            <div>
              <label className="text-xs text-brand-muted mb-1 block">Type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as AccountType }))}
                className="input-field"
              >
                <option value="CHECKING">Courant</option>
                <option value="SAVINGS">Épargne</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1 block">Numéro de compte</label>
            <input
              value={form.accountNumber}
              onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))}
              className="input-field"
              placeholder="Ex: 0001-2345-6789"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-brand-muted mb-1 block">
                {account ? 'Solde actuel (Ar)' : 'Solde initial (Ar)'}
              </label>
              <input
                type="number"
                step="1"
                value={form.initialBalance}
                onChange={e => setForm(f => ({ ...f, initialBalance: e.target.value }))}
                className="input-field"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-brand-muted mb-1 block">Devise</label>
              <input
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="input-field"
                placeholder="MGA"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1 block">
              Mode de paiement lié
              <span className="ml-1 text-brand-orange">(flux automatique)</span>
            </label>
            <select
              value={form.paymentMethod}
              onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
              className="input-field"
            >
              <option value="">— Aucun (manuel uniquement) —</option>
              {PAYMENT_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <p className="text-xs text-brand-muted mt-1">
              Si défini, chaque paiement avec ce mode sera automatiquement enregistré ici.
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              className="w-4 h-4 accent-brand-orange"
            />
            <span className="text-sm">Compte actif</span>
          </label>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Annuler</button>
            <button type="submit" className="flex-1 btn-primary">
              {account ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Transaction Modal ─────────────────────────────────────────────────────────

function TransactionModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (data: { type: TransactionType; amount: number; description: string; reference: string; date: string }) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    type: 'CREDIT' as TransactionType,
    amount: '',
    description: '',
    reference: '',
    date: today,
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
            <div className="grid grid-cols-2 gap-2">
              {(['CREDIT', 'DEBIT'] as TransactionType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, type: t }))}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    form.type === t
                      ? t === 'CREDIT'
                        ? 'bg-green-500/20 border-green-500/50 text-green-400'
                        : 'bg-red-500/20 border-red-500/50 text-red-400'
                      : 'border-brand-border text-brand-muted hover:border-white/20'
                  }`}
                >
                  {t === 'CREDIT'
                    ? <ArrowUpCircle className="w-4 h-4" />
                    : <ArrowDownCircle className="w-4 h-4" />
                  }
                  {txTypeLabel(t)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
              <label className="text-xs text-brand-muted mb-1 block">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="input-field"
                required
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1 block">Description</label>
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="input-field"
              placeholder="Ex: Virement client ABC"
            />
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1 block">Référence</label>
            <input
              value={form.reference}
              onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
              className="input-field"
              placeholder="Ex: VIR-2025-001"
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

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function BankPage() {
  const qc = useQueryClient()
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [accountModal, setAccountModal] = useState<{ open: boolean; account: BankAccount | null }>({
    open: false, account: null,
  })
  const [txModal, setTxModal] = useState(false)
  const [txPage, setTxPage] = useState(1)

  // Accounts
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery<BankAccount[]>({
    queryKey: ['bank-accounts'],
    queryFn: () => api.get('/bank/accounts').then(r => r.data.data),
  })

  const selectedAccount = accounts.find(a => a.id === selectedAccountId) ?? null

  // Transactions for selected account
  const { data: txRes, isLoading: loadingTx } = useQuery<{ data: BankTransaction[]; meta: Meta }>({
    queryKey: ['bank-transactions', selectedAccountId, txPage],
    queryFn: () =>
      api.get(`/bank/accounts/${selectedAccountId}/transactions?page=${txPage}&perPage=15`).then(r => r.data),
    enabled: !!selectedAccountId,
    placeholderData: prev => prev,
  })

  const transactions = txRes?.data ?? []
  const txMeta = txRes?.meta

  // Mutations
  const createAccount = useMutation({
    mutationFn: (d: any) => api.post('/bank/accounts', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
      toast.success('Compte créé')
      setAccountModal({ open: false, account: null })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  const updateAccount = useMutation({
    mutationFn: ({ id, d }: { id: string; d: any }) => api.put(`/bank/accounts/${id}`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
      toast.success('Compte mis à jour')
      setAccountModal({ open: false, account: null })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  const deleteAccount = useMutation({
    mutationFn: (id: string) => api.delete(`/bank/accounts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
      toast.success('Compte supprimé')
      if (selectedAccountId === deletedId) setSelectedAccountId(null)
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  const addTransaction = useMutation({
    mutationFn: (d: any) => api.post(`/bank/accounts/${selectedAccountId}/transactions`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-transactions', selectedAccountId] })
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
      toast.success('Transaction enregistrée')
      setTxModal(false)
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  const reconcileTransaction = useMutation({
    mutationFn: (txId: string) => api.patch(`/bank/transactions/${txId}/reconcile`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-transactions', selectedAccountId] })
      toast.success('Rapprochement mis à jour')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  // Track deleted account id to avoid stale selection
  let deletedId = ''

  function handleAccountSave(data: any) {
    if (accountModal.account) {
      updateAccount.mutate({ id: accountModal.account.id, d: data })
    } else {
      createAccount.mutate(data)
    }
  }

  const totalBalance = accounts.filter(a => a.isActive).reduce((sum, a) => sum + a.balance, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Banque</h1>
          <p className="text-brand-muted text-sm">Gestion des comptes bancaires et transactions</p>
        </div>
        <button
          onClick={() => setAccountModal({ open: true, account: null })}
          className="btn-primary flex items-center gap-1.5 text-sm"
        >
          <Plus className="w-4 h-4" /> Ajouter un compte
        </button>
      </div>

      {/* Total balance KPI */}
      {accounts.length > 0 && (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5">
          <p className="text-xs text-brand-muted uppercase tracking-wide mb-1">Solde total (comptes actifs)</p>
          <p className={`text-3xl font-bold ${totalBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(totalBalance)}
          </p>
          <p className="text-xs text-brand-muted mt-1">{accounts.filter(a => a.isActive).length} compte(s) actif(s)</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Accounts list ── */}
        <div className="lg:col-span-1 space-y-3">
          <p className="text-xs text-brand-muted uppercase tracking-wide font-medium">Comptes</p>
          {loadingAccounts ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-brand-card border border-brand-border rounded-2xl h-24 animate-pulse" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="bg-brand-card border border-brand-border rounded-2xl p-8 text-center">
              <Building2 className="w-10 h-10 text-brand-muted mx-auto mb-2 opacity-50" />
              <p className="text-brand-muted text-sm">Aucun compte. Créez-en un.</p>
            </div>
          ) : (
            accounts.map(account => (
              <motion.div
                key={account.id}
                layout
                onClick={() => { setSelectedAccountId(account.id); setTxPage(1) }}
                className={`bg-brand-card border rounded-2xl p-4 cursor-pointer transition-all ${
                  selectedAccountId === account.id
                    ? 'border-brand-orange shadow-[0_0_0_1px] shadow-brand-orange/30'
                    : 'border-brand-border hover:border-white/20'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{account.name}</p>
                      {account.paymentMethod && (
                        <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-xs border bg-brand-orange/15 text-brand-orange border-brand-orange/30">
                          {PAYMENT_METHODS.find(m => m.value === account.paymentMethod)?.label ?? account.paymentMethod}
                        </span>
                      )}
                      {!account.isActive && (
                        <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-xs border bg-gray-500/15 text-gray-400 border-gray-500/30">
                          Inactif
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-brand-muted">{account.bankName ?? '—'} · {accountTypeLabel(account.type)}</p>
                    {account.accountNumber && (
                      <p className="text-xs text-brand-muted font-mono mt-0.5">{account.accountNumber}</p>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0 ml-2">
                    <button
                      onClick={e => { e.stopPropagation(); setAccountModal({ open: true, account }) }}
                      className="p-1.5 text-brand-muted hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        if (confirm(`Supprimer le compte "${account.name}" ?`)) {
                          deletedId = account.id
                          deleteAccount.mutate(account.id)
                        }
                      }}
                      className="p-1.5 text-brand-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-end justify-between mt-3">
                  <div>
                    <p className="text-xs text-brand-muted">Solde</p>
                    <p className={`text-xl font-bold ${account.balance >= 0 ? 'text-white' : 'text-red-400'}`}>
                      {formatCurrency(account.balance)}
                    </p>
                  </div>
                  {account.transactionCount !== undefined && (
                    <div className="flex items-center gap-1 text-xs text-brand-muted">
                      <Wallet className="w-3.5 h-3.5" />
                      <span>{account.transactionCount} opérations</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* ── Transactions panel ── */}
        <div className="lg:col-span-2">
          {!selectedAccountId ? (
            <div className="bg-brand-card border border-brand-border rounded-2xl p-12 text-center h-full flex flex-col items-center justify-center">
              <Building2 className="w-12 h-12 text-brand-muted opacity-30 mb-3" />
              <p className="text-brand-muted">Sélectionnez un compte pour voir ses transactions</p>
            </div>
          ) : (
            <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-brand-border flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="font-semibold">{selectedAccount?.name}</h2>
                  <p className="text-xs text-brand-muted">{selectedAccount?.bankName}</p>
                </div>
                <button
                  onClick={() => setTxModal(true)}
                  className="btn-primary flex items-center gap-1.5 text-sm py-1.5 px-3"
                >
                  <Plus className="w-4 h-4" /> Nouvelle transaction
                </button>
              </div>

              {loadingTx ? (
                <div className="p-8 text-center text-brand-muted">Chargement…</div>
              ) : transactions.length === 0 ? (
                <div className="p-12 text-center">
                  <Wallet className="w-10 h-10 text-brand-muted mx-auto mb-2 opacity-50" />
                  <p className="text-brand-muted text-sm">Aucune transaction pour ce compte.</p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-brand-border/30">
                    {transactions.map(tx => (
                      <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/2 transition-colors">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          tx.type === 'CREDIT' ? 'bg-green-500/15' : 'bg-red-500/15'
                        }`}>
                          {tx.type === 'CREDIT'
                            ? <ArrowUpCircle className="w-4 h-4 text-green-400" />
                            : <ArrowDownCircle className="w-4 h-4 text-red-400" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium border ${
                              tx.type === 'CREDIT'
                                ? 'bg-green-500/15 text-green-400 border-green-500/30'
                                : 'bg-red-500/15 text-red-400 border-red-500/30'
                            }`}>
                              {tx.type === 'CREDIT' ? 'Crédit' : 'Débit'}
                            </span>
                            {tx.description && (
                              <span className="text-sm truncate">{tx.description}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-brand-muted">
                              {new Date(tx.date).toLocaleDateString('fr-FR', {
                                day: '2-digit', month: 'short', year: 'numeric',
                              })}
                            </span>
                            {tx.reference && (
                              <span className="text-xs text-brand-muted font-mono">· {tx.reference}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <p className={`font-bold text-sm ${tx.type === 'CREDIT' ? 'text-green-400' : 'text-red-400'}`}>
                            {tx.type === 'CREDIT' ? '+' : '−'}{formatCurrency(tx.amount)}
                          </p>
                          <button
                            onClick={() => reconcileTransaction.mutate(tx.id)}
                            title={tx.reconciled ? 'Annuler le rapprochement' : 'Marquer comme rapproché'}
                            className={`transition-colors ${
                              tx.reconciled
                                ? 'text-green-400 hover:text-brand-muted'
                                : 'text-brand-muted hover:text-green-400'
                            }`}
                          >
                            {tx.reconciled
                              ? <CheckSquare className="w-4 h-4" />
                              : <Square className="w-4 h-4" />
                            }
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {txMeta && txMeta.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-brand-border">
                      <span className="text-xs text-brand-muted">
                        {((txMeta.page - 1) * txMeta.perPage) + 1}–
                        {Math.min(txMeta.page * txMeta.perPage, txMeta.total)} sur {txMeta.total}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setTxPage(p => Math.max(1, p - 1))}
                          disabled={txPage === 1}
                          className="p-1.5 rounded-lg border border-brand-border text-brand-muted hover:text-white disabled:opacity-40 transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setTxPage(p => Math.min(txMeta.totalPages, p + 1))}
                          disabled={txPage === txMeta.totalPages}
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
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {accountModal.open && (
          <AccountModal
            account={accountModal.account}
            onClose={() => setAccountModal({ open: false, account: null })}
            onSave={handleAccountSave}
          />
        )}
        {txModal && selectedAccountId && (
          <TransactionModal
            onClose={() => setTxModal(false)}
            onSave={d => addTransaction.mutate(d)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

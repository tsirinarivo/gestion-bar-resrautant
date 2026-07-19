'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { CreditCard, Search, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatCurrency } from '@restaurant/utils'

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces', MVOLA: 'MVola', ORANGE_MONEY: 'Orange Money', AIRTEL_MONEY: 'Airtel Money',
  CARD: 'Carte', BNI_MOBILE: 'BNI Mobile', BOA_MOBILE: 'BOA Mobile', VIREMENT: 'Virement',
  CHEQUE: 'Chèque', VOUCHER: 'Bon', WALLET: 'Points',
}

type Payment = {
  id: string; amount: number; method: string; createdAt: string
  order: { orderNumber: string; type: string; table: { number: number } | null } | null
  refunds: { amount: number; status: string }[]
}
type Resp = { payments: Payment[]; summary: { total: number; count: number; byMethod: { method: string; total: number; count: number }[] } }

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function EncaissementsPage() {
  const [from, setFrom] = useState(todayStr())
  const [to, setTo] = useState(todayStr())
  const [method, setMethod] = useState('')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery<Resp>({
    queryKey: ['encaissements', from, to, method, search],
    queryFn: () => {
      const p = new URLSearchParams()
      if (from) p.set('from', from)
      if (to) p.set('to', to)
      if (method) p.set('method', method)
      if (search) p.set('search', search)
      return api.get(`/payments?${p.toString()}`).then(r => r.data.data)
    },
  })

  const reprint = useMutation({
    mutationFn: (id: string) => api.post(`/payments/${id}/reprint`),
    onSuccess: () => toast.success('Réimpression envoyée à l\'imprimante'),
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Échec de la réimpression'),
  })

  const payments = data?.payments ?? []
  const summary = data?.summary

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand-orange/20 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-brand-orange" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Encaissements</h1>
          <p className="text-brand-muted text-sm">Historique des paiements encaissés</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="glass-card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-brand-muted mb-1">Du</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="block text-xs text-brand-muted mb-1">Au</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="block text-xs text-brand-muted mb-1">Méthode</label>
          <select value={method} onChange={e => setMethod(e.target.value)} className="input-field">
            <option value="">Toutes</option>
            {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-brand-muted mb-1">N° commande</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" className="input-field pl-10" />
          </div>
        </div>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card p-4">
          <p className="text-xs text-brand-muted">Total encaissé</p>
          <p className="text-xl font-bold text-brand-orange">{formatCurrency(summary?.total ?? 0)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-brand-muted">Nb paiements</p>
          <p className="text-xl font-bold">{summary?.count ?? 0}</p>
        </div>
        {(summary?.byMethod ?? []).slice(0, 2).map(m => (
          <div key={m.method} className="glass-card p-4">
            <p className="text-xs text-brand-muted">{METHOD_LABELS[m.method] ?? m.method}</p>
            <p className="text-xl font-bold">{formatCurrency(m.total)}</p>
          </div>
        ))}
      </div>

      {/* Par méthode (détail) */}
      {(summary?.byMethod?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2">
          {summary!.byMethod.map(m => (
            <span key={m.method} className="text-xs bg-brand-bg border border-brand-border rounded-lg px-3 py-1.5">
              {METHOD_LABELS[m.method] ?? m.method} : <b>{formatCurrency(m.total)}</b> <span className="text-brand-muted">({m.count})</span>
            </span>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-brand-border text-left text-xs text-brand-muted">
            <tr>
              <th className="px-4 py-3">Date/Heure</th>
              <th className="px-4 py-3">Commande</th>
              <th className="px-4 py-3">Table</th>
              <th className="px-4 py-3">Méthode</th>
              <th className="px-4 py-3 text-right">Montant</th>
              <th className="px-4 py-3 text-right">Ticket</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-brand-muted">Chargement…</td></tr>
            ) : payments.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-brand-muted">Aucun encaissement sur cette période</td></tr>
            ) : payments.map(p => {
              const refunded = p.refunds.filter(r => r.status !== 'CANCELLED').reduce((s, r) => s + r.amount, 0)
              return (
                <tr key={p.id} className="border-b border-brand-border/40 hover:bg-white/5">
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(p.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-4 py-3 font-mono text-xs">{p.order?.orderNumber ?? '—'}</td>
                  <td className="px-4 py-3">{p.order?.table ? `Table ${p.order.table.number}` : p.order?.type === 'TAKEAWAY' ? 'Emporté' : '—'}</td>
                  <td className="px-4 py-3">{METHOD_LABELS[p.method] ?? p.method}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatCurrency(p.amount)}
                    {refunded > 0 && <span className="block text-[11px] text-red-400">−{formatCurrency(refunded)} remb.</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => reprint.mutate(p.id)} disabled={reprint.isPending}
                      title="Réimprimer le ticket"
                      className="p-2 rounded-lg bg-brand-orange/15 text-brand-orange hover:bg-brand-orange/25 disabled:opacity-50">
                      <Printer className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

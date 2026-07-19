'use client'

import { useState, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CreditCard, ChevronLeft, ChevronRight, ChevronDown, Printer, RotateCcw, Search,
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency } from '@restaurant/utils'
import { toast } from 'sonner'

type Meta = { page: number; perPage: number; total: number; totalPages: number }

type PaymentItem = {
  quantity: number
  unitPrice: number
  totalPrice: number
  discountAmount: number
  productName?: string | null
  product?: { name: string } | null
}

type Payment = {
  id: string
  amount: number
  method: string
  status: string
  reference?: string | null
  createdAt: string
  order: {
    id: string
    orderNumber: string
    type: string
    table?: { number: number } | null
    customer?: { firstName: string; lastName: string } | null
    items: PaymentItem[]
  } | null
  refunds: { amount: number; status: string }[]
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces', MVOLA: 'MVola', ORANGE_MONEY: 'Orange Money', AIRTEL_MONEY: 'Airtel Money',
  CARD: 'Carte', BNI_MOBILE: 'BNI Mobile', BOA_MOBILE: 'BOA Mobile', VIREMENT: 'Virement',
  CHEQUE: 'Chèque', VOUCHER: 'Bon', WALLET: 'Wallet',
}

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: 'bg-green-500/15 text-green-400',
  PENDING: 'bg-amber-500/15 text-amber-400',
  FAILED: 'bg-red-500/15 text-red-400',
  REFUNDED: 'bg-purple-500/15 text-purple-400',
  PARTIAL_REFUND: 'bg-purple-500/15 text-purple-400',
}

export default function EncaissementsPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [method, setMethod] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['encaissements', page, method, status, from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), perPage: '20' })
      if (method) params.set('method', method)
      if (status) params.set('status', status)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await api.get(`/payments?${params.toString()}`)
      return res.data as { data: Payment[]; meta: Meta }
    },
  })

  const reprint = useMutation({
    mutationFn: (id: string) => api.post(`/payments/${id}/reprint`),
    onSuccess: () => toast.success('Réimpression envoyée à l\'imprimante'),
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Échec de la réimpression'),
  })

  const payments = data?.data ?? []
  const meta = data?.meta

  const total = payments.reduce((s, p) => s + (p.status === 'COMPLETED' ? p.amount : 0), 0)

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <header className="mb-5 flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-orange-500/15 flex items-center justify-center">
          <CreditCard className="w-6 h-6 text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Encaissements</h1>
          <p className="text-sm text-brand-muted">Détail des paiements + réimpression des tickets</p>
        </div>
      </header>

      {/* Filtres */}
      <div className="bg-brand-card border border-brand-border rounded-2xl p-4 mb-4 grid gap-3 md:grid-cols-5">
        <select value={method} onChange={e => { setMethod(e.target.value); setPage(1) }}
          className="bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm">
          <option value="">Toutes méthodes</option>
          {Object.entries(METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm">
          <option value="">Tous statuts</option>
          <option value="COMPLETED">Complété</option>
          <option value="PENDING">En attente</option>
          <option value="REFUNDED">Remboursé</option>
          <option value="PARTIAL_REFUND">Remb. partiel</option>
          <option value="FAILED">Échoué</option>
        </select>
        <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1) }}
          className="bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm" />
        <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1) }}
          className="bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm" />
        {(method || status || from || to) && (
          <button onClick={() => { setMethod(''); setStatus(''); setFrom(''); setTo(''); setPage(1) }}
            className="flex items-center justify-center gap-1 text-sm text-brand-muted hover:text-white border border-brand-border rounded-lg px-3 py-2">
            <RotateCcw className="w-4 h-4" /> Réinitialiser
          </button>
        )}
      </div>

      <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-brand-muted">Chargement…</div>
        ) : payments.length === 0 ? (
          <div className="p-10 text-center text-brand-muted flex flex-col items-center gap-2">
            <Search className="w-8 h-8 opacity-40" />
            Aucun encaissement trouvé.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-brand-muted border-b border-brand-border">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Commande</th>
                  <th className="px-4 py-3">Table / Client</th>
                  <th className="px-4 py-3">Méthode</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => {
                  const isOpen = expanded === p.id
                  const clientName = p.order?.customer
                    ? `${p.order.customer.firstName} ${p.order.customer.lastName}`.trim()
                    : null
                  const tableName = p.order?.table ? `Table ${p.order.table.number}`
                    : p.order?.type === 'TAKEAWAY' ? 'Emporté' : '—'
                  return (
                    <Fragment key={p.id}>
                      <tr className="border-b border-brand-border/50 hover:bg-white/5">
                        <td className="px-4 py-3 whitespace-nowrap text-brand-muted">
                          {new Date(p.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{p.order?.orderNumber ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span>{tableName}</span>
                          {clientName && <span className="block text-xs text-brand-muted">{clientName}</span>}
                        </td>
                        <td className="px-4 py-3">{METHOD_LABELS[p.method] ?? p.method}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(p.amount)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[p.status] ?? 'bg-white/10 text-brand-muted'}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => reprint.mutate(p.id)} disabled={reprint.isPending}
                              title="Réimprimer le ticket"
                              className="p-2 rounded-lg bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 disabled:opacity-50">
                              <Printer className="w-4 h-4" />
                            </button>
                            {p.order && p.order.items.length > 0 && (
                              <button onClick={() => setExpanded(isOpen ? null : p.id)}
                                title="Détails"
                                className="p-2 rounded-lg border border-brand-border text-brand-muted hover:text-white">
                                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isOpen && p.order && (
                        <tr className="bg-black/20">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="space-y-1">
                              {p.order.items.map((it, idx) => (
                                <div key={idx} className="flex justify-between text-xs text-brand-muted">
                                  <span>{it.quantity}× {it.productName ?? it.product?.name ?? 'Article'}
                                    {it.discountAmount > 0 && <span className="text-orange-400"> (remise {formatCurrency(it.discountAmount)})</span>}
                                  </span>
                                  <span>{formatCurrency(it.totalPrice)}</span>
                                </div>
                              ))}
                              {p.refunds.length > 0 && (
                                <div className="pt-2 mt-1 border-t border-brand-border/50 text-xs text-purple-400">
                                  Remboursé : {formatCurrency(p.refunds.reduce((s, r) => s + r.amount, 0))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-brand-border">
            <span className="text-xs text-brand-muted">
              {((meta.page - 1) * meta.perPage) + 1}–{Math.min(meta.page * meta.perPage, meta.total)} sur {meta.total}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg border border-brand-border text-brand-muted hover:text-white disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages}
                className="p-1.5 rounded-lg border border-brand-border text-brand-muted hover:text-white disabled:opacity-40">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {payments.length > 0 && (
        <p className="mt-3 text-right text-sm text-brand-muted">
          Total complété (page) : <span className="font-semibold text-white">{formatCurrency(total)}</span>
        </p>
      )}
    </div>
  )
}

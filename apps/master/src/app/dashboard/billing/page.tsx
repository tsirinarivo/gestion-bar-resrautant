'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Receipt, Loader2, Play, CheckCircle2, XCircle } from 'lucide-react'
import { formatCurrency } from '@restaurant/utils'

type Invoice = {
  id: string
  number: string
  amountMga: number
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELED'
  periodFrom: string
  periodTo: string
  dueDate: string
  paidAt: string | null
  tenant: { slug: string; name: string }
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-blue-100 text-blue-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELED: 'bg-slate-100 text-slate-500',
}

const FILTERS = ['ALL', 'PENDING', 'OVERDUE', 'PAID', 'CANCELED'] as const

export default function BillingPage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL')

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', filter],
    queryFn: async (): Promise<Invoice[]> => {
      const q = filter === 'ALL' ? '' : `?status=${filter}`
      const res = await fetch(`/api/billing/invoices${q}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Chargement échoué')
      return res.json()
    },
  })

  const { data: settings } = useQuery({
    queryKey: ['billing-settings'],
    queryFn: async () => {
      const res = await fetch('/api/billing/settings', { cache: 'no-store' })
      if (!res.ok) throw new Error('Chargement échoué')
      return res.json() as Promise<{ gracePeriodDays: number }>
    },
  })

  const [grace, setGrace] = useState<string>('')

  const runMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/billing/run', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Échec')
      return body as { generated: number; markedOverdue: number; suspended: number }
    },
    onSuccess: (r) => {
      toast.success(`${r.generated} générées · ${r.markedOverdue} en retard · ${r.suspended} suspendues`)
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const payMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/billing/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pay', method: 'MANUAL' }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Échec')
    },
    onSuccess: () => {
      toast.success('Facture marquée payée')
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const cancelMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/billing/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Échec')
    },
    onSuccess: () => {
      toast.success('Facture annulée')
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const graceMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/billing/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gracePeriodDays: Number(grace) }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Échec')
    },
    onSuccess: () => {
      toast.success('Délai de grâce mis à jour')
      qc.invalidateQueries({ queryKey: ['billing-settings'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="px-6 py-8 md:px-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Receipt className="h-6 w-6 text-brand-600" /> Facturation
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Factures mensuelles générées automatiquement depuis les abonnements.
          </p>
        </div>
        <button
          onClick={() => runMut.mutate()}
          disabled={runMut.isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {runMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Lancer la facturation
        </button>
      </header>

      <section className="card mb-6 flex flex-wrap items-end gap-3 p-5">
        <div>
          <label className="mb-1 block text-xs uppercase text-slate-500">
            Délai de grâce avant suspension (jours)
          </label>
          <input
            className="input w-40"
            type="number"
            placeholder={settings ? String(settings.gracePeriodDays) : '7'}
            value={grace}
            onChange={(e) => setGrace(e.target.value)}
          />
        </div>
        <button
          onClick={() => graceMut.mutate()}
          disabled={graceMut.isPending || grace === ''}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Enregistrer
        </button>
        <p className="ml-auto max-w-md text-xs text-slate-400">
          Suspension <strong>soft</strong> (flag DB) après ce délai. La stack Docker du tenant
          n'est pas coupée automatiquement — coupez-la manuellement depuis la fiche client.
        </p>
      </section>

      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              filter === f ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {f === 'ALL' ? 'Toutes' : f}
          </button>
        ))}
      </div>

      <section className="card p-5">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : !invoices || invoices.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune facture.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="pb-2">Numéro</th>
                <th className="pb-2">Client</th>
                <th className="pb-2">Période</th>
                <th className="pb-2 text-right">Montant</th>
                <th className="pb-2 text-center">Statut</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 font-mono text-xs">{inv.number}</td>
                  <td className="py-3 font-medium text-slate-900">{inv.tenant.name}</td>
                  <td className="py-3 text-xs text-slate-500">
                    {new Date(inv.periodFrom).toLocaleDateString('fr-FR')} →{' '}
                    {new Date(inv.periodTo).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="py-3 text-right">{formatCurrency(inv.amountMga)}</td>
                  <td className="py-3 text-center">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[inv.status]}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {(inv.status === 'PENDING' || inv.status === 'OVERDUE') && (
                      <div className="inline-flex items-center gap-3">
                        <button
                          onClick={() => payMut.mutate(inv.id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
                        >
                          <CheckCircle2 className="h-4 w-4" /> Payée
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Annuler la facture ${inv.number} ?`)) cancelMut.mutate(inv.id)
                          }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-red-600"
                        >
                          <XCircle className="h-4 w-4" /> Annuler
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

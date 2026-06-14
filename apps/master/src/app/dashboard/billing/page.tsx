'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Receipt, Loader2, Play, CheckCircle2, XCircle } from 'lucide-react'
import { formatCurrency } from '@restaurant/utils'
import { PageHeader, StatusBadge } from '@/components/ui/PageHeader'

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
    onSuccess: r => {
      toast.success(
        `${r.generated} générées · ${r.markedOverdue} en retard · ${r.suspended} suspendues`,
      )
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
    <div className="container-x py-8 sm:py-10">
      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <Receipt className="h-6 w-6 text-brand-600" /> Facturation
          </span>
        }
        subtitle="Factures mensuelles générées automatiquement"
        actions={
          <button
            onClick={() => runMut.mutate()}
            disabled={runMut.isPending}
            className="btn-secondary"
          >
            {runMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Lancer la facturation
          </button>
        }
      />

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card mb-6 p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Délai de grâce avant suspension (jours)</label>
            <input
              className="input w-40"
              type="number"
              placeholder={settings ? String(settings.gracePeriodDays) : '7'}
              value={grace}
              onChange={e => setGrace(e.target.value)}
            />
          </div>
          <button
            onClick={() => graceMut.mutate()}
            disabled={graceMut.isPending || grace === ''}
            className="btn-primary"
          >
            Enregistrer
          </button>
          <p className="ml-auto max-w-md text-xs text-slate-400">
            Suspension <strong>soft</strong> (flag DB) après ce délai. La stack Docker du tenant
            n'est pas coupée automatiquement.
          </p>
        </div>
      </motion.section>

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-white p-1 ring-1 ring-slate-200 scrollbar-hidden">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === f
                ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f === 'ALL' ? 'Toutes' : f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="card flex items-center gap-2 p-6 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : !invoices || invoices.length === 0 ? (
        <div className="card p-10 text-center text-sm text-slate-500">Aucune facture.</div>
      ) : (
        <>
          <div className="card hidden overflow-hidden sm:block">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <Th>Numéro</Th>
                  <Th>Client</Th>
                  <Th>Période</Th>
                  <Th right>Montant</Th>
                  <Th>Statut</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv, i) => (
                  <motion.tr
                    key={inv.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i, 8) * 0.03 }}
                    className="hover:bg-slate-50/60"
                  >
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-700">{inv.number}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{inv.tenant.name}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      {new Date(inv.periodFrom).toLocaleDateString('fr-FR')} →{' '}
                      {new Date(inv.periodTo).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums">
                      {formatCurrency(inv.amountMga)}
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={inv.status} /></td>
                    <td className="px-5 py-3.5 text-right">
                      {(inv.status === 'PENDING' || inv.status === 'OVERDUE') && (
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => payMut.mutate(inv.id)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Payée
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Annuler la facture ${inv.number} ?`))
                                cancelMut.mutate(inv.id)
                            }}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Annuler
                          </button>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2.5 sm:hidden">
            {invoices.map(inv => (
              <div key={inv.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{inv.tenant.name}</div>
                    <div className="font-mono text-[11px] text-slate-500">{inv.number}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold tabular-nums">{formatCurrency(inv.amountMga)}</div>
                    <StatusBadge status={inv.status} />
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  {new Date(inv.periodFrom).toLocaleDateString('fr-FR')} →{' '}
                  {new Date(inv.periodTo).toLocaleDateString('fr-FR')}
                </div>
                {(inv.status === 'PENDING' || inv.status === 'OVERDUE') && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => payMut.mutate(inv.id)}
                      className="flex-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                    >
                      Payée
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Annuler la facture ${inv.number} ?`))
                          cancelMut.mutate(inv.id)
                      }}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500"
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}

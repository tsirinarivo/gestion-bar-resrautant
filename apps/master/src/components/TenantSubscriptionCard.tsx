'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { formatCurrency } from '@restaurant/utils'

type Plan = { id: string; key: string; name: string; amountMga: number; active: boolean }
type Subscription = {
  plan: string
  amountMga: number
  status: string
  nextDueDate: string
} | null

const SUB_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  PAST_DUE: 'bg-red-100 text-red-700',
  CANCELED: 'bg-slate-100 text-slate-500',
}

export function TenantSubscriptionCard({ tenantId }: { tenantId: string }) {
  const router = useRouter()
  const [selected, setSelected] = useState('')

  const { data: sub, refetch } = useQuery({
    queryKey: ['subscription', tenantId],
    queryFn: async (): Promise<Subscription> => {
      const res = await fetch(`/api/tenants/${tenantId}/subscription`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Chargement échoué')
      return res.json()
    },
  })

  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: async (): Promise<Plan[]> => {
      const res = await fetch('/api/plans', { cache: 'no-store' })
      if (!res.ok) throw new Error('Chargement échoué')
      return res.json()
    },
  })

  const assignMut = useMutation({
    mutationFn: async (planKey: string) => {
      const res = await fetch(`/api/tenants/${tenantId}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Échec')
    },
    onSuccess: () => {
      toast.success('Abonnement mis à jour')
      setSelected('')
      refetch()
      router.refresh()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const activePlans = (plans ?? []).filter((p) => p.active)

  return (
    <section className="card p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">Abonnement</h2>
      {sub ? (
        <div className="mb-4 space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-xs uppercase text-slate-500">Plan</span>
            <span className="font-medium text-slate-900">{sub.plan}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-xs uppercase text-slate-500">Montant / mois</span>
            <span className="text-slate-900">{formatCurrency(sub.amountMga)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-xs uppercase text-slate-500">Statut</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SUB_STYLES[sub.status] ?? ''}`}>
              {sub.status}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-xs uppercase text-slate-500">Prochaine échéance</span>
            <span className="text-slate-900">{new Date(sub.nextDueDate).toLocaleDateString('fr-FR')}</span>
          </div>
        </div>
      ) : (
        <p className="mb-4 text-sm text-slate-500">Aucun abonnement assigné.</p>
      )}

      <div className="flex gap-2">
        <select
          className="input flex-1"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">{sub ? 'Changer de plan…' : 'Assigner un plan…'}</option>
          {activePlans.map((p) => (
            <option key={p.id} value={p.key}>
              {p.name} — {formatCurrency(p.amountMga)}/mois
            </option>
          ))}
        </select>
        <button
          onClick={() => selected && assignMut.mutate(selected)}
          disabled={!selected || assignMut.isPending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {assignMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Appliquer'}
        </button>
      </div>
    </section>
  )
}

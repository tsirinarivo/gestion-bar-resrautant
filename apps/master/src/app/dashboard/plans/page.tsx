'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, Package } from 'lucide-react'
import { formatCurrency } from '@restaurant/utils'

type Plan = {
  id: string
  key: string
  name: string
  amountMga: number
  active: boolean
  sortOrder: number
}

async function fetchPlans(): Promise<Plan[]> {
  const res = await fetch('/api/plans', { cache: 'no-store' })
  if (!res.ok) throw new Error('Chargement échoué')
  return res.json()
}

export default function PlansPage() {
  const qc = useQueryClient()
  const { data: plans, isLoading } = useQuery({ queryKey: ['plans'], queryFn: fetchPlans })

  const [form, setForm] = useState({ key: '', name: '', amountMga: '', sortOrder: '' })

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: form.key.trim(),
          name: form.name.trim(),
          amountMga: Number(form.amountMga) || 0,
          sortOrder: Number(form.sortOrder) || 0,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Création échouée')
      return body
    },
    onSuccess: () => {
      toast.success('Plan créé')
      setForm({ key: '', name: '', amountMga: '', sortOrder: '' })
      qc.invalidateQueries({ queryKey: ['plans'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggleMut = useMutation({
    mutationFn: async (p: Plan) => {
      const res = await fetch(`/api/plans/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !p.active }),
      })
      if (!res.ok) throw new Error('Mise à jour échouée')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/plans/${id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Suppression échouée')
    },
    onSuccess: () => {
      toast.success('Plan supprimé')
      qc.invalidateQueries({ queryKey: ['plans'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="px-6 py-8 md:px-10">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Package className="h-6 w-6 text-brand-600" /> Plans d'abonnement
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Catalogue des formules facturées mensuellement aux clients.
        </p>
      </header>

      <section className="card mb-6 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">Nouveau plan</h2>
        <div className="grid gap-3 md:grid-cols-5">
          <input
            className="input"
            placeholder="clé (ex: pro)"
            value={form.key}
            onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Nom (ex: Pro)"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            className="input"
            type="number"
            placeholder="Prix MGA/mois"
            value={form.amountMga}
            onChange={(e) => setForm((f) => ({ ...f, amountMga: e.target.value }))}
          />
          <input
            className="input"
            type="number"
            placeholder="Ordre"
            value={form.sortOrder}
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
          />
          <button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending || !form.key || !form.name}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Ajouter
          </button>
        </div>
      </section>

      <section className="card p-5">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : !plans || plans.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun plan. Créez votre première formule ci-dessus.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="pb-2">Clé</th>
                <th className="pb-2">Nom</th>
                <th className="pb-2 text-right">Prix / mois</th>
                <th className="pb-2 text-center">Statut</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 font-mono text-xs">{p.key}</td>
                  <td className="py-3 font-medium text-slate-900">{p.name}</td>
                  <td className="py-3 text-right">{formatCurrency(p.amountMga)}</td>
                  <td className="py-3 text-center">
                    <button
                      onClick={() => toggleMut.mutate(p)}
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {p.active ? 'Actif' : 'Inactif'}
                    </button>
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Supprimer le plan ${p.name} ?`)) deleteMut.mutate(p.id)
                      }}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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

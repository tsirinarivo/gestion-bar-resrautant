'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, Package, Power } from 'lucide-react'
import { formatCurrency } from '@restaurant/utils'
import { PageHeader } from '@/components/ui/PageHeader'

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
    <div className="container-x py-8 sm:py-10">
      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <Package className="h-6 w-6 text-brand-600" /> Plans d'abonnement
          </span>
        }
        subtitle="Catalogue des formules facturées mensuellement"
      />

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card mb-6 p-5 sm:p-6"
      >
        <h2 className="text-sm font-bold text-slate-900">Nouveau plan</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            className="input"
            placeholder="Clé (ex: pro)"
            value={form.key}
            onChange={e => setForm(f => ({ ...f, key: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Nom (ex: Pro)"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <input
            className="input"
            type="number"
            placeholder="Prix MGA/mois"
            value={form.amountMga}
            onChange={e => setForm(f => ({ ...f, amountMga: e.target.value }))}
          />
          <input
            className="input"
            type="number"
            placeholder="Ordre"
            value={form.sortOrder}
            onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))}
          />
          <button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending || !form.key || !form.name}
            className="btn-primary"
          >
            {createMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Ajouter
          </button>
        </div>
      </motion.section>

      {isLoading ? (
        <div className="card flex items-center gap-2 p-6 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : !plans || plans.length === 0 ? (
        <EmptyState />
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <AnimatePresence>
            {plans.map(p => (
              <motion.div
                key={p.id}
                variants={{
                  hidden: { opacity: 0, y: 12 },
                  show: { opacity: 1, y: 0 },
                }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`card relative overflow-hidden p-5 transition-all hover:shadow-soft-lg ${
                  !p.active ? 'opacity-60' : ''
                }`}
              >
                {p.active && (
                  <div className="absolute right-0 top-0 h-20 w-20 -translate-y-10 translate-x-10 rounded-full bg-gradient-to-br from-brand-100 to-brand-200 blur-2xl" />
                )}
                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                        {p.key}
                      </div>
                      <h3 className="mt-1 font-display text-xl font-extrabold text-slate-900">
                        {p.name}
                      </h3>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        p.active
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
                          : 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200'
                      }`}
                    >
                      {p.active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                  <div className="mt-4 font-display text-3xl font-extrabold gradient-text">
                    {formatCurrency(p.amountMga)}
                  </div>
                  <div className="text-xs text-slate-500">par mois</div>

                  <div className="mt-5 flex gap-2">
                    <button
                      onClick={() => toggleMut.mutate(p)}
                      className="btn-secondary flex-1 text-xs"
                    >
                      <Power className="h-3.5 w-3.5" />
                      {p.active ? 'Désactiver' : 'Activer'}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Supprimer le plan ${p.name} ?`)) deleteMut.mutate(p.id)
                      }}
                      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="card flex flex-col items-center px-6 py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100">
        <Package className="h-7 w-7 text-brand-600" />
      </div>
      <h3 className="font-display text-lg font-bold text-slate-900">Aucun plan</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Créez votre première formule d'abonnement ci-dessus.
      </p>
    </div>
  )
}

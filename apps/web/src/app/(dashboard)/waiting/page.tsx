'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Clock, Bell, CheckCircle2, LogOut, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

type WaitingEntry = {
  id: string
  firstName: string
  lastName: string
  phone: string
  email?: string
  partySize: number
  status: 'WAITING' | 'NOTIFIED' | 'SEATED' | 'LEFT'
  notifiedAt?: string
  createdAt: string
}

const STATUS_META = {
  WAITING:  { label: 'En attente',  color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/30',  icon: Clock },
  NOTIFIED: { label: 'Notifié',     color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30',    icon: Bell },
  SEATED:   { label: 'Assis',       color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/30',  icon: CheckCircle2 },
  LEFT:     { label: 'Parti',       color: 'text-gray-400',   bg: 'bg-gray-500/10 border-gray-500/30',    icon: LogOut },
}

function waitMins(createdAt: string) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
}

function AddModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', partySize: 2 })

  const create = useMutation({
    mutationFn: (data: any) => api.post('/waiting-list', data),
    onSuccess: () => {
      toast.success('Ajouté à la liste d\'attente')
      qc.invalidateQueries({ queryKey: ['waiting-list'] })
      onClose()
    },
    onError: () => toast.error('Erreur lors de l\'ajout'),
  })

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-brand-card border border-brand-border rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">Ajouter à la liste d'attente</h2>
          <button onClick={onClose} className="text-brand-muted hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); create.mutate(form) }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-brand-muted mb-1 block">Prénom *</label>
              <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                required className="input-field" placeholder="Jean" />
            </div>
            <div>
              <label className="text-sm text-brand-muted mb-1 block">Nom *</label>
              <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                required className="input-field" placeholder="Dupont" />
            </div>
          </div>
          <div>
            <label className="text-sm text-brand-muted mb-1 block">Téléphone *</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              required className="input-field" placeholder="+261 34 00 000 00" />
          </div>
          <div>
            <label className="text-sm text-brand-muted mb-1 block">Email (optionnel)</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="input-field" placeholder="jean@example.com" />
          </div>
          <div>
            <label className="text-sm text-brand-muted mb-1 block">Nombre de couverts *</label>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setForm(f => ({ ...f, partySize: Math.max(1, f.partySize - 1) }))}
                className="w-10 h-10 rounded-xl bg-brand-darker border border-brand-border text-xl flex items-center justify-center">−</button>
              <span className="text-2xl font-bold w-8 text-center">{form.partySize}</span>
              <button type="button" onClick={() => setForm(f => ({ ...f, partySize: f.partySize + 1 }))}
                className="w-10 h-10 rounded-xl bg-brand-darker border border-brand-border text-xl flex items-center justify-center">+</button>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Annuler</button>
            <button type="submit" disabled={create.isPending} className="flex-1 btn-primary disabled:opacity-50">
              {create.isPending ? 'Ajout...' : 'Ajouter'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

export default function WaitingPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const { data = [] } = useQuery<WaitingEntry[]>({
    queryKey: ['waiting-list', showAll],
    queryFn: () => api.get(`/waiting-list${showAll ? '?status=WAITING,NOTIFIED,SEATED,LEFT' : ''}`).then(r => r.data.data),
    refetchInterval: 15_000,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/waiting-list/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Statut mis à jour')
      qc.invalidateQueries({ queryKey: ['waiting-list'] })
    },
    onError: () => toast.error('Erreur'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/waiting-list/${id}`),
    onSuccess: () => {
      toast.success('Supprimé')
      qc.invalidateQueries({ queryKey: ['waiting-list'] })
    },
  })

  const waiting = data.filter(e => e.status === 'WAITING').length
  const notified = data.filter(e => e.status === 'NOTIFIED').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Liste d'attente</h1>
          <p className="text-brand-muted text-sm mt-1">
            {waiting} en attente · {notified} notifié(s)
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowAll(v => !v)}
            className={`btn-secondary text-sm ${showAll ? 'border-brand-orange text-brand-orange' : ''}`}>
            {showAll ? 'Actifs uniquement' : 'Voir tout'}
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(STATUS_META).map(([key, meta]) => {
          const count = data.filter(e => e.status === key).length
          const Icon = meta.icon
          return (
            <div key={key} className="glass-card p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${meta.bg}`}>
                <Icon className={`w-5 h-5 ${meta.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-brand-muted">{meta.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {data.length === 0 ? (
          <div className="py-16 text-center text-brand-muted">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Liste d'attente vide</p>
          </div>
        ) : (
          <div className="divide-y divide-brand-border">
            {data.map((entry, idx) => {
              const meta = STATUS_META[entry.status] ?? STATUS_META.WAITING
              const Icon = meta.icon
              const mins = waitMins(entry.createdAt)
              return (
                <div key={entry.id} className="px-4 py-3 flex items-center gap-4">
                  <span className="text-2xl font-bold text-brand-muted w-8 text-center flex-shrink-0">
                    {entry.status === 'WAITING' ? idx + 1 : '—'}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{entry.firstName} {entry.lastName}</p>
                    <p className="text-xs text-brand-muted">{entry.phone}</p>
                  </div>

                  <div className="flex items-center gap-1 text-sm text-brand-muted flex-shrink-0">
                    <Users className="w-4 h-4" /> {entry.partySize}
                  </div>

                  <div className="flex items-center gap-1 text-sm text-brand-muted flex-shrink-0">
                    <Clock className="w-4 h-4" /> {mins}&apos;
                  </div>

                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${meta.bg} ${meta.color} flex-shrink-0`}>
                    <Icon className="w-3 h-3" /> {meta.label}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {entry.status === 'WAITING' && (
                      <button onClick={() => updateStatus.mutate({ id: entry.id, status: 'NOTIFIED' })}
                        className="text-xs bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 px-2 py-1 rounded-lg transition-colors">
                        Notifier
                      </button>
                    )}
                    {(entry.status === 'WAITING' || entry.status === 'NOTIFIED') && (
                      <button onClick={() => updateStatus.mutate({ id: entry.id, status: 'SEATED' })}
                        className="text-xs bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 px-2 py-1 rounded-lg transition-colors">
                        Asseoir
                      </button>
                    )}
                    {(entry.status === 'WAITING' || entry.status === 'NOTIFIED') && (
                      <button onClick={() => updateStatus.mutate({ id: entry.id, status: 'LEFT' })}
                        className="text-xs bg-gray-500/10 border border-gray-500/30 text-gray-400 hover:bg-gray-500/20 px-2 py-1 rounded-lg transition-colors">
                        Parti
                      </button>
                    )}
                    <button onClick={() => remove.mutate(entry.id)}
                      className="p-1.5 text-brand-muted hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAdd && <AddModal onClose={() => setShowAdd(false)} />}
      </AnimatePresence>
    </div>
  )
}

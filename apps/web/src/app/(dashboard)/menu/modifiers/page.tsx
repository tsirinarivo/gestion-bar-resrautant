'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Layers, Plus, Trash2, Edit2, X, ChevronDown, ChevronUp, Check, ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@restaurant/utils'

type Modifier = {
  id: string
  name: string
  price: number
  isDefault: boolean
  isActive: boolean
  sortOrder: number
}

type ModifierGroup = {
  id: string
  name: string
  description: string | null
  minSelect: number
  maxSelect: number
  isRequired: boolean
  sortOrder: number
  modifiers: Modifier[]
  products: { productId: string; product: { name: string } }[]
  _count: { products: number; modifiers: number }
}

const EMPTY_GROUP = { name: '', description: '', minSelect: 0, maxSelect: 1, isRequired: false, sortOrder: 0 }
const EMPTY_MOD = { name: '', price: 0, isDefault: false, isActive: true, sortOrder: 0 }

function GroupModal({ group, onClose }: { group?: ModifierGroup; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(group ? {
    name: group.name, description: group.description ?? '',
    minSelect: group.minSelect, maxSelect: group.maxSelect,
    isRequired: group.isRequired, sortOrder: group.sortOrder,
  } : EMPTY_GROUP)

  const save = useMutation({
    mutationFn: (d: typeof form) => group
      ? api.put(`/modifier-groups/${group.id}`, d)
      : api.post('/modifier-groups', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modifier-groups'] })
      toast.success(group ? 'Groupe mis à jour' : 'Groupe créé')
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Erreur'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-brand-card border border-brand-border rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-brand-border">
          <h2 className="font-bold text-lg">{group ? 'Modifier le groupe' : 'Nouveau groupe'}</h2>
          <button onClick={onClose} className="text-brand-muted hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-brand-muted mb-1">Nom du groupe *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input-field w-full" placeholder="ex: Taille, Cuisson, Suppléments…" />
          </div>
          <div>
            <label className="block text-xs text-brand-muted mb-1">Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="input-field w-full" placeholder="Optionnel" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-brand-muted mb-1">Min. sélections</label>
              <input type="number" min={0} value={form.minSelect}
                onChange={e => setForm(f => ({ ...f, minSelect: Number(e.target.value) }))}
                className="input-field w-full" />
            </div>
            <div>
              <label className="block text-xs text-brand-muted mb-1">Max. sélections</label>
              <input type="number" min={1} value={form.maxSelect}
                onChange={e => setForm(f => ({ ...f, maxSelect: Number(e.target.value) }))}
                className="input-field w-full" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setForm(f => ({ ...f, isRequired: !f.isRequired }))}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${form.isRequired ? 'bg-brand-orange border-brand-orange' : 'border-brand-muted'}`}>
              {form.isRequired && <Check className="w-3 h-3 text-white" />}
            </button>
            <label className="text-sm">Obligatoire (le client doit choisir)</label>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-brand-border">
          <button onClick={onClose} className="flex-1 btn-secondary text-sm">Annuler</button>
          <button onClick={() => save.mutate(form)} disabled={!form.name || save.isPending}
            className="flex-1 btn-primary text-sm disabled:opacity-50">
            {save.isPending ? '...' : group ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function ModifierRow({ mod, groupId }: { mod: Modifier; groupId: string }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: mod.name, price: mod.price, isDefault: mod.isDefault, isActive: mod.isActive })

  const update = useMutation({
    mutationFn: () => api.put(`/modifier-groups/${groupId}/modifiers/${mod.id}`, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['modifier-groups'] }); setEditing(false) },
  })
  const remove = useMutation({
    mutationFn: () => api.delete(`/modifier-groups/${groupId}/modifiers/${mod.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modifier-groups'] }),
  })

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-1.5 px-2 bg-white/5 rounded-xl">
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="input-field flex-1 text-xs py-1" placeholder="Nom" />
        <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
          className="input-field w-24 text-xs py-1" placeholder="Prix" min={0} />
        <button onClick={() => update.mutate()} className="p-1.5 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setEditing(false)} className="p-1.5 bg-white/5 text-brand-muted rounded-lg hover:bg-white/10">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 py-1.5 px-2 rounded-xl group ${!mod.isActive ? 'opacity-50' : ''}`}>
      <span className="flex-1 text-sm">{mod.name}</span>
      {mod.isDefault && <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">Défaut</span>}
      <span className="text-sm text-brand-orange font-medium w-20 text-right">{mod.price > 0 ? `+${formatCurrency(mod.price)}` : 'Gratuit'}</span>
      <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 p-1 text-brand-muted hover:text-white transition-all">
        <Edit2 className="w-3 h-3" />
      </button>
      <button onClick={() => { if (confirm(`Supprimer "${mod.name}" ?`)) remove.mutate() }}
        className="opacity-0 group-hover:opacity-100 p-1 text-red-400/60 hover:text-red-400 transition-all">
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  )
}

function AddModifierRow({ groupId }: { groupId: string }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_MOD)

  const add = useMutation({
    mutationFn: () => api.post(`/modifier-groups/${groupId}/modifiers`, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['modifier-groups'] }); setForm(EMPTY_MOD); setOpen(false) },
  })

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full text-left text-xs py-1.5 px-2 text-brand-muted hover:text-brand-orange transition-colors">
        + Ajouter un modificateur
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 bg-brand-orange/5 border border-brand-orange/20 rounded-xl">
      <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        autoFocus className="input-field flex-1 text-xs py-1" placeholder="Nom du modificateur" />
      <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
        className="input-field w-24 text-xs py-1" placeholder="Prix (0 = gratuit)" min={0} />
      <button onClick={() => add.mutate()} disabled={!form.name} className="p-1.5 bg-green-500/20 text-green-400 rounded-lg disabled:opacity-40">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => { setOpen(false); setForm(EMPTY_MOD) }} className="p-1.5 text-brand-muted hover:text-white">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function GroupCard({ group }: { group: ModifierGroup }) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)

  const remove = useMutation({
    mutationFn: () => api.delete(`/modifier-groups/${group.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['modifier-groups'] }); toast.success('Groupe supprimé') },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Erreur'),
  })

  return (
    <>
      {editing && <GroupModal group={group} onClose={() => setEditing(false)} />}
      <motion.div layout className="glass-card overflow-hidden">
        <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded(v => !v)}>
          <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center flex-shrink-0">
            <Layers className="w-5 h-5 text-brand-orange" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold">{group.name}</p>
              {group.isRequired && <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded-full border border-red-500/30">Obligatoire</span>}
              <span className="text-[10px] text-brand-muted">
                {group.minSelect}–{group.maxSelect} choix · {group._count.modifiers} option{group._count.modifiers !== 1 ? 's' : ''}
              </span>
            </div>
            {group.description && <p className="text-xs text-brand-muted truncate">{group.description}</p>}
            {group._count.products > 0 && (
              <p className="text-xs text-blue-400 mt-0.5">
                Assigné à {group._count.products} produit{group._count.products !== 1 ? 's' : ''} : {group.products.slice(0, 3).map(p => p.product.name).join(', ')}{group._count.products > 3 ? '…' : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={e => { e.stopPropagation(); setEditing(true) }}
              className="p-1.5 text-brand-muted hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={e => { e.stopPropagation(); if (confirm(`Supprimer le groupe "${group.name}" et ses modificateurs ?`)) remove.mutate() }}
              className="p-1.5 text-brand-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
            {expanded ? <ChevronUp className="w-4 h-4 text-brand-muted" /> : <ChevronDown className="w-4 h-4 text-brand-muted" />}
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
              className="overflow-hidden border-t border-brand-border">
              <div className="p-4 space-y-1">
                {group.modifiers.length === 0 && (
                  <p className="text-xs text-brand-muted text-center py-2">Aucun modificateur — ajoutez-en ci-dessous</p>
                )}
                {group.modifiers.map(m => (
                  <ModifierRow key={m.id} mod={m} groupId={group.id} />
                ))}
                <AddModifierRow groupId={group.id} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  )
}

export default function ModifiersPage() {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)

  const { data: groups = [], isLoading } = useQuery<ModifierGroup[]>({
    queryKey: ['modifier-groups'],
    queryFn: () => api.get('/modifier-groups').then(r => r.data.data ?? []),
    staleTime: 30_000,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/menu')} className="p-2 hover:bg-white/5 rounded-xl text-brand-muted hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Groupes de modificateurs</h1>
          <p className="text-brand-muted text-sm">{groups.length} groupe{groups.length !== 1 ? 's' : ''} · Taille, cuisson, suppléments…</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouveau groupe
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-20 text-brand-muted glass-card">
          <Layers className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-semibold">Aucun groupe de modificateurs</p>
          <p className="text-sm mt-1">Créez des groupes (Taille, Cuisson…) puis assignez-les à vos produits</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary mt-4">Créer le premier groupe</button>
        </div>
      ) : (
        <AnimatePresence>
          <div className="space-y-3">
            {groups.map(g => <GroupCard key={g.id} group={g} />)}
          </div>
        </AnimatePresence>
      )}

      {showCreate && <GroupModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, X, Tag, Edit2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@restaurant/utils'
import { toast } from 'sonner'

const TYPE_LABELS: Record<string, string> = {
  PERCENTAGE: 'Réduction %',
  FIXED_AMOUNT: 'Réduction fixe',
  BUY_X_GET_Y: 'X acheté = Y offert',
  FREE_DELIVERY: 'Livraison gratuite',
}

const CHANNEL_LABELS: Record<string, string> = {
  ONLINE: 'En ligne', POS: 'POS', BOTH: 'Tous canaux',
}

type Promo = {
  id: string; name: string; description?: string; type: string; value: number
  minOrderAmount?: number; maxDiscount?: number
  startDate?: string; endDate?: string; isActive: boolean
  usageLimit?: number; usageCount: number; channels: string[]
  createdAt: string
}

function PromoModal({ promo, onClose, onSaved }: { promo: Promo | null; onClose: () => void; onSaved: () => void }) {
  const now = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    name: promo?.name ?? '',
    description: promo?.description ?? '',
    type: promo?.type ?? 'PERCENTAGE',
    value: promo?.value?.toString() ?? '10',
    minOrderAmount: promo?.minOrderAmount?.toString() ?? '',
    maxDiscount: promo?.maxDiscount?.toString() ?? '',
    startDate: promo?.startDate?.slice(0, 10) ?? now,
    endDate: promo?.endDate?.slice(0, 10) ?? '',
    usageLimit: promo?.usageLimit?.toString() ?? '',
    channels: promo?.channels ?? ['BOTH'],
    isActive: promo?.isActive ?? true,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Nom requis'); return }
    setLoading(true)
    try {
      const body = {
        name: form.name.trim(), description: form.description.trim() || undefined,
        type: form.type, value: parseFloat(form.value),
        minOrderAmount: form.minOrderAmount ? parseFloat(form.minOrderAmount) : undefined,
        maxDiscount: form.maxDiscount ? parseFloat(form.maxDiscount) : undefined,
        startDate: form.startDate || undefined, endDate: form.endDate || undefined,
        usageLimit: form.usageLimit ? parseInt(form.usageLimit) : undefined,
        channels: form.channels, isActive: form.isActive,
      }
      if (promo) await api.patch(`/promotions/${promo.id}`, body)
      else await api.post('/promotions', body)
      onSaved(); onClose()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la sauvegarde')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-brand-surface rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">{promo ? 'Modifier la promotion' : 'Nouvelle promotion'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-brand-muted/10 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-brand-muted mb-1">Nom *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field text-sm" placeholder="Soldes d'été" />
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-muted mb-1">Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field text-sm" placeholder="Réduction 20% sur tous les plats" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-brand-muted mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input-field text-sm">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-brand-muted mb-1">
                Valeur {form.type === 'PERCENTAGE' ? '(%)' : '(Ar)'}
              </label>
              <input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} className="input-field text-sm" min="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-brand-muted mb-1">Commande min. (Ar)</label>
              <input type="number" value={form.minOrderAmount} onChange={e => setForm(f => ({ ...f, minOrderAmount: e.target.value }))} className="input-field text-sm" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-brand-muted mb-1">Réduction max. (Ar)</label>
              <input type="number" value={form.maxDiscount} onChange={e => setForm(f => ({ ...f, maxDiscount: e.target.value }))} className="input-field text-sm" placeholder="—" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-brand-muted mb-1">Date début</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="input-field text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-brand-muted mb-1">Date fin</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="input-field text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-brand-muted mb-1">Limite d'usage</label>
              <input type="number" value={form.usageLimit} onChange={e => setForm(f => ({ ...f, usageLimit: e.target.value }))} className="input-field text-sm" placeholder="Illimité" min="1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-brand-muted mb-1">Canal</label>
              <select value={form.channels[0] ?? 'BOTH'} onChange={e => setForm(f => ({ ...f, channels: [e.target.value] }))} className="input-field text-sm">
                {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 accent-brand-orange" />
            <span>Promotion active</span>
          </label>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Enregistrement...' : promo ? 'Sauvegarder' : 'Créer'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

export default function PromotionsPage() {
  const [modal, setModal] = useState<{ open: boolean; promo: Promo | null }>({ open: false, promo: null })
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['promotions'],
    queryFn: () => api.get('/promotions').then(r => r.data),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/promotions/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promotions'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/promotions/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['promotions'] }); toast.success('Promotion supprimée') },
  })

  const promos: Promo[] = data?.data ?? []
  const active = promos.filter(p => p.isActive).length

  return (
    <div className="space-y-6">
      {modal.open && (
        <PromoModal promo={modal.promo} onClose={() => setModal({ open: false, promo: null })}
          onSaved={() => qc.invalidateQueries({ queryKey: ['promotions'] })} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Promotions</h1>
          <p className="text-brand-muted text-sm">{promos.length} promotion{promos.length !== 1 ? 's' : ''} · {active} active{active !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setModal({ open: true, promo: null })} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouvelle promotion
        </button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)
        ) : promos.length === 0 ? (
          <div className="text-center py-16 text-brand-muted">
            <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Aucune promotion configurée</p>
          </div>
        ) : (
          promos.map(promo => {
            const isExpired = promo.endDate && new Date(promo.endDate) < new Date()
            return (
              <motion.div key={promo.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className={`glass-card p-4 ${!promo.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold">{promo.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        !promo.isActive ? 'bg-gray-500/20 text-gray-400' :
                        isExpired ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                      }`}>
                        {!promo.isActive ? 'Inactive' : isExpired ? 'Expirée' : 'Active'}
                      </span>
                      <span className="text-xs bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded-full">
                        {TYPE_LABELS[promo.type] ?? promo.type}
                      </span>
                    </div>
                    <p className="text-sm text-brand-muted">
                      {promo.type === 'PERCENTAGE' ? `${promo.value}% de réduction` :
                       promo.type === 'FIXED_AMOUNT' ? `${formatCurrency(promo.value)} de réduction` :
                       promo.type === 'FREE_DELIVERY' ? 'Livraison offerte' :
                       `Valeur : ${promo.value}`}
                      {promo.minOrderAmount ? ` · min. ${formatCurrency(promo.minOrderAmount)}` : ''}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-brand-muted">
                      {promo.startDate && <span>Du {formatDate(promo.startDate)}</span>}
                      {promo.endDate && <span>au {formatDate(promo.endDate)}</span>}
                      <span>{CHANNEL_LABELS[promo.channels[0] ?? ''] ?? promo.channels[0]}</span>
                      <span>{promo.usageCount}{promo.usageLimit ? `/${promo.usageLimit}` : ''} utilisations</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleActive.mutate({ id: promo.id, isActive: !promo.isActive })}
                      className="p-2 hover:bg-white/10 text-brand-muted rounded-lg transition-colors"
                      title={promo.isActive ? 'Désactiver' : 'Activer'}>
                      {promo.isActive ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setModal({ open: true, promo })}
                      className="p-2 hover:bg-white/10 text-brand-muted rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => { if (confirm(`Supprimer la promotion "${promo.name}" ?`)) deleteMutation.mutate(promo.id) }}
                      className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}

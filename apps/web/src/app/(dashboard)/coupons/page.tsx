'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { Tag, Plus, Copy, Pencil, Trash2, X, AlertTriangle } from 'lucide-react'
import { api } from '@/lib/api'
import { formatDate, formatCurrency } from '@restaurant/utils'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CouponType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_DELIVERY'

interface Coupon {
  id: string
  code: string
  description?: string | null
  type: CouponType
  value: number
  minOrderAmount?: number | null
  maxDiscount?: number | null
  startDate?: string | null
  endDate?: string | null
  usageLimit?: number | null
  usageCount: number
  isActive: boolean
  channels: string[]
  _count?: { usages: number }
}

interface CouponFormValues {
  code: string
  description: string
  type: CouponType
  value: string
  minOrderAmount: string
  maxDiscount: string
  usageLimit: string
  startDate: string
  endDate: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<CouponType, string> = {
  PERCENTAGE: 'Pourcentage',
  FIXED_AMOUNT: 'Montant fixe',
  FREE_DELIVERY: 'Livraison offerte',
}

const TYPE_BADGE: Record<CouponType, string> = {
  PERCENTAGE: 'bg-purple-500/20 text-purple-400',
  FIXED_AMOUNT: 'bg-blue-500/20 text-blue-400',
  FREE_DELIVERY: 'bg-teal-500/20 text-teal-400',
}

function toDateInput(dateStr?: string | null) {
  if (!dateStr) return ''
  return new Date(dateStr).toISOString().split('T')[0]
}

// ---------------------------------------------------------------------------
// Coupon Form Modal (create + edit)
// ---------------------------------------------------------------------------

interface CouponModalProps {
  coupon?: Coupon | null
  onClose: () => void
  onSaved: () => void
}

function CouponModal({ coupon, onClose, onSaved }: CouponModalProps) {
  const isEdit = !!coupon

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CouponFormValues>({
    defaultValues: {
      code: coupon?.code ?? '',
      description: coupon?.description ?? '',
      type: coupon?.type ?? 'PERCENTAGE',
      value: coupon?.value != null ? String(coupon.value) : '',
      minOrderAmount: coupon?.minOrderAmount != null ? String(coupon.minOrderAmount) : '',
      maxDiscount: coupon?.maxDiscount != null ? String(coupon.maxDiscount) : '',
      usageLimit: coupon?.usageLimit != null ? String(coupon.usageLimit) : '',
      startDate: toDateInput(coupon?.startDate),
      endDate: toDateInput(coupon?.endDate),
    },
  })

  const type = watch('type')

  const onSubmit = async (values: CouponFormValues) => {
    const payload: Record<string, unknown> = {
      code: values.code.toUpperCase() || undefined,
      description: values.description || undefined,
      type: values.type,
      value: parseFloat(values.value),
      minOrderAmount: values.minOrderAmount ? parseFloat(values.minOrderAmount) : null,
      maxDiscount: values.type === 'PERCENTAGE' && values.maxDiscount ? parseFloat(values.maxDiscount) : null,
      usageLimit: values.usageLimit ? parseInt(values.usageLimit, 10) : null,
      startDate: values.startDate || null,
      endDate: values.endDate || null,
    }

    try {
      if (isEdit) {
        await api.put(`/coupons/${coupon!.id}`, payload)
        toast.success('Coupon mis à jour')
      } else {
        await api.post('/coupons', payload)
        toast.success('Coupon créé')
      }
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Une erreur est survenue')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-lg glass-card p-6 overflow-y-auto max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">{isEdit ? 'Modifier le coupon' : 'Nouveau coupon'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-lg text-brand-muted hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Code */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Code <span className="text-red-400">*</span></label>
            <input
              {...register('code', { required: !isEdit && 'Le code est requis' })}
              placeholder="PROMO20"
              className="input-field font-mono tracking-widest uppercase"
              style={{ textTransform: 'uppercase' }}
            />
            {errors.code && <p className="text-red-400 text-xs mt-1">{errors.code.message}</p>}
            <p className="text-brand-muted text-xs mt-1">Laissez vide pour générer automatiquement</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <input
              {...register('description')}
              placeholder="Description optionnelle..."
              className="input-field"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Type <span className="text-red-400">*</span></label>
            <select {...register('type', { required: true })} className="input-field">
              <option value="PERCENTAGE">Pourcentage (%)</option>
              <option value="FIXED_AMOUNT">Montant fixe (Ar)</option>
              <option value="FREE_DELIVERY">Livraison offerte</option>
            </select>
          </div>

          {/* Value */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Valeur <span className="text-red-400">*</span>
              <span className="text-brand-muted font-normal ml-1">
                {type === 'PERCENTAGE' ? '(%)' : '(Ar)'}
              </span>
            </label>
            <div className="relative">
              <input
                {...register('value', {
                  required: 'La valeur est requise',
                  min: { value: 0.01, message: 'La valeur doit être positive' },
                })}
                type="number"
                step="0.01"
                min="0"
                placeholder={type === 'PERCENTAGE' ? '10' : '5000'}
                className="input-field pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted text-sm">
                {type === 'PERCENTAGE' ? '%' : 'Ar'}
              </span>
            </div>
            {errors.value && <p className="text-red-400 text-xs mt-1">{errors.value.message}</p>}
          </div>

          {/* Two-column row: minOrderAmount + maxDiscount (PERCENTAGE only) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Montant minimum <span className="text-brand-muted font-normal">(Ar)</span></label>
              <input
                {...register('minOrderAmount')}
                type="number"
                min="0"
                placeholder="ex: 10000"
                className="input-field"
              />
            </div>

            {type === 'PERCENTAGE' && (
              <div>
                <label className="block text-sm font-medium mb-1.5">Réduction max <span className="text-brand-muted font-normal">(Ar)</span></label>
                <input
                  {...register('maxDiscount')}
                  type="number"
                  min="0"
                  placeholder="ex: 20000"
                  className="input-field"
                />
              </div>
            )}
          </div>

          {/* Max utilisations */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Max utilisations</label>
            <input
              {...register('usageLimit')}
              type="number"
              min="1"
              placeholder="Illimité"
              className="input-field"
            />
          </div>

          {/* Date début / Date fin */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Date début</label>
              <input
                {...register('startDate')}
                type="date"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Date fin</label>
              <input
                {...register('endDate')}
                type="date"
                className="input-field"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-brand-border text-brand-muted hover:text-white hover:border-white/30 transition-colors text-sm font-medium">
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 btn-primary py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Créer le coupon'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Delete Confirmation Modal
// ---------------------------------------------------------------------------

interface DeleteModalProps {
  coupon: Coupon
  onClose: () => void
  onDeleted: () => void
}

function DeleteModal({ coupon, onClose, onDeleted }: DeleteModalProps) {
  const [loading, setLoading] = useState(false)

  const confirm = async () => {
    setLoading(true)
    try {
      await api.delete(`/coupons/${coupon.id}`)
      toast.success('Coupon supprimé')
      onDeleted()
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur lors de la suppression')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-sm glass-card p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold mb-1">Supprimer ce coupon ?</h2>
            <p className="text-brand-muted text-sm">
              Le coupon <span className="font-mono font-bold text-brand-orange">{coupon.code}</span> sera définitivement supprimé.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-brand-border text-brand-muted hover:text-white hover:border-white/30 transition-colors text-sm font-medium">
            Annuler
          </button>
          <button
            onClick={confirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Suppression...' : 'Supprimer'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CouponsPage() {
  const qc = useQueryClient()

  const [showCreate, setShowCreate] = useState(false)
  const [editCoupon, setEditCoupon] = useState<Coupon | null>(null)
  const [deleteCoupon, setDeleteCoupon] = useState<Coupon | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['coupons'],
    queryFn: () => api.get('/coupons').then(r => r.data.data),
  })

  const coupons: Coupon[] = data || []

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/coupons/${id}`, { isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coupons'] })
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  })

  const handleSaved = () => {
    qc.invalidateQueries({ queryKey: ['coupons'] })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Promotions & Coupons</h1>
          <p className="text-brand-muted text-sm">{coupons.length} coupon{coupons.length > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nouveau coupon
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-56 rounded-2xl" />
          ))
        ) : coupons.length === 0 ? (
          <div className="col-span-full text-center py-16 text-brand-muted">
            <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Aucun coupon créé</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Créer un coupon
            </button>
          </div>
        ) : (
          coupons.map((coupon) => (
            <motion.div
              key={coupon.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`glass-card p-5 flex flex-col gap-3 ${!coupon.isActive ? 'opacity-60' : ''}`}
            >
              {/* Top row: code + actions */}
              <div className="flex items-start justify-between">
                <div className="px-3 py-1.5 bg-brand-orange/10 border border-brand-orange/20 rounded-xl">
                  <span className="font-mono font-bold text-brand-orange tracking-widest">{coupon.code}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { navigator.clipboard.writeText(coupon.code); toast.success('Code copié !') }}
                    title="Copier le code"
                    className="p-1.5 hover:bg-white/5 rounded-lg text-brand-muted hover:text-white transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditCoupon(coupon)}
                    title="Modifier"
                    className="p-1.5 hover:bg-white/5 rounded-lg text-brand-muted hover:text-blue-400 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteCoupon(coupon)}
                    title="Supprimer"
                    className="p-1.5 hover:bg-red-500/10 rounded-lg text-brand-muted hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-brand-muted">{coupon.description || 'Aucune description'}</p>

              {/* Type badge */}
              <span className={`self-start text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_BADGE[coupon.type]}`}>
                {TYPE_LABELS[coupon.type]}
              </span>

              {/* Value + usage */}
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold text-brand-orange">
                    {coupon.type === 'PERCENTAGE'
                      ? `${coupon.value}%`
                      : coupon.type === 'FIXED_AMOUNT'
                      ? `Ar ${coupon.value.toLocaleString('fr-FR')}`
                      : '—'}
                  </p>
                  <p className="text-xs text-brand-muted">
                    {coupon.type === 'PERCENTAGE' || coupon.type === 'FIXED_AMOUNT' ? 'de réduction' : 'livraison offerte'}
                  </p>
                </div>
                <div className="text-right text-xs text-brand-muted">
                  <p>{coupon._count?.usages ?? coupon.usageCount} utilisations</p>
                  {coupon.usageLimit && <p>/ {coupon.usageLimit} max</p>}
                </div>
              </div>

              {/* Extra info */}
              <div className="space-y-0.5">
                {coupon.minOrderAmount != null && (
                  <p className="text-xs text-brand-muted">Minimum: Ar {coupon.minOrderAmount.toLocaleString('fr-FR')}</p>
                )}
                {coupon.maxDiscount != null && (
                  <p className="text-xs text-brand-muted">Réduction max: Ar {coupon.maxDiscount.toLocaleString('fr-FR')}</p>
                )}
                {coupon.startDate && (
                  <p className="text-xs text-brand-muted">Début: {formatDate(coupon.startDate)}</p>
                )}
                {coupon.endDate && (
                  <p className="text-xs text-brand-muted">Expire: {formatDate(coupon.endDate)}</p>
                )}
              </div>

              {/* Footer: active toggle + channels */}
              <div className="mt-auto pt-3 border-t border-brand-border flex items-center justify-between">
                <button
                  onClick={() => toggleActive.mutate({ id: coupon.id, isActive: !coupon.isActive })}
                  className={`text-xs px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                    coupon.isActive
                      ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  }`}
                  title={coupon.isActive ? 'Cliquer pour désactiver' : 'Cliquer pour activer'}
                >
                  {coupon.isActive ? 'Actif' : 'Inactif'}
                </button>
                <div className="flex gap-1 text-xs text-brand-muted">
                  {(coupon.channels || []).map((c: string) => (
                    <span key={c} className="px-1.5 py-0.5 bg-white/5 rounded">{c}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCreate && (
          <CouponModal
            onClose={() => setShowCreate(false)}
            onSaved={handleSaved}
          />
        )}
        {editCoupon && (
          <CouponModal
            coupon={editCoupon}
            onClose={() => setEditCoupon(null)}
            onSaved={handleSaved}
          />
        )}
        {deleteCoupon && (
          <DeleteModal
            coupon={deleteCoupon}
            onClose={() => setDeleteCoupon(null)}
            onDeleted={handleSaved}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

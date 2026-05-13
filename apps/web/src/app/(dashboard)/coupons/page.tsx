'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Tag, Plus, Copy, ToggleLeft, ToggleRight } from 'lucide-react'
import { api } from '@/lib/api'
import { formatDate, formatCurrency } from '@restaurant/utils'
import { toast } from 'sonner'

export default function CouponsPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['coupons'],
    queryFn: () => api.get('/coupons').then(r => r.data.data),
  })

  const coupons = data || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Promotions & Coupons</h1>
          <p className="text-brand-muted text-sm">{coupons.length} coupon{coupons.length > 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nouveau coupon
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-48 rounded-2xl" />)
        ) : coupons.length === 0 ? (
          <div className="col-span-full text-center py-16 text-brand-muted">
            <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Aucun coupon créé</p>
          </div>
        ) : (
          coupons.map((coupon: any) => (
            <motion.div key={coupon.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`glass-card p-5 ${!coupon.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="px-3 py-1.5 bg-brand-orange/10 border border-brand-orange/20 rounded-xl">
                  <span className="font-mono font-bold text-brand-orange tracking-widest">{coupon.code}</span>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(coupon.code); toast.success('Code copié !') }}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-brand-muted hover:text-white transition-colors">
                  <Copy className="w-4 h-4" />
                </button>
              </div>

              <p className="text-sm mb-3">{coupon.description || 'Aucune description'}</p>

              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-2xl font-bold text-brand-orange">
                    {coupon.type === 'PERCENTAGE' ? `${coupon.value}%` : formatCurrency(coupon.value)}
                  </p>
                  <p className="text-xs text-brand-muted">
                    {coupon.type === 'PERCENTAGE' ? 'de réduction' :
                     coupon.type === 'FIXED_AMOUNT' ? 'de réduction' : 'livraison offerte'}
                  </p>
                </div>
                <div className="text-right text-xs text-brand-muted">
                  <p>{coupon._count?.usages || 0} utilisations</p>
                  {coupon.usageLimit && <p>/ {coupon.usageLimit} max</p>}
                </div>
              </div>

              {coupon.minOrderAmount && (
                <p className="text-xs text-brand-muted">Minimum: {formatCurrency(coupon.minOrderAmount)}</p>
              )}
              {coupon.endDate && (
                <p className="text-xs text-brand-muted">Expire: {formatDate(coupon.endDate)}</p>
              )}

              <div className="mt-3 pt-3 border-t border-brand-border flex items-center justify-between">
                <span className={`text-xs px-2 py-0.5 rounded-full ${coupon.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {coupon.isActive ? 'Actif' : 'Inactif'}
                </span>
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
    </div>
  )
}

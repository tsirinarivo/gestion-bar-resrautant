'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Star, Eye, EyeOff, MessageSquare, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { formatDate } from '@restaurant/utils'
import { toast } from 'sonner'

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400 text-sm">
      {'⭐'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  )
}

export default function ReviewsPage() {
  const [replyingId, setReplyingId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['reviews'],
    queryFn: () => api.get('/reviews?limit=50').then(r => r.data),
  })

  const replyMutation = useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) =>
      api.patch(`/reviews/${id}/reply`, { reply }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] })
      setReplyingId(null)
      setReplyText('')
      toast.success('Réponse publiée')
    },
  })

  const visibilityMutation = useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) =>
      api.patch(`/reviews/${id}/visibility`, { isPublic }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] })
      toast.success('Visibilité mise à jour')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/reviews/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] })
      toast.success('Avis supprimé')
    },
  })

  const reviews = data?.data ?? []
  const avgRating = reviews.length
    ? (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Avis clients</h1>
          <p className="text-brand-muted text-sm">
            {reviews.length} avis · Note moyenne : {avgRating} ⭐
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[5,4,3,2,1].map(star => {
          const count = reviews.filter((r: any) => r.rating === star).length
          const pct = reviews.length ? (count / reviews.length) * 100 : 0
          return (
            <div key={star} className="glass-card p-3 text-center">
              <p className="text-lg font-bold">{count}</p>
              <p className="text-xs text-brand-muted">{'⭐'.repeat(star)}</p>
              <div className="mt-1 h-1 bg-brand-border rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)
        ) : reviews.length === 0 ? (
          <div className="text-center py-16 text-brand-muted">
            <Star className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Aucun avis pour l'instant</p>
          </div>
        ) : (
          reviews.map((review: any) => (
            <motion.div key={review.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="glass-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <StarDisplay rating={review.rating} />
                    {review.customer && (
                      <span className="text-sm font-medium">{review.customer.firstName}</span>
                    )}
                    <span className="text-xs text-brand-muted">{formatDate(review.createdAt)}</span>
                    {!review.isPublic && (
                      <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">Masqué</span>
                    )}
                  </div>
                  {review.content && (
                    <p className="text-sm text-brand-muted mb-2">{review.content}</p>
                  )}
                  {review.reply && (
                    <div className="bg-brand-orange/10 border-l-2 border-brand-orange px-3 py-2 text-sm rounded-r-xl">
                      <span className="font-medium text-brand-orange text-xs">Votre réponse :</span>
                      <p className="mt-0.5">{review.reply}</p>
                    </div>
                  )}
                  {replyingId === review.id && (
                    <div className="mt-2 flex gap-2">
                      <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                        rows={2} placeholder="Votre réponse..." className="input-field text-sm resize-none flex-1" />
                      <div className="flex flex-col gap-1">
                        <button onClick={() => replyMutation.mutate({ id: review.id, reply: replyText })}
                          disabled={!replyText.trim()} className="btn-primary px-3 py-1 text-xs">Envoyer</button>
                        <button onClick={() => setReplyingId(null)} className="btn-secondary px-3 py-1 text-xs">Annuler</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {!review.reply && (
                    <button onClick={() => { setReplyingId(review.id); setReplyText('') }}
                      className="p-2 hover:bg-brand-orange/10 text-brand-muted hover:text-brand-orange rounded-lg transition-colors" title="Répondre">
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => visibilityMutation.mutate({ id: review.id, isPublic: !review.isPublic })}
                    className="p-2 hover:bg-white/10 text-brand-muted rounded-lg transition-colors"
                    title={review.isPublic ? 'Masquer' : 'Afficher'}>
                    {review.isPublic ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button onClick={() => { if (confirm('Supprimer cet avis ?')) deleteMutation.mutate(review.id) }}
                    className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors" title="Supprimer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}

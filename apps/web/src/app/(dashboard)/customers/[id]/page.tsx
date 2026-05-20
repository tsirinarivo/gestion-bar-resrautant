'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, User, Phone, Mail, MapPin, Award, ShoppingBag, Calendar, Star, Edit2, Check, X, Plus, Minus } from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency, formatDate, formatRelative, initials } from '@restaurant/utils'
import { toast } from 'sonner'

const TIER_COLORS: Record<string, string> = {
  BRONZE:   'text-amber-600 bg-amber-700/20 border-amber-700/30',
  SILVER:   'text-gray-300 bg-gray-500/20 border-gray-500/30',
  GOLD:     'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
  PLATINUM: 'text-cyan-300 bg-cyan-500/20 border-cyan-500/30',
}
const TIER_EMOJI: Record<string, string> = { BRONZE: '🥉', SILVER: '🥈', GOLD: '🥇', PLATINUM: '💎' }

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'text-amber-400', CONFIRMED: 'text-blue-400', PREPARING: 'text-orange-400',
  READY: 'text-green-400', COMPLETED: 'text-emerald-400', CANCELLED: 'text-red-400',
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const qc = useQueryClient()
  const [adjustPoints, setAdjustPoints] = useState(0)
  const [adjustReason, setAdjustReason] = useState('')
  const [showAdjust, setShowAdjust] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get(`/customers/${id}`).then(r => r.data.data),
  })

  const saveNotes = useMutation({
    mutationFn: () => api.put(`/customers/${id}`, { notes: notesValue.trim() || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customer', id] }); setEditingNotes(false); toast.success('Note enregistrée') },
  })

  const adjustLoyalty = useMutation({
    mutationFn: () => api.post(`/customers/${id}/loyalty/adjust`, { points: adjustPoints, reason: adjustReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer', id] })
      toast.success(`${adjustPoints > 0 ? '+' : ''}${adjustPoints} points appliqués`)
      setShowAdjust(false); setAdjustPoints(0); setAdjustReason('')
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Erreur'),
  })

  if (isLoading) return (
    <div className="space-y-6">
      <div className="skeleton h-8 w-40 rounded-xl" />
      <div className="skeleton h-40 rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="skeleton h-64 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    </div>
  )

  if (!customer) return (
    <div className="text-center py-20 text-brand-muted">
      <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
      <p>Client introuvable</p>
      <button onClick={() => router.back()} className="mt-4 btn-secondary text-sm">Retour</button>
    </div>
  )

  const loyalty = customer.loyaltyAccount
  const tier = loyalty?.tier ?? 'BRONZE'
  const totalSpent = customer.orders?.reduce((s: number, o: any) => s + o.totalAmount, 0) ?? 0
  const avgBasket = customer.orders?.length ? totalSpent / customer.orders.length : 0

  return (
    <div className="space-y-6">
      <button onClick={() => router.push('/customers')}
        className="flex items-center gap-2 text-sm text-brand-muted hover:text-white transition-colors">
        <ChevronLeft className="w-4 h-4" /> Retour aux clients
      </button>

      {/* Hero card */}
      <div className="glass-card p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-xl text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #FF4D00, #FFB800)' }}>
            {initials(customer.firstName, customer.lastName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">{customer.firstName} {customer.lastName}</h1>
                <div className="flex flex-wrap gap-3 mt-1 text-sm text-brand-muted">
                  {customer.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{customer.phone}</span>}
                  {customer.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{customer.email}</span>}
                  {customer.city && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{customer.city}</span>}
                  {customer.birthDate && <span className="flex items-center gap-1">🎂 {new Date(customer.birthDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span>}
                </div>
              </div>
              {loyalty && (
                <span className={`text-sm px-3 py-1.5 rounded-xl border font-semibold flex-shrink-0 ${TIER_COLORS[tier] ?? TIER_COLORS.BRONZE}`}>
                  {TIER_EMOJI[tier]} {tier}
                </span>
              )}
            </div>

            {/* Notes */}
            <div className="mt-3">
              {editingNotes ? (
                <div className="flex items-start gap-2">
                  <textarea autoFocus value={notesValue} onChange={e => setNotesValue(e.target.value)}
                    rows={2} placeholder="Notes internes (allergies, préférences…)"
                    className="input-field text-sm resize-none flex-1" />
                  <div className="flex flex-col gap-1">
                    <button onClick={() => saveNotes.mutate()} className="p-1.5 bg-green-500/20 text-green-400 rounded-lg"><Check className="w-4 h-4" /></button>
                    <button onClick={() => { setEditingNotes(false); setNotesValue(customer.notes ?? '') }} className="p-1.5 bg-white/5 text-brand-muted rounded-lg"><X className="w-4 h-4" /></button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setNotesValue(customer.notes ?? ''); setEditingNotes(true) }}
                  className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl w-full text-left transition-colors ${customer.notes ? 'text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20' : 'text-brand-muted bg-white/5 hover:bg-white/10'}`}>
                  <Edit2 className="w-3.5 h-3.5 flex-shrink-0" />
                  {customer.notes || '+ Ajouter une note interne (allergies, préférences…)'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Commandes', value: customer.orders?.length ?? 0, icon: ShoppingBag, color: 'text-brand-orange' },
          { label: 'Total dépensé', value: formatCurrency(totalSpent), icon: Award, color: 'text-green-400' },
          { label: 'Panier moyen', value: formatCurrency(avgBasket), icon: ShoppingBag, color: 'text-blue-400' },
          { label: 'Points fidélité', value: loyalty?.points ?? 0, icon: Star, color: 'text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="glass-card p-4 flex items-center gap-3">
            <s.icon className={`w-5 h-5 flex-shrink-0 ${s.color}`} />
            <div>
              <p className="font-bold text-lg">{s.value}</p>
              <p className="text-xs text-brand-muted">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Loyalty */}
        {loyalty && (
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" /> Fidélité
              </h2>
              <button onClick={() => setShowAdjust(v => !v)} className="text-xs text-brand-orange hover:underline">
                {showAdjust ? 'Annuler' : '+ Ajuster les points'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4 text-center">
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xl font-bold text-yellow-400">{loyalty.points}</p>
                <p className="text-xs text-brand-muted">Points actuels</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xl font-bold">{loyalty.totalEarned}</p>
                <p className="text-xs text-brand-muted">Total gagné</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xl font-bold">{loyalty.totalSpent}</p>
                <p className="text-xs text-brand-muted">Total dépensé</p>
              </div>
            </div>

            {showAdjust && (
              <div className="space-y-2 mb-4 p-3 bg-brand-orange/5 border border-brand-orange/20 rounded-xl">
                <div className="flex items-center gap-2">
                  <button onClick={() => setAdjustPoints(v => v - 50)} className="p-1.5 bg-white/10 rounded-lg hover:bg-white/20"><Minus className="w-3.5 h-3.5" /></button>
                  <input type="number" value={adjustPoints} onChange={e => setAdjustPoints(Number(e.target.value))}
                    className="input-field text-center flex-1" placeholder="Ex: +100 ou -50" />
                  <button onClick={() => setAdjustPoints(v => v + 50)} className="p-1.5 bg-white/10 rounded-lg hover:bg-white/20"><Plus className="w-3.5 h-3.5" /></button>
                </div>
                <input value={adjustReason} onChange={e => setAdjustReason(e.target.value)}
                  className="input-field w-full text-sm" placeholder="Raison (ex: Geste commercial, correction…)" />
                <button onClick={() => adjustLoyalty.mutate()}
                  disabled={!adjustPoints || !adjustReason || adjustLoyalty.isPending}
                  className="btn-primary w-full text-sm disabled:opacity-50">
                  Appliquer l'ajustement
                </button>
              </div>
            )}

            {loyalty.transactions?.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                <p className="text-xs text-brand-muted mb-2">Historique transactions</p>
                {loyalty.transactions.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between text-xs py-1.5 border-b border-brand-border/30">
                    <span className="text-brand-muted">{t.description || t.type}</span>
                    <div className="flex items-center gap-3">
                      <span className={t.points > 0 ? 'text-green-400' : 'text-red-400'}>
                        {t.points > 0 ? '+' : ''}{t.points} pts
                      </span>
                      <span className="text-brand-muted/60">{formatRelative(t.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recent orders */}
        <div className="glass-card p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <ShoppingBag className="w-4 h-4 text-brand-orange" /> Dernières commandes
          </h2>
          {!customer.orders?.length ? (
            <p className="text-sm text-brand-muted text-center py-6">Aucune commande</p>
          ) : (
            <div className="space-y-2">
              {customer.orders.map((o: any) => (
                <div key={o.id} className="flex items-center justify-between py-2 border-b border-brand-border/30 text-sm">
                  <div>
                    <p className="font-medium">{o.orderNumber}</p>
                    <p className="text-xs text-brand-muted">{formatRelative(o.createdAt)} · {o.items?.length} article{o.items?.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-brand-orange">{formatCurrency(o.totalAmount)}</p>
                    <p className={`text-xs font-medium ${STATUS_COLOR[o.status] ?? 'text-brand-muted'}`}>{o.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reservations */}
        {customer.reservations?.length > 0 && (
          <div className="glass-card p-5">
            <h2 className="font-semibold flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-brand-orange" /> Réservations
            </h2>
            <div className="space-y-2">
              {customer.reservations.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-brand-border/30 text-sm">
                  <div>
                    <p className="font-medium">{formatDate(r.date)}</p>
                    <p className="text-xs text-brand-muted">{r.partySize} pers. · {r.status}</p>
                  </div>
                  {r.specialRequest && (
                    <p className="text-xs text-amber-400 max-w-[150px] truncate">⭐ {r.specialRequest}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Addresses */}
        {customer.addresses?.length > 0 && (
          <div className="glass-card p-5">
            <h2 className="font-semibold flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-brand-orange" /> Adresses
            </h2>
            <div className="space-y-2">
              {customer.addresses.map((a: any) => (
                <div key={a.id} className="text-sm p-3 bg-white/5 rounded-xl">
                  <p>{a.street}</p>
                  <p className="text-brand-muted">{a.postalCode} {a.city}{a.country && `, ${a.country}`}</p>
                  {a.isDefault && <span className="text-xs text-brand-orange">Adresse principale</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

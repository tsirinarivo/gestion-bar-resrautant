'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@restaurant/utils'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'
const RESTAURANT_SLUG = process.env['NEXT_PUBLIC_RESTAURANT_SLUG'] ?? 'restaurant-demo'

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED'

const STATUS_STEPS: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED']

const STATUS_INFO: Record<OrderStatus, { label: string; emoji: string; description: string }> = {
  PENDING:   { label: 'En attente',   emoji: '⏳', description: 'Votre commande est reçue et en attente de confirmation.' },
  CONFIRMED: { label: 'Confirmée',    emoji: '✅', description: 'Votre commande a été confirmée.' },
  PREPARING: { label: 'En préparation', emoji: '👨‍🍳', description: 'Votre commande est en cours de préparation en cuisine.' },
  READY:     { label: 'Prête',        emoji: '🛎️', description: 'Votre commande est prête ! Venez la récupérer ou elle sera livrée.' },
  COMPLETED: { label: 'Livrée',       emoji: '🎉', description: 'Votre commande a été livrée. Bon appétit !' },
  CANCELLED: { label: 'Annulée',      emoji: '❌', description: 'Cette commande a été annulée.' },
}

type OrderItem = {
  quantity: number; unitPrice: number; totalPrice: number; notes?: string; status?: string
  product: { name: string; image?: string }
}

type Order = {
  id: string; orderNumber: string; status: OrderStatus; type: string;
  totalAmount: number; createdAt: string; readyAt?: string; estimatedTime?: number;
  items: OrderItem[]
  statusHistory: { status: string; notes?: string; createdAt: string }[]
}

export default function OrderTrackingPage({ params }: { params: { orderNumber: string } }) {
  const [order, setOrder] = useState<Order | null>(null)
  const orderRef = useRef<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [review, setReview] = useState({ rating: 0, content: '' })
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  const [reviewLoading, setReviewLoading] = useState(false)

  async function submitReview() {
    if (!review.rating) return
    setReviewLoading(true)
    try {
      await fetch(`${API_URL}/api/public/${RESTAURANT_SLUG}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: review.rating, content: review.content || undefined, orderNumber: params.orderNumber }),
      })
      setReviewSubmitted(true)
    } catch {}
    finally { setReviewLoading(false) }
  }

  async function cancelOrder() {
    if (!confirm('Êtes-vous sûr de vouloir annuler cette commande ?')) return
    setCancelling(true)
    setCancelError('')
    try {
      const res = await fetch(`${API_URL}/api/public/${RESTAURANT_SLUG}/orders/${params.orderNumber}/cancel`, { method: 'POST' })
      const data = await res.json() as { success: boolean; error?: string }
      if (!data.success) throw new Error(data.error ?? 'Erreur lors de l\'annulation')
      await fetchOrder()
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setCancelling(false)
    }
  }

  async function fetchOrder() {
    try {
      const res = await fetch(`${API_URL}/api/public/${RESTAURANT_SLUG}/orders/${params.orderNumber}`)
      const data = await res.json() as { success: boolean; data: Order; error?: string }
      if (!data.success) throw new Error(data.error ?? 'Commande introuvable')
      orderRef.current = data.data
      setOrder(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrder()
    // Poll every 30s — use ref to avoid stale closure on order state
    const interval = setInterval(() => {
      const current = orderRef.current
      if (current && (current.status === 'COMPLETED' || current.status === 'CANCELLED')) return
      fetchOrder()
    }, 30_000)
    return () => clearInterval(interval)
  }, [params.orderNumber])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Chargement…</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-5xl mb-4">❓</p>
          <h1 className="text-xl font-bold mb-2">Commande introuvable</h1>
          <p className="text-gray-500 text-sm mb-6">{error || 'Cette commande n\'existe pas.'}</p>
          <Link href="/menu" className="btn-primary">Retour au menu</Link>
        </div>
      </div>
    )
  }

  const statusInfo = STATUS_INFO[order.status] ?? STATUS_INFO['PENDING']
  const statusIdx = STATUS_STEPS.indexOf(order.status)
  const isCancelled = order.status === 'CANCELLED'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-amber-600 text-white py-6 px-4">
        <div className="max-w-lg mx-auto">
          <Link href="/orders" className="text-amber-200 text-sm hover:text-white mb-3 block">← Mes commandes</Link>
          <h1 className="text-2xl font-bold">{statusInfo.emoji} {statusInfo.label}</h1>
          <p className="text-amber-100 text-sm mt-1">Commande {order.orderNumber}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Status message */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-gray-700">{statusInfo.description}</p>
          {order.estimatedTime && !isCancelled && order.status !== 'COMPLETED' && (
            <p className="text-sm text-amber-600 mt-2 font-medium">⏱ Temps estimé : environ {order.estimatedTime} min</p>
          )}

          {/* Progress bar */}
          {!isCancelled && (
            <div className="mt-4">
              <div className="flex justify-between mb-2">
                {STATUS_STEPS.map((s, i) => (
                  <div key={s} className="flex flex-col items-center flex-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1
                      ${i <= statusIdx ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                      {i < statusIdx ? '✓' : i + 1}
                    </div>
                    <span className={`text-[10px] text-center leading-tight ${i <= statusIdx ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                      {STATUS_INFO[s]?.label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(5, (statusIdx / (STATUS_STEPS.length - 1)) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Order items */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-sm">Articles commandés</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                <div className="flex-1">
                  <p className="font-medium">{item.quantity}× {item.product.name}</p>
                  {item.notes && <p className="text-gray-500 text-xs">{item.notes}</p>}
                </div>
                <span className="text-gray-600 font-semibold ml-3">{formatCurrency(item.totalPrice)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between px-5 py-3 border-t border-gray-100 font-bold">
            <span>Total</span>
            <span className="text-amber-600">{formatCurrency(order.totalAmount)}</span>
          </div>
        </div>

        {/* Status history */}
        {order.statusHistory && order.statusHistory.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-sm">Historique</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {order.statusHistory.map((h, i) => (
                <div key={i} className="px-5 py-2.5 text-sm flex items-center gap-3">
                  <span className="text-lg">{STATUS_INFO[h.status as OrderStatus]?.emoji ?? '•'}</span>
                  <div className="flex-1">
                    <p className="font-medium">{STATUS_INFO[h.status as OrderStatus]?.label ?? h.status}</p>
                    {h.notes && <p className="text-gray-500 text-xs">{h.notes}</p>}
                  </div>
                  <span className="text-gray-400 text-xs flex-shrink-0">
                    {new Date(h.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Review form — shown only after completion */}
        {order.status === 'COMPLETED' && !reviewSubmitted && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-semibold text-sm mb-3">⭐ Donnez votre avis</h2>
            <div className="flex gap-1 mb-3">
              {[1,2,3,4,5].map(star => (
                <button key={star} onClick={() => setReview(r => ({ ...r, rating: star }))}
                  className={`text-2xl transition-transform hover:scale-110 ${star <= review.rating ? 'opacity-100' : 'opacity-30'}`}>
                  ⭐
                </button>
              ))}
            </div>
            {review.rating > 0 && (
              <>
                <textarea value={review.content} onChange={e => setReview(r => ({ ...r, content: e.target.value }))}
                  rows={2} placeholder="Commentaire (optionnel)..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400 resize-none mb-3" />
                <button onClick={submitReview} disabled={reviewLoading}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-white font-bold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">
                  {reviewLoading ? 'Envoi...' : 'Envoyer mon avis'}
                </button>
              </>
            )}
          </div>
        )}
        {reviewSubmitted && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center text-sm text-green-700">
            ✅ Merci pour votre avis !
          </div>
        )}

        <button onClick={fetchOrder}
          className="w-full py-3 rounded-xl border border-amber-300 text-amber-600 font-medium text-sm hover:bg-amber-50 transition-colors">
          🔄 Actualiser le statut
        </button>

        {order.status === 'PENDING' && (
          <div>
            <button onClick={cancelOrder} disabled={cancelling}
              className="w-full py-3 rounded-xl border border-red-300 text-red-500 font-medium text-sm hover:bg-red-50 transition-colors disabled:opacity-50">
              {cancelling ? 'Annulation...' : '✕ Annuler ma commande'}
            </button>
            {cancelError && <p className="text-red-500 text-xs text-center mt-1">{cancelError}</p>}
            <p className="text-gray-400 text-xs text-center mt-1">Annulation possible uniquement avant confirmation</p>
          </div>
        )}
      </div>
    </div>
  )
}

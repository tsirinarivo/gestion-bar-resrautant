'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'
const RESTAURANT_SLUG = process.env['NEXT_PUBLIC_RESTAURANT_SLUG'] ?? 'restaurant-demo'

type RestaurantInfo = { name: string; slug: string; logo?: string }

export default function PostMealReviewPage({ params }: { params: { orderNumber: string } }) {
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null)
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API_URL}/api/public/${RESTAURANT_SLUG}/info`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { data?: RestaurantInfo } | null) => { if (d?.data) setRestaurant(d.data) })
      .catch(() => {})
  }, [])

  async function submit() {
    if (!rating) return
    setSubmitting(true); setError('')
    try {
      const r = await fetch(`${API_URL}/api/public/${RESTAURANT_SLUG}/reviews`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rating, content: content || undefined, orderNumber: params.orderNumber }),
      })
      const data = await r.json() as { success: boolean; error?: string }
      if (!data.success) throw new Error(data.error ?? 'Erreur')
      setDone(true)
    } catch (e: any) {
      setError(e?.message ?? 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🙏</div>
          <h1 className="text-xl font-bold mb-2">Merci pour votre avis !</h1>
          <p className="text-sm text-gray-500 mb-6">
            Votre retour nous aide à améliorer le service. À très bientôt !
          </p>
          <Link href="/"
            className="inline-block bg-amber-500 hover:bg-amber-400 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 p-4">
      <div className="bg-white rounded-3xl shadow-xl p-6 max-w-md w-full">
        <div className="text-center mb-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Commande {params.orderNumber}</p>
          <h1 className="text-xl font-bold mt-1">Comment était votre expérience ?</h1>
          {restaurant && <p className="text-sm text-gray-500 mt-1">{restaurant.name}</p>}
        </div>

        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map(star => (
            <button key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              className="text-4xl transition-transform hover:scale-110 cursor-pointer">
              <span className={star <= (hover || rating) ? 'opacity-100' : 'opacity-25 grayscale'}>⭐</span>
            </button>
          ))}
        </div>

        {rating > 0 && (
          <>
            <p className="text-center text-sm text-amber-600 font-medium mb-4">
              {rating === 1 && '😞 Très insatisfait'}
              {rating === 2 && '😕 Insatisfait'}
              {rating === 3 && '😐 Correct'}
              {rating === 4 && '🙂 Satisfait'}
              {rating === 5 && '🤩 Excellent !'}
            </p>

            <textarea value={content} onChange={e => setContent(e.target.value)}
              rows={4} placeholder="Dites-nous ce qui vous a plu (ou pas)..."
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-400 resize-none mb-4" />

            {error && <p className="text-red-500 text-xs text-center mb-3">{error}</p>}

            <button onClick={submit} disabled={submitting}
              className="w-full bg-amber-500 hover:bg-amber-400 text-white font-bold py-3 rounded-2xl text-sm transition-colors disabled:opacity-50">
              {submitting ? 'Envoi...' : 'Envoyer mon avis'}
            </button>

            <p className="text-center text-xs text-gray-400 mt-3">
              Votre commentaire pourra être affiché publiquement
            </p>
          </>
        )}
      </div>
    </div>
  )
}

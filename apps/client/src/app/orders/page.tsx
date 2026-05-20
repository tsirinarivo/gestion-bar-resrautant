'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'
const RESTAURANT_SLUG = process.env['NEXT_PUBLIC_RESTAURANT_SLUG'] ?? 'restaurant-demo'

const STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  PREPARING: 'bg-orange-100 text-orange-700',
  READY:     'bg-green-100 text-green-700',
  COMPLETED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-600',
}
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente', CONFIRMED: 'Confirmée', PREPARING: 'En préparation',
  READY: 'Prête', COMPLETED: 'Livrée', CANCELLED: 'Annulée',
}

type OrderSummary = {
  orderNumber: string; status: string; totalAmount: number; createdAt: string; type: string
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('orders') ?? '[]') as string[]
    if (!history.length) { setLoading(false); return }
    Promise.all(
      history.map(num =>
        fetch(`${API_URL}/api/public/${RESTAURANT_SLUG}/orders/${num}`)
          .then(r => r.json())
          .then((d: { success: boolean; data: OrderSummary }) => d.success ? d.data : null)
          .catch(() => null)
      )
    ).then(results => {
      setOrders(results.filter(Boolean) as OrderSummary[])
      setLoading(false)
    })
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-amber-600 text-white py-6 px-4">
        <div className="max-w-lg mx-auto">
          <Link href="/" className="text-amber-200 text-sm hover:text-white mb-3 block">← Accueil</Link>
          <h1 className="text-2xl font-bold">Mes commandes</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Chargement…</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">📋</p>
            <p className="text-xl text-gray-700 font-semibold mb-2">Aucune commande</p>
            <p className="text-gray-500 text-sm mb-6">Vous n'avez pas encore passé de commande.</p>
            <Link href="/menu" className="btn-primary">Commander maintenant</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => (
              <Link key={order.orderNumber} href={`/orders/${order.orderNumber}`}
                className="block bg-white rounded-2xl shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-base font-mono">{order.orderNumber}</p>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{order.type === 'DELIVERY' ? '🛵 Livraison' : '🥡 Emporté'}</span>
                  <span className="font-semibold text-amber-600">
                    {new Intl.NumberFormat('fr-FR').format(order.totalAmount)} Ar
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(order.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

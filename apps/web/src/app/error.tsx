'use client'

import Link from 'next/link'

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark p-6">
      <div className="text-center max-w-md">
        <p className="text-7xl mb-4">⚠️</p>
        <h1 className="text-3xl font-bold mb-2">Une erreur est survenue</h1>
        <p className="text-brand-muted mb-2 text-sm">
          {error.message || 'Erreur inattendue'}
        </p>
        <div className="flex gap-3 justify-center mt-6">
          <button onClick={reset}
            className="px-5 py-2.5 rounded-xl border border-brand-border text-brand-muted hover:border-brand-orange/40 hover:text-brand-orange transition-colors">
            Réessayer
          </button>
          <Link href="/dashboard"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-br from-brand-orange to-amber-500 text-white font-semibold hover:scale-105 transition-transform">
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    </div>
  )
}

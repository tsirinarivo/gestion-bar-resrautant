import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark p-6">
      <div className="text-center max-w-md">
        <p className="text-7xl mb-4">🍽️</p>
        <h1 className="text-3xl font-bold mb-2">Page introuvable</h1>
        <p className="text-brand-muted mb-8">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <Link href="/dashboard"
          className="inline-block px-6 py-3 rounded-xl bg-gradient-to-br from-brand-orange to-amber-500 text-white font-semibold hover:scale-105 transition-transform">
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  )
}

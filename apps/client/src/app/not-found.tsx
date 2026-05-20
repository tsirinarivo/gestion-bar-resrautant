import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50 p-6">
      <div className="text-center max-w-md">
        <p className="text-7xl mb-4">🍽️</p>
        <h1 className="text-3xl font-bold mb-2">Page introuvable</h1>
        <p className="text-gray-600 mb-8">Cette page n'existe pas.</p>
        <Link href="/menu" className="inline-block bg-amber-500 hover:bg-amber-400 text-white font-bold px-6 py-3 rounded-2xl transition-colors">
          Voir le menu
        </Link>
      </div>
    </div>
  )
}

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative h-screen flex items-center justify-center bg-gradient-to-br from-amber-900 via-stone-800 to-stone-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 text-center px-4">
          <p className="text-amber-400 font-medium tracking-widest text-sm uppercase mb-4">Bienvenue au</p>
          <h1 className="text-6xl md:text-8xl font-serif font-bold mb-6">Restaurant Demo</h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-4 max-w-2xl mx-auto">
            Cuisine locale et internationale — Ambiance chaleureuse
          </p>
          <p className="text-gray-400 mb-10">Antananarivo · Ouvert 7j/7</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/menu" className="btn-primary text-lg px-8 py-4 rounded-2xl">
              Commander en ligne
            </Link>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/40 rounded-full flex items-start justify-center p-1">
            <div className="w-1.5 h-3 bg-white/60 rounded-full" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="container-narrow">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            {[
              { icon: '🌿', title: 'Produits Locaux', desc: 'Viande de zébu, crevettes, vanille et épices directement de Madagascar' },
              { icon: '👨‍🍳', title: 'Cuisine Maison', desc: 'Romazava, brochettes, burgers et pizzas préparés sur place avec soin' },
              { icon: '🛵', title: 'Livraison Rapide', desc: 'Commandez en ligne et recevez votre repas directement chez vous' },
            ].map(f => (
              <div key={f.title} className="space-y-4">
                <div className="text-5xl">{f.icon}</div>
                <h3 className="text-xl font-serif font-bold">{f.title}</h3>
                <p className="text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-amber-50">
        <div className="container-narrow text-center">
          <h2 className="text-4xl font-serif font-bold mb-4">Notre Carte</h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Entrées, plats malgaches, burgers, pizzas, boissons et desserts. Commandez à emporter ou faites-vous livrer.
          </p>
          <Link href="/menu" className="btn-primary text-lg">Voir le menu complet →</Link>
        </div>
      </section>

      <footer className="bg-stone-900 text-gray-400 py-12">
        <div className="container-narrow text-center text-sm">
          <p className="text-white font-serif text-xl font-bold mb-2">Restaurant Demo</p>
          <p>Antananarivo, Madagascar</p>
          <p className="mt-4">&copy; {new Date().getFullYear()} Restaurant Demo. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}

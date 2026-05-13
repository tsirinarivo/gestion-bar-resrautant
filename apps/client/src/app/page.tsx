import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative h-screen flex items-center justify-center bg-gradient-to-br from-amber-900 via-stone-800 to-stone-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 text-center px-4">
          <p className="text-amber-400 font-medium tracking-widest text-sm uppercase mb-4">
            Bienvenue au
          </p>
          <h1 className="text-6xl md:text-8xl font-serif font-bold mb-6">
            Le Bistrot Moderne
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-4 max-w-2xl mx-auto">
            Cuisine française revisitée avec des produits frais et locaux
          </p>
          <p className="text-gray-400 mb-10">
            45 Rue de la Paix, Paris 2e · Ouvert 7j/7 de 11h30 à 23h30
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/menu"
              className="btn-primary text-lg px-8 py-4 rounded-2xl"
            >
              Commander en ligne
            </Link>
            <Link
              href="/reservations"
              className="inline-flex items-center justify-center px-8 py-4 border-2 border-white text-white font-semibold rounded-2xl hover:bg-white/10 transition-all duration-200 text-lg"
            >
              Réserver une table
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
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
              { icon: '🌿', title: 'Produits Frais', desc: 'Nous sélectionnons chaque jour les meilleurs produits locaux et de saison' },
              { icon: '👨‍🍳', title: 'Cuisine Maison', desc: 'Toutes nos recettes sont préparées sur place avec passion et savoir-faire' },
              { icon: '🍷', title: 'Cave Sélectionnée', desc: 'Plus de 80 références de vins soigneusement sélectionnés par notre sommelier' },
            ].map((f) => (
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
            Découvrez nos entrées, plats, burgers, pizzas et desserts. Commandez sur place, à emporter ou faites-vous livrer.
          </p>
          <Link href="/menu" className="btn-primary text-lg">
            Voir le menu complet →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-stone-900 text-gray-400 py-12">
        <div className="container-narrow">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-white font-serif text-xl font-bold mb-4">Le Bistrot Moderne</h3>
              <p className="text-sm">45 Rue de la Paix<br />75002 Paris<br />+33 1 42 86 75 30</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Horaires</h4>
              <p className="text-sm">Lundi – Jeudi : 11h30 – 22h30<br />Vendredi – Samedi : 11h30 – 23h30<br />Dimanche : 11h00 – 21h30</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Liens</h4>
              <nav className="space-y-2 text-sm">
                <Link href="/menu" className="block hover:text-white transition-colors">Notre Menu</Link>
                <Link href="/reservations" className="block hover:text-white transition-colors">Réservations</Link>
                <Link href="/orders" className="block hover:text-white transition-colors">Mes Commandes</Link>
                <Link href="/account" className="block hover:text-white transition-colors">Mon Compte</Link>
              </nav>
            </div>
          </div>
          <div className="border-t border-stone-700 mt-8 pt-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} Le Bistrot Moderne. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

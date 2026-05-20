'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const RESTAURANT_SLUG = process.env['NEXT_PUBLIC_RESTAURANT_SLUG'] ?? 'restaurant-demo';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

interface RestaurantInfo {
  name: string;
  description?: string;
  address?: string;
  city?: string;
  phone?: string;
  website?: string;
  logo?: string;
  openingHours?: Record<string, { open: boolean; start: string; end: string }>;
  deliveryEnabled?: boolean;
  pickupEnabled?: boolean;
}

function isOpen(hours: RestaurantInfo['openingHours']): boolean | null {
  if (!hours) return null;
  const now = new Date();
  const dayKey = DAY_KEYS[now.getDay()];
  const day = hours[dayKey ?? ''];
  if (!day || !day.open) return false;
  const [sh, sm] = (day.start ?? '09:00').split(':').map(Number);
  const [eh, em] = (day.end ?? '22:00').split(':').map(Number);
  const current = now.getHours() * 60 + now.getMinutes();
  return current >= (sh ?? 0) * 60 + (sm ?? 0) && current < (eh ?? 22) * 60 + (em ?? 0);
}

function nextOpenDay(hours: RestaurantInfo['openingHours']): string | null {
  if (!hours) return null;
  const now = new Date();
  for (let i = 1; i <= 7; i++) {
    const dayIdx = (now.getDay() + i) % 7;
    const dayKey = DAY_KEYS[dayIdx];
    const day = dayKey ? hours[dayKey] : undefined;
    if (day?.open) {
      const labels = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
      return `${labels[dayIdx] ?? ''} à ${day.start}`;
    }
  }
  return null;
}

export default function HomePage() {
  const [info, setInfo] = useState<RestaurantInfo | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/public/${RESTAURANT_SLUG}/info`)
      .then(r => r.json())
      .then((d: { success?: boolean; data?: RestaurantInfo }) => { if (d.data) setInfo(d.data) })
      .catch(() => null);
  }, []);

  const name = info?.name ?? 'Restaurant';
  const description = info?.description ?? 'Cuisine locale et internationale — Ambiance chaleureuse';
  const address = info?.city ? `${info.city} · Madagascar` : 'Madagascar';
  const openStatus = isOpen(info?.openingHours);
  const next = openStatus === false ? nextOpenDay(info?.openingHours) : null;

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative h-screen flex items-center justify-center bg-gradient-to-br from-amber-900 via-stone-800 to-stone-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 text-center px-4">
          {info?.logo && (
            <img src={info.logo} alt={name} className="w-24 h-24 rounded-full object-cover mx-auto mb-6 border-4 border-amber-400/50" />
          )}
          <p className="text-amber-400 font-medium tracking-widest text-sm uppercase mb-4">Bienvenue au</p>
          <h1 className="text-6xl md:text-8xl font-serif font-bold mb-6">{name}</h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-4 max-w-2xl mx-auto">{description}</p>
          <div className="flex items-center justify-center gap-3 mb-10">
            <p className="text-gray-400">{address}</p>
            {openStatus !== null && (
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${openStatus ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                {openStatus ? '● Ouvert' : '● Fermé'}
              </span>
            )}
          </div>
          {openStatus === false && next && (
            <p className="text-amber-400 text-sm mb-6">Prochain ouverture : {next}</p>
          )}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/menu" className="btn-primary text-lg px-8 py-4 rounded-2xl">
              Commander en ligne
            </Link>
            {info?.phone && (
              <a href={`tel:${info.phone}`}
                className="text-lg px-8 py-4 rounded-2xl border-2 border-white/30 hover:border-white/60 transition-colors">
                📞 Appeler
              </a>
            )}
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
          <p className="text-white font-serif text-xl font-bold mb-2">{name}</p>
          {info?.address && <p>{info.address}{info.city ? `, ${info.city}` : ''}</p>}
          {info?.phone && <p className="mt-1">{info.phone}</p>}
          {info?.website && (
            <a href={info.website} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline mt-1 block">{info.website}</a>
          )}
          <p className="mt-4">&copy; {new Date().getFullYear()} {name}. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}

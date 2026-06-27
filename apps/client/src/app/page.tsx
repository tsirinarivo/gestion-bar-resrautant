'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const RESTAURANT_SLUG = process.env['NEXT_PUBLIC_RESTAURANT_SLUG'] ?? 'restaurant-demo';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DEFAULT_PRIMARY = '#F59E0B';

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
  siteTemplate?: 'classic' | 'modern' | 'compact';
  sitePrimaryColor?: string | null;
  siteTagline?: string | null;
  siteHeroImage?: string | null;
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

type Review = { id: string; rating: number; content?: string; reply?: string; createdAt: string; customer?: { firstName?: string } };

export default function HomePage() {
  const [info, setInfo] = useState<RestaurantInfo | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/public/${RESTAURANT_SLUG}/info`)
      .then(r => r.json())
      .then((d: { data?: RestaurantInfo }) => { if (d.data) setInfo(d.data) })
      .catch(() => null);
    fetch(`${API_URL}/api/public/${RESTAURANT_SLUG}/reviews`)
      .then(r => r.json())
      .then((d: { data?: Review[] }) => { if (d.data?.length) setReviews(d.data.slice(0, 6)) })
      .catch(() => null);
  }, []);

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const name = info?.name ?? 'Restaurant';
  const tagline = info?.siteTagline || info?.description || 'Cuisine locale et internationale — Ambiance chaleureuse';
  const address = info?.city ? `${info.city} · Madagascar` : 'Madagascar';
  const openStatus = isOpen(info?.openingHours);
  const primary = info?.sitePrimaryColor || DEFAULT_PRIMARY;
  const template = info?.siteTemplate || 'classic';
  const hero = info?.siteHeroImage;

  const heroProps = { name, tagline, address, openStatus, primary, hero, logo: info?.logo, phone: info?.phone };

  return (
    <div className="min-h-screen" style={{ ['--primary' as any]: primary }}>
      {template === 'modern' && <HeroModern {...heroProps} />}
      {template === 'compact' && <HeroCompact {...heroProps} />}
      {(template === 'classic' || !['modern', 'compact'].includes(template)) && <HeroClassic {...heroProps} />}

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="container-narrow">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            {[
              { icon: '🌿', title: 'Produits Locaux', desc: 'Des produits frais et locaux, sélectionnés avec soin' },
              { icon: '👨‍🍳', title: 'Cuisine Maison', desc: 'Des plats préparés sur place avec passion' },
              { icon: '🛵', title: 'Livraison Rapide', desc: 'Commandez en ligne et recevez chez vous' },
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
      <section className="py-20" style={{ background: `${primary}12` }}>
        <div className="container-narrow text-center">
          <h2 className="text-4xl font-serif font-bold mb-4">Notre Carte</h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Découvrez nos plats et boissons. Commandez à emporter ou faites-vous livrer.
          </p>
          <Link href="/menu" className="inline-block text-lg text-white font-bold px-8 py-4 rounded-2xl transition-opacity hover:opacity-90"
            style={{ background: primary }}>Voir le menu complet →</Link>
        </div>
      </section>

      {/* Reviews */}
      {reviews.length > 0 && (
        <section className="py-20 bg-white">
          <div className="container-narrow">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-serif font-bold mb-3">Ce qu'en disent nos clients</h2>
              {avgRating && (
                <p className="text-xl font-bold" style={{ color: primary }}>
                  ⭐ {avgRating} / 5 <span className="text-sm text-gray-500 font-normal">({reviews.length} avis)</span>
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reviews.map(r => (
                <div key={r.id} className="rounded-2xl p-6 shadow-sm" style={{ background: `${primary}10` }}>
                  <div className="text-xl mb-3" style={{ color: primary }}>
                    {'⭐'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                  </div>
                  {r.content && <p className="text-gray-700 mb-3 italic">« {r.content} »</p>}
                  <p className="text-sm font-bold text-gray-900">{r.customer?.firstName ?? 'Anonyme'}</p>
                  <p className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString('fr-FR')}</p>
                  {r.reply && (
                    <div className="mt-3 pt-3 border-t" style={{ borderColor: `${primary}30` }}>
                      <p className="text-xs font-bold mb-1" style={{ color: primary }}>Réponse du restaurant :</p>
                      <p className="text-xs text-gray-600">{r.reply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="bg-stone-900 text-gray-400 py-12">
        <div className="container-narrow text-center text-sm">
          <p className="text-white font-serif text-xl font-bold mb-2">{name}</p>
          {info?.address && <p>{info.address}{info.city ? `, ${info.city}` : ''}</p>}
          {info?.phone && <p className="mt-1">{info.phone}</p>}
          {info?.website && (
            <a href={info.website} target="_blank" rel="noopener noreferrer" className="hover:underline mt-1 block" style={{ color: primary }}>{info.website}</a>
          )}
          <p className="mt-4">&copy; {new Date().getFullYear()} {name}. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}

type HeroProps = {
  name: string; tagline: string; address: string; openStatus: boolean | null;
  primary: string; hero?: string | null; logo?: string; phone?: string;
};

function OpenBadge({ openStatus }: { openStatus: boolean | null }) {
  if (openStatus === null) return null;
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${openStatus ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
      {openStatus ? '● Ouvert' : '● Fermé'}
    </span>
  );
}

function OrderBtn({ primary, label = 'Commander en ligne' }: { primary: string; label?: string }) {
  return (
    <Link href="/menu" className="inline-block text-lg text-white font-bold px-8 py-4 rounded-2xl transition-opacity hover:opacity-90"
      style={{ background: primary }}>{label}</Link>
  );
}

// ── CLASSIQUE : hero plein écran, dégradé sombre, centré ──────────────────────
function HeroClassic({ name, tagline, address, openStatus, primary, logo, phone }: HeroProps) {
  return (
    <section className="relative h-screen flex items-center justify-center bg-gradient-to-br from-stone-800 via-stone-900 to-black text-white overflow-hidden">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 text-center px-4">
        {logo && <img src={logo} alt={name} className="w-24 h-24 rounded-full object-cover mx-auto mb-6 border-4" style={{ borderColor: `${primary}80` }} />}
        <p className="font-medium tracking-widest text-sm uppercase mb-4" style={{ color: primary }}>Bienvenue au</p>
        <h1 className="text-6xl md:text-8xl font-serif font-bold mb-6">{name}</h1>
        <p className="text-xl md:text-2xl text-gray-300 mb-4 max-w-2xl mx-auto">{tagline}</p>
        <div className="flex items-center justify-center gap-3 mb-10">
          <p className="text-gray-400">{address}</p>
          <OpenBadge openStatus={openStatus} />
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <OrderBtn primary={primary} />
          {phone && <a href={`tel:${phone}`} className="text-lg px-8 py-4 rounded-2xl border-2 border-white/30 hover:border-white/60 transition-colors">📞 Appeler</a>}
        </div>
      </div>
    </section>
  );
}

// ── MODERNE : grande image plein cadre, titre aligné à gauche ─────────────────
function HeroModern({ name, tagline, address, openStatus, primary, hero, logo, phone }: HeroProps) {
  return (
    <section className="relative h-screen flex items-end overflow-hidden text-white"
      style={hero ? { backgroundImage: `url(${hero})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                   : { background: `linear-gradient(135deg, ${primary}, #111)` }}>
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 pb-20">
        {logo && <img src={logo} alt={name} className="w-20 h-20 rounded-2xl object-cover mb-5 border-2 border-white/40" />}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs uppercase tracking-widest font-semibold px-2 py-1 rounded" style={{ background: primary }}>Restaurant</span>
          <OpenBadge openStatus={openStatus} />
        </div>
        <h1 className="text-5xl md:text-7xl font-serif font-bold mb-4 leading-tight">{name}</h1>
        <p className="text-lg md:text-2xl text-gray-200 max-w-2xl mb-2">{tagline}</p>
        <p className="text-gray-400 mb-8">{address}</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <OrderBtn primary={primary} />
          {phone && <a href={`tel:${phone}`} className="text-lg px-8 py-4 rounded-2xl border-2 border-white/40 hover:bg-white/10 transition-colors text-center">📞 Appeler</a>}
        </div>
      </div>
    </section>
  );
}

// ── COMPACT : bandeau court coloré, accès menu immédiat ───────────────────────
function HeroCompact({ name, tagline, openStatus, primary, logo, phone }: HeroProps) {
  return (
    <section className="text-white" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}cc)` }}>
      <div className="max-w-4xl mx-auto px-6 py-12 sm:py-16">
        <div className="flex items-center gap-4 mb-5">
          {logo && <img src={logo} alt={name} className="w-16 h-16 rounded-xl object-cover border-2 border-white/50" />}
          <div>
            <h1 className="text-3xl sm:text-5xl font-serif font-bold leading-tight">{name}</h1>
            <div className="mt-1"><OpenBadge openStatus={openStatus} /></div>
          </div>
        </div>
        <p className="text-base sm:text-xl text-white/90 mb-6 max-w-2xl">{tagline}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/menu" className="inline-block text-lg font-bold px-8 py-3.5 rounded-2xl bg-white text-center transition-opacity hover:opacity-90"
            style={{ color: primary }}>🍽️ Voir le menu</Link>
          {phone && <a href={`tel:${phone}`} className="text-lg px-8 py-3.5 rounded-2xl border-2 border-white/60 hover:bg-white/10 transition-colors text-center">📞 Appeler</a>}
        </div>
      </div>
    </section>
  );
}

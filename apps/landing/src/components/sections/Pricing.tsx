'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Check, Sparkles, Zap, Crown, Rocket } from 'lucide-react'

const PLANS = [
  {
    name: 'Essai',
    icon: Sparkles,
    price: 'Gratuit',
    period: '3 jours',
    desc: 'Testez Sakafio sans engagement, sans CB.',
    features: [
      'Toutes les fonctionnalités du plan Starter',
      'Données démo malgaches pré-remplies (optionnel)',
      'Support email',
      'Suspendu après 3 jours sauf abonnement',
    ],
    cta: 'Démarrer gratuitement',
    href: '/signup',
    highlight: false,
  },
  {
    name: 'Starter',
    icon: Zap,
    price: '49 000',
    currency: 'Ar',
    period: '/mois',
    desc: 'Pour les petits restaurants et bars qui démarrent.',
    features: [
      'POS + KDS + Stock + Caisse',
      'Jusqu\'à 3 utilisateurs',
      'Jusqu\'à 1000 commandes/mois',
      'Fidélité clients de base',
      'Support email & WhatsApp',
      'Impression tickets incluse',
    ],
    cta: 'Choisir Starter',
    href: '/signup?plan=starter',
    highlight: false,
  },
  {
    name: 'Pro',
    icon: Crown,
    price: '99 000',
    currency: 'Ar',
    period: '/mois',
    desc: 'Pour les restos établis qui veulent optimiser.',
    features: [
      'Tout Starter +',
      'Utilisateurs illimités',
      'Commandes illimitées',
      'Réservations + Liste d\'attente',
      'Analytics avancés + export Excel',
      'Multi-entrepôts',
      'Site client public + QR codes',
      'Campagnes marketing email/SMS',
      'Support prioritaire',
    ],
    cta: 'Choisir Pro',
    href: '/signup?plan=pro',
    highlight: true,
  },
  {
    name: 'Pro+',
    icon: Rocket,
    price: '149 000',
    currency: 'Ar',
    period: '/mois',
    desc: 'Pour les restos qui veulent passer un cap sur la marque et la présence en ligne.',
    features: [
      'Tout Pro +',
      'Site client white-label (votre logo, vos couleurs)',
      'Domaine personnalisé (votre-resto.com)',
    ],
    cta: 'Choisir Pro+',
    href: '/signup?plan=pro-plus',
    highlight: false,
  },
]

// Conservés pour réactivation future si nécessaire — non affichés publiquement.
// Stratégie actuelle : zéro friction sales, tout self-service à prix fixe.
const _ARCHIVED_PLANS = [
  {
    name: 'Groupe',
    price: '199 000 Ar/mois',
    desc: 'Pour les chaînes multi-établissements (≤ 3 restos).',
    features: [
      'Tout Pro+ +',
      'Jusqu\'à 3 établissements',
      'Tableau de bord consolidé multi-resto',
      'Comptabilité agrégée par enseigne',
      'Transferts de stock inter-établissements',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Sur devis',
    desc: 'Pour les chaînes et groupes hôteliers > 3 établissements.',
    features: [
      'Tout Groupe +',
      'Établissements illimités',
      'SLA 99.95% garanti',
      'Intégrations sur mesure (compta, ERP)',
      'Manager de compte dédié',
      'Formation équipe sur site',
    ],
  },
]

export function Pricing() {
  return (
    <section id="tarifs" className="relative py-14 sm:py-20 md:py-32">
      <div className="container-x">
        <div className="mx-auto max-w-3xl text-center">
          <motion.span
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="inline-block rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-700 dark:border-brand-900 dark:bg-brand-950/50 dark:text-brand-300"
          >
            Tarifs simples
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="mt-3 sm:mt-4 font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-balance"
          >
            Un prix juste, <span className="gradient-text">sans surprises</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
            className="mt-5 text-lg text-slate-600 dark:text-slate-300"
          >
            Pas de frais cachés, pas de pourcentage sur le chiffre d'affaires, pas de surcoût par terminal.
          </motion.p>
        </div>

        <div className="mt-12 sm:mt-16 grid gap-4 sm:gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className={`relative flex flex-col rounded-2xl border p-5 sm:p-6 ${
                p.highlight
                  ? 'border-brand-500 bg-gradient-to-br from-brand-50 via-white to-orange-50 shadow-2xl shadow-brand-500/20 dark:border-brand-600 dark:from-brand-950/50 dark:via-slate-900 dark:to-slate-900 dark:shadow-brand-900/40 mt-3 sm:mt-0'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md">
                  Plus populaire
                </div>
              )}
              <div className="mb-3 flex items-center gap-2">
                <p.icon className={`h-5 w-5 ${p.highlight ? 'text-brand-600' : 'text-slate-500'}`} />
                <h3 className="font-display text-xl font-bold">{p.name}</h3>
              </div>
              <div className="mb-2 flex flex-wrap items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-extrabold">{p.price}</span>
                {p.currency && <span className="text-base sm:text-lg font-semibold text-slate-500">{p.currency}</span>}
                {p.period && <span className="text-xs sm:text-sm text-slate-500">{p.period}</span>}
              </div>
              <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">{p.desc}</p>
              <ul className="mb-6 space-y-2.5 text-sm">
                {p.features.map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className={`mt-0.5 h-4 w-4 flex-shrink-0 ${p.highlight ? 'text-brand-600' : 'text-emerald-600'}`} />
                    <span className="text-slate-700 dark:text-slate-300">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={p.href}
                className={`mt-auto block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold transition-all ${
                  p.highlight
                    ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/30 hover:shadow-xl hover:shadow-brand-500/50 hover:brightness-110'
                    : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {p.cta}
              </Link>
            </motion.div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-slate-500 dark:text-slate-400">
          Tous les prix sont en Ariary (Ar), TVA incluse. Aucun engagement de durée. Annulation à tout moment.
        </p>
        <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-500">
          Vous gérez plusieurs établissements ? <Link href="/contact" className="font-semibold text-brand-600 hover:underline">Parlons-en</Link> pour un tarif adapté.
        </p>
      </div>
    </section>
  )
}

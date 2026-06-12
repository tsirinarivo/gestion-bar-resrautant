'use client'

import { motion } from 'framer-motion'
import {
  ShoppingCart, ChefHat, Package, Heart, Calendar, Receipt,
  CreditCard, BarChart3, Users, Wifi, Smartphone, Printer,
} from 'lucide-react'

const FEATURES = [
  {
    icon: ShoppingCart,
    title: 'POS Caisse',
    desc: 'Encaissement rapide, paiement mixte (cash, mobile money, carte), pourboires, reçu cloud.',
    color: 'brand',
  },
  {
    icon: ChefHat,
    title: 'KDS Cuisine',
    desc: 'Écran cuisine multi-station (chaud/froid/boissons), notifications temps réel, son d\'alerte.',
    color: 'orange',
  },
  {
    icon: Package,
    title: 'Stock & Inventaire',
    desc: 'Multi-entrepôts, comptage par lots, FIFO, alertes seuil, dates d\'expiration.',
    color: 'emerald',
  },
  {
    icon: Heart,
    title: 'Fidélité Clients',
    desc: 'Points fidélité (1 pt = 10 Ar), WALLET de rachat, segmentation, anniversaires, dettes.',
    color: 'rose',
  },
  {
    icon: Calendar,
    title: 'Réservations',
    desc: 'Plan de salle, rappels auto SMS/email, liste d\'attente, capacité par table.',
    color: 'blue',
  },
  {
    icon: Receipt,
    title: 'Caisse & Banque',
    desc: 'Sessions de caisse, comptage coupures, comptes bancaires, rapprochement automatique.',
    color: 'amber',
  },
  {
    icon: CreditCard,
    title: 'Mobile Money MG',
    desc: 'MVola, Orange Money, Airtel Money, BNI Mobile, BOA Mobile — natif.',
    color: 'cyan',
  },
  {
    icon: BarChart3,
    title: 'Analytics & Rapports',
    desc: 'Performance cuisine, top plats, CA temps réel, rapport TVA, export Excel.',
    color: 'purple',
  },
  {
    icon: Users,
    title: 'Équipe & Shifts',
    desc: 'Planning hebdomadaire, clock-in/out, permissions par rôle, heures travaillées.',
    color: 'indigo',
  },
  {
    icon: Wifi,
    title: 'Multi-tenant SaaS',
    desc: 'Une instance isolée par restaurant. Vos données, votre infra, votre indépendance.',
    color: 'teal',
  },
  {
    icon: Smartphone,
    title: 'Commande en ligne',
    desc: 'Site client public + QR code par table. Vos clients commandent sans téléchargement.',
    color: 'fuchsia',
  },
  {
    icon: Printer,
    title: 'Imprimante cloud',
    desc: 'Tickets via XPyun cloud — pas besoin de réseau local complexe.',
    color: 'slate',
  },
]

export function Features() {
  return (
    <section id="fonctionnalites" className="relative py-20 md:py-32">
      <div className="container-x">
        <div className="mx-auto max-w-3xl text-center">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="inline-block rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-700 dark:border-brand-900 dark:bg-brand-950/50 dark:text-brand-300"
          >
            Fonctionnalités
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 font-display text-4xl font-extrabold tracking-tight md:text-5xl text-balance"
          >
            Tout ce dont vous avez besoin,<br />
            <span className="gradient-text">rien de ce qui vous ralentit</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="mt-5 text-lg text-slate-600 dark:text-slate-300"
          >
            12 modules intégrés. Pas d'options à activer, pas de plugins à payer.
          </motion.p>
        </div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: (i % 3) * 0.05 }}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:shadow-black/30"
            >
              <div
                className={`absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity group-hover:opacity-100 bg-${f.color}-300 dark:bg-${f.color}-700`}
                style={{ backgroundColor: 'currentColor', color: getColor(f.color) }}
              />
              <div
                className="relative mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: `${getColor(f.color)}20`, color: getColor(f.color) }}
              >
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="relative font-semibold text-slate-900 dark:text-white">{f.title}</h3>
              <p className="relative mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function getColor(c: string): string {
  const m: Record<string, string> = {
    brand: '#ea580c', orange: '#f97316', emerald: '#10b981', rose: '#f43f5e',
    blue: '#3b82f6', amber: '#f59e0b', cyan: '#06b6d4', purple: '#a855f7',
    indigo: '#6366f1', teal: '#14b8a6', fuchsia: '#d946ef', slate: '#64748b',
  }
  return m[c] || '#ea580c'
}

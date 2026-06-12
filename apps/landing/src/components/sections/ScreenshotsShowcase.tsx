'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, ShoppingCart, ChefHat, Package, Receipt, Users } from 'lucide-react'

const TABS = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', desc: "Vision 360° de votre restaurant. CA temps réel, top plats, alertes stock, planning du jour." },
  { id: 'pos', icon: ShoppingCart, label: 'POS', desc: "Encaissement en moins de 30 secondes. Paiements mixtes, mobile money, pourboires." },
  { id: 'kds', icon: ChefHat, label: 'KDS Cuisine', desc: "Écran cuisine multi-station. Filtrage chaud/froid/boissons. Notifications temps réel." },
  { id: 'stock', icon: Package, label: 'Stock', desc: "Multi-entrepôts. Comptage par lots. FIFO. Alertes seuil + dates d'expiration." },
  { id: 'caisse', icon: Receipt, label: 'Caisse', desc: "Sessions ouverture/fermeture. Comptage coupures MGA. Rapprochement bancaire." },
  { id: 'employees', icon: Users, label: 'Équipe', desc: "Planning shifts hebdo. Clock-in/out. Heures travaillées. Permissions par rôle." },
]

export function ScreenshotsShowcase() {
  const [active, setActive] = useState(TABS[0]!.id)
  const tab = TABS.find(t => t.id === active)!

  return (
    <section className="bg-slate-50 py-14 sm:py-20 dark:bg-slate-900/50 md:py-32">
      <div className="container-x">
        <div className="mx-auto max-w-3xl text-center">
          <motion.span
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="inline-block rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-700 dark:border-brand-900 dark:bg-brand-950/50 dark:text-brand-300"
          >
            Voir l'app
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="mt-3 sm:mt-4 font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-balance"
          >
            Pensé pour <span className="gradient-text">tous les rôles</span> de votre équipe
          </motion.h2>
        </div>

        {/* Tabs — scrollables horizontalement sur mobile */}
        <div className="mt-10 sm:mt-12 -mx-4 sm:mx-0 overflow-x-auto scrollbar-thin">
          <div className="flex items-center sm:justify-center gap-2 px-4 sm:px-0 pb-2 sm:flex-wrap">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`inline-flex flex-shrink-0 items-center gap-2 rounded-full border px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  active === t.id
                    ? 'border-brand-500 bg-brand-500 text-white shadow-md shadow-brand-500/30'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                }`}
              >
                <t.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Screenshot zone */}
        <div className="relative mx-auto mt-10 max-w-5xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/40"
            >
              <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="ml-4 flex-1 rounded-md bg-slate-100 px-3 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  https://admin-mon-resto.sakafio.mg/{tab.id === 'dashboard' ? 'dashboard' : tab.id === 'pos' ? '../pos' : tab.id}
                </div>
              </div>
              {/* Screenshot placeholder — sera remplacé par image Playwright auto-générée */}
              <div className="aspect-[16/10] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center text-slate-400 dark:text-slate-600">
                <div className="text-center">
                  <tab.icon className="mx-auto mb-3 h-16 w-16 opacity-30" />
                  <div className="text-sm">Screenshot {tab.label}</div>
                  <div className="mt-1 text-xs opacity-60">(généré auto par Playwright à chaque deploy)</div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Description */}
          <motion.p
            key={tab.id + '-desc'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 text-center text-base text-slate-600 dark:text-slate-300 md:text-lg max-w-2xl mx-auto"
          >
            {tab.desc}
          </motion.p>
        </div>
      </div>
    </section>
  )
}

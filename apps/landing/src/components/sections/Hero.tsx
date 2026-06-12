'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, Play } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-32">
      {/* Background gradient + blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[640px] w-[1200px] -translate-x-1/2 bg-gradient-to-br from-brand-400/30 via-orange-300/20 to-cyan-300/20 blur-3xl dark:from-brand-500/20 dark:via-orange-500/10 dark:to-cyan-500/10" />
        <div className="absolute -left-20 top-40 h-72 w-72 animate-float rounded-full bg-brand-300/30 blur-3xl dark:bg-brand-600/20" />
        <div className="absolute right-0 top-20 h-96 w-96 animate-pulse-glow rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-500/10" />
      </div>

      <div className="container-x">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-semibold text-brand-700 dark:border-brand-900 dark:bg-brand-950/50 dark:text-brand-300"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Fait à Madagascar 🇲🇬 — Essai 3 jours sans CB
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-balance md:text-7xl"
          >
            Le logiciel <span className="gradient-text">tout-en-un</span><br />
            pour votre restaurant et bar
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-balance text-lg text-slate-600 md:text-xl dark:text-slate-300"
          >
            POS, KDS, gestion de stock, fidélité, réservations, comptabilité — gérez tout depuis une seule interface.
            Pensé pour les restaurants et bars malgaches.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-xl shadow-brand-500/30 transition-all hover:shadow-2xl hover:shadow-brand-500/50 hover:brightness-110 active:scale-[0.98]"
            >
              Démarrer l'essai gratuit
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="#fonctionnalites"
              className="group inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white/80 px-7 py-3.5 text-base font-semibold text-slate-700 backdrop-blur transition-all hover:border-slate-400 hover:bg-white dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-900"
            >
              <Play className="h-4 w-4" />
              Voir une démo
            </Link>
          </motion.div>

          {/* Mini trust signals */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-slate-500 dark:text-slate-400"
          >
            <span className="flex items-center gap-1.5"><Dot /> Sans engagement</span>
            <span className="flex items-center gap-1.5"><Dot /> Sans carte bancaire</span>
            <span className="flex items-center gap-1.5"><Dot /> Support en français + Malagasy</span>
            <span className="flex items-center gap-1.5"><Dot /> Hébergé à Madagascar</span>
          </motion.div>
        </div>

        {/* App preview mockup */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="relative mx-auto mt-16 max-w-5xl"
        >
          <div className="relative rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/40">
            {/* Top bar */}
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="ml-4 flex-1 rounded-md bg-slate-100 px-3 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                https://admin-<span className="text-brand-600">votre-resto</span>.sakafio.mg/dashboard
              </div>
            </div>
            {/* Placeholder dashboard preview — sera remplacé par screenshot Playwright */}
            <div className="aspect-[16/9] bg-gradient-to-br from-slate-50 via-white to-brand-50 p-8 dark:from-slate-900 dark:via-slate-900 dark:to-brand-950/30">
              <div className="grid h-full grid-cols-4 gap-4">
                <KpiCard label="CA aujourd'hui" value="1.2M Ar" trend="+12%" color="emerald" />
                <KpiCard label="Commandes" value="47" trend="+8%" color="blue" />
                <KpiCard label="Ticket moyen" value="25 530 Ar" trend="+4%" color="purple" />
                <KpiCard label="Tables occupées" value="8/12" trend="" color="amber" />
                <div className="col-span-2 row-span-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-2 text-xs font-semibold text-slate-500">CA cette semaine</div>
                  <div className="flex h-full items-end gap-2 pb-4">
                    {[40, 65, 50, 80, 95, 70, 90].map((h, i) => (
                      <div
                        key={i}
                        style={{ height: `${h}%` }}
                        className="flex-1 rounded-t-lg bg-gradient-to-t from-brand-500 to-brand-300"
                      />
                    ))}
                  </div>
                </div>
                <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-3 text-xs font-semibold text-slate-500">Top plats</div>
                  <div className="space-y-2 text-xs">
                    {['Romazava', 'Ravitoto', 'Mofo gasy', 'Brochettes zébu'].map((p, i) => (
                      <div key={p} className="flex items-center justify-between">
                        <span>{p}</span>
                        <span className="font-mono text-slate-500">{[18, 14, 12, 9][i]}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-3 text-xs font-semibold text-slate-500">Stock alertes</div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-red-600"><span>THB 33cl</span><span>2 restants</span></div>
                    <div className="flex justify-between text-amber-600"><span>Riz blanc</span><span>4 kg</span></div>
                    <div className="flex justify-between text-amber-600"><span>Citrons verts</span><span>0.5 kg</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating sub-app cards */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -left-6 top-1/4 hidden rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900 lg:block"
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="text-base">👨‍🍳</span>
              <div>
                <div className="font-semibold">KDS Cuisine</div>
                <div className="text-slate-500">12 plats en cours</div>
              </div>
            </div>
          </motion.div>
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            className="absolute -right-6 top-1/2 hidden rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900 lg:block"
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="text-base">💳</span>
              <div>
                <div className="font-semibold">Caisse POS</div>
                <div className="text-slate-500">Encaissé : 89 500 Ar</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

function KpiCard({ label, value, trend, color }: { label: string; value: string; trend: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30',
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30',
    purple: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30',
    amber: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-bold">{value}</div>
      {trend && <div className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${colors[color]}`}>{trend}</div>}
    </div>
  )
}

function Dot() {
  return <span className="h-1 w-1 rounded-full bg-emerald-500" />
}

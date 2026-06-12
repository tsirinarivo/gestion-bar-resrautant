'use client'

import { motion } from 'framer-motion'
import { Quote } from 'lucide-react'

const TESTIMONIALS = [
  {
    quote: "Avant Sakafio, je passais 2h chaque soir à recompter ma caisse. Maintenant c'est fait en 5 minutes et tout est cohérent avec ma banque.",
    name: 'Rakoto Hery',
    role: 'Gérant — Le Bistrot Moderne, Antananarivo',
    rating: 5,
  },
  {
    quote: "Le KDS en cuisine a divisé par 3 nos erreurs de commande. Les serveurs et les cuistos parlent enfin le même langage.",
    name: 'Soa Rabeson',
    role: 'Cheffe — Chez Mada, Tana',
    rating: 5,
  },
  {
    quote: "L'import depuis Dolibarr a pris 10 minutes. J'avais 800 produits, tout est venu propre. Bluffant.",
    name: 'Andriantsoa Naina',
    role: 'Propriétaire — Sakafy Mada',
    rating: 5,
  },
]

export function Testimonials() {
  return (
    <section id="temoignages" className="py-14 sm:py-20 md:py-32">
      <div className="container-x">
        <div className="mx-auto max-w-3xl text-center">
          <motion.h2
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-balance"
          >
            Ce qu'ils en pensent
          </motion.h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <motion.figure
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
            >
              <Quote className="absolute right-4 top-4 h-8 w-8 text-brand-200 dark:text-brand-900" />
              <div className="mb-3 flex gap-0.5 text-amber-400">
                {Array.from({ length: t.rating }).map((_, j) => <span key={j}>★</span>)}
              </div>
              <blockquote className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                "{t.quote}"
              </blockquote>
              <figcaption className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="text-sm font-semibold">{t.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{t.role}</div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  )
}

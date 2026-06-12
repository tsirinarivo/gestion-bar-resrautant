'use client'

import { motion } from 'framer-motion'

const LOGOS = ['Le Bistrot Moderne', 'Bar 2.0', 'Chez Mada', 'Resto Anosy', 'Café Akoma', 'Sakafy Mada']

export function LogosTrust() {
  return (
    <section className="border-y border-slate-200 bg-slate-50/50 py-12 dark:border-slate-800 dark:bg-slate-900/30">
      <div className="container-x">
        <motion.p
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className="text-center text-xs font-semibold uppercase tracking-widest text-slate-500"
        >
          Ils utilisent Sakafio au quotidien
        </motion.p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {LOGOS.map((l, i) => (
            <motion.div
              key={l}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="font-display text-lg font-bold text-slate-400 dark:text-slate-600 transition-colors hover:text-slate-700 dark:hover:text-slate-300"
            >
              {l}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

'use client'

import { motion } from 'framer-motion'

const STATS = [
  { value: '12+', label: 'Modules intégrés' },
  { value: '< 30s', label: 'Pour encaisser' },
  { value: '99.9%', label: 'Disponibilité' },
  { value: 'MGA', label: 'Devise native + multi' },
]

export function Stats() {
  return (
    <section className="relative overflow-hidden border-y border-slate-200 bg-gradient-to-br from-brand-50 via-orange-50 to-cyan-50 py-10 sm:py-16 dark:border-slate-800 dark:from-brand-950/40 dark:via-orange-950/30 dark:to-cyan-950/30">
      <div className="container-x">
        <div className="grid grid-cols-2 gap-6 sm:gap-8 md:grid-cols-4">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold gradient-text">{s.value}</div>
              <div className="mt-1.5 sm:mt-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

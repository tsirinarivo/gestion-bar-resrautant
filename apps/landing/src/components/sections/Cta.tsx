'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export function Cta() {
  return (
    <section className="relative overflow-hidden py-14 sm:py-20 md:py-32">
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-orange-600 px-6 sm:px-8 py-12 sm:py-16 text-center text-white shadow-2xl shadow-brand-500/30 md:px-16 md:py-20"
        >
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

          <h2 className="relative font-display text-2xl sm:text-3xl md:text-5xl font-extrabold leading-tight tracking-tight text-balance">
            Prêt à transformer votre restaurant ?
          </h2>
          <p className="relative mx-auto mt-3 sm:mt-4 max-w-xl text-sm sm:text-base md:text-lg text-white/90">
            Démarrez votre essai gratuit de 3 jours. Sans carte bancaire, sans engagement.
            Vos clients verront la différence dès le 1er service.
          </p>
          <div className="relative mt-6 sm:mt-8 flex flex-col items-stretch sm:items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 sm:px-7 py-3.5 text-sm sm:text-base font-semibold text-brand-600 shadow-xl transition-all hover:scale-[1.02] hover:bg-brand-50 active:scale-100"
            >
              Démarrer maintenant
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/30 px-6 sm:px-7 py-3.5 text-sm sm:text-base font-semibold text-white transition-all hover:bg-white/10"
            >
              Parler à un humain
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

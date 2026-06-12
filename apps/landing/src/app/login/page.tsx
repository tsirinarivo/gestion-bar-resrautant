'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ExternalLink, ShoppingCart, ChefHat, Settings, Building2 } from 'lucide-react'

const APPS = [
  {
    icon: Building2,
    title: 'Admin restaurant',
    desc: 'Gestion du menu, des stocks, des employés, des finances.',
    url: 'https://admin-<votre-slug>.sakafio.mg/login',
    color: 'brand',
  },
  {
    icon: ShoppingCart,
    title: 'Caisse POS',
    desc: 'Prise de commande et encaissement.',
    url: 'https://pos-<votre-slug>.sakafio.mg',
    color: 'orange',
  },
  {
    icon: ChefHat,
    title: 'Cuisine KDS',
    desc: 'Affichage des commandes en cuisine.',
    url: 'https://kds-<votre-slug>.sakafio.mg',
    color: 'amber',
  },
  {
    icon: Settings,
    title: 'Console Master',
    desc: 'Gestion multi-restaurants (admins Sakafio uniquement).',
    url: 'https://master.sakafio.mg',
    color: 'slate',
  },
]

export default function LoginPage() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container-x">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight md:text-5xl text-balance">
            Se connecter à Sakafio
          </h1>
          <p className="mt-4 text-base text-slate-600 dark:text-slate-300">
            Chaque restaurant a son propre sous-domaine. Choisissez votre interface :
          </p>
        </motion.div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-2">
          {APPS.map((a, i) => (
            <motion.div
              key={a.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-0.5 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-950/50">
                <a.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-bold">{a.title}</h3>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{a.desc}</p>
              <div className="mt-4 flex items-center gap-1 font-mono text-xs text-slate-500">
                <ExternalLink className="h-3 w-3" />
                {a.url}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mx-auto mt-12 max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <strong>Vous ne connaissez pas votre sous-domaine ?</strong> Il est dans l'email de bienvenue que nous vous avons envoyé à la création de votre compte. Sinon, contactez-nous : <a href="mailto:support@sakafio.mg" className="font-semibold underline">support@sakafio.mg</a>
        </div>

        <p className="mt-10 text-center text-sm text-slate-500">
          Pas encore de compte ? <Link href="/signup" className="font-semibold text-brand-600 hover:underline">Démarrer un essai gratuit</Link>
        </p>
      </div>
    </div>
  )
}

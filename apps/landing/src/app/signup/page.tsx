'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Loader2, ArrowRight, Check, ShieldCheck, Sparkles } from 'lucide-react'

export default function SignupPage() {
  const sp = useSearchParams()
  const plan = sp.get('plan') || 'trial'
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    restaurantName: '',
    contactName: '',
    email: '',
    phone: '',
    password: '',
    seedDemo: true,
    acceptTerms: false,
  })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.acceptTerms) {
      toast.error('Acceptez les CGV pour continuer')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, plan }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Erreur inscription')
      toast.success('Compte créé ! Vérifiez votre email.')
      // TODO redirect vers page de confirmation
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container-x grid gap-12 lg:grid-cols-2">
        {/* Left : marketing */}
        <div className="hidden lg:block">
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-900 dark:bg-brand-950/50 dark:text-brand-300">
              <Sparkles className="h-3 w-3" /> Essai gratuit 3 jours
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
              Démarrez en <span className="gradient-text">moins de 5 minutes</span>
            </h1>
            <p className="mt-4 text-base text-slate-600 dark:text-slate-300">
              Aucune carte bancaire demandée. Vous avez accès à toutes les fonctionnalités pendant 3 jours.
            </p>

            <ul className="mt-10 space-y-4">
              {[
                { i: '🍽️', t: 'Données démo malgaches pré-remplies (optionnel)', d: '15+ plats, prix MGA réalistes, 3-4 tables' },
                { i: '⚡', t: 'Provisioning automatique', d: 'Votre instance est prête en quelques minutes' },
                { i: '📧', t: 'Identifiants envoyés par email', d: 'Avec toutes vos URLs (admin, POS, KDS, site client)' },
                { i: '🔒', t: 'Base de données isolée', d: 'Chaque restaurant a sa DB dédiée — vos données restent vôtres' },
              ].map(b => (
                <li key={b.t} className="flex gap-3">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-100 text-base dark:bg-brand-950">{b.i}</span>
                  <div>
                    <div className="font-semibold">{b.t}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">{b.d}</div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-10 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3 text-sm">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <div>
                  <div className="font-semibold">Vos données sont en sécurité</div>
                  <div className="text-xs text-slate-500">Hébergement à Madagascar, backups quotidiens, HTTPS partout</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right : form */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="font-display text-2xl font-bold mb-1">Créer mon compte</h2>
          <p className="text-sm text-slate-500 mb-6">
            Plan sélectionné : <span className="font-semibold capitalize text-brand-600">{plan}</span>
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Nom du restaurant *" placeholder="Le Bistrot Antananarivo"
              value={form.restaurantName}
              onChange={v => setForm(f => ({ ...f, restaurantName: v }))} required />
            <Field label="Votre nom" placeholder="Pierre Rasolofo"
              value={form.contactName}
              onChange={v => setForm(f => ({ ...f, contactName: v }))} />
            <Field label="Email *" type="email" placeholder="vous@email.com"
              value={form.email}
              onChange={v => setForm(f => ({ ...f, email: v }))} required />
            <Field label="Téléphone (WhatsApp)" placeholder="+261 34 12 345 67"
              value={form.phone}
              onChange={v => setForm(f => ({ ...f, phone: v }))} />
            <Field label="Mot de passe *" type="password" placeholder="Au moins 8 caractères"
              value={form.password}
              onChange={v => setForm(f => ({ ...f, password: v }))} required minLength={8} />

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <input type="checkbox" checked={form.seedDemo}
                onChange={e => setForm(f => ({ ...f, seedDemo: e.target.checked }))}
                className="mt-1 h-4 w-4 cursor-pointer rounded text-brand-600" />
              <div>
                <div className="font-medium text-sm">Pré-remplir avec un menu démo malgache</div>
                <div className="text-xs text-slate-500 mt-0.5">Mofo gasy, ravitoto, romazava, brochettes, THB… (vous pouvez tout supprimer après)</div>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" checked={form.acceptTerms}
                onChange={e => setForm(f => ({ ...f, acceptTerms: e.target.checked }))}
                className="mt-1 h-4 w-4 cursor-pointer rounded text-brand-600" required />
              <span className="text-slate-600 dark:text-slate-400">
                J'accepte les <Link href="/cgv" className="text-brand-600 hover:underline">CGV</Link> et la <Link href="/confidentialite" className="text-brand-600 hover:underline">politique de confidentialité</Link>.
              </span>
            </label>

            <button type="submit" disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 transition-all hover:shadow-xl hover:shadow-brand-500/50 hover:brightness-110 active:scale-[0.99] disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>
                Démarrer l'essai gratuit
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>}
            </button>

            <p className="text-center text-xs text-slate-500">
              Déjà un compte ? <Link href="/login" className="text-brand-600 hover:underline">Se connecter</Link>
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  ...props
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  required?: boolean
  minLength?: number
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</label>
      <input
        {...props}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:placeholder:text-slate-500"
      />
    </div>
  )
}

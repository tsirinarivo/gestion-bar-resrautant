'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff, Lock, Mail, Sparkles, Shield } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Échec de la connexion')
      }
      toast.success('Bienvenue dans la Master Console')
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50">
      {/* Background ambient blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-[480px] w-[480px] rounded-full bg-gradient-to-br from-brand-200 to-brand-400 opacity-30 blur-3xl animate-float" />
        <div
          className="absolute -bottom-40 -right-32 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-cyan-200 to-brand-300 opacity-25 blur-3xl animate-float"
          style={{ animationDelay: '1.5s' }}
        />
        <div className="absolute inset-0 bg-mesh" />
      </div>

      <div className="relative grid min-h-screen lg:grid-cols-2">
        {/* Left side — marketing / brand */}
        <div className="hidden flex-col justify-between p-10 lg:flex xl:p-16">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 blur-md opacity-50" />
              <img src="/logo.svg" alt="Sakafio" className="relative h-12 w-12" />
            </div>
            <div>
              <div className="font-display text-xl font-extrabold text-slate-900">Sakafio</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-brand-600">
                Master Console
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="max-w-md"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50/80 px-3 py-1 text-xs font-semibold text-brand-700 backdrop-blur">
              <Sparkles className="h-3 w-3" /> Console privilégiée
            </span>
            <h2 className="mt-5 font-display text-4xl font-extrabold leading-tight tracking-tight text-slate-900 xl:text-5xl">
              Pilotez tous vos <span className="gradient-text">restaurants</span> depuis un seul écran.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate-600">
              Provisioning des clients, suivi des essais, facturation, déploiements,
              configuration SMTP — tout au même endroit.
            </p>

            <ul className="mt-10 space-y-4">
              {[
                ['Provisioning instantané', 'Un client opérationnel en ~5 min.'],
                ['Live logs déploiement', 'Tracez chaque étape du provisioning.'],
                ['Facturation intégrée', 'Plans, abonnements, factures automatiques.'],
              ].map(([t, d]) => (
                <li key={t} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-sm shadow-brand-500/30">
                    <Shield className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{t}</div>
                    <div className="text-sm text-slate-500">{d}</div>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>

          <div className="text-xs text-slate-400">
            © {new Date().getFullYear()} Sakafio · Logiciel pour votre restaurant et bar
          </div>
        </div>

        {/* Right side — login form */}
        <div className="flex items-center justify-center p-6 lg:p-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="w-full max-w-md"
          >
            <div className="mb-8 text-center lg:hidden">
              <img src="/logo.svg" alt="Sakafio" className="mx-auto mb-3 h-16 w-16 drop-shadow-md" />
              <h1 className="font-display text-2xl font-extrabold text-slate-900">
                Sakafio <span className="font-medium text-slate-400">Master</span>
              </h1>
            </div>

            <div className="card-glass overflow-hidden p-7 sm:p-8">
              <div className="mb-6">
                <h2 className="font-display text-2xl font-extrabold text-slate-900">Connexion</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Accès réservé aux administrateurs du SaaS
                </p>
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="label">Email</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vous@sakafio.mg"
                      className="input pl-10"
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Mot de passe</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="input pl-10 pr-10"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Afficher le mot de passe"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileTap={{ scale: 0.98 }}
                  className="btn-primary w-full py-3"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Connexion…
                    </>
                  ) : (
                    'Se connecter'
                  )}
                </motion.button>
              </form>
            </div>

            <p className="mt-6 text-center text-xs text-slate-400">
              Connexion sécurisée · HTTPS · Session expirante
            </p>
          </motion.div>
        </div>
      </div>
    </main>
  )
}

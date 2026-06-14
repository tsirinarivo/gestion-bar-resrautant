'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2, Mail, Save, Send, CheckCircle2, Info, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/PageHeader'

type SmtpForm = {
  host: string
  port: number
  user: string
  pass: string
  from: string
  secure: boolean
}

const EMPTY_FORM: SmtpForm = {
  host: '',
  port: 587,
  user: '',
  pass: '',
  from: 'noreply@sakafio.mg',
  secure: false,
}

export default function SmtpSettingsPage() {
  const router = useRouter()
  const [form, setForm] = useState<SmtpForm>(EMPTY_FORM)
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [configured, setConfigured] = useState(false)
  const [source, setSource] = useState<'db' | 'env' | 'none'>('none')

  useEffect(() => {
    fetch('/api/settings/smtp')
      .then(r => r.json())
      .then((d: { configured: boolean; source: 'db' | 'env' | 'none'; config: SmtpForm | null }) => {
        if (d.config) setForm({ ...EMPTY_FORM, ...d.config })
        setConfigured(d.configured)
        setSource(d.source)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function update<K extends keyof SmtpForm>(k: K, v: SmtpForm[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/settings/smtp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Erreur sauvegarde')
      toast.success('Configuration SMTP enregistrée')
      setConfigured(true)
      setSource('db')
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function onTest() {
    if (!testEmail) {
      toast.error('Renseigne un email destinataire pour le test')
      return
    }
    setTesting(true)
    try {
      const res = await fetch('/api/settings/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmail }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Échec de l'envoi")
      toast.success(`Email de test envoyé à ${testEmail}`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="container-x flex h-64 items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="container-x py-8 sm:py-10">
      <PageHeader
        backHref="/dashboard/settings"
        backLabel="Tous les paramètres"
        title={
          <span className="flex items-center gap-2.5">
            <Mail className="h-6 w-6 text-brand-600" /> Configuration SMTP
          </span>
        }
        subtitle="Utilisé pour envoyer les emails de bienvenue aux nouveaux clients"
      />

      {configured && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          <CheckCircle2 className="h-4 w-4" />
          SMTP configuré ({source === 'db' ? 'depuis la console' : "depuis les variables d'environnement"})
        </motion.div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={onSave}
          className="card space-y-4 p-5 sm:p-6 lg:col-span-2"
        >
          <h2 className="text-sm font-bold text-slate-900">Paramètres de connexion</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Hôte SMTP *</label>
              <input
                className="input"
                value={form.host}
                onChange={e => update('host', e.target.value)}
                required
                placeholder="smtp-relay.brevo.com"
              />
              <p className="mt-1.5 text-[11px] text-slate-500">
                Ex: smtp-relay.brevo.com, smtp.gmail.com, smtp.sendgrid.net, ssl0.ovh.net
              </p>
            </div>
            <div>
              <label className="label">Port *</label>
              <input
                type="number"
                className="input"
                value={form.port}
                onChange={e => update('port', Number(e.target.value))}
                required
                min={1}
                max={65535}
              />
              <p className="mt-1.5 text-[11px] text-slate-500">
                587 (STARTTLS), 465 (SSL direct), 25 (non chiffré)
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="label">Utilisateur SMTP *</label>
              <input
                className="input"
                value={form.user}
                onChange={e => update('user', e.target.value)}
                required
                placeholder="login fourni par votre provider"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Mot de passe SMTP *</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input pr-10 font-mono"
                  value={form.pass}
                  onChange={e => update('pass', e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder={configured ? 'Inchangé (laisse vide pour conserver)' : ''}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Afficher le mot de passe"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Pour Gmail : utilise un{' '}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 hover:underline"
                >
                  mot de passe d'application
                </a>{' '}
                (pas ton mdp principal).
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="label">From (expéditeur affiché) *</label>
              <input
                type="email"
                className="input"
                value={form.from}
                onChange={e => update('from', e.target.value)}
                required
                placeholder="noreply@sakafio.mg"
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 p-3 transition-colors hover:border-slate-300">
                <input
                  type="checkbox"
                  checked={form.secure}
                  onChange={e => update('secure', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded text-brand-600"
                />
                <div className="text-sm">
                  <span className="font-semibold text-slate-900">Connexion sécurisée (SSL/TLS direct)</span>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Coche pour le port 465 (SSL implicite). Décoche pour STARTTLS port 587
                    (recommandé Gmail/SendGrid/Brevo).
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Enregistrer
            </button>
          </div>
        </motion.form>

        <div className="space-y-5 lg:col-span-1">
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="card p-5"
          >
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-bold text-slate-900">Test d'envoi</h2>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Envoie un email de test pour vérifier la config.
            </p>
            <div className="mt-4 space-y-2">
              <input
                type="email"
                className="input"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="ton@email.com"
              />
              <button
                type="button"
                onClick={onTest}
                disabled={testing || !testEmail}
                className="btn-secondary w-full"
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Envoyer un test
              </button>
            </div>
          </motion.section>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600"
          >
            <Info className="mr-1 inline h-3 w-3" />
            La config DB a priorité sur les variables d'environnement (
            <code className="rounded bg-white px-1 font-mono">SMTP_HOST</code>, etc.). Si la DB
            est vide, le fallback env continue de fonctionner.
            <div className="mt-2 text-[11px] text-slate-500">
              Si l'envoi échoue, regarde les logs :{' '}
              <code className="rounded bg-white px-1 font-mono">docker logs restaurant_master</code>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

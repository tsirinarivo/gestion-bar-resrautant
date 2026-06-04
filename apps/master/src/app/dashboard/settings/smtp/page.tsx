'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Mail, Save, Send, CheckCircle2, Info } from 'lucide-react'
import { toast } from 'sonner'

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
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="px-6 py-8 md:px-10">
      <div className="mb-4">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Retour aux paramètres
        </Link>
      </div>

      <header className="mb-6 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configuration SMTP</h1>
          <p className="mt-1 text-sm text-slate-500">
            Utilisé pour envoyer les emails de bienvenue aux nouveaux clients (URLs + identifiants).
          </p>
        </div>
      </header>

      {configured && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          SMTP configuré ({source === 'db' ? 'depuis la console' : 'depuis les variables d\'environnement'})
        </div>
      )}

      <form onSubmit={onSave} className="card space-y-4 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Hôte SMTP *</label>
            <input
              className="input"
              value={form.host}
              onChange={e => update('host', e.target.value)}
              required
              placeholder="smtp.gmail.com"
            />
            <p className="mt-1 text-xs text-slate-500">Ex: smtp.gmail.com, smtp.sendgrid.net, smtp.ovh.fr</p>
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
            <p className="mt-1 text-xs text-slate-500">587 (TLS), 465 (SSL), 25 (non chiffré)</p>
          </div>
          <div className="md:col-span-2">
            <label className="label">Utilisateur SMTP *</label>
            <input
              type="email"
              className="input"
              value={form.user}
              onChange={e => update('user', e.target.value)}
              required
              placeholder="ton@email.com"
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Mot de passe SMTP *</label>
            <input
              type="password"
              className="input font-mono"
              value={form.pass}
              onChange={e => update('pass', e.target.value)}
              required
              autoComplete="new-password"
              placeholder={configured ? 'Inchangé (laisse tel quel pour conserver)' : 'Au moins 8 caractères'}
            />
            <p className="mt-1 text-xs text-slate-500">
              Pour Gmail : utilise un{' '}
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 hover:underline"
              >
                mot de passe d'application
              </a>{' '}
              (pas ton mdp principal). Le mot de passe est chiffré en DB.
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
          <div className="md:col-span-2 flex items-start gap-2">
            <input
              type="checkbox"
              id="secure"
              checked={form.secure}
              onChange={e => update('secure', e.target.checked)}
              className="mt-1"
            />
            <label htmlFor="secure" className="text-sm text-slate-700">
              Connexion sécurisée (SSL/TLS direct, généralement port 465).<br />
              <span className="text-xs text-slate-500">
                Décoche pour STARTTLS (port 587, recommandé Gmail/SendGrid).
              </span>
            </label>
          </div>
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
        </div>
      </form>

      <section className="card mt-6 p-6">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Send className="h-5 w-5 text-brand-600" />
          Test d'envoi
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Envoie un email de test pour vérifier que la config fonctionne. Si ton SMTP rejette ou
          l'email n'arrive pas, vérifie hôte/port/credentials et regarde les logs :{' '}
          <code className="rounded bg-slate-100 px-1 text-xs">docker logs restaurant_master</code>.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            className="input flex-1"
            value={testEmail}
            onChange={e => setTestEmail(e.target.value)}
            placeholder="ton@email.com"
          />
          <button
            type="button"
            onClick={onTest}
            disabled={testing || !testEmail}
            className="btn-secondary inline-flex items-center gap-2"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer un test
          </button>
        </div>
      </section>

      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        <Info className="mr-1 inline h-3 w-3" />
        La config DB a priorité sur les variables d'environnement (<code>SMTP_HOST</code>, etc.).
        Si la DB est vide, le fallback env continue de fonctionner.
      </div>
    </div>
  )
}

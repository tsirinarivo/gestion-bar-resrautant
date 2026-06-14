'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Loader2,
  ArrowLeft,
  Info,
  CheckCircle2,
  XCircle,
  Building2,
  Mail,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'

type CreatedTenant = {
  id: string
  slug: string
  name: string
  subdomain: string
  apiPort: number
  status: string
  adminEmail: string
}

type TenantEvent = {
  id: string
  type: string
  details: string | null
  createdAt: string
}

export default function NewTenantPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [tenant, setTenant] = useState<CreatedTenant | null>(null)
  const [events, setEvents] = useState<TenantEvent[]>([])
  const [finalStatus, setFinalStatus] = useState<'ACTIVE' | 'ERROR' | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const logRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState({
    slug: '',
    name: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    notes: '',
    adminEmail: '',
    adminPassword: '',
    adminFirstName: 'Admin',
    adminLastName: 'Principal',
  })

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  useEffect(() => {
    if (!tenant || finalStatus) return
    let cancelled = false
    let lastEventTime = ''
    const poll = async () => {
      try {
        const url = `/api/tenants/${tenant.id}/events${lastEventTime ? `?since=${encodeURIComponent(lastEventTime)}` : ''}`
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { tenant: { status: string }; events: TenantEvent[] }
        if (cancelled) return
        if (data.events.length > 0) {
          setEvents(prev => [...prev, ...data.events])
          const last = data.events[data.events.length - 1]
          if (last) lastEventTime = last.createdAt
        }
        if (data.tenant.status === 'ACTIVE') {
          setFinalStatus('ACTIVE')
          toast.success(`Client ${form.name} provisionné`)
        } else if (data.tenant.status === 'ERROR') {
          setFinalStatus('ERROR')
          toast.error('Le provisioning a échoué — voir les logs')
        }
      } catch {}
    }
    void poll()
    const id = setInterval(poll, 1500)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [tenant, finalStatus, form.name])

  useEffect(() => {
    if (!startedAt || finalStatus) return
    const id = setInterval(() => setElapsedSec(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(id)
  }, [startedAt, finalStatus])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [events])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setStartedAt(Date.now())
    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error || 'Provisioning échoué')
        setLoading(false)
        setStartedAt(null)
        return
      }
      setTenant(body)
    } catch (err) {
      toast.error((err as Error).message)
      setLoading(false)
      setStartedAt(null)
    }
  }

  // ── Vue : provisioning en cours / fini ───────────────────────────────────
  if (tenant) {
    const elapsed = `${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, '0')}`
    return (
      <div className="container-x py-8 sm:py-10">
        <PageHeader
          backHref="/dashboard/tenants"
          backLabel="Tous les clients"
          title={
            finalStatus === 'ACTIVE'
              ? 'Client provisionné'
              : finalStatus === 'ERROR'
                ? 'Provisioning échoué'
                : 'Provisioning en cours…'
          }
          subtitle={
            <span>
              {tenant.name} · temps écoulé : <span className="font-mono">{elapsed}</span>
            </span>
          }
        />

        <div className="grid gap-5 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-5 lg:col-span-1"
          >
            <div className="flex items-center gap-3">
              <StatusIcon finalStatus={finalStatus} />
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Statut
                </div>
                <div className="font-display text-base font-bold text-slate-900">
                  {finalStatus === 'ACTIVE'
                    ? 'Actif'
                    : finalStatus === 'ERROR'
                      ? 'En erreur'
                      : 'En cours…'}
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-1 rounded-xl bg-slate-50 p-4 text-xs">
              <InfoRow label="Slug" value={tenant.slug} mono />
              <InfoRow label="Sous-domaine" value={`${tenant.subdomain}.sakafio.mg`} mono />
              <InfoRow label="URL admin" value={`admin-${tenant.subdomain}.sakafio.mg`} mono />
              <InfoRow label="Port API" value={String(tenant.apiPort)} mono />
              <InfoRow label="Email admin" value={tenant.adminEmail} />
            </div>

            {finalStatus === 'ACTIVE' && (
              <div className="mt-4 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                <Info className="h-4 w-4 flex-shrink-0" />
                <div>
                  Email de bienvenue envoyé au client. Vérifie l'event{' '}
                  <code className="font-mono">EMAIL_SENT</code> ou{' '}
                  <code className="font-mono">EMAIL_FAILED</code> dans le journal.
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              {finalStatus === 'ACTIVE' && (
                <>
                  <button onClick={() => router.push('/dashboard/tenants')} className="btn-primary">
                    Voir tous les clients
                  </button>
                  <button
                    onClick={() => {
                      setTenant(null)
                      setEvents([])
                      setFinalStatus(null)
                      setLoading(false)
                      setStartedAt(null)
                    }}
                    className="btn-secondary"
                  >
                    Créer un autre
                  </button>
                </>
              )}
              {finalStatus === 'ERROR' && (
                <>
                  <button
                    onClick={() => router.push(`/dashboard/tenants/${tenant.id}`)}
                    className="btn-secondary"
                  >
                    Voir le détail
                  </button>
                  <button
                    onClick={() => router.push('/dashboard/tenants')}
                    className="btn-secondary"
                  >
                    Retour
                  </button>
                </>
              )}
            </div>
          </motion.div>

          {/* Live log */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card overflow-hidden lg:col-span-2"
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-slate-500" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Journal du provisioning
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">{events.length} event(s)</span>
            </div>
            <div
              ref={logRef}
              className="max-h-[60vh] min-h-64 overflow-auto bg-slate-950 p-4 font-mono text-[11px] leading-relaxed text-emerald-200"
            >
              {events.length === 0 ? (
                <div className="text-slate-500">En attente du premier événement…</div>
              ) : (
                <AnimatePresence initial={false}>
                  {events.map(ev => (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`mb-1 whitespace-pre-wrap ${
                        ev.type === 'PROVISION_FAILED'
                          ? 'text-red-300'
                          : ev.type === 'PROVISIONED'
                            ? 'text-emerald-300'
                            : 'text-emerald-200'
                      }`}
                    >
                      <span className="text-slate-500">
                        [{new Date(ev.createdAt).toLocaleTimeString('fr-FR')}]
                      </span>{' '}
                      <span className="text-amber-300">{ev.type}</span>
                      {ev.details && (
                        <div className="ml-4 text-slate-300">{ev.details}</div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="container-x py-8 sm:py-10">
      <PageHeader
        backHref="/dashboard/tenants"
        backLabel="Tous les clients"
        title="Nouveau client"
        subtitle="Le provisioning prend ~5 minutes. Le journal s'affichera en direct."
      />

      <form onSubmit={onSubmit} className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <FormSection icon={Building2} title="Identité" subtitle="Nom et sous-domaine du client">
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Nom du restaurant *"
                value={form.name}
                onChange={v => update('name', v)}
                required
                placeholder="Restaurant de Pierre"
              />
              <div>
                <label className="label">Slug (sous-domaine) *</label>
                <input
                  className="input font-mono lowercase"
                  value={form.slug}
                  onChange={e => update('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  required
                  pattern="^[a-z][a-z0-9-]{1,30}$"
                  placeholder="pierre"
                />
                {form.slug && (
                  <p className="mt-1.5 font-mono text-[11px] text-brand-700">
                    → {form.slug}.sakafio.mg
                  </p>
                )}
              </div>
            </div>
          </FormSection>

          <FormSection icon={Mail} title="Contact propriétaire" subtitle="Pour les emails et le support">
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Nom du contact"
                value={form.contactName}
                onChange={v => update('contactName', v)}
                placeholder="Pierre Rasolofo"
              />
              <Field
                label="Téléphone"
                value={form.contactPhone}
                onChange={v => update('contactPhone', v)}
                placeholder="+261 34 12 345 67"
              />
              <div className="md:col-span-2">
                <Field
                  label="Email contact *"
                  type="email"
                  value={form.contactEmail}
                  onChange={v => update('contactEmail', v)}
                  required
                />
              </div>
            </div>
          </FormSection>

          <FormSection
            icon={ShieldCheck}
            title="Compte admin initial du restaurant"
            subtitle="Identifiants envoyés au client par email"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Email admin *"
                type="email"
                value={form.adminEmail}
                onChange={v => update('adminEmail', v)}
                required
                placeholder="admin@pierre.com"
              />
              <Field
                label="Mot de passe initial *"
                type="password"
                value={form.adminPassword}
                onChange={v => update('adminPassword', v)}
                required
                minLength={8}
                placeholder="Au moins 8 caractères"
                autoComplete="new-password"
                mono
              />
              <Field
                label="Prénom"
                value={form.adminFirstName}
                onChange={v => update('adminFirstName', v)}
              />
              <Field
                label="Nom"
                value={form.adminLastName}
                onChange={v => update('adminLastName', v)}
              />
            </div>
          </FormSection>

          <FormSection icon={Sparkles} title="Notes internes" subtitle="Visibles uniquement par les admins master">
            <textarea
              className="input min-h-24"
              value={form.notes}
              onChange={e => update('notes', e.target.value)}
              placeholder="Conditions particulières, contacts secondaires, etc."
            />
          </FormSection>

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Démarrage…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Créer et provisionner
                </>
              )}
            </button>
            <Link href="/dashboard/tenants" className="btn-secondary">
              Annuler
            </Link>
          </div>
        </div>

        {/* Side info */}
        <aside className="lg:col-span-1">
          <div className="card sticky top-20 p-5">
            <h3 className="font-display text-sm font-bold text-slate-900">Que va-t-il se passer ?</h3>
            <ol className="mt-4 space-y-3 text-xs text-slate-600">
              {[
                ['1', 'Vérification des images Docker et placeholders'],
                ['2', 'Création de la base de données dédiée'],
                ['3', 'Démarrage des 5 containers (api/web/pos/kds/client)'],
                ['4', 'Création de l\'admin initial et seed optionnel'],
                ['5', 'Génération de la config nginx + cron Certbot'],
                ['6', 'Envoi de l\'email de bienvenue au client'],
              ].map(([n, txt]) => (
                <li key={n} className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand-500 to-brand-600 text-[10px] font-bold text-white">
                    {n}
                  </span>
                  <span>{txt}</span>
                </li>
              ))}
            </ol>
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <Info className="mr-1 inline h-3 w-3" />
              SMTP doit être configuré pour l'email automatique.
            </div>
          </div>
        </aside>
      </form>
    </div>
  )
}

function StatusIcon({ finalStatus }: { finalStatus: 'ACTIVE' | 'ERROR' | null }) {
  if (finalStatus === 'ACTIVE') {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/30">
        <CheckCircle2 className="h-6 w-6" />
      </div>
    )
  }
  if (finalStatus === 'ERROR') {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-red-600 text-white shadow-md shadow-red-500/30">
        <XCircle className="h-6 w-6" />
      </div>
    )
  }
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/30">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  )
}

function FormSection({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="card p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-md shadow-brand-500/30">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </motion.section>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
  minLength,
  autoComplete,
  mono,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  placeholder?: string
  minLength?: number
  autoComplete?: string
  mono?: boolean
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        className={`input ${mono ? 'font-mono' : ''}`}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        minLength={minLength}
        autoComplete={autoComplete}
      />
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <span className={`min-w-0 truncate text-right text-xs text-slate-900 ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  )
}

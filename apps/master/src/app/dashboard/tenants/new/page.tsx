'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Info, CheckCircle2, XCircle } from 'lucide-react'
import Link from 'next/link'

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
    setForm((f) => ({ ...f, [k]: v }))
  }

  // ── Live polling des events pendant le provisioning ──────────────────────
  useEffect(() => {
    if (!tenant || finalStatus) return
    let cancelled = false
    let lastEventTime = ''

    const poll = async () => {
      try {
        const url = `/api/tenants/${tenant.id}/events${lastEventTime ? `?since=${encodeURIComponent(lastEventTime)}` : ''}`
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json() as { tenant: { status: string }; events: TenantEvent[] }
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
      } catch {
        /* ignore network blip, next poll réessaiera */
      }
    }

    void poll()
    const id = setInterval(poll, 1500)
    return () => { cancelled = true; clearInterval(id) }
  }, [tenant, finalStatus, form.name])

  // ── Compteur de temps écoulé ─────────────────────────────────────────────
  useEffect(() => {
    if (!startedAt || finalStatus) return
    const id = setInterval(() => setElapsedSec(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(id)
  }, [startedAt, finalStatus])

  // ── Auto-scroll du log vers le bas ───────────────────────────────────────
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
      // 202 Accepted : le provisioning tourne en background, l'effect lance
      // le polling des events
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
      <div className="px-6 py-8 md:px-10">
        <div className="mb-4">
          <Link
            href="/dashboard/tenants"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Retour à la liste
          </Link>
        </div>

        <div className="card p-6">
          <div className="mb-6 flex items-center gap-3">
            {finalStatus === 'ACTIVE' ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            ) : finalStatus === 'ERROR' ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-700">
                <XCircle className="h-5 w-5" />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-xl font-bold text-slate-900">
                {finalStatus === 'ACTIVE' && 'Client provisionné'}
                {finalStatus === 'ERROR' && 'Provisioning échoué'}
                {!finalStatus && 'Provisioning en cours…'}
              </h1>
              <p className="text-sm text-slate-500">{tenant.name} — temps écoulé : <span className="font-mono">{elapsed}</span></p>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg bg-slate-50 p-4 text-sm">
            <Row label="Slug" value={tenant.slug} mono />
            <Row label="Sous-domaine" value={`${tenant.subdomain}.sakafio.mg`} mono />
            <Row label="URL admin" value={`https://admin-${tenant.subdomain}.sakafio.mg`} mono />
            <Row label="Port API alloué" value={String(tenant.apiPort)} mono />
            <Row label="Email admin" value={tenant.adminEmail} />
          </div>

          {finalStatus === 'ACTIVE' && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <Info className="mr-1 inline h-3 w-3" />
              Envoie les identifiants au client par un canal sûr. Le mot de passe n'est plus affiché après ce point.
            </div>
          )}

          {/* Live log */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase text-slate-500">Journal du provisioning</h2>
              <span className="text-xs text-slate-400">{events.length} event(s)</span>
            </div>
            <div
              ref={logRef}
              className="max-h-96 min-h-40 overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px] leading-snug text-emerald-200"
            >
              {events.length === 0 ? (
                <div className="text-slate-500">En attente du premier événement…</div>
              ) : (
                events.map(ev => (
                  <div key={ev.id} className={`whitespace-pre-wrap ${ev.type === 'PROVISION_FAILED' ? 'text-red-300' : ev.type === 'PROVISIONED' ? 'text-emerald-300' : 'text-emerald-200'}`}>
                    <span className="text-slate-500">[{new Date(ev.createdAt).toLocaleTimeString('fr-FR')}]</span> <span className="text-amber-300">{ev.type}</span>
                    {ev.details && <div className="ml-4 text-slate-300">{ev.details}</div>}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            {finalStatus === 'ACTIVE' && (
              <>
                <button onClick={() => router.push('/dashboard/tenants')} className="btn-primary">
                  Voir tous les clients
                </button>
                <button onClick={() => { setTenant(null); setEvents([]); setFinalStatus(null); setLoading(false); setStartedAt(null) }} className="btn-secondary">
                  Créer un autre client
                </button>
              </>
            )}
            {finalStatus === 'ERROR' && (
              <>
                <button onClick={() => router.push(`/dashboard/tenants/${tenant.id}`)} className="btn-secondary">
                  Voir le détail du tenant en erreur
                </button>
                <button onClick={() => router.push('/dashboard/tenants')} className="btn-secondary">
                  Retour à la liste
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-8 md:px-10">
      <div className="mb-4">
        <Link
          href="/dashboard/tenants"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Retour à la liste
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Nouveau client</h1>
        <p className="mt-1 text-sm text-slate-500">
          Le provisioning prend ~5 minutes (build images Docker + push schema + seed). Le journal s'affichera en direct.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-6">
        <section className="card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">Identité</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Nom du restaurant *</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                required
                placeholder="Restaurant de Pierre"
              />
            </div>
            <div>
              <label className="label">Slug (sous-domaine) *</label>
              <input
                className="input font-mono lowercase"
                value={form.slug}
                onChange={(e) => update('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                required
                pattern="^[a-z][a-z0-9-]{1,30}$"
                placeholder="pierre"
              />
              <p className="mt-1 text-xs text-slate-500">
                {form.slug && `→ ${form.slug}.sakafio.mg`}
              </p>
            </div>
          </div>
        </section>

        <section className="card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">Contact propriétaire</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Nom du contact</label>
              <input
                className="input"
                value={form.contactName}
                onChange={(e) => update('contactName', e.target.value)}
                placeholder="Pierre Rasolofo"
              />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input
                className="input"
                value={form.contactPhone}
                onChange={(e) => update('contactPhone', e.target.value)}
                placeholder="+261 34 12 345 67"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Email contact *</label>
              <input
                type="email"
                className="input"
                value={form.contactEmail}
                onChange={(e) => update('contactEmail', e.target.value)}
                required
              />
            </div>
          </div>
        </section>

        <section className="card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">
            Compte admin initial du restaurant
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Email admin *</label>
              <input
                type="email"
                className="input"
                value={form.adminEmail}
                onChange={(e) => update('adminEmail', e.target.value)}
                required
                placeholder="admin@pierre.com"
              />
            </div>
            <div>
              <label className="label">Mot de passe initial *</label>
              <input
                type="password"
                className="input font-mono"
                value={form.adminPassword}
                onChange={(e) => update('adminPassword', e.target.value)}
                required
                minLength={8}
                placeholder="Au moins 8 caractères"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="label">Prénom</label>
              <input
                className="input"
                value={form.adminFirstName}
                onChange={(e) => update('adminFirstName', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Nom</label>
              <input
                className="input"
                value={form.adminLastName}
                onChange={(e) => update('adminLastName', e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">Notes internes</h2>
          <textarea
            className="input min-h-24"
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Conditions particulières, contacts secondaires, etc."
          />
        </section>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Démarrage…
              </>
            ) : (
              'Créer et provisionner'
            )}
          </button>
          <Link href="/dashboard/tenants" className="btn-secondary">
            Annuler
          </Link>
        </div>
      </form>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <span className="text-xs uppercase text-slate-500">{label}</span>
      <span className={`col-span-2 text-sm ${mono ? 'font-mono' : ''} text-slate-900`}>
        {value}
      </span>
    </div>
  )
}

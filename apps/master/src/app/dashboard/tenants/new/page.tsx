'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Info } from 'lucide-react'
import Link from 'next/link'

type CreatedTenant = {
  id: string
  slug: string
  name: string
  subdomain: string
  apiPort: number
  status: string
  adminEmail: string
  adminPasswordSent: boolean
  logs: string
}

export default function NewTenantPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState<CreatedTenant | null>(null)

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Provisioning échoué')
      toast.success(`Client ${form.name} créé`)
      setCreated(body)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (created) {
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
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              ✓
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Client provisionné</h1>
              <p className="text-sm text-slate-500">{created.name}</p>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg bg-slate-50 p-4 text-sm">
            <Row label="Slug" value={created.slug} mono />
            <Row label="Sous-domaine" value={`${created.subdomain}.sakafio.mg`} mono />
            <Row label="URL admin" value={`https://admin-${created.subdomain}.sakafio.mg`} mono />
            <Row label="Port API alloué" value={String(created.apiPort)} mono />
            <Row label="Email admin" value={created.adminEmail} />
            <Row label="Status" value={created.status} />
          </div>

          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <Info className="mr-1 inline h-3 w-3" />
            Envoie les identifiants au client par un canal sûr. Le mot de passe n'est plus affiché après ce point.
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-medium text-slate-600">
              Voir les logs de provisioning
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-[10px] leading-tight text-emerald-200">
              {created.logs}
            </pre>
          </details>

          <div className="mt-6 flex gap-2">
            <button onClick={() => router.push('/dashboard/tenants')} className="btn-primary">
              Voir tous les clients
            </button>
            <button onClick={() => setCreated(null)} className="btn-secondary">
              Créer un autre client
            </button>
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
          Le provisioning prend ~5 minutes (build images Docker + push schema + seed).
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
                Provisioning en cours (~5 min)…
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

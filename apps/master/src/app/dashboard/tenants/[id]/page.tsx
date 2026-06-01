import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { masterPrisma } from '@restaurant/master-database'
import { readSession } from '@/lib/auth'
import { DeleteTenantButton } from '@/components/DeleteTenantButton'
import { SuspendResumeButton } from '@/components/SuspendResumeButton'

export const dynamic = 'force-dynamic'

export default async function TenantDetailPage({ params }: { params: { id: string } }) {
  const session = readSession()
  const tenant = await masterPrisma.tenant.findUnique({
    where: { id: params.id },
    include: {
      events: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  })
  if (!tenant) return notFound()

  const adminUrl = `https://admin-${tenant.subdomain}.sakafio.mg`
  const posUrl = `https://pos-${tenant.subdomain}.sakafio.mg`
  const apiUrl = `https://api-${tenant.subdomain}.sakafio.mg`

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

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{tenant.name}</h1>
          <p className="mt-1 font-mono text-sm text-slate-500">{tenant.slug}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={tenant.status} />
          <SuspendResumeButton
            tenantId={tenant.id}
            tenantSlug={tenant.slug}
            status={tenant.status}
          />
          {session?.role === 'OWNER' && (
            <DeleteTenantButton
              tenantId={tenant.id}
              tenantSlug={tenant.slug}
              tenantName={tenant.name}
            />
          )}
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">URLs publiques</h2>
          <div className="space-y-2 text-sm">
            <LinkRow label="Admin" url={adminUrl} />
            <LinkRow label="POS" url={posUrl} />
            <LinkRow label="API" url={apiUrl} />
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">Contact</h2>
          <div className="space-y-1 text-sm">
            <Row label="Nom" value={tenant.contactName || '—'} />
            <Row label="Email" value={tenant.contactEmail} />
            <Row label="Téléphone" value={tenant.contactPhone || '—'} />
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">Infrastructure</h2>
          <div className="space-y-1 text-sm">
            <Row label="DB" value={tenant.dbName} mono />
            <Row label="Port API" value={String(tenant.apiPort)} mono />
            <Row label="Port Web" value={String(tenant.webPort)} mono />
            <Row label="Port POS" value={String(tenant.posPort)} mono />
            <Row label="Port KDS" value={String(tenant.kdsPort)} mono />
            <Row label="Port Client" value={String(tenant.clientPort)} mono />
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">Dates</h2>
          <div className="space-y-1 text-sm">
            <Row label="Créé" value={new Date(tenant.createdAt).toLocaleString('fr-FR')} />
            <Row
              label="Provisionné"
              value={tenant.provisionedAt ? new Date(tenant.provisionedAt).toLocaleString('fr-FR') : '—'}
            />
            <Row
              label="Dernier déploiement"
              value={
                tenant.lastDeployedAt ? new Date(tenant.lastDeployedAt).toLocaleString('fr-FR') : '—'
              }
            />
            {tenant.suspendedAt && (
              <Row label="Suspendu le" value={new Date(tenant.suspendedAt).toLocaleString('fr-FR')} />
            )}
          </div>
        </section>
      </div>

      {tenant.notes && (
        <section className="card mt-6 p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{tenant.notes}</p>
        </section>
      )}

      <section className="card mt-6 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">Historique</h2>
        {tenant.events.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun événement.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {tenant.events.map((ev) => (
              <li key={ev.id} className="flex items-start gap-3 border-b border-slate-100 pb-2 last:border-0">
                <span className="font-mono text-xs text-slate-400">
                  {new Date(ev.createdAt).toLocaleString('fr-FR')}
                </span>
                <span className="font-medium text-slate-900">{ev.type}</span>
                {ev.details && <span className="text-slate-600">{ev.details}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-xs uppercase text-slate-500">{label}</span>
      <span className={`text-sm ${mono ? 'font-mono' : ''} text-slate-900`}>{value}</span>
    </div>
  )
}

function LinkRow({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs uppercase text-slate-500">{label}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-mono text-xs text-brand-600 hover:underline"
      >
        {url} <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-700',
    PROVISIONING: 'bg-blue-100 text-blue-700',
    SUSPENDED: 'bg-amber-100 text-amber-700',
    ARCHIVED: 'bg-slate-100 text-slate-600',
    ERROR: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  )
}

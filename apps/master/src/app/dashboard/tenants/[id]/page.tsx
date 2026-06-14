import { notFound } from 'next/navigation'
import { ExternalLink, Mail, Phone, Server, Calendar, Activity, FileText } from 'lucide-react'
import { masterPrisma } from '@restaurant/master-database'
import { readSession } from '@/lib/auth'
import { DeleteTenantButton } from '@/components/DeleteTenantButton'
import { SuspendResumeButton } from '@/components/SuspendResumeButton'
import { TenantSubscriptionCard } from '@/components/TenantSubscriptionCard'
import { PageHeader, StatusBadge } from '@/components/ui/PageHeader'

export const dynamic = 'force-dynamic'

export default async function TenantDetailPage({ params }: { params: { id: string } }) {
  const session = readSession()
  const tenant = await masterPrisma.tenant.findUnique({
    where: { id: params.id },
    include: {
      events: { orderBy: { createdAt: 'desc' }, take: 30 },
    },
  })
  if (!tenant) return notFound()

  const sub = tenant.subdomain
  const URLS = [
    { label: 'Admin', url: `https://admin-${sub}.sakafio.mg` },
    { label: 'POS', url: `https://pos-${sub}.sakafio.mg` },
    { label: 'KDS', url: `https://kds-${sub}.sakafio.mg` },
    { label: 'Client (vitrine)', url: `https://${sub}.sakafio.mg` },
    { label: 'API', url: `https://api-${sub}.sakafio.mg` },
  ]

  return (
    <div className="container-x py-8 sm:py-10">
      <PageHeader
        backHref="/dashboard/tenants"
        backLabel="Tous les clients"
        title={
          <div className="flex flex-wrap items-center gap-3">
            <span className="truncate">{tenant.name}</span>
            <StatusBadge status={tenant.status} />
            {tenant.subscriptionStatus && (
              <StatusBadge status={tenant.subscriptionStatus} dot={false} />
            )}
          </div>
        }
        subtitle={
          <span className="font-mono text-xs">
            {tenant.slug} · DB {tenant.dbName}
          </span>
        }
        actions={
          <>
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
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <CardHeader icon={ExternalLink} title="URLs publiques" />
          <div className="mt-4 grid gap-2">
            {URLS.map(u => (
              <a
                key={u.label}
                href={u.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3.5 py-2.5 transition-colors hover:border-brand-200 hover:bg-brand-50/40"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {u.label}
                  </div>
                  <div className="truncate font-mono text-xs text-brand-700">{u.url}</div>
                </div>
                <ExternalLink className="h-4 w-4 flex-shrink-0 text-slate-400 group-hover:text-brand-600" />
              </a>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <CardHeader icon={Mail} title="Contact" />
          <div className="mt-4 space-y-3">
            <ContactRow icon={Mail} label="Email" value={tenant.contactEmail} />
            <ContactRow icon={Phone} label="Téléphone" value={tenant.contactPhone || '—'} />
            <ContactRow label="Nom" value={tenant.contactName || '—'} />
          </div>
        </section>

        <section className="card p-5">
          <CardHeader icon={Server} title="Infrastructure" />
          <div className="mt-4 space-y-1.5 text-xs">
            <Row label="DB" value={tenant.dbName} mono />
            <Row label="Port API" value={String(tenant.apiPort)} mono />
            <Row label="Port Web" value={String(tenant.webPort)} mono />
            <Row label="Port POS" value={String(tenant.posPort)} mono />
            <Row label="Port KDS" value={String(tenant.kdsPort)} mono />
            <Row label="Port Client" value={String(tenant.clientPort)} mono />
          </div>
        </section>

        <section className="card p-5">
          <CardHeader icon={Calendar} title="Dates" />
          <div className="mt-4 space-y-1.5 text-xs">
            <Row label="Créé" value={new Date(tenant.createdAt).toLocaleString('fr-FR')} />
            <Row
              label="Provisionné"
              value={tenant.provisionedAt ? new Date(tenant.provisionedAt).toLocaleString('fr-FR') : '—'}
            />
            <Row
              label="Dernier déploiement"
              value={tenant.lastDeployedAt ? new Date(tenant.lastDeployedAt).toLocaleString('fr-FR') : '—'}
            />
            {tenant.suspendedAt && (
              <Row label="Suspendu le" value={new Date(tenant.suspendedAt).toLocaleString('fr-FR')} />
            )}
            {tenant.trialEndsAt && (
              <Row label="Fin essai" value={new Date(tenant.trialEndsAt).toLocaleString('fr-FR')} />
            )}
          </div>
        </section>

        <div className="lg:col-span-1">
          <TenantSubscriptionCard tenantId={tenant.id} />
        </div>
      </div>

      {tenant.notes && (
        <section className="card mt-5 p-5">
          <CardHeader icon={FileText} title="Notes internes" />
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{tenant.notes}</p>
        </section>
      )}

      <section className="card mt-5 p-5">
        <CardHeader
          icon={Activity}
          title="Historique"
          right={<span className="text-xs text-slate-400">{tenant.events.length} événement(s)</span>}
        />
        {tenant.events.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Aucun événement.</p>
        ) : (
          <ol className="mt-4 space-y-2.5">
            {(tenant.events as Array<{ id: string; type: string; details: string | null; createdAt: Date }>).map(ev => (
              <li key={ev.id} className="flex items-start gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
                <span className="font-mono text-[11px] text-slate-400">
                  {new Date(ev.createdAt).toLocaleString('fr-FR')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-900">{ev.type}</div>
                  {ev.details && (
                    <div className="mt-0.5 whitespace-pre-wrap text-xs text-slate-600">
                      {ev.details}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

function CardHeader({
  icon: Icon,
  title,
  right,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      </div>
      {right}
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <span className={`min-w-0 truncate text-right text-xs ${mono ? 'font-mono' : ''} text-slate-900`}>
        {value}
      </span>
    </div>
  )
}

function ContactRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      {Icon ? (
        <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <Icon className="h-3.5 w-3.5" />
        </div>
      ) : (
        <div className="mt-0.5 h-7 w-7" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </div>
        <div className="truncate text-sm text-slate-900">{value}</div>
      </div>
    </div>
  )
}

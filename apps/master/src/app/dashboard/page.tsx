import Link from 'next/link'
import { Users, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { masterPrisma } from '@restaurant/master-database'

export default async function OverviewPage() {
  const [total, active, suspended, errored, recent] = await Promise.all([
    masterPrisma.tenant.count(),
    masterPrisma.tenant.count({ where: { status: 'ACTIVE' } }),
    masterPrisma.tenant.count({ where: { status: 'SUSPENDED' } }),
    masterPrisma.tenant.count({ where: { status: 'ERROR' } }),
    masterPrisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  return (
    <div className="px-6 py-8 md:px-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Vue d'ensemble</h1>
        <p className="mt-1 text-sm text-slate-500">
          Suivi global des clients Sakafio
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Clients" value={total} icon={Users} tone="brand" />
        <KpiCard label="Actifs" value={active} icon={CheckCircle2} tone="green" />
        <KpiCard label="Suspendus" value={suspended} icon={AlertTriangle} tone="amber" />
        <KpiCard label="En erreur" value={errored} icon={Activity} tone="red" />
      </div>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Derniers clients</h2>
          <Link href="/dashboard/tenants" className="text-xs font-medium text-brand-600 hover:underline">
            Voir tout →
          </Link>
        </div>
        <div className="card overflow-hidden">
          {recent.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Aucun client pour l'instant.{' '}
              <Link href="/dashboard/tenants/new" className="text-brand-600 hover:underline">
                Créer le premier →
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Nom</th>
                  <th className="px-4 py-2">Slug</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Créé</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{t.slug}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(t.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  tone: 'brand' | 'green' | 'amber' | 'red'
}) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-100 text-brand-700',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
  }
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs uppercase text-slate-500">{label}</div>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
      </div>
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
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  )
}

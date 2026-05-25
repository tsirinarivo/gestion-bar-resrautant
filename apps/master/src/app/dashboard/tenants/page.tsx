import Link from 'next/link'
import { Plus, ExternalLink } from 'lucide-react'
import { masterPrisma } from '@restaurant/master-database'

export const dynamic = 'force-dynamic'

export default async function TenantsPage() {
  const tenants = await masterPrisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="px-6 py-8 md:px-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
          <p className="mt-1 text-sm text-slate-500">{tenants.length} client(s)</p>
        </div>
        <Link href="/dashboard/tenants/new" className="btn-primary">
          <Plus className="h-4 w-4" />
          Nouveau client
        </Link>
      </header>

      <div className="card overflow-hidden">
        {tenants.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-slate-500">Aucun client provisionné.</p>
            <Link href="/dashboard/tenants/new" className="btn-primary mt-4 inline-flex">
              <Plus className="h-4 w-4" />
              Créer le premier client
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Créé</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{t.slug}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{t.contactEmail}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(t.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/tenants/${t.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                    >
                      Détails <ExternalLink className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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

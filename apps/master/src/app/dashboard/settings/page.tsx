import Link from 'next/link'
import { Mail, ChevronRight } from 'lucide-react'
import { masterPrisma } from '@restaurant/master-database'
import { readSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = readSession()
  const users = await masterPrisma.masterUser.findMany({
    orderBy: { createdAt: 'asc' },
  })

  return (
    <div className="px-6 py-8 md:px-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">Utilisateurs de la console et configuration globale</p>
      </header>

      {/* Sections de config (cards cliquables) */}
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <Link
          href="/dashboard/settings/smtp"
          className="card group flex items-center gap-4 p-4 transition-colors hover:bg-slate-50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600">
            <Mail className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-slate-900">Configuration SMTP</div>
            <div className="text-xs text-slate-500">
              Email de bienvenue automatique à la création de tenant
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-700" />
        </Link>
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Utilisateurs de la console</h2>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Dernière connexion</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">
                  {u.email}
                  {session?.uid === u.id && (
                    <span className="ml-2 text-[10px] uppercase text-brand-600">(vous)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{u.name}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">{u.role}</span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {u.lastLogin ? new Date(u.lastLogin).toLocaleString('fr-FR') : '—'}
                </td>
                <td className="px-4 py-3">
                  {u.active ? (
                    <span className="text-xs text-emerald-700">Actif</span>
                  ) : (
                    <span className="text-xs text-red-700">Désactivé</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        La gestion CRUD des utilisateurs sera ajoutée au sprint 3. Pour ajouter un utilisateur,
        utilise <code className="rounded bg-slate-100 px-1">deploy/master-add-user.sh</code>.
      </p>
    </div>
  )
}

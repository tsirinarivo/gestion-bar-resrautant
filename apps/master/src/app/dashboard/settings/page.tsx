import Link from 'next/link'
import { Mail, ChevronRight, Users as UsersIcon, Server } from 'lucide-react'
import { masterPrisma } from '@restaurant/master-database'
import { readSession } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = readSession()
  const users = await masterPrisma.masterUser.findMany({
    orderBy: { createdAt: 'asc' },
  })

  return (
    <div className="container-x py-8 sm:py-10">
      <PageHeader
        title="Paramètres"
        subtitle="Utilisateurs de la console et configuration globale"
      />

      <h2 className="mb-3 text-sm font-bold text-slate-900">Configuration</h2>
      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <SettingCard
          href="/dashboard/settings/smtp"
          icon={Mail}
          title="Configuration SMTP"
          desc="Email de bienvenue automatique à la création de tenant"
        />
        <SettingCard
          icon={Server}
          title="Variables d'environnement"
          desc="Sprint suivant — édition de .env.prod sans SSH"
          disabled
        />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">Utilisateurs de la console</h2>
        <span className="text-xs text-slate-400">{users.length} utilisateur(s)</span>
      </div>

      <div className="card overflow-hidden">
        <div className="hidden sm:block">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/50">
              <tr>
                <Th>Email</Th>
                <Th>Nom</Th>
                <Th>Rôle</Th>
                <Th>Dernière connexion</Th>
                <Th>Statut</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(users as Array<{
                id: string
                email: string
                name: string
                role: string
                lastLogin: Date | null
                active: boolean
              }>).map(u => (
                <tr key={u.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white shadow-sm">
                        {u.email.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{u.email}</div>
                        {session?.uid === u.id && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">
                            Vous
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{u.name}</td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-500">
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleString('fr-FR') : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    {u.active ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
                        Actif
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-red-700">Désactivé</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-100 sm:hidden">
          {(users as Array<{
            id: string
            email: string
            name: string
            role: string
            lastLogin: Date | null
            active: boolean
          }>).map(u => (
            <div key={u.id} className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white">
                  {u.email.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-slate-900">{u.email}</div>
                  <div className="text-xs text-slate-500">{u.name}</div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                  {u.role}
                </span>
                {u.active ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Actif
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-red-700">Désactivé</span>
                )}
                {session?.uid === u.id && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">
                    Vous
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <UsersIcon className="h-4 w-4 flex-shrink-0 text-slate-500" />
        <div>
          La gestion CRUD des utilisateurs sera ajoutée au sprint 3. Pour ajouter un utilisateur,
          utilise <code className="rounded bg-white px-1 font-mono">deploy/master-add-user.sh</code>.
        </div>
      </div>
    </div>
  )
}

function SettingCard({
  href,
  icon: Icon,
  title,
  desc,
  disabled,
}: {
  href?: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  desc: string
  disabled?: boolean
}) {
  const inner = (
    <div
      className={`card group flex items-center gap-4 p-5 transition-all ${
        disabled
          ? 'cursor-not-allowed opacity-60'
          : 'hover:border-brand-200 hover:shadow-soft-lg'
      }`}
    >
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-md shadow-brand-500/30">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="font-bold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">{desc}</div>
      </div>
      {!disabled && (
        <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-700" />
      )}
    </div>
  )
  if (disabled || !href) return inner
  return <Link href={href}>{inner}</Link>
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </th>
  )
}

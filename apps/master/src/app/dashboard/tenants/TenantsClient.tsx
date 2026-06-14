'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, ChevronRight, Users, Clock, Phone, Mail } from 'lucide-react'
import { PageHeader, StatusBadge } from '@/components/ui/PageHeader'

type Tenant = {
  id: string
  name: string
  slug: string
  status: string
  contactEmail: string
  contactPhone: string | null
  createdAt: string
  subscriptionStatus: string | null
  trialEndsAt: string | null
}

const STATUS_FILTERS = ['ALL', 'ACTIVE', 'PROVISIONING', 'SUSPENDED', 'ERROR'] as const

export function TenantsClient({ tenants }: { tenants: Tenant[] }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>('ALL')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tenants.filter(t => {
      if (filter !== 'ALL' && t.status !== filter) return false
      if (!q) return true
      return (
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        t.contactEmail.toLowerCase().includes(q)
      )
    })
  }, [tenants, query, filter])

  return (
    <div className="container-x py-8 sm:py-10">
      <PageHeader
        title="Clients"
        subtitle={`${tenants.length} client${tenants.length > 1 ? 's' : ''} provisionné${tenants.length > 1 ? 's' : ''}`}
        actions={
          <Link href="/dashboard/tenants/new" className="btn-primary">
            <Plus className="h-4 w-4" /> Nouveau client
          </Link>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mb-5 flex flex-wrap items-center gap-2"
      >
        <div className="relative min-w-[220px] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher un client, slug, email…"
            className="input pl-10"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 ring-1 ring-slate-200 scrollbar-hidden">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === f
                  ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f === 'ALL' ? 'Tous' : f}
            </button>
          ))}
        </div>
      </motion.div>

      {tenants.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-hidden sm:block">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <Th>Nom</Th>
                  <Th>Slug</Th>
                  <Th>Statut</Th>
                  <Th>Abonnement</Th>
                  <Th>Contact</Th>
                  <Th right>Créé</Th>
                  <Th right>{''}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence>
                  {filtered.map((t, i) => (
                    <motion.tr
                      key={t.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: Math.min(i, 12) * 0.03 }}
                      className="group hover:bg-slate-50/60"
                    >
                      <td className="px-5 py-3.5">
                        <Link href={`/dashboard/tenants/${t.id}`} className="flex items-center gap-3">
                          <Avatar name={t.name} />
                          <div>
                            <div className="font-semibold text-slate-900 group-hover:text-brand-700">
                              {t.name}
                            </div>
                            {t.trialEndsAt && (
                              <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                                <Clock className="h-3 w-3" />
                                Essai → {new Date(t.trialEndsAt).toLocaleDateString('fr-FR')}
                              </div>
                            )}
                          </div>
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{t.slug}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={t.status} /></td>
                      <td className="px-5 py-3.5">
                        {t.subscriptionStatus
                          ? <StatusBadge status={t.subscriptionStatus} dot={false} />
                          : <span className="text-[11px] text-slate-400">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600">
                        <div className="truncate">{t.contactEmail}</div>
                        {t.contactPhone && (
                          <div className="text-[11px] text-slate-400">{t.contactPhone}</div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-slate-500">
                        {new Date(t.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/dashboard/tenants/${t.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50"
                        >
                          Détail <ChevronRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="p-10 text-center text-sm text-slate-500">
                Aucun client ne correspond aux filtres.
              </div>
            )}
          </div>

          {/* Mobile cards */}
          <div className="space-y-2.5 sm:hidden">
            {filtered.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.04 }}
              >
                <Link
                  href={`/dashboard/tenants/${t.id}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-soft active:bg-slate-50"
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={t.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate font-semibold text-slate-900">{t.name}</div>
                        <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" />
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">{t.slug}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={t.status} />
                        {t.subscriptionStatus && (
                          <StatusBadge status={t.subscriptionStatus} dot={false} />
                        )}
                      </div>
                      <div className="mt-2 space-y-0.5 text-[11px] text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3" /> {t.contactEmail}
                        </div>
                        {t.contactPhone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3" /> {t.contactPhone}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
            {filtered.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                Aucun client ne correspond aux filtres.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-bold text-slate-700">
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="card flex flex-col items-center px-6 py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100">
        <Users className="h-7 w-7 text-brand-600" />
      </div>
      <h3 className="font-display text-lg font-bold text-slate-900">Aucun client provisionné</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Commencez par créer votre premier restaurant. Le provisioning prend environ 5 minutes.
      </p>
      <Link href="/dashboard/tenants/new" className="btn-primary mt-6 inline-flex">
        <Plus className="h-4 w-4" /> Créer le premier client
      </Link>
    </div>
  )
}

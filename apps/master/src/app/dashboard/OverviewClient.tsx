'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Users,
  Activity,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  Plus,
  Clock,
} from 'lucide-react'

type IconKey = 'Users' | 'CheckCircle2' | 'Activity' | 'AlertTriangle'
const ICONS: Record<IconKey, React.ComponentType<{ className?: string }>> = {
  Users,
  CheckCircle2,
  Activity,
  AlertTriangle,
}

type Tone = 'brand' | 'green' | 'amber' | 'red' | 'blue'

type KpiInput = {
  label: string
  value: number
  icon: IconKey
  tone: Tone
  hint: string
}

type RecentTenant = {
  id: string
  name: string
  slug: string
  status: string
  createdAt: string
  subscriptionStatus: string | null
  trialEndsAt: string | null
}

const TONES: Record<Tone, { icon: string; ring: string; accent: string }> = {
  brand: {
    icon: 'bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-md shadow-brand-500/30',
    ring: 'ring-brand-500/20',
    accent: 'text-brand-700',
  },
  green: {
    icon: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/30',
    ring: 'ring-emerald-500/20',
    accent: 'text-emerald-700',
  },
  blue: {
    icon: 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/30',
    ring: 'ring-blue-500/20',
    accent: 'text-blue-700',
  },
  amber: {
    icon: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/30',
    ring: 'ring-amber-500/20',
    accent: 'text-amber-700',
  },
  red: {
    icon: 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-md shadow-red-500/30',
    ring: 'ring-red-500/20',
    accent: 'text-red-700',
  },
}

export function OverviewClient({ kpis, recent }: { kpis: KpiInput[]; recent: RecentTenant[] }) {
  return (
    <div className="container-x py-8 sm:py-10">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8 flex flex-wrap items-end justify-between gap-3"
      >
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Vue d'ensemble
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Suivi global de votre infrastructure Sakafio
          </p>
        </div>
        <Link href="/dashboard/tenants/new" className="btn-primary">
          <Plus className="h-4 w-4" /> Nouveau client
        </Link>
      </motion.header>

      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.06 } },
        }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      >
        {kpis.map(k => (
          <KpiCard key={k.label} {...k} />
        ))}
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-10"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-slate-900 sm:text-lg">
            Derniers clients
          </h2>
          <Link
            href="/dashboard/tenants"
            className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
          >
            Voir tous <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="card overflow-hidden">
          {recent.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/50">
                    <tr>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Nom
                      </th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Slug
                      </th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Statut
                      </th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Abonnement
                      </th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Créé
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recent.map((t, i) => (
                      <motion.tr
                        key={t.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * i }}
                        className="group hover:bg-slate-50/60"
                      >
                        <td className="px-5 py-3.5">
                          <Link href={`/dashboard/tenants/${t.id}`} className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-bold text-slate-700">
                              {t.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 group-hover:text-brand-700">
                                {t.name}
                              </div>
                              {t.trialEndsAt && (
                                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                                  <Clock className="h-3 w-3" />
                                  Essai jusqu'au {new Date(t.trialEndsAt).toLocaleDateString('fr-FR')}
                                </div>
                              )}
                            </div>
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{t.slug}</td>
                        <td className="px-5 py-3.5"><StatusBadge status={t.status} /></td>
                        <td className="px-5 py-3.5"><SubBadge sub={t.subscriptionStatus} /></td>
                        <td className="px-5 py-3.5 text-right text-xs text-slate-500">
                          {new Date(t.createdAt).toLocaleDateString('fr-FR')}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="divide-y divide-slate-100 sm:hidden">
                {recent.map((t, i) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i }}
                  >
                    <Link href={`/dashboard/tenants/${t.id}`} className="block p-4 active:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-bold text-slate-700">
                          {t.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-slate-900">{t.name}</div>
                          <div className="font-mono text-[11px] text-slate-500">{t.slug}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={t.status} />
                        <SubBadge sub={t.subscriptionStatus} />
                        <span className="ml-auto text-[11px] text-slate-500">
                          {new Date(t.createdAt).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      </motion.section>
    </div>
  )
}

function KpiCard({ label, value, icon, tone, hint }: KpiInput) {
  const Icon = ICONS[icon]
  const t = TONES[tone]
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
      }}
      whileHover={{ y: -2 }}
      className={`card relative overflow-hidden p-4 transition-all hover:shadow-soft-lg sm:p-5 ring-1 ${t.ring}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${t.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 font-display text-3xl font-extrabold text-slate-900 tabular-nums">
        {value}
      </div>
      <div className={`mt-1 text-xs font-medium ${t.accent}`}>{hint}</div>
    </motion.div>
  )
}

function EmptyState() {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50">
        <Users className="h-6 w-6 text-brand-600" />
      </div>
      <h3 className="font-display text-base font-bold text-slate-900">Aucun client pour l'instant</h3>
      <p className="mt-1 text-sm text-slate-500">
        Provisionnez votre premier restaurant pour commencer.
      </p>
      <Link href="/dashboard/tenants/new" className="btn-primary mt-5 inline-flex">
        <Plus className="h-4 w-4" /> Créer le premier
      </Link>
    </div>
  )
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  PROVISIONING: 'bg-blue-50 text-blue-700 ring-blue-200',
  SUSPENDED: 'bg-amber-50 text-amber-700 ring-amber-200',
  ARCHIVED: 'bg-slate-100 text-slate-600 ring-slate-200',
  ERROR: 'bg-red-50 text-red-700 ring-red-200',
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600 ring-slate-200'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cls}`}>
      {status === 'ACTIVE' && <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />}
      {status}
    </span>
  )
}

function SubBadge({ sub }: { sub: string | null }) {
  if (!sub) return <span className="text-[11px] text-slate-400">—</span>
  const cls =
    sub === 'TRIAL'
      ? 'bg-blue-50 text-blue-700 ring-blue-200'
      : sub === 'ACTIVE'
        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
        : 'bg-slate-100 text-slate-600 ring-slate-200'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cls}`}>
      {sub}
    </span>
  )
}

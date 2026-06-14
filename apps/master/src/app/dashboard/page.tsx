import Link from 'next/link'
import { Users, Activity, AlertTriangle, CheckCircle2, ArrowUpRight, Plus } from 'lucide-react'
import { masterPrisma } from '@restaurant/master-database'
import { OverviewClient } from './OverviewClient'

export default async function OverviewPage() {
  const [total, active, suspended, errored, recent] = await Promise.all([
    masterPrisma.tenant.count(),
    masterPrisma.tenant.count({ where: { status: 'ACTIVE' } }),
    masterPrisma.tenant.count({ where: { status: 'SUSPENDED' } }),
    masterPrisma.tenant.count({ where: { status: 'ERROR' } }),
    masterPrisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        subscriptionStatus: true,
        trialEndsAt: true,
      },
    }),
  ])

  const trial = await masterPrisma.tenant.count({ where: { subscriptionStatus: 'TRIAL' } })

  const kpis = [
    {
      label: 'Clients totaux',
      value: total,
      icon: 'Users' as const,
      tone: 'brand' as const,
      hint: total > 0 ? 'Tous statuts confondus' : 'Aucun client',
    },
    {
      label: 'Actifs',
      value: active,
      icon: 'CheckCircle2' as const,
      tone: 'green' as const,
      hint: total > 0 ? `${Math.round((active / total) * 100)}% du total` : '—',
    },
    {
      label: 'En essai',
      value: trial,
      icon: 'Activity' as const,
      tone: 'blue' as const,
      hint: trial > 0 ? 'À convertir bientôt' : 'Aucun essai',
    },
    {
      label: 'Suspendus',
      value: suspended,
      icon: 'AlertTriangle' as const,
      tone: 'amber' as const,
      hint: suspended > 0 ? 'À investiguer' : 'OK',
    },
    {
      label: 'En erreur',
      value: errored,
      icon: 'Activity' as const,
      tone: 'red' as const,
      hint: errored > 0 ? 'Action requise' : 'Tout va bien',
    },
  ]

  return (
    <OverviewClient
      kpis={kpis}
      recent={(recent as Array<{
        id: string
        name: string
        slug: string
        status: string
        createdAt: Date
        subscriptionStatus: string | null
        trialEndsAt: Date | null
      }>).map(t => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        trialEndsAt: t.trialEndsAt?.toISOString() ?? null,
      }))}
    />
  )
}

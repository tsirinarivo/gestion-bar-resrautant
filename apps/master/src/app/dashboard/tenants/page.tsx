import Link from 'next/link'
import { Plus } from 'lucide-react'
import { masterPrisma } from '@restaurant/master-database'
import { TenantsClient } from './TenantsClient'

export const dynamic = 'force-dynamic'

export default async function TenantsPage() {
  const tenants = await masterPrisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
  })

  type Row = {
    id: string
    name: string
    slug: string
    status: string
    contactEmail: string
    contactPhone: string | null
    createdAt: Date
    subscriptionStatus: string | null
    trialEndsAt: Date | null
  }

  return (
    <TenantsClient
      tenants={(tenants as Row[]).map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        contactEmail: t.contactEmail,
        contactPhone: t.contactPhone ?? null,
        createdAt: t.createdAt.toISOString(),
        subscriptionStatus: t.subscriptionStatus ?? null,
        trialEndsAt: t.trialEndsAt?.toISOString() ?? null,
      }))}
    />
  )
}

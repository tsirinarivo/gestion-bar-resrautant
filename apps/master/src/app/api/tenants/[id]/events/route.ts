import { NextResponse } from 'next/server'
import { masterPrisma } from '@restaurant/master-database'
import { readSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/tenants/:id/events?since=<ISO date>
// Retourne les events du tenant + son statut courant. Utilisé par l'UI new tenant
// pour afficher un live log pendant le provisioning (poll toutes les 1-2s).
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const url = new URL(req.url)
  const sinceParam = url.searchParams.get('since')
  const since = sinceParam ? new Date(sinceParam) : new Date(0)

  const tenant = await masterPrisma.tenant.findUnique({
    where: { id: params.id },
    select: { id: true, slug: true, status: true, provisionedAt: true, suspendedAt: true },
  })
  if (!tenant) return NextResponse.json({ error: 'Tenant introuvable' }, { status: 404 })

  const events = await masterPrisma.tenantEvent.findMany({
    where: { tenantId: tenant.id, createdAt: { gt: since } },
    orderBy: { createdAt: 'asc' },
    take: 200,
  })

  return NextResponse.json({
    tenant,
    events,
    serverTime: new Date().toISOString(),
  })
}

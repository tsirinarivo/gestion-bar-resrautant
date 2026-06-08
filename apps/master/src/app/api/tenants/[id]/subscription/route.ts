import { NextResponse } from 'next/server'
import { z } from 'zod'
import { masterPrisma } from '@restaurant/master-database'
import { readSession } from '@/lib/auth'
import { setTenantSubscription } from '@/lib/billing'

export const dynamic = 'force-dynamic'

const putSchema = z.object({
  planKey: z.string().min(1),
})

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const sub = await masterPrisma.subscription.findUnique({ where: { tenantId: params.id } })
  return NextResponse.json(sub)
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const tenant = await masterPrisma.tenant.findUnique({ where: { id: params.id } })
  if (!tenant) return NextResponse.json({ error: 'Tenant introuvable' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'planKey requis' }, { status: 400 })
  }

  try {
    const sub = await setTenantSubscription(params.id, parsed.data.planKey, session.uid)
    return NextResponse.json(sub)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}

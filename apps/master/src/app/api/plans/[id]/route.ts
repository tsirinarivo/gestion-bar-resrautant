import { NextResponse } from 'next/server'
import { z } from 'zod'
import { masterPrisma } from '@restaurant/master-database'
import { readSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  amountMga: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (session.role !== 'OWNER') {
    return NextResponse.json({ error: 'Seul un OWNER peut gérer les plans' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
  }

  const plan = await masterPrisma.plan.update({ where: { id: params.id }, data: parsed.data })
  return NextResponse.json(plan)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (session.role !== 'OWNER') {
    return NextResponse.json({ error: 'Seul un OWNER peut gérer les plans' }, { status: 403 })
  }

  const plan = await masterPrisma.plan.findUnique({ where: { id: params.id } })
  if (!plan) return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 })

  const inUse = await masterPrisma.subscription.count({ where: { plan: plan.key } })
  if (inUse > 0) {
    return NextResponse.json(
      { error: `Plan utilisé par ${inUse} abonnement(s) — désactivez-le plutôt que de le supprimer` },
      { status: 400 }
    )
  }

  await masterPrisma.plan.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

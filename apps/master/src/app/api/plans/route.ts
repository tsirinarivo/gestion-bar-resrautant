import { NextResponse } from 'next/server'
import { z } from 'zod'
import { masterPrisma } from '@restaurant/master-database'
import { readSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/),
  name: z.string().min(2),
  amountMga: z.number().int().min(0),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export async function GET() {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const plans = await masterPrisma.plan.findMany({
    orderBy: [{ sortOrder: 'asc' }, { amountMga: 'asc' }],
  })
  return NextResponse.json(plans)
}

export async function POST(req: Request) {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (session.role !== 'OWNER') {
    return NextResponse.json({ error: 'Seul un OWNER peut gérer les plans' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const plan = await masterPrisma.plan.create({ data: parsed.data })
    return NextResponse.json(plan, { status: 201 })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'Cette clé de plan existe déjà' }, { status: 400 })
    }
    throw err
  }
}

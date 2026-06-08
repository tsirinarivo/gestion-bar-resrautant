import { NextResponse } from 'next/server'
import { z } from 'zod'
import { readSession } from '@/lib/auth'
import { getGraceDays, setGraceDays } from '@/lib/billing'

export const dynamic = 'force-dynamic'

const putSchema = z.object({
  gracePeriodDays: z.number().int().min(0).max(90),
})

export async function GET() {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  return NextResponse.json({ gracePeriodDays: await getGraceDays() })
}

export async function PUT(req: Request) {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (session.role !== 'OWNER') {
    return NextResponse.json({ error: 'Seul un OWNER peut modifier la facturation' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Valeur invalide (0-90 jours)' }, { status: 400 })
  }

  await setGraceDays(parsed.data.gracePeriodDays, session.uid)
  return NextResponse.json({ gracePeriodDays: parsed.data.gracePeriodDays })
}

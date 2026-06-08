import { NextResponse } from 'next/server'
import { readSession } from '@/lib/auth'
import { runBillingCycle } from '@/lib/billing'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const res = await runBillingCycle()
  return NextResponse.json(res)
}

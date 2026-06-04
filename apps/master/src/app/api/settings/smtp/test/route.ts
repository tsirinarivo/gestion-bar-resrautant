import { NextResponse } from 'next/server'
import { z } from 'zod'
import { readSession } from '@/lib/auth'
import { sendTestEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const parsed = z.object({ to: z.string().email() }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Email destinataire invalide' }, { status: 400 })
  }

  const result = await sendTestEmail(parsed.data.to)
  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Échec envoi' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

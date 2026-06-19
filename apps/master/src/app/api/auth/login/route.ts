import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { masterPrisma } from '@restaurant/master-database'
import { setSessionCookie, signSession } from '@/lib/auth'

const schema = z.object({
  email: z.string().email().transform(s => s.trim().toLowerCase()),
  password: z.string().min(6),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
  }

  const user = await masterPrisma.masterUser.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  })
  if (!user || !user.active) {
    return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 })
  }

  const ok = await bcrypt.compare(parsed.data.password, user.password)
  if (!ok) {
    return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 })
  }

  await masterPrisma.masterUser.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  })

  const token = signSession({
    uid: user.id,
    email: user.email,
    role: user.role as 'OWNER' | 'SUPPORT',
  })
  setSessionCookie(token)

  return NextResponse.json({ ok: true })
}

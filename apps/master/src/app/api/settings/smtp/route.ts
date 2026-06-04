import { NextResponse } from 'next/server'
import { z } from 'zod'
import { masterPrisma } from '@restaurant/master-database'
import { readSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const PASSWORD_PLACEHOLDER = '__UNCHANGED__'

const smtpSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  user: z.string().min(1),
  pass: z.string().min(1),
  from: z.string().email(),
  secure: z.boolean().optional(),
})

export async function GET() {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (session.role !== 'OWNER') {
    return NextResponse.json({ error: 'Seul un OWNER peut voir la config SMTP' }, { status: 403 })
  }

  const row = await masterPrisma.masterSetting.findUnique({ where: { key: 'smtp' } })
  if (!row?.value) {
    return NextResponse.json({ configured: false, source: 'none', config: null })
  }
  const v = row.value as any
  // On NE renvoie JAMAIS le password en clair. On envoie un placeholder
  // qui indique au client qu'il y a un mot de passe mais ne le révèle pas.
  return NextResponse.json({
    configured: true,
    source: 'db',
    config: {
      host: v.host,
      port: v.port,
      user: v.user,
      pass: PASSWORD_PLACEHOLDER,
      from: v.from,
      secure: v.secure ?? false,
    },
    updatedAt: row.updatedAt,
  })
}

export async function PUT(req: Request) {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (session.role !== 'OWNER') {
    return NextResponse.json({ error: 'Seul un OWNER peut modifier la config SMTP' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = smtpSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // Si le client envoie le placeholder pour pass, c'est qu'il n'a pas modifié
  // le champ → on garde l'ancien password sans le faire transiter
  let finalPass = parsed.data.pass
  if (finalPass === PASSWORD_PLACEHOLDER) {
    const existing = await masterPrisma.masterSetting.findUnique({ where: { key: 'smtp' } })
    finalPass = (existing?.value as any)?.pass
    if (!finalPass) {
      return NextResponse.json({ error: 'Mot de passe requis pour la 1re config' }, { status: 400 })
    }
  }

  await masterPrisma.masterSetting.upsert({
    where: { key: 'smtp' },
    create: {
      key: 'smtp',
      value: { ...parsed.data, pass: finalPass },
      updatedBy: session.uid,
    },
    update: {
      value: { ...parsed.data, pass: finalPass },
      updatedBy: session.uid,
    },
  })

  return NextResponse.json({ ok: true })
}

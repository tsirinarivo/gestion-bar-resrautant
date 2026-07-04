import { NextResponse } from 'next/server'
import { masterPrisma } from '@restaurant/master-database'
import { readSession } from '@/lib/auth'
import { runSeedDemoScript } from '@/lib/provisioning'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const tenant = await masterPrisma.tenant.findUnique({ where: { id: params.id } })
  if (!tenant) return NextResponse.json({ error: 'Tenant introuvable' }, { status: 404 })

  const result = await runSeedDemoScript({ slug: tenant.slug, dbName: tenant.dbName })

  await masterPrisma.tenantEvent.create({
    data: {
      tenantId: tenant.id,
      userId: session.uid,
      type: result.ok ? 'DEMO_SEEDED' : 'DEMO_SEED_FAILED',
      details: result.ok
        ? 'Données démo chargées depuis la console master'
        : `Échec seed démo : ${(result.stderr || '').slice(-500)}`,
    },
  }).catch(() => { /* non bloquant */ })

  if (!result.ok) {
    return NextResponse.json({ error: 'Le chargement des données démo a échoué', detail: result.stderr.slice(-1000) }, { status: 500 })
  }

  await masterPrisma.tenant.update({ where: { id: tenant.id }, data: { seededWithDemo: true } }).catch(() => {})

  return NextResponse.json({ ok: true })
}

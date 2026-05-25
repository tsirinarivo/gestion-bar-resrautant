import { NextResponse } from 'next/server'
import { masterPrisma } from '@restaurant/master-database'
import { readSession } from '@/lib/auth'
import { runDeletionScript } from '@/lib/provisioning'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (session.role !== 'OWNER') {
    return NextResponse.json({ error: 'Seuls les OWNER peuvent supprimer un tenant' }, { status: 403 })
  }

  const tenant = await masterPrisma.tenant.findUnique({ where: { id: params.id } })
  if (!tenant) return NextResponse.json({ error: 'Tenant introuvable' }, { status: 404 })

  const result = await runDeletionScript(tenant)

  if (!result.ok) {
    await masterPrisma.tenantEvent.create({
      data: {
        tenantId: tenant.id,
        userId: session.uid,
        type: 'DELETION_FAILED',
        details: result.stderr.slice(-2000),
      },
    })
    return NextResponse.json(
      {
        error: 'Suppression échouée — voir les logs',
        logs: (result.stdout + '\n' + result.stderr).slice(-4000),
      },
      { status: 500 }
    )
  }

  // Le script a réussi → supprime le tenant + ses events (cascade Prisma)
  await masterPrisma.tenantEvent.deleteMany({ where: { tenantId: tenant.id } })
  await masterPrisma.tenant.delete({ where: { id: tenant.id } })

  return NextResponse.json({
    ok: true,
    slug: tenant.slug,
    logs: (result.stdout + '\n' + result.stderr).slice(-4000),
  })
}

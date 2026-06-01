import { NextResponse } from 'next/server'
import { z } from 'zod'
import { masterPrisma, TenantStatus } from '@restaurant/master-database'
import { readSession } from '@/lib/auth'
import { runDeletionScript } from '@/lib/provisioning'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  action: z.enum(['suspend', 'resume']),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Action invalide (suspend|resume)' }, { status: 400 })
  }

  const tenant = await masterPrisma.tenant.findUnique({ where: { id: params.id } })
  if (!tenant) return NextResponse.json({ error: 'Tenant introuvable' }, { status: 404 })

  const newStatus = parsed.data.action === 'suspend' ? TenantStatus.SUSPENDED : TenantStatus.ACTIVE
  const updated = await masterPrisma.tenant.update({
    where: { id: tenant.id },
    data: {
      status: newStatus,
      suspendedAt: parsed.data.action === 'suspend' ? new Date() : null,
    },
  })

  await masterPrisma.tenantEvent.create({
    data: {
      tenantId: tenant.id,
      userId: session.uid,
      type: parsed.data.action === 'suspend' ? 'SUSPENDED' : 'RESUMED',
      details: `Action ${parsed.data.action} par ${session.email ?? session.uid}`,
    },
  })

  return NextResponse.json({ id: updated.id, slug: updated.slug, status: updated.status })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (session.role !== 'OWNER') {
    return NextResponse.json({ error: 'Seuls les OWNER peuvent supprimer un tenant' }, { status: 403 })
  }

  const tenant = await masterPrisma.tenant.findUnique({ where: { id: params.id } })
  if (!tenant) return NextResponse.json({ error: 'Tenant introuvable' }, { status: 404 })

  // 2FA confirmation : le client doit envoyer le slug exact dans le body pour
  // confirmer la suppression. Évite les clics accidentels (DB tenant détruite).
  const body = await req.json().catch(() => ({})) as { confirmSlug?: string }
  if (body.confirmSlug !== tenant.slug) {
    return NextResponse.json(
      { error: `Tapez exactement le slug "${tenant.slug}" pour confirmer` },
      { status: 400 }
    )
  }

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

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { masterPrisma, TenantStatus } from '@restaurant/master-database'
import { readSession } from '@/lib/auth'
import { createTenantRecord, runProvisioningScript } from '@/lib/provisioning'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  slug: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/),
  name: z.string().min(2),
  contactName: z.string().optional(),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  adminFirstName: z.string().min(1),
  adminLastName: z.string().min(1),
})

export async function GET() {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const tenants = await masterPrisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(tenants)
}

export async function POST(req: Request) {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  let tenant
  try {
    tenant = await createTenantRecord(parsed.data)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  await masterPrisma.tenantEvent.create({
    data: {
      tenantId: tenant.id,
      userId: session.uid,
      type: 'CREATED',
      details: `Slug=${tenant.slug}, ports=${tenant.apiPort}-${tenant.clientPort}`,
    },
  })

  const result = await runProvisioningScript(
    tenant,
    parsed.data.adminEmail,
    parsed.data.adminPassword,
    parsed.data.adminFirstName,
    parsed.data.adminLastName
  )

  if (!result.ok) {
    await masterPrisma.tenant.update({
      where: { id: tenant.id },
      data: { status: TenantStatus.ERROR },
    })
    await masterPrisma.tenantEvent.create({
      data: {
        tenantId: tenant.id,
        userId: session.uid,
        type: 'PROVISION_FAILED',
        details: result.stderr.slice(-2000),
      },
    })
    return NextResponse.json(
      {
        error: 'Provisioning échoué — voir les logs',
        logs: (result.stdout + '\n' + result.stderr).slice(-4000),
      },
      { status: 500 }
    )
  }

  const updated = await masterPrisma.tenant.update({
    where: { id: tenant.id },
    data: {
      status: TenantStatus.ACTIVE,
      provisionedAt: new Date(),
      lastDeployedAt: new Date(),
    },
  })

  await masterPrisma.tenantEvent.create({
    data: {
      tenantId: tenant.id,
      userId: session.uid,
      type: 'PROVISIONED',
      details: `Admin ${parsed.data.adminEmail} créé`,
    },
  })

  return NextResponse.json({
    id: updated.id,
    slug: updated.slug,
    name: updated.name,
    subdomain: updated.subdomain,
    apiPort: updated.apiPort,
    status: updated.status,
    adminEmail: parsed.data.adminEmail,
    adminPasswordSent: false,
    logs: (result.stdout + '\n' + result.stderr).slice(-4000),
  })
}

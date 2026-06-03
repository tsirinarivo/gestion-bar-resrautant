import { NextResponse } from 'next/server'
import { z } from 'zod'
import { masterPrisma } from '@restaurant/master-database'
import { readSession } from '@/lib/auth'
import { createTenantRecord, runProvisioningScriptAsync } from '@/lib/provisioning'

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

  // Fire-and-forget : le provisioning prend 5-10 min, on ne peut pas attendre
  // dans le handler HTTP (nginx/CDN ferment vers 60s). On retourne immédiatement
  // 202 Accepted + le tenantId. L'UI poll /api/tenants/:id/events pour le live
  // log et /api/tenants/:id pour le statut final (ACTIVE | ERROR).
  runProvisioningScriptAsync(
    tenant,
    session.uid,
    parsed.data.adminEmail,
    parsed.data.adminPassword,
    parsed.data.adminFirstName,
    parsed.data.adminLastName,
  )

  return NextResponse.json(
    {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      subdomain: tenant.subdomain,
      apiPort: tenant.apiPort,
      status: tenant.status, // PROVISIONING
      adminEmail: parsed.data.adminEmail,
      adminPasswordSent: false,
    },
    { status: 202 }
  )
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { masterPrisma, TenantStatus } from '@restaurant/master-database'
import { createTenantRecord, runProvisioningScriptAsync } from '@/lib/provisioning'

export const dynamic = 'force-dynamic'

const schema = z.object({
  restaurantName: z.string().min(2).max(80),
  contactName: z.string().max(80).optional().default(''),
  email: z.string().email(),
  phone: z.string().max(40).optional().default(''),
  password: z.string().min(8).max(200),
  seedDemo: z.boolean().optional().default(true),
  plan: z.enum(['trial', 'starter', 'pro', 'groupe', 'enterprise']).optional().default('trial'),
})

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28)
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base || 'restaurant'
  if (!/^[a-z]/.test(candidate)) candidate = 'r-' + candidate
  for (let i = 0; i < 50; i++) {
    const suffix = i === 0 ? '' : '-' + i
    const slug = (candidate + suffix).slice(0, 31)
    const exists = await masterPrisma.tenant.findUnique({ where: { slug } })
    if (!exists) return slug
  }
  throw new Error('Impossible de générer un slug unique')
}

function splitName(full: string, fallbackEmail: string): { first: string; last: string } {
  const trimmed = full.trim()
  if (!trimmed) {
    const local = fallbackEmail.split('@')[0] || 'Admin'
    return { first: local, last: 'Principal' }
  }
  const parts = trimmed.split(/\s+/)
  const first = parts[0] || 'Admin'
  const last = parts.length > 1 ? parts.slice(1).join(' ') : 'Principal'
  return { first, last }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const data = parsed.data

  const existingByEmail = await masterPrisma.tenant.findFirst({
    where: { contactEmail: data.email },
  })
  if (existingByEmail) {
    return NextResponse.json(
      { error: 'Un compte existe déjà avec cet email. Connectez-vous ou utilisez un autre email.' },
      { status: 409 },
    )
  }

  const slugBase = slugify(data.restaurantName)
  const slug = await uniqueSlug(slugBase)
  const { first, last } = splitName(data.contactName, data.email)

  let tenant
  try {
    tenant = await createTenantRecord({
      slug,
      name: data.restaurantName,
      contactName: data.contactName || undefined,
      contactEmail: data.email,
      contactPhone: data.phone || undefined,
      notes: 'Self-service signup',
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  await masterPrisma.tenant.update({
    where: { id: tenant.id },
    data: {
      signupSource: 'self-service',
      seededWithDemo: data.seedDemo,
      subscriptionPlan: data.plan,
      subscriptionStatus: 'TRIAL',
      trialEndsAt,
    },
  })

  await masterPrisma.tenantEvent.create({
    data: {
      tenantId: tenant.id,
      type: 'CREATED',
      details: `Self-service signup · plan=${data.plan} · seedDemo=${data.seedDemo} · trial→${trialEndsAt.toISOString()}`,
    },
  }).catch(() => {})

  runProvisioningScriptAsync(tenant, null, data.email, data.password, first, last)

  return NextResponse.json(
    {
      ok: true,
      slug: tenant.slug,
      subdomain: tenant.subdomain,
      adminUrl: `https://admin-${tenant.subdomain}.sakafio.mg`,
      status: TenantStatus.PROVISIONING,
      trialEndsAt: trialEndsAt.toISOString(),
      message: 'Votre instance se prépare. Vous recevrez vos identifiants par email dans quelques minutes.',
    },
    { status: 202 },
  )
}

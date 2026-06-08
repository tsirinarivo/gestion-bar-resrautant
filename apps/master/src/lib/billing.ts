import { masterPrisma } from '@restaurant/master-database'
import { addMonths } from 'date-fns'

const DEFAULT_GRACE_DAYS = 7

export async function getGraceDays(): Promise<number> {
  const row = await masterPrisma.masterSetting.findUnique({ where: { key: 'billing' } })
  const v = row?.value as { gracePeriodDays?: number } | undefined
  const g = v?.gracePeriodDays
  return typeof g === 'number' && g > 0 ? g : DEFAULT_GRACE_DAYS
}

export async function setGraceDays(days: number, userId: string): Promise<void> {
  await masterPrisma.masterSetting.upsert({
    where: { key: 'billing' },
    create: { key: 'billing', value: { gracePeriodDays: days }, updatedBy: userId },
    update: { value: { gracePeriodDays: days }, updatedBy: userId },
  })
}

async function nextInvoiceNumber(date: Date): Promise<string> {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const prefix = `F-${y}${m}-`
  const count = await masterPrisma.invoice.count({ where: { number: { startsWith: prefix } } })
  return `${prefix}${String(count + 1).padStart(4, '0')}`
}

export type BillingResult = {
  generated: number
  markedOverdue: number
  suspended: number
}

/**
 * Cycle de facturation. Idempotent — peut tourner plusieurs fois par jour sans
 * dupliquer de factures (garde par period). Décision MT-2 : suspension SOFT
 * (flag DB status=SUSPENDED) uniquement, on ne coupe PAS la stack Docker du
 * tenant automatiquement (protège le tenant prod d'un bug de facturation).
 */
export async function runBillingCycle(now = new Date()): Promise<BillingResult> {
  const grace = await getGraceDays()
  let generated = 0
  let markedOverdue = 0
  let suspended = 0

  const dueSubs = await masterPrisma.subscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'PAST_DUE'] },
      nextDueDate: { lte: now },
      amountMga: { gt: 0 },
    },
  })
  for (const sub of dueSubs) {
    const periodFrom = sub.nextDueDate
    const periodTo = addMonths(periodFrom, 1)
    const exists = await masterPrisma.invoice.findFirst({
      where: { tenantId: sub.tenantId, periodFrom },
    })
    if (!exists) {
      const number = await nextInvoiceNumber(now)
      await masterPrisma.invoice.create({
        data: {
          tenantId: sub.tenantId,
          number,
          amountMga: sub.amountMga,
          status: 'PENDING',
          periodFrom,
          periodTo,
          dueDate: periodFrom,
        },
      })
      await masterPrisma.tenantEvent.create({
        data: {
          tenantId: sub.tenantId,
          type: 'INVOICE_GENERATED',
          details: `Facture ${number} — ${sub.amountMga} MGA (période ${periodFrom.toLocaleDateString('fr-FR')})`,
        },
      }).catch(() => {})
      generated++
    }
    await masterPrisma.subscription.update({
      where: { id: sub.id },
      data: { nextDueDate: periodTo },
    })
  }

  const toOverdue = await masterPrisma.invoice.findMany({
    where: { status: 'PENDING', dueDate: { lt: now } },
    select: { id: true, tenantId: true },
  })
  for (const inv of toOverdue) {
    await masterPrisma.invoice.update({ where: { id: inv.id }, data: { status: 'OVERDUE' } })
    await masterPrisma.subscription.updateMany({
      where: { tenantId: inv.tenantId, status: 'ACTIVE' },
      data: { status: 'PAST_DUE' },
    })
    markedOverdue++
  }

  const cutoff = new Date(now.getTime() - grace * 86_400_000)
  const toSuspend = await masterPrisma.invoice.findMany({
    where: { status: 'OVERDUE', dueDate: { lt: cutoff } },
    include: { tenant: true },
  })
  for (const inv of toSuspend) {
    if (inv.tenant.status !== 'ACTIVE') continue
    await masterPrisma.tenant.update({
      where: { id: inv.tenantId },
      data: { status: 'SUSPENDED', suspendedAt: now, suspendReason: `Facture impayée ${inv.number}` },
    })
    await masterPrisma.tenantEvent.create({
      data: {
        tenantId: inv.tenantId,
        type: 'AUTO_SUSPENDED',
        details: `Suspension auto — facture ${inv.number} impayée depuis > ${grace}j (flag DB, stack Docker non coupée)`,
      },
    }).catch(() => {})
    suspended++
  }

  return { generated, markedOverdue, suspended }
}

export async function markInvoicePaid(invoiceId: string, method: string | undefined, userId: string) {
  const inv = await masterPrisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { tenant: true },
  })
  if (!inv) throw new Error('Facture introuvable')
  if (inv.status === 'PAID') return inv
  if (inv.status === 'CANCELED') throw new Error('Facture annulée — impossible de la marquer payée')

  await masterPrisma.invoice.update({
    where: { id: inv.id },
    data: { status: 'PAID', paidAt: new Date(), paidMethod: method ?? null },
  })

  const stillDue = await masterPrisma.invoice.count({
    where: { tenantId: inv.tenantId, status: { in: ['PENDING', 'OVERDUE'] } },
  })
  if (stillDue === 0) {
    await masterPrisma.subscription.updateMany({
      where: { tenantId: inv.tenantId },
      data: { status: 'ACTIVE' },
    })
    if (
      inv.tenant.status === 'SUSPENDED' &&
      (inv.tenant.suspendReason ?? '').toLowerCase().includes('impay')
    ) {
      await masterPrisma.tenant.update({
        where: { id: inv.tenantId },
        data: { status: 'ACTIVE', suspendedAt: null, suspendReason: null },
      })
      await masterPrisma.tenantEvent.create({
        data: {
          tenantId: inv.tenantId,
          userId,
          type: 'REACTIVATED',
          details: `Réactivation auto après paiement facture ${inv.number}`,
        },
      }).catch(() => {})
    }
  }

  await masterPrisma.tenantEvent.create({
    data: {
      tenantId: inv.tenantId,
      userId,
      type: 'INVOICE_PAID',
      details: `Facture ${inv.number} marquée payée${method ? ` (${method})` : ''}`,
    },
  }).catch(() => {})

  return masterPrisma.invoice.findUnique({ where: { id: inv.id } })
}

export async function setTenantSubscription(tenantId: string, planKey: string, userId: string) {
  const plan = await masterPrisma.plan.findUnique({ where: { key: planKey } })
  if (!plan) throw new Error('Plan introuvable')
  const now = new Date()
  const sub = await masterPrisma.subscription.upsert({
    where: { tenantId },
    create: {
      tenantId,
      plan: plan.key,
      amountMga: plan.amountMga,
      status: 'ACTIVE',
      startedAt: now,
      nextDueDate: addMonths(now, 1),
    },
    update: { plan: plan.key, amountMga: plan.amountMga },
  })
  await masterPrisma.tenantEvent.create({
    data: {
      tenantId,
      userId,
      type: 'SUBSCRIPTION_SET',
      details: `Plan ${plan.name} (${plan.amountMga} MGA/mois)`,
    },
  }).catch(() => {})
  return sub
}

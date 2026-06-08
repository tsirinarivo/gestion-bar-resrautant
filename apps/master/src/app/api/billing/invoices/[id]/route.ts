import { NextResponse } from 'next/server'
import { z } from 'zod'
import { masterPrisma } from '@restaurant/master-database'
import { readSession } from '@/lib/auth'
import { markInvoicePaid } from '@/lib/billing'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  action: z.enum(['pay', 'cancel']),
  method: z.string().optional(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Action invalide (pay|cancel)' }, { status: 400 })
  }

  if (parsed.data.action === 'pay') {
    try {
      const inv = await markInvoicePaid(params.id, parsed.data.method, session.uid)
      return NextResponse.json(inv)
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 })
    }
  }

  const inv = await masterPrisma.invoice.findUnique({ where: { id: params.id } })
  if (!inv) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
  if (inv.status === 'PAID') {
    return NextResponse.json({ error: 'Facture déjà payée — impossible de l\'annuler' }, { status: 400 })
  }
  const updated = await masterPrisma.invoice.update({
    where: { id: params.id },
    data: { status: 'CANCELED' },
  })
  await masterPrisma.tenantEvent.create({
    data: { tenantId: inv.tenantId, userId: session.uid, type: 'INVOICE_CANCELED', details: `Facture ${inv.number} annulée` },
  }).catch(() => {})
  return NextResponse.json(updated)
}

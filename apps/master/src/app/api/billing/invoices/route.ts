import { NextResponse } from 'next/server'
import { masterPrisma, InvoiceStatus } from '@restaurant/master-database'
import { readSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = readSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const tenantId = searchParams.get('tenantId')

  const where: { status?: InvoiceStatus; tenantId?: string } = {}
  if (status && status in InvoiceStatus) where.status = status as InvoiceStatus
  if (tenantId) where.tenantId = tenantId

  const invoices = await masterPrisma.invoice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { tenant: { select: { slug: true, name: true } } },
  })
  return NextResponse.json(invoices)
}

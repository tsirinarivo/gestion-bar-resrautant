import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const invoiceRouter = Router()
invoiceRouter.use(authenticate)

function generateInvoiceNumber(seq: number) {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `FAC-${y}${m}-${String(seq).padStart(4, '0')}`
}

// GET /api/invoices
invoiceRouter.get('/', authorize('manager', 'superadmin', 'caissier'), async (req: AuthRequest, res, next) => {
  try {
    const { status, from, to, search } = req.query as Record<string, string>
    const restaurantId = req.user!.restaurantId

    const where: Record<string, unknown> = { payment: { order: { restaurantId } } }
    if (status) where.status = status
    if (from || to) {
      where.issueDate = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to + 'T23:59:59') } : {}),
      }
    }
    if (search) where.invoiceNumber = { contains: search, mode: 'insensitive' }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        payment: {
          select: {
            id: true,
            amount: true,
            method: true,
            order: {
              select: {
                id: true,
                orderNumber: true,
                customer: { select: { firstName: true, lastName: true, email: true } },
              },
            },
          },
        },
        items: true,
      },
      orderBy: { issueDate: 'desc' },
      take: 200,
    })

    res.json({ success: true, data: invoices })
  } catch (error) { next(error) }
})

// GET /api/invoices/stats
invoiceRouter.get('/stats', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [total, paid, sent, draft, monthAmount] = await Promise.all([
      prisma.invoice.count({ where: { payment: { order: { restaurantId } } } }),
      prisma.invoice.count({ where: { payment: { order: { restaurantId } }, status: 'PAID' } }),
      prisma.invoice.count({ where: { payment: { order: { restaurantId } }, status: 'SENT' } }),
      prisma.invoice.count({ where: { payment: { order: { restaurantId } }, status: 'DRAFT' } }),
      prisma.invoice.aggregate({
        where: { payment: { order: { restaurantId } }, status: 'PAID', issueDate: { gte: firstOfMonth } },
        _sum: { totalTTC: true },
      }),
    ])

    res.json({
      success: true,
      data: { total, paid, sent, draft, monthAmount: monthAmount._sum.totalTTC ?? 0 },
    })
  } catch (error) { next(error) }
})

// POST /api/invoices — Generate invoice from a payment or manually
invoiceRouter.post('/', authorize('manager', 'superadmin', 'caissier'), async (req: AuthRequest, res, next) => {
  try {
    const { paymentId, notes } = z.object({
      paymentId: z.string(),
      notes: z.string().optional(),
    }).parse(req.body)

    const restaurantId = req.user!.restaurantId

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, order: { restaurantId } },
      include: {
        order: {
          include: {
            items: {
              include: { product: { select: { name: true, taxRate: true, price: true } } },
            },
          },
        },
      },
    })
    if (!payment) throw new AppError('Paiement introuvable', 404)

    // Check if invoice already exists for this payment
    const existing = await prisma.invoice.findFirst({ where: { paymentId } })
    if (existing) throw new AppError('Une facture existe déjà pour ce paiement', 409)

    // Determine sequence number for current month
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const count = await prisma.invoice.count({ where: { issueDate: { gte: startOfMonth }, payment: { order: { restaurantId } } } })
    const invoiceNumber = generateInvoiceNumber(count + 1)

    // Build invoice items from order items
    const orderItems = payment.order.items
    const invoiceItems = orderItems.map(item => {
      const taxRate = item.product?.taxRate ?? 0
      const unitPriceHT = (item.unitPrice ?? 0) / (1 + taxRate / 100)
      const totalHT = unitPriceHT * item.quantity
      const totalTTC = (item.unitPrice ?? 0) * item.quantity
      return {
        description: item.product?.name ?? 'Article',
        quantity: item.quantity,
        unitPrice: unitPriceHT,
        taxRate,
        totalHT,
        totalTTC,
      }
    })

    const totalHT = invoiceItems.reduce((s, i) => s + i.totalHT, 0)
    const totalTTC = invoiceItems.reduce((s, i) => s + i.totalTTC, 0)
    const totalTax = totalTTC - totalHT

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        totalHT,
        totalTax,
        totalTTC,
        status: 'DRAFT',
        notes: notes || null,
        paymentId,
        items: { create: invoiceItems },
      },
      include: { items: true },
    })

    res.status(201).json({ success: true, data: invoice })
  } catch (error) { next(error) }
})

// GET /api/invoices/:id
invoiceRouter.get('/:id', authorize('manager', 'superadmin', 'caissier'), async (req: AuthRequest, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, payment: { order: { restaurantId } } },
      include: {
        items: true,
        payment: {
          include: {
            order: {
              include: {
                customer: { select: { firstName: true, lastName: true, email: true, phone: true } },
                table: { select: { name: true } },
              },
            },
          },
        },
      },
    })
    if (!invoice) throw new AppError('Facture introuvable', 404)
    res.json({ success: true, data: invoice })
  } catch (error) { next(error) }
})

// PATCH /api/invoices/:id/status
invoiceRouter.patch('/:id/status', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const { status } = z.object({
      status: z.enum(['DRAFT', 'SENT', 'PAID', 'CANCELLED']),
    }).parse(req.body)

    const restaurantId = req.user!.restaurantId
    const existing = await prisma.invoice.findFirst({
      where: { id: req.params.id, payment: { order: { restaurantId } } },
    })
    if (!existing) throw new AppError('Facture introuvable', 404)

    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: { status },
    })

    res.json({ success: true, data: invoice })
  } catch (error) { next(error) }
})

// DELETE /api/invoices/:id — only DRAFT can be deleted
invoiceRouter.delete('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId
    const existing = await prisma.invoice.findFirst({
      where: { id: req.params.id, payment: { order: { restaurantId } } },
    })
    if (!existing) throw new AppError('Facture introuvable', 404)
    if (existing.status !== 'DRAFT') throw new AppError('Seules les factures BROUILLON peuvent être supprimées', 400)

    await prisma.invoice.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (error) { next(error) }
})

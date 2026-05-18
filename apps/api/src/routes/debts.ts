import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const debtRouter = Router()
debtRouter.use(authenticate)

const PAYMENT_METHODS = ['CASH', 'MVOLA', 'ORANGE_MONEY', 'AIRTEL_MONEY', 'CARD',
  'BNI_MOBILE', 'BOA_MOBILE', 'VIREMENT', 'CHEQUE', 'VOUCHER', 'WALLET'] as const

// GET /api/debts
debtRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { status, customerId } = req.query
    const where: any = { restaurantId: req.user!.restaurantId }
    if (status) where.status = status
    if (customerId) where.customerId = customerId

    const debts = await prisma.customerDebt.findMany({
      where,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: debts })
  } catch (error) { next(error) }
})

// GET /api/debts/stats
debtRouter.get('/stats', async (req: AuthRequest, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId
    const [pending, partial, paid] = await Promise.all([
      prisma.customerDebt.aggregate({
        where: { restaurantId, status: 'PENDING' },
        _sum: { amount: true }, _count: true,
      }),
      prisma.customerDebt.aggregate({
        where: { restaurantId, status: 'PARTIAL' },
        _sum: { amount: true, paidAmount: true }, _count: true,
      }),
      prisma.customerDebt.aggregate({
        where: { restaurantId, status: 'PAID' },
        _sum: { amount: true }, _count: true,
      }),
    ])

    const totalOutstanding =
      (pending._sum.amount ?? 0) +
      ((partial._sum.amount ?? 0) - (partial._sum.paidAmount ?? 0))

    const debtors = await prisma.customerDebt.groupBy({
      by: ['customerId'],
      where: { restaurantId, status: { in: ['PENDING', 'PARTIAL'] } },
    })

    res.json({
      success: true,
      data: {
        totalOutstanding,
        pendingCount: pending._count,
        partialCount: partial._count,
        paidCount: paid._count,
        debtorCount: debtors.length,
      },
    })
  } catch (error) { next(error) }
})

// POST /api/debts
debtRouter.post('/', authorize('manager', 'superadmin', 'caissier'), async (req: AuthRequest, res, next) => {
  try {
    const data = z.object({
      customerId: z.string(),
      amount: z.number().positive(),
      dueDate: z.string().optional(),
      notes: z.string().optional(),
      orderRef: z.string().optional(),
    }).parse(req.body)

    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, restaurantId: req.user!.restaurantId },
    })
    if (!customer) throw new AppError('Client introuvable', 404)

    const debt = await prisma.customerDebt.create({
      data: {
        customerId: data.customerId,
        restaurantId: req.user!.restaurantId,
        amount: data.amount,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        notes: data.notes,
        orderRef: data.orderRef,
      },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        payments: true,
      },
    })
    res.status(201).json({ success: true, data: debt })
  } catch (error) { next(error) }
})

// POST /api/debts/:id/pay
debtRouter.post('/:id/pay', authorize('manager', 'superadmin', 'caissier'), async (req: AuthRequest, res, next) => {
  try {
    const { amount, method, notes } = z.object({
      amount: z.number().positive(),
      method: z.enum(PAYMENT_METHODS).default('CASH'),
      notes: z.string().optional(),
    }).parse(req.body)

    const debt = await prisma.customerDebt.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!debt) throw new AppError('Dette introuvable', 404)
    if (debt.status === 'PAID') throw new AppError('Cette dette est déjà soldée', 400)
    if (debt.status === 'CANCELLED') throw new AppError('Cette dette est annulée', 400)

    const remaining = debt.amount - debt.paidAmount
    if (amount > remaining + 0.01) {
      throw new AppError(`Montant trop élevé — reste dû : ${remaining} MGA`, 400)
    }

    const newPaid = debt.paidAmount + amount
    const newStatus = newPaid >= debt.amount - 0.01 ? 'PAID' : 'PARTIAL'

    const [, updated] = await prisma.$transaction([
      prisma.debtPayment.create({ data: { debtId: debt.id, amount, method, notes } }),
      prisma.customerDebt.update({
        where: { id: debt.id },
        data: { paidAmount: newPaid, status: newStatus },
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
          payments: { orderBy: { createdAt: 'desc' } },
        },
      }),
    ])
    res.json({ success: true, data: updated })
  } catch (error) { next(error) }
})

// PATCH /api/debts/:id/cancel
debtRouter.patch('/:id/cancel', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const debt = await prisma.customerDebt.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!debt) throw new AppError('Dette introuvable', 404)
    if (['PAID', 'CANCELLED'].includes(debt.status)) {
      throw new AppError('Impossible d\'annuler une dette soldée ou déjà annulée', 400)
    }
    const updated = await prisma.customerDebt.update({
      where: { id: debt.id },
      data: { status: 'CANCELLED' },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        payments: true,
      },
    })
    res.json({ success: true, data: updated })
  } catch (error) { next(error) }
})

// DELETE /api/debts/:id
debtRouter.delete('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const debt = await prisma.customerDebt.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!debt) throw new AppError('Dette introuvable', 404)
    await prisma.customerDebt.delete({ where: { id: debt.id } })
    res.json({ success: true })
  } catch (error) { next(error) }
})

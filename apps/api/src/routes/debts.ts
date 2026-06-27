import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'
import { deductStockForOrder } from './orders'

export const debtRouter = Router()
debtRouter.use(authenticate)

// POST /api/debts/from-order — solder une commande À CRÉDIT (sur le compte du
// client). Crée la dette du montant restant et clôture la commande (stock,
// table) sans encaissement. Le client paiera plus tard via la page Dettes.
debtRouter.post('/from-order', async (req: AuthRequest, res, next) => {
  try {
    const { orderId, customerId, dueDate, notes } = z.object({
      orderId: z.string(),
      customerId: z.string(),
      dueDate: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body)
    const restaurantId = req.user!.restaurantId

    const customer = await prisma.customer.findFirst({ where: { id: customerId, restaurantId } })
    if (!customer) throw new AppError('Client introuvable', 404)

    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      include: { payments: { where: { status: 'COMPLETED' } } },
    })
    if (!order) throw new AppError('Commande introuvable', 404)
    if (order.status === 'CANCELLED') throw new AppError('Commande annulée', 400)

    const paid = order.payments.reduce((s, p) => s + p.amount, 0)
    const outstanding = Math.max(0, order.totalAmount - paid)
    if (outstanding <= 0) throw new AppError('Cette commande est déjà soldée', 400)

    const debt = await prisma.customerDebt.create({
      data: {
        customerId, restaurantId,
        amount: outstanding,
        orderRef: order.orderNumber,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        notes: notes ?? `Commande ${order.orderNumber} à crédit`,
      },
      include: { customer: { select: { id: true, firstName: true, lastName: true, phone: true } }, payments: true },
    })

    if (order.status !== 'COMPLETED') {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          customerId,
          statusHistory: { create: { status: 'COMPLETED', notes: 'Soldé à crédit', changedBy: req.user!.id } },
        },
      })
      await deductStockForOrder(order.id, order.orderNumber, req.user!.id).catch(() => {})
      if (order.tableId) {
        const active = await prisma.order.count({ where: { tableId: order.tableId, status: { notIn: ['COMPLETED', 'CANCELLED'] } } })
        if (active === 0) await prisma.diningTable.update({ where: { id: order.tableId }, data: { status: 'AVAILABLE' } }).catch(() => {})
      }
    }

    res.status(201).json({ success: true, data: debt })
  } catch (error) { next(error) }
})

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

    const restaurantId = req.user!.restaurantId
    const debtId = req.params.id

    const updated = await prisma.$transaction(async (tx) => {
      const debt = await tx.customerDebt.findFirst({
        where: { id: debtId, restaurantId },
      })
      if (!debt) throw new AppError('Dette introuvable', 404)
      if (debt.status === 'PAID') throw new AppError('Cette dette est déjà soldée', 400)
      if (debt.status === 'CANCELLED') throw new AppError('Cette dette est annulée', 400)

      const remaining = debt.amount - debt.paidAmount
      // MGA is integer — tolerate 1 MGA rounding
      if (amount > remaining + 1) {
        throw new AppError(`Montant trop élevé — reste dû : ${Math.round(remaining)} MGA`, 400)
      }

      // Atomique : updateMany conditionnel — ne paie que si paidAmount n'a pas
      // bougé entre le findFirst et l'update (2 paiements concurrents auraient
      // count=0 sur le 2e et on lève une erreur).
      const r = await tx.customerDebt.updateMany({
        where: { id: debt.id, paidAmount: debt.paidAmount },
        data: { paidAmount: { increment: amount } },
      })
      if (r.count === 0) {
        throw new AppError('Paiement concurrent détecté — réessayez', 409)
      }

      const fresh = await tx.customerDebt.findUniqueOrThrow({
        where: { id: debt.id },
        select: { paidAmount: true, amount: true },
      })
      const newStatus = fresh.paidAmount >= fresh.amount - 1 ? 'PAID' : 'PARTIAL'

      await tx.debtPayment.create({ data: { debtId: debt.id, amount, method, notes } })

      return tx.customerDebt.update({
        where: { id: debt.id },
        data: { status: newStatus },
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
          payments: { orderBy: { createdAt: 'desc' } },
        },
      })
    })

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

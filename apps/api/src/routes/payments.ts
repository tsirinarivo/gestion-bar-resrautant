import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const paymentRouter = Router()
paymentRouter.use(authenticate)

paymentRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = z.object({
      orderId: z.string(),
      amount: z.number().positive(),
      method: z.enum(['CASH', 'CARD', 'STRIPE', 'PAYPAL', 'VOUCHER', 'WALLET']),
      reference: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body)

    const order = await prisma.order.findFirst({
      where: { id: data.orderId, restaurantId: req.user!.restaurantId },
    })
    if (!order) throw new AppError('Commande introuvable', 404)

    const payment = await prisma.payment.create({
      data: { ...data, currency: 'MGA', status: 'COMPLETED' },
    })

    const totalPaid = await prisma.payment.aggregate({
      where: { orderId: data.orderId, status: 'COMPLETED' },
      _sum: { amount: true },
    })

    if ((totalPaid._sum.amount || 0) >= order.totalAmount) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })
    }

    res.status(201).json({ success: true, data: payment })
  } catch (error) {
    next(error)
  }
})

paymentRouter.post('/:id/refund', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const { amount, reason } = z.object({
      amount: z.number().positive(),
      reason: z.string().optional(),
    }).parse(req.body)

    const payment = await prisma.payment.findFirst({
      where: { id: req.params.id, order: { restaurantId: req.user!.restaurantId } },
    })
    if (!payment) throw new AppError('Paiement introuvable', 404)
    if (amount > payment.amount) throw new AppError('Le montant du remboursement dépasse le paiement', 400)

    const refund = await prisma.refund.create({
      data: { paymentId: payment.id, amount, reason, status: 'COMPLETED' },
    })

    if (amount === payment.amount) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } })
    } else {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'PARTIAL_REFUND' } })
    }

    res.status(201).json({ success: true, data: refund })
  } catch (error) {
    next(error)
  }
})

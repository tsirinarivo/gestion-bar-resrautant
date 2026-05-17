import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'
import { autoPostPaymentToBank } from './bank'
import { autoPrintSaleReceipt } from '../lib/printer'

async function autoPostToCaisse(
  restaurantId: string,
  type: 'SALE' | 'REFUND',
  amount: number,
  description: string,
  reference: string,
) {
  const session = await prisma.caisseSession.findFirst({
    where: { restaurantId, status: 'OPEN' },
  })
  if (!session) return
  await prisma.caisseTransaction.create({
    data: { sessionId: session.id, restaurantId, type, amount, description, reference },
  })
}

export const paymentRouter = Router()
paymentRouter.use(authenticate)

paymentRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = z.object({
      orderId: z.string(),
      amount: z.number().positive(),
      method: z.enum(['CASH', 'CARD', 'MVOLA', 'ORANGE_MONEY', 'AIRTEL_MONEY', 'BNI_MOBILE', 'BOA_MOBILE', 'VIREMENT', 'CHEQUE', 'VOUCHER', 'WALLET']),
      reference: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body)

    const restaurantId = req.user!.restaurantId
    const order = await prisma.order.findFirst({
      where: { id: data.orderId, restaurantId },
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

      // Libérer la table si plus aucune commande active dessus
      if (order.tableId) {
        const activeOrders = await prisma.order.count({
          where: {
            tableId: order.tableId,
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
            id: { not: order.id },
          },
        })
        if (activeOrders === 0) {
          await prisma.diningTable.update({
            where: { id: order.tableId },
            data: { status: 'AVAILABLE' },
          })
        }
      }

      // Impression automatique du reçu
      const completedOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: {
          items: { include: { product: true } },
          payments: true,
        },
      })
      if (completedOrder) {
        autoPrintSaleReceipt(restaurantId, {
          id:            completedOrder.id,
          code:          completedOrder.orderNumber,
          date:          completedOrder.createdAt,
          shopName:      '',
          shopAddr:      null,
          shopPhone:     null,
          cashierName:   null,
          items:         completedOrder.items.map((i: any) => ({
            name:      i.product?.name ?? 'Article',
            qty:       i.quantity,
            unitPrice: i.unitPrice,
            total:     i.totalPrice,
          })),
          subtotal:      completedOrder.subtotal,
          discount:      completedOrder.discountAmount ?? 0,
          total:         completedOrder.totalAmount,
          paymentMethod: completedOrder.payments[0]?.method ?? null,
          currency:      'MGA',
        }).catch(() => { /* non-bloquant */ })
      }
    }

    // Auto-enregistre dans la session de caisse ouverte
    await autoPostToCaisse(
      restaurantId,
      'SALE',
      data.amount,
      `Paiement commande ${order.orderNumber} (${data.method})`,
      payment.id,
    ).catch(() => { /* non-bloquant */ })

    // Auto-credit the bank account linked to this payment method
    await autoPostPaymentToBank(
      restaurantId,
      data.method,
      data.amount,
      'CREDIT',
      `Paiement commande ${order.orderNumber}`,
      payment.id,
    ).catch(() => { /* non-bloquant */ })

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
      include: { order: { select: { restaurantId: true, orderNumber: true } } },
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

    // Auto-enregistre le remboursement dans la session de caisse ouverte
    await autoPostToCaisse(
      payment.order.restaurantId,
      'REFUND',
      amount,
      `Remboursement commande ${payment.order.orderNumber}${reason ? ` — ${reason}` : ''}`,
      refund.id,
    ).catch(() => { /* non-bloquant */ })

    // Auto-debit the linked bank account for the refund
    await autoPostPaymentToBank(
      payment.order.restaurantId,
      payment.method,
      amount,
      'DEBIT',
      `Remboursement commande ${payment.order.orderNumber}${reason ? ` — ${reason}` : ''}`,
      refund.id,
    ).catch(() => { /* non-bloquant */ })

    res.status(201).json({ success: true, data: refund })
  } catch (error) {
    next(error)
  }
})

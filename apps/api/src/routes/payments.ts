import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'
import { autoPostPaymentToBank } from './bank'
import { autoPrintReceiptWithTable } from '../lib/printer'
import { deductStockForOrder, earnLoyaltyPoints } from './orders'

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Especes', MVOLA: 'MVola', ORANGE_MONEY: 'Orange Money',
  AIRTEL_MONEY: 'Airtel Money', CARD: 'Carte', BNI_MOBILE: 'BNI Mobile',
  BOA_MOBILE: 'BOA Mobile', VIREMENT: 'Virement', CHEQUE: 'Cheque',
  VOUCHER: 'Bon', WALLET: 'Wallet',
}

function formatPaymentLabel(payments: { method: string; amount: number }[]): string {
  return payments
    .map(p => {
      const label = PAYMENT_LABELS[p.method] ?? p.method
      const amount = new Intl.NumberFormat('fr-FR').format(p.amount)
        .replace(/[  ]/g, '.') + ' MGA'
      return `${label} ${amount}`
    })
    .join(' / ')
}

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
    if (order.status === 'COMPLETED') throw new AppError('Cette commande est déjà soldée', 400)
    if (order.status === 'CANCELLED') throw new AppError('Impossible d\'encaisser une commande annulée', 400)

    // ── Vérifier que la méthode de paiement a un compte bancaire associé ──────
    const linkedBank = await prisma.bankAccount.findFirst({
      where: { restaurantId, paymentMethod: data.method, isActive: true },
    })
    if (!linkedBank) {
      const label = PAYMENT_LABELS[data.method] ?? data.method
      throw new AppError(
        `Aucun compte bancaire associé à "${label}". Configurez-en un dans Banque → Comptes bancaires.`,
        400,
      )
    }

    // ── Si commande POS, exiger une session de caisse ouverte ─────────────────
    if (order.source === 'POS') {
      const openSession = await prisma.caisseSession.findFirst({
        where: { restaurantId, status: 'OPEN' },
      })
      if (!openSession) {
        throw new AppError(
          'Caisse fermée. Ouvrez une session de caisse avant d\'encaisser.',
          400,
        )
      }
    }

    // B1 — empêcher le sur-paiement
    const existingPaid = await prisma.payment.aggregate({
      where: { orderId: data.orderId, status: 'COMPLETED' },
      _sum: { amount: true },
    })
    const alreadyPaid = existingPaid._sum.amount ?? 0
    if (alreadyPaid + data.amount > order.totalAmount + 0.01) {
      throw new AppError(`Sur-paiement refusé : reste dû ${order.totalAmount - alreadyPaid} MGA`, 400)
    }

    // Atomicité : déduction des points fidélité + création du paiement dans
    // la même transaction Prisma. Si payment.create échoue, les points
    // sont remboursés automatiquement par le rollback.
    const payment = await prisma.$transaction(async (tx) => {
      if (data.method === 'WALLET') {
        const orderWithCustomer = await tx.order.findUnique({
          where: { id: data.orderId },
          include: { customer: { include: { loyaltyAccount: true } } },
        })
        const loyaltyAccount = orderWithCustomer?.customer?.loyaltyAccount
        if (!loyaltyAccount) throw new AppError('Aucun compte fidélité associé à cette commande', 400)
        const pointsToDeduct = Math.round(data.amount / 10)
        // Atomic conditional decrement — row-level lock prevents race conditions
        const updated = await tx.loyaltyAccount.updateMany({
          where: { id: loyaltyAccount.id, points: { gte: pointsToDeduct } },
          data: { points: { decrement: pointsToDeduct }, totalSpent: { increment: pointsToDeduct } },
        })
        if (updated.count === 0) {
          throw new AppError(`Solde de points insuffisant`, 400)
        }
        const freshAccount = await tx.loyaltyAccount.findUnique({
          where: { id: loyaltyAccount.id },
          select: { points: true },
        })
        await tx.loyaltyTransaction.create({
          data: {
            type: 'SPEND',
            points: -pointsToDeduct,
            balance: freshAccount!.points,
            description: `Paiement commande ${order.orderNumber}`,
            accountId: loyaltyAccount.id,
          },
        })
      }

      return tx.payment.create({
        data: { ...data, currency: 'MGA', status: 'COMPLETED' },
      })
    })

    const totalPaid = await prisma.payment.aggregate({
      where: { orderId: data.orderId, status: 'COMPLETED' },
      _sum: { amount: true },
    })

    // B — race condition sur-paiement : si deux paiements concurrents ont passé le guard,
    // le second détecté ici dépasse le total — on annule le paiement qu'on vient de créer
    if ((totalPaid._sum.amount ?? 0) > order.totalAmount + 1) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'CANCELLED' } })
      throw new AppError('Sur-paiement détecté : la commande est déjà soldée', 400)
    }

    // BUG 3 — re-lire le statut frais depuis la DB pour éviter le double-COMPLETED sur race condition
    // B2 — freshOrder peut être null si l'ordre a été supprimé entre-temps
    const freshOrder = await prisma.order.findUnique({ where: { id: order.id }, select: { status: true } })
    if (!freshOrder) throw new AppError('Commande introuvable après paiement', 404)
    if ((totalPaid._sum.amount || 0) >= order.totalAmount && freshOrder.status !== 'COMPLETED') {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          statusHistory: { create: { status: 'COMPLETED', notes: 'Paiement soldé', changedBy: req.user!.id } },
        },
      })
      // BUG 2.1 — déduction stock manquante sur paiement POS
      await deductStockForOrder(order.id, order.orderNumber, req.user!.id).catch(() => {})

      // Loyalty: customer earns 1 point per 100 MGA spent (excluding WALLET redemption)
      await earnLoyaltyPoints(order.id, order.orderNumber).catch(() => {})

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
          items:      { include: { product: true } },
          payments:   true,
          table:      true,
          restaurant: true,
        },
      })
      if (completedOrder) {
        const tableLabel = completedOrder.table
          ? `Table ${completedOrder.table.number}`
          : completedOrder.type === 'TAKEAWAY' ? 'Emporte' : null
        const cashier = req.user
          ? `${req.user.firstName} ${req.user.lastName}`.trim()
          : null
        autoPrintReceiptWithTable(restaurantId, {
          id:           completedOrder.id,
          code:         completedOrder.orderNumber,
          date:         completedOrder.createdAt,
          shopName:     completedOrder.restaurant.name,
          shopAddr:     completedOrder.restaurant.address,
          shopPhone:    completedOrder.restaurant.phone,
          cashierName:  cashier,
          table:        tableLabel,
          items:        completedOrder.items.map((i: any) => ({
            name:      i.product?.name ?? 'Article',
            qty:       i.quantity,
            unitPrice: i.unitPrice,
            total:     i.totalPrice,
          })),
          subtotal:     completedOrder.subtotal,
          discount:     completedOrder.discountAmount ?? 0,
          total:        completedOrder.totalAmount,
          paymentMethod: formatPaymentLabel(completedOrder.payments),
          currency:     'MGA',
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
      include: {
        order: { select: { restaurantId: true, orderNumber: true } },
        refunds: { select: { amount: true, status: true } },
      },
    })
    if (!payment) throw new AppError('Paiement introuvable', 404)
    // BUG 2.3 — vérifier le total cumulatif des remboursements, pas seulement le montant unitaire
    const alreadyRefunded = (payment.refunds ?? [])
      .filter((r: any) => r.status !== 'CANCELLED')
      .reduce((sum: number, r: any) => sum + r.amount, 0)
    if (alreadyRefunded + amount > payment.amount) {
      throw new AppError(`Le remboursement total (${alreadyRefunded + amount} MGA) dépasse le paiement original (${payment.amount} MGA)`, 400)
    }

    const refund = await prisma.refund.create({
      data: { paymentId: payment.id, amount, reason, status: 'COMPLETED' },
    })

    // BUG 4 — vérifier le CUMUL des remboursements, pas seulement le montant courant
    if (alreadyRefunded + amount >= payment.amount) {
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

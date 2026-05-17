import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'
import { generateOrderNumber } from '@restaurant/utils'
import { autoPrintSaleReceipt } from '../lib/printer'

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Especes', MVOLA: 'MVola', ORANGE_MONEY: 'Orange Money',
  AIRTEL_MONEY: 'Airtel Money', CARD: 'Carte', BNI_MOBILE: 'BNI Mobile',
  BOA_MOBILE: 'BOA Mobile', VIREMENT: 'Virement', CHEQUE: 'Cheque',
  VOUCHER: 'Bon', WALLET: 'Wallet',
}

function formatPaymentLabel(payments: { method: string; amount: number }[]): string {
  if (!payments?.length) return ''
  return payments
    .map(p => {
      const label = PAYMENT_LABELS[p.method] ?? p.method
      const amount = new Intl.NumberFormat('fr-FR').format(p.amount)
        .replace(/[  ]/g, '.') + ' MGA'
      return `${label} ${amount}`
    })
    .join(' / ')
}

// Build receipt payload for autoPrintSaleReceipt (uses transaction date from original order)
function buildReceiptPayload(updatedOrder: any, originalOrder: any, cashierEmail?: string) {
  const tableLabel = updatedOrder.table
    ? `Table ${updatedOrder.table.number}`
    : updatedOrder.type === 'TAKEAWAY' ? 'Emporte' : null
  const restaurant = updatedOrder.restaurant
  return {
    id:            updatedOrder.id,
    code:          updatedOrder.orderNumber,
    date:          originalOrder.createdAt,
    shopName:      restaurant?.name ?? '',
    shopAddr:      tableLabel
                     ? `${restaurant?.address ?? ''} | ${tableLabel}`
                     : (restaurant?.address ?? null),
    shopPhone:     restaurant?.phone ?? null,
    cashierName:   cashierEmail ?? null,
    items:         (updatedOrder.items ?? []).map((i: any) => ({
      name:      i.product?.name ?? 'Article',
      qty:       i.quantity,
      unitPrice: i.unitPrice,
      total:     i.totalPrice,
    })),
    subtotal:      updatedOrder.subtotal,
    discount:      updatedOrder.discountAmount ?? 0,
    total:         updatedOrder.totalAmount,
    paymentMethod: formatPaymentLabel(updatedOrder.payments ?? []),
    currency:      'MGA',
  }
}

export const orderRouter = Router()
orderRouter.use(authenticate)

const orderItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  notes: z.string().optional(),
  kdsStation: z.string().optional(),
  modifiers: z.array(z.object({
    name: z.string(),
    price: z.number(),
    type: z.string(),
    modifierId: z.string().optional(),
    variantId: z.string().optional(),
  })).optional(),
})

const createOrderSchema = z.object({
  type: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'ONLINE']),
  status: z.enum(['PENDING', 'CONFIRMED']).default('PENDING'),
  tableId: z.string().optional(),
  customerId: z.string().optional(),
  couponId: z.string().optional(),
  guestCount: z.number().int().positive().default(1),
  notes: z.string().optional(),
  deliveryAddress: z.string().optional(),
  deliveryCity: z.string().optional(),
  deliveryPostalCode: z.string().optional(),
  deliveryNotes: z.string().optional(),
  items: z.array(orderItemSchema).min(1),
}).refine(d => d.type !== 'DELIVERY' || !!d.deliveryAddress, {
  message: "L'adresse de livraison est requise pour une commande DELIVERY",
  path: ['deliveryAddress'],
})

// GET /api/orders
orderRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { status, type, tableId, page = '1', limit = '20', date } = req.query

    const where: any = { restaurantId: req.user!.restaurantId }
    if (status) {
      const statuses = (status as string).split(',').map(s => s.trim()).filter(Boolean)
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses }
    }
    if (type) {
      const types = (type as string).split(',').map(s => s.trim()).filter(Boolean)
      where.type = types.length === 1 ? types[0] : { in: types }
    }
    if (tableId) where.tableId = tableId
    if (date) {
      const d = new Date(date as string)
      where.createdAt = {
        gte: new Date(d.setHours(0, 0, 0, 0)),
        lt: new Date(d.setHours(23, 59, 59, 999)),
      }
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          type: true,
          status: true,
          subtotal: true,
          taxAmount: true,
          discountAmount: true,
          totalAmount: true,
          guestCount: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          confirmedAt: true,
          readyAt: true,
          completedAt: true,
          table: { select: { id: true, number: true, name: true, section: true } },
          customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
          payments: { select: { id: true, amount: true, method: true, status: true } },
          items: {
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
              notes: true,
              status: true,
              kdsStation: true,
              product: { select: { id: true, name: true, image: true, requiresPreparation: true } },
              modifiers: { select: { id: true, name: true, price: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.order.count({ where }),
    ])

    res.json({
      success: true,
      data: orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/orders/:id
orderRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: {
        items: { include: { product: true, modifiers: true } },
        table: true,
        customer: { include: { loyaltyAccount: true } },
        payments: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        coupon: true,
      },
    })

    if (!order) throw new AppError('Commande introuvable', 404)

    res.json({ success: true, data: order })
  } catch (error) {
    next(error)
  }
})

// POST /api/orders
orderRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = createOrderSchema.parse(req.body)
    const restaurantId = req.user!.restaurantId

    const subtotal = data.items.reduce((sum, item) => {
      const modifierTotal = (item.modifiers || []).reduce((s, m) => s + m.price, 0)
      return sum + (item.unitPrice + modifierTotal) * item.quantity
    }, 0)

    const [coupon, restaurant] = await Promise.all([
      data.couponId ? prisma.coupon.findUnique({ where: { id: data.couponId } }) : Promise.resolve(null),
      prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { deliveryFee: true } }),
    ])

    let discountAmount = 0
    if (coupon && coupon.isActive) {
      if (coupon.type === 'PERCENTAGE') {
        discountAmount = subtotal * (coupon.value / 100)
        if (coupon.maxDiscount) discountAmount = Math.min(discountAmount, coupon.maxDiscount)
      } else if (coupon.type === 'FIXED_AMOUNT') {
        discountAmount = coupon.value
      }
    }
    const deliveryFee = data.type === 'DELIVERY' ? (restaurant?.deliveryFee || 0) : 0
    // Pas de TVA pour DINE_IN/TAKEAWAY — les prix affichés sont TTC
    const taxAmount = 0
    const totalAmount = subtotal - discountAmount + deliveryFee

    const initialStatus = data.status ?? 'PENDING'
    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        type: data.type,
        status: initialStatus,
        confirmedAt: initialStatus === 'CONFIRMED' ? new Date() : undefined,
        restaurantId,
        tableId: data.tableId,
        customerId: data.customerId,
        couponId: data.couponId,
        guestCount: data.guestCount,
        notes: data.notes,
        deliveryAddress: data.deliveryAddress,
        deliveryCity: data.deliveryCity,
        deliveryPostalCode: data.deliveryPostalCode,
        deliveryNotes: data.deliveryNotes,
        subtotal,
        taxAmount,
        discountAmount,
        deliveryFee,
        totalAmount,
        items: {
          create: data.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.unitPrice * item.quantity,
            notes: item.notes,
            kdsStation: item.kdsStation,
            modifiers: item.modifiers ? {
              create: item.modifiers.map(m => ({
                name: m.name,
                price: m.price,
                type: m.type,
                modifierId: m.modifierId,
                variantId: m.variantId,
              })),
            } : undefined,
          })),
        },
        statusHistory: {
          create: { status: initialStatus, changedBy: req.user!.id },
        },
      },
      include: {
        items: { include: { product: true, modifiers: true } },
        table: true,
        customer: true,
      },
    })

    await Promise.all([
      data.tableId
        ? prisma.diningTable.update({ where: { id: data.tableId }, data: { status: 'OCCUPIED' } })
        : Promise.resolve(null),
      data.couponId
        ? prisma.coupon.update({ where: { id: data.couponId }, data: { usageCount: { increment: 1 } } })
        : Promise.resolve(null),
    ])

    const io = req.app.get('io')
    io?.to(restaurantId).emit('order:created', order)
    io?.to(`kds-${restaurantId}`).emit('kds:new_order', order)

    res.status(201).json({ success: true, data: order })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/orders/:id/status
orderRouter.patch('/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const { status, notes } = z.object({
      status: z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'COMPLETED', 'CANCELLED']),
      notes: z.string().optional(),
    }).parse(req.body)

    const order = await prisma.order.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })

    if (!order) throw new AppError('Commande introuvable', 404)

    const timestamps: Record<string, Date> = {}
    if (status === 'CONFIRMED') timestamps.confirmedAt = new Date()
    if (status === 'PREPARING') timestamps.confirmedAt = order.confirmedAt || new Date()
    if (status === 'READY') timestamps.readyAt = new Date()
    if (status === 'DELIVERED') timestamps.deliveredAt = new Date()
    if (status === 'COMPLETED') timestamps.completedAt = new Date()
    if (status === 'CANCELLED') timestamps.cancelledAt = new Date()

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        status,
        ...timestamps,
        cancellationReason: status === 'CANCELLED' ? notes : undefined,
        statusHistory: {
          create: { status, notes, changedBy: req.user!.id },
        },
      },
      include: {
        items:      { include: { product: true } },
        table:      true,
        customer:   true,
        payments:   true,
        restaurant: true,
      },
    })

    // Auto-mark no-prep items as READY when order is confirmed
    if (status === 'CONFIRMED') {
      const noPrepItems = updatedOrder.items.filter((i: any) => i.product && !i.product.requiresPreparation)
      if (noPrepItems.length > 0) {
        await prisma.orderItem.updateMany({
          where: { orderId: order.id, product: { requiresPreparation: false } },
          data: { status: 'READY' },
        })
        // If ALL items need no preparation → order is ready immediately
        const kitchenItemsCount = updatedOrder.items.filter((i: any) => i.product?.requiresPreparation !== false).length
        if (kitchenItemsCount === 0) {
          await prisma.order.update({
            where: { id: order.id },
            data: { status: 'READY', readyAt: new Date() },
          })
        }
      }
    }

    if ((status === 'COMPLETED' || status === 'CANCELLED') && order.tableId) {
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

    // ── Déduction automatique du stock quand commande COMPLETED ──────────
    if (status === 'COMPLETED') {
      const orderWithItems = await prisma.order.findUnique({
        where: { id: order.id },
        select: {
          items: {
            select: {
              quantity: true,
              product: {
                select: {
                  recipeItems: {
                    select: {
                      quantity: true,
                      yieldRate: true,
                      ingredient: {
                        select: { stockItemId: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })

      for (const item of orderWithItems?.items ?? []) {
        for (const recipeItem of item.product?.recipeItems ?? []) {
          const stockItemId = recipeItem.ingredient?.stockItemId
          if (!stockItemId) continue
          const qtyToDeduct = item.quantity * recipeItem.quantity / (recipeItem.yieldRate || 1)
          try {
            const stockItem = await prisma.stockItem.findUnique({ where: { id: stockItemId } })
            if (!stockItem) continue
            const newQty = Math.max(0, stockItem.currentQuantity - qtyToDeduct)
            await prisma.$transaction([
              prisma.stockMovement.create({
                data: {
                  type: 'OUT',
                  quantity: qtyToDeduct,
                  stockItemId,
                  reason: `Vente commande #${updatedOrder.orderNumber}`,
                  createdBy: req.user!.id,
                },
              }),
              prisma.stockItem.update({
                where: { id: stockItemId },
                data: { currentQuantity: newQty },
              }),
            ])
            // Alerte stock faible
            if (newQty <= stockItem.minQuantity && stockItem.currentQuantity > stockItem.minQuantity) {
              await prisma.stockAlert.create({
                data: {
                  type: newQty <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
                  message: `Stock faible : ${stockItem.name} (${newQty} ${stockItem.unit} restants)`,
                  stockItemId,
                },
              })
            }
          } catch { /* continue si table stock non disponible */ }
        }
      }
    }

    // ── Impression automatique ticket (uniquement au paiement) ──────────────
    if (status === 'COMPLETED') {
      autoPrintSaleReceipt(req.user!.restaurantId, buildReceiptPayload(updatedOrder, order, req.user!.email)).catch(() => {})
    }

    const io = req.app.get('io')
    io?.to(req.user!.restaurantId).emit('order:status_changed', {
      orderId: order.id,
      status,
      order: updatedOrder,
    })

    res.json({ success: true, data: updatedOrder })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/orders/:id/tip — ajouter/modifier le pourboire
orderRouter.patch('/:id/tip', async (req: AuthRequest, res, next) => {
  try {
    const { tip } = z.object({ tip: z.number().min(0) }).parse(req.body)
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!order) throw new AppError('Commande introuvable', 404)
    const newTotal = order.totalAmount - (order.tipAmount || 0) + tip
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { tipAmount: tip, totalAmount: newTotal },
    })
    res.json({ success: true, data: updated })
  } catch (error) {
    next(error)
  }
})

// GET /api/orders/:id/payments — paiements d'une commande avec solde restant
orderRouter.get('/:id/payments', async (req: AuthRequest, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: { payments: { orderBy: { createdAt: 'asc' } } },
    })
    if (!order) throw new AppError('Commande introuvable', 404)
    const paid = order.payments.filter(p => p.status === 'COMPLETED').reduce((s, p) => s + p.amount, 0)
    const remaining = Math.max(0, order.totalAmount - paid)
    res.json({ success: true, data: { order, payments: order.payments, paid, remaining } })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/orders/:id
orderRouter.delete('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })

    if (!order) throw new AppError('Commande introuvable', 404)
    if (!['PENDING', 'CANCELLED'].includes(order.status)) {
      throw new AppError('Seules les commandes en attente ou annulées peuvent être supprimées', 400)
    }

    await prisma.order.delete({ where: { id: order.id } })
    res.json({ success: true, message: 'Commande supprimée' })
  } catch (error) {
    next(error)
  }
})

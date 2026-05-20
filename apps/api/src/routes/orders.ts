import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'
import { generateOrderNumber, convertUnit } from '@restaurant/utils'
import { autoPrintReceiptWithTable } from '../lib/printer'

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
function buildReceiptPayload(updatedOrder: any, originalOrder: any, cashierName?: string) {
  const tableLabel = updatedOrder.table
    ? `Table ${updatedOrder.table.number}`
    : updatedOrder.type === 'TAKEAWAY' ? 'Emporte' : null
  const restaurant = updatedOrder.restaurant
  return {
    id:            updatedOrder.id,
    code:          updatedOrder.orderNumber,
    date:          originalOrder.createdAt,
    shopName:    restaurant?.name ?? '',
    shopAddr:    restaurant?.address ?? null,
    shopPhone:   restaurant?.phone ?? null,
    cashierName: cashierName ?? null,
    table:       tableLabel,
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

// ─── Shared stock deduction (called from both PATCH /status and payments route) ─
export async function deductStockForOrder(
  orderId: string,
  orderNumber: string,
  createdBy: string,
) {
  // Idempotency: skip if stock already deducted for this order (prevents double deduction)
  const alreadyDeducted = await prisma.stockMovement.count({
    where: { reason: `Vente commande #${orderNumber}` },
  })
  if (alreadyDeducted > 0) return

  const orderWithItems = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      items: {
        select: {
          quantity: true,
          product: {
            select: {
              stockItemId: true,
              recipeItems: {
                select: {
                  quantity: true,
                  unit: true,
                  yieldRate: true,
                  ingredient: { select: { stockItemId: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  for (const item of orderWithItems?.items ?? []) {
    const product = item.product
    if (!product) continue

    // ── Cas 1 : produit lié directement à un article de stock (sans recette) ──
    if (product.stockItemId && (!product.recipeItems || product.recipeItems.length === 0)) {
      try {
        const stockItem = await prisma.stockItem.findUnique({ where: { id: product.stockItemId } })
        if (!stockItem) continue

        const actualQty = Math.min(item.quantity, stockItem.currentQuantity)
        const newQty = stockItem.currentQuantity - actualQty

        await prisma.$transaction([
          prisma.stockMovement.create({
            data: {
              type: 'OUT',
              quantity: actualQty,
              stockItemId: product.stockItemId,
              reason: `Vente commande #${orderNumber}`,
              createdBy,
            },
          }),
          prisma.stockItem.update({
            where: { id: product.stockItemId },
            data: { currentQuantity: newQty },
          }),
        ])

        if (newQty <= stockItem.minQuantity && stockItem.currentQuantity > stockItem.minQuantity) {
          const alertType = newQty <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK'
          const existing = await prisma.stockAlert.findFirst({
            where: { stockItemId: product.stockItemId, type: alertType, resolvedAt: null },
          })
          if (!existing) {
            await prisma.stockAlert.create({
              data: {
                type: alertType,
                message: `Stock faible : ${stockItem.name} (${newQty.toFixed(2)} ${stockItem.unit} restants)`,
                stockItemId: product.stockItemId,
              },
            }).catch(() => {})
          }
        }
      } catch { /* non-bloquant */ }
      continue
    }

    // ── Cas 2 : produit à recette — déduire les ingrédients ──
    for (const recipeItem of product.recipeItems ?? []) {
      const stockItemId = recipeItem.ingredient?.stockItemId
      if (!stockItemId) continue
      try {
        const stockItem = await prisma.stockItem.findUnique({ where: { id: stockItemId } })
        if (!stockItem) continue

        let baseQty: number
        if (recipeItem.unit && recipeItem.unit !== stockItem.unit) {
          const converted = convertUnit(recipeItem.quantity, recipeItem.unit, stockItem.unit)
          if (converted === null) {
            console.warn(`[stock] Incompatible units: recette "${recipeItem.unit}" vs stock "${stockItem.unit}" pour ${stockItem.name} — déduction ignorée`)
            continue
          }
          baseQty = converted
        } else {
          baseQty = recipeItem.quantity
        }

        const theoreticalQty = item.quantity * baseQty / (recipeItem.yieldRate || 1)
        const actualQty = Math.min(theoreticalQty, stockItem.currentQuantity)
        const newQty = stockItem.currentQuantity - actualQty

        await prisma.$transaction([
          prisma.stockMovement.create({
            data: {
              type: 'OUT',
              quantity: actualQty,
              stockItemId,
              reason: `Vente commande #${orderNumber}`,
              createdBy,
            },
          }),
          prisma.stockItem.update({
            where: { id: stockItemId },
            data: { currentQuantity: newQty },
          }),
        ])

        if (actualQty < theoreticalQty) {
          await prisma.stockAlert.create({
            data: {
              type: 'OUT_OF_STOCK',
              message: `Rupture partielle : ${stockItem.name} — besoin ${theoreticalQty.toFixed(2)} ${stockItem.unit}, disponible ${actualQty.toFixed(2)} ${stockItem.unit}`,
              stockItemId,
            },
          }).catch(() => {})
        }

        if (newQty <= stockItem.minQuantity && stockItem.currentQuantity > stockItem.minQuantity) {
          const alertType = newQty <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK'
          const existingAlert = await prisma.stockAlert.findFirst({
            where: { stockItemId, type: alertType, resolvedAt: null },
          })
          if (!existingAlert) {
            await prisma.stockAlert.create({
              data: {
                type: alertType,
                message: `Stock faible : ${stockItem.name} (${newQty.toFixed(2)} ${stockItem.unit} restants)`,
                stockItemId,
              },
            }).catch(() => {})
          }
        }
      } catch { /* non-bloquant */ }
    }
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
  estimatedTime: z.number().int().positive().optional(),
  items: z.array(orderItemSchema).min(1),
}).refine(d => d.type !== 'DELIVERY' || !!d.deliveryAddress, {
  message: "L'adresse de livraison est requise pour une commande DELIVERY",
  path: ['deliveryAddress'],
})

// GET /api/orders
orderRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { status, type, tableId, page = '1', limit = '20', date, orderNumber, customerName, source } = req.query

    const where: any = { restaurantId: req.user!.restaurantId }
    if (orderNumber) where.orderNumber = { contains: orderNumber as string, mode: 'insensitive' }
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
    if (customerName) {
      where.customer = {
        OR: [
          { firstName: { contains: customerName as string, mode: 'insensitive' } },
          { lastName: { contains: customerName as string, mode: 'insensitive' } },
        ],
      }
    }
    if (source) where.source = source as string

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
          deliveredAt: true,
          completedAt: true,
          cancelledAt: true,
          tipAmount: true,
          estimatedTime: true,
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

    // Check table availability for DINE_IN orders
    if (data.type === 'DINE_IN' && data.tableId) {
      const table = await prisma.diningTable.findFirst({
        where: { id: data.tableId, restaurantId },
        select: { status: true, number: true },
      })
      if (table && ['OCCUPIED', 'RESERVED', 'BLOCKED'].includes(table.status)) {
        throw new AppError(
          `Table ${table.number} n'est pas disponible (statut: ${table.status})`,
          400,
        )
      }
    }

    // Vérification stock avant création : rejeter si article épuisé
    for (const item of data.items) {
      const product = await prisma.product.findFirst({
        where: { id: item.productId, restaurantId },
        select: { name: true, stockItemId: true, stockItem: { select: { currentQuantity: true, unit: true } } },
      })
      if (product?.stockItemId && product.stockItem) {
        if (product.stockItem.currentQuantity < item.quantity) {
          throw new AppError(
            `Stock insuffisant pour "${product.name}" : ${product.stockItem.currentQuantity} ${product.stockItem.unit} disponible(s), ${item.quantity} demandé(s)`,
            400,
          )
        }
      }
    }

    // Fetch products to inherit kdsStation when not set by client
    const productIds = [...new Set(data.items.map(i => i.productId))]
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, kdsStation: true },
    })
    const productKdsMap = new Map(products.map(p => [p.id, p.kdsStation]))

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
        estimatedTime: data.estimatedTime,
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
            kdsStation: item.kdsStation ?? productKdsMap.get(item.productId) ?? null,
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

    // Create notification for managers/servers
    const orderType = order.type === 'DINE_IN' ? 'sur place' : order.type === 'DELIVERY' ? 'livraison' : 'à emporter'
    prisma.notification.create({
      data: {
        type: 'ORDER',
        title: 'Nouvelle commande',
        message: `Commande ${order.orderNumber} (${orderType}) — ${order.items?.length ?? 0} article(s)`,
        restaurantId,
        targetRole: 'manager',
        data: { orderId: order.id, orderNumber: order.orderNumber, type: order.type },
      },
    }).catch(() => {}) // non-blocking

    io?.to(restaurantId).emit('notification:new', { type: 'ORDER', orderNumber: order.orderNumber })

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

    // BUG 3.1 — empêche les transitions depuis un état terminal
    if (order.status === 'COMPLETED') throw new AppError('La commande est déjà terminée', 400)
    if (order.status === 'CANCELLED') throw new AppError('La commande est annulée', 400)

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
      await deductStockForOrder(order.id, updatedOrder.orderNumber, req.user!.id).catch(() => {})
    }

    // ── Impression automatique ticket (uniquement au paiement) ──────────────
    if (status === 'COMPLETED') {
      autoPrintReceiptWithTable(req.user!.restaurantId, buildReceiptPayload(updatedOrder, order, `${req.user!.firstName} ${req.user!.lastName}`.trim())).catch(() => {})
    }

    const io = req.app.get('io')
    const statusPayload = { orderId: order.id, status, order: updatedOrder }
    io?.to(req.user!.restaurantId).emit('order:status_changed', statusPayload)
    // BUG 3.3 — propager aussi au room KDS pour les mises à jour de statut
    io?.to(`kds-${req.user!.restaurantId}`).emit('order:status_changed', statusPayload)

    // Notify when order is ready for pickup / serving
    if (status === 'READY') {
      const tableInfo = updatedOrder.table ? ` — Table ${updatedOrder.table.number}` : ''
      prisma.notification.create({
        data: {
          type: 'ORDER',
          title: 'Commande prête',
          message: `Commande ${updatedOrder.orderNumber}${tableInfo} est prête`,
          restaurantId: req.user!.restaurantId,
          targetRole: 'serveur',
          data: { orderId: updatedOrder.id, orderNumber: updatedOrder.orderNumber },
        },
      }).catch(() => {})
      io?.to(req.user!.restaurantId).emit('notification:new', { type: 'ORDER', message: `Commande ${updatedOrder.orderNumber} prête` })
    }

    // Notify when order is CANCELLED
    if (status === 'CANCELLED') {
      const reason = notes ? ` — ${notes}` : ''
      const tableInfo = updatedOrder.table ? ` (Table ${updatedOrder.table.number})` : ''
      const msg = `Commande ${updatedOrder.orderNumber}${tableInfo} annulée${reason}`
      prisma.notification.create({
        data: {
          type: 'ORDER',
          title: 'Commande annulée',
          message: msg,
          restaurantId: req.user!.restaurantId,
          targetRole: 'manager',
          data: { orderId: updatedOrder.id, orderNumber: updatedOrder.orderNumber, reason: notes },
        },
      }).catch(() => {})
      io?.to(req.user!.restaurantId).emit('notification:new', { type: 'ORDER', message: msg })
    }

    res.json({ success: true, data: updatedOrder })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/orders/:id/items/:itemId — change quantity of item in PENDING order
orderRouter.patch('/:id/items/:itemId', async (req: AuthRequest, res, next) => {
  try {
    const { quantity } = z.object({ quantity: z.number().int().min(1) }).parse(req.body)
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: { items: true },
    })
    if (!order) throw new AppError('Commande introuvable', 404)
    if (order.status !== 'PENDING') throw new AppError('Seules les commandes en attente peuvent être modifiées', 400)

    const item = order.items.find(i => i.id === req.params.itemId)
    if (!item) throw new AppError('Article introuvable', 404)

    const newItemTotal = item.unitPrice * quantity
    const totalDiff = newItemTotal - item.totalPrice
    const newSubtotal = order.subtotal + totalDiff
    const newTotal = order.totalAmount + totalDiff

    const [updatedItem] = await prisma.$transaction([
      prisma.orderItem.update({ where: { id: item.id }, data: { quantity, totalPrice: newItemTotal } }),
      prisma.order.update({ where: { id: order.id }, data: { subtotal: newSubtotal, totalAmount: newTotal } }),
    ])

    const io = req.app.get('io')
    io?.to(req.user!.restaurantId).emit('order:updated', { orderId: order.id })

    res.json({ success: true, data: updatedItem })
  } catch (error) { next(error) }
})

// DELETE /api/orders/:id/items/:itemId — remove item from a PENDING order
orderRouter.delete('/:id/items/:itemId', async (req: AuthRequest, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: { items: true },
    })
    if (!order) throw new AppError('Commande introuvable', 404)
    if (order.status !== 'PENDING') throw new AppError('Seules les commandes en attente peuvent être modifiées', 400)

    const item = order.items.find(i => i.id === req.params.itemId)
    if (!item) throw new AppError('Article introuvable', 404)
    if (order.items.length === 1) throw new AppError('Impossible de supprimer le dernier article — annulez la commande', 400)

    const newSubtotal = order.subtotal - item.totalPrice
    const newTotal = order.totalAmount - item.totalPrice

    await prisma.$transaction([
      prisma.orderItem.delete({ where: { id: item.id } }),
      prisma.order.update({ where: { id: order.id }, data: { subtotal: newSubtotal, totalAmount: newTotal } }),
    ])

    const io = req.app.get('io')
    io?.to(req.user!.restaurantId).emit('order:updated', { orderId: order.id })

    res.json({ success: true, message: 'Article supprimé' })
  } catch (error) { next(error) }
})

// PATCH /api/orders/:id/tip — ajouter/modifier le pourboire
// PATCH /api/orders/:id/items/:itemId/status — per-item status from KDS
orderRouter.patch('/:id/items/:itemId/status', async (req: AuthRequest, res, next) => {
  try {
    const { status } = z.object({
      status: z.enum(['PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED']),
    }).parse(req.body)

    const item = await prisma.orderItem.findFirst({
      where: { id: req.params.itemId, orderId: req.params.id, order: { restaurantId: req.user!.restaurantId } },
    })
    if (!item) throw new AppError('Item introuvable', 404)

    const updated = await prisma.orderItem.update({
      where: { id: item.id },
      data: { status, preparedAt: status === 'READY' ? new Date() : item.preparedAt },
    })

    // If all items READY → mark order READY (when order was PREPARING)
    if (status === 'READY') {
      const order = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: { items: { select: { status: true } } },
      })
      if (order && order.status === 'PREPARING' && order.items.every(i => i.status === 'READY' || i.status === 'CANCELLED')) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'READY', readyAt: new Date(), statusHistory: { create: { status: 'READY', changedBy: req.user!.id } } },
        })
        const io = req.app.get('io')
        const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } })
        io?.to(req.user!.restaurantId).emit('order:status_changed', { orderId: order.id, status: 'READY', order: updatedOrder })
      }
    }

    // Notify KDS of item change
    const io = req.app.get('io')
    io?.to(`kds-${req.user!.restaurantId}`).emit('order:item_changed', { orderId: req.params.id, itemId: item.id, status })

    res.json({ success: true, data: updated })
  } catch (error) { next(error) }
})

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

// PATCH /api/orders/:id — edit order notes
orderRouter.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { notes, deliveryAddress, deliveryCity, deliveryPostalCode, deliveryNotes, estimatedTime } = z.object({
      notes: z.string().nullable().optional(),
      deliveryAddress: z.string().nullable().optional(),
      deliveryCity: z.string().nullable().optional(),
      deliveryPostalCode: z.string().nullable().optional(),
      deliveryNotes: z.string().nullable().optional(),
      estimatedTime: z.number().int().nullable().optional(),
    }).parse(req.body)

    const order = await prisma.order.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!order) throw new AppError('Commande introuvable', 404)

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        ...(notes !== undefined && { notes }),
        ...(deliveryAddress !== undefined && { deliveryAddress }),
        ...(deliveryCity !== undefined && { deliveryCity }),
        ...(deliveryPostalCode !== undefined && { deliveryPostalCode }),
        ...(deliveryNotes !== undefined && { deliveryNotes }),
        ...(estimatedTime !== undefined && { estimatedTime }),
      },
    })
    res.json({ success: true, data: updated })
  } catch (error) { next(error) }
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

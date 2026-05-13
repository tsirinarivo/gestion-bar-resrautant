import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'
import { generateOrderNumber } from '@restaurant/utils'

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
})

// GET /api/orders
orderRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { status, type, tableId, page = '1', limit = '20', date } = req.query

    const where: any = { restaurantId: req.user!.restaurantId }
    if (status) where.status = status
    if (type) where.type = type
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
        include: {
          items: { include: { product: true, modifiers: true } },
          table: true,
          customer: true,
          payments: true,
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

    let discountAmount = 0
    if (data.couponId) {
      const coupon = await prisma.coupon.findUnique({ where: { id: data.couponId } })
      if (coupon && coupon.isActive) {
        if (coupon.type === 'PERCENTAGE') {
          discountAmount = subtotal * (coupon.value / 100)
          if (coupon.maxDiscount) discountAmount = Math.min(discountAmount, coupon.maxDiscount)
        } else if (coupon.type === 'FIXED_AMOUNT') {
          discountAmount = coupon.value
        }
      }
    }

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } })
    const deliveryFee = data.type === 'DELIVERY' ? (restaurant?.deliveryFee || 0) : 0
    const taxAmount = (subtotal - discountAmount) * 0.1
    const totalAmount = subtotal - discountAmount + taxAmount + deliveryFee

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        type: data.type,
        status: 'PENDING',
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
          create: { status: 'PENDING', changedBy: req.user!.id },
        },
      },
      include: {
        items: { include: { product: true, modifiers: true } },
        table: true,
        customer: true,
      },
    })

    if (data.tableId) {
      await prisma.diningTable.update({
        where: { id: data.tableId },
        data: { status: 'OCCUPIED' },
      })
    }

    if (data.couponId) {
      await prisma.coupon.update({
        where: { id: data.couponId },
        data: { usageCount: { increment: 1 } },
      })
    }

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
        items: { include: { product: true } },
        table: true,
        customer: true,
      },
    })

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

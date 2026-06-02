import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { generateOrderNumber } from '@restaurant/utils'

export const publicRouter = Router()

// GET /api/public/:slug/info
publicRouter.get('/:slug/info', async (req, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug: req.params.slug },
      select: {
        id: true, name: true, description: true, phone: true,
        address: true, city: true, openingHours: true, currency: true,
        logo: true, website: true,
        deliveryEnabled: true, pickupEnabled: true, dineInEnabled: true,
        deliveryFee: true, minOrderAmount: true, estimatedPrepTime: true,
      },
    })
    if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant introuvable' })
    res.json({ success: true, data: restaurant })
  } catch (error) { next(error) }
})

// GET /api/public/:slug/menu
publicRouter.get('/:slug/menu', async (req, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { slug: req.params.slug } })
    if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant introuvable' })

    const categories = await prisma.category.findMany({
      where: { restaurantId: restaurant.id, isActive: true },
      include: {
        products: {
          where: { isActive: true, isAvailable: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
    res.json({ success: true, data: { restaurant, categories } })
  } catch (error) { next(error) }
})

// POST /api/public/:slug/coupons/validate — public coupon validation
publicRouter.post('/:slug/coupons/validate', async (req, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { slug: req.params.slug } })
    if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant introuvable' })
    const { code, orderAmount } = z.object({
      code: z.string().min(1).max(64),
      orderAmount: z.number().nonnegative().finite(),
    }).parse(req.body)

    const coupon = await prisma.coupon.findFirst({
      where: { code: code.toUpperCase(), restaurantId: restaurant.id, isActive: true },
    })
    if (!coupon) return res.status(404).json({ success: false, error: 'Code promo invalide' })
    if (coupon.endDate && coupon.endDate < new Date()) return res.status(400).json({ success: false, error: 'Code promo expiré' })
    if (coupon.startDate && coupon.startDate > new Date()) return res.status(400).json({ success: false, error: 'Code promo pas encore valide' })
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) return res.status(400).json({ success: false, error: 'Code promo épuisé' })
    if (coupon.minOrderAmount && orderAmount < coupon.minOrderAmount) {
      return res.status(400).json({ success: false, error: `Montant minimum : Ar ${coupon.minOrderAmount}` })
    }
    let discount = 0
    if (coupon.type === 'PERCENTAGE') {
      discount = orderAmount * (coupon.value / 100)
      if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount)
    } else if (coupon.type === 'FIXED_AMOUNT') {
      discount = Math.min(coupon.value, orderAmount)
    }
    res.json({ success: true, data: { code: coupon.code, type: coupon.type, value: coupon.value, discount } })
  } catch (error) { next(error) }
})

// POST /api/public/:slug/orders — guest order
publicRouter.post('/:slug/orders', async (req, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { slug: req.params.slug } })
    if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant introuvable' })

    const orderBodySchema = z.object({
      items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
        notes: z.string().optional(),
      })).min(1),
      type: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']).default('TAKEAWAY'),
      notes: z.string().optional(),
      customerName: z.string().min(1).max(100).optional(),
      customerPhone: z.string().min(1).max(20).optional(),
      deliveryAddress: z.string().optional(),
      deliveryCity: z.string().optional(),
      tipAmount: z.number().nonnegative().default(0),
      couponCode: z.string().optional(),
    })
    const parsed = orderBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message ?? 'Données invalides' })
    }
    const { items, type, notes, customerName, customerPhone, deliveryAddress, deliveryCity, tipAmount, couponCode } = parsed.data

    // Recharger les prix depuis la DB — JAMAIS faire confiance au prix envoyé par le client.
    const productIds = [...new Set(items.map(i => i.productId))]
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, restaurantId: restaurant.id, isActive: true, isAvailable: true },
      select: { id: true, price: true, kdsStation: true, name: true },
    })
    const productMap = new Map(products.map(p => [p.id, p]))
    for (const item of items) {
      if (!productMap.has(item.productId)) {
        return res.status(400).json({ success: false, error: `Produit indisponible` })
      }
    }
    const enrichedItems = items.map(item => ({
      ...item,
      unitPrice: productMap.get(item.productId)!.price,
    }))

    const subtotal = enrichedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
    const deliveryFee = type === 'DELIVERY' ? (restaurant.deliveryFee ?? 0) : 0
    // Pas de TVA — les prix produits sont TTC (cohérent avec orders.ts POS)
    const taxAmount = 0
    const tip = Number(tipAmount) || 0

    const contactNote = customerName ? `Client: ${customerName}${customerPhone ? ` — ${customerPhone}` : ''}` : undefined
    const fullNotes = [contactNote, notes].filter(Boolean).join(' | ') || undefined

    const kdsMap = new Map(products.map(p => [p.id, p.kdsStation]))

    // Transaction : claim coupon atomique + create order pour éviter le dépassement
    // de usageLimit en cas de commandes simultanées.
    const order = await prisma.$transaction(async (tx) => {
      let discountAmount = 0
      let couponId: string | undefined
      if (couponCode) {
        const c = await tx.coupon.findFirst({
          where: { code: String(couponCode).toUpperCase(), restaurantId: restaurant.id, isActive: true },
        })
        if (c && (!c.endDate || c.endDate >= new Date()) &&
            (!c.startDate || c.startDate <= new Date()) &&
            (!c.minOrderAmount || subtotal >= c.minOrderAmount)) {
          // Increment atomique conditionnel
          const incrementResult = await tx.coupon.updateMany({
            where: c.usageLimit !== null
              ? { id: c.id, usageCount: { lt: c.usageLimit } }
              : { id: c.id },
            data: { usageCount: { increment: 1 } },
          })
          if (incrementResult.count > 0) {
            if (c.type === 'PERCENTAGE') {
              discountAmount = subtotal * (c.value / 100)
              if (c.maxDiscount) discountAmount = Math.min(discountAmount, c.maxDiscount)
            } else if (c.type === 'FIXED_AMOUNT') {
              discountAmount = Math.min(c.value, subtotal)
            }
            couponId = c.id
          }
        }
      }
      const totalAmount = subtotal + taxAmount + deliveryFee + tip - discountAmount

      return tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          type,
          status: 'PENDING',
          source: 'ONLINE',
          restaurantId: restaurant.id,
          notes: fullNotes,
          deliveryAddress,
          deliveryCity,
          subtotal,
          taxAmount,
          tipAmount: tip,
          deliveryFee,
          discountAmount,
          couponId,
          totalAmount,
          items: {
            create: enrichedItems.map(item => ({
              productId: item.productId,
              productName: productMap.get(item.productId)?.name ?? null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.unitPrice * item.quantity,
              notes: item.notes,
              kdsStation: kdsMap.get(item.productId) ?? null,
            })),
          },
          statusHistory: {
            create: { status: 'PENDING', notes: 'Commande en ligne (client)' },
          },
        },
        include: { items: { include: { product: { select: { name: true } } } } },
      })
    })

    // Notify dashboard + KDS of the new order
    const io = req.app.get('io')
    if (io) {
      io.to(restaurant.id).emit('order:created', { orderNumber: order.orderNumber, type: order.type })
      io.to(`kds-${restaurant.id}`).emit('kds:new_order', { orderId: order.id })
      prisma.notification.create({
        data: {
          type: 'ORDER',
          title: `Nouvelle commande en ligne`,
          message: `${order.orderNumber} — ${customerName || 'Anonyme'}${customerPhone ? ` (${customerPhone})` : ''}`,
          restaurantId: restaurant.id,
          targetRole: 'manager',
        },
      }).catch(() => {})
      io.to(restaurant.id).emit('notification:new', { type: 'ORDER' })
    }

    res.status(201).json({ success: true, data: order })
  } catch (error) { next(error) }
})

// GET /api/public/:slug/orders/:orderNumber — guest order tracking
publicRouter.get('/:slug/orders/:orderNumber', async (req, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { slug: req.params.slug } })
    if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant introuvable' })

    const order = await prisma.order.findFirst({
      where: { restaurantId: restaurant.id, orderNumber: req.params.orderNumber },
      select: {
        id: true, orderNumber: true, status: true, type: true,
        totalAmount: true, createdAt: true, completedAt: true, readyAt: true,
        notes: true, estimatedTime: true,
        items: {
          select: { quantity: true, unitPrice: true, totalPrice: true, notes: true, status: true,
            product: { select: { name: true, image: true } } }
        },
        statusHistory: { orderBy: { createdAt: 'desc' }, take: 10,
          select: { status: true, notes: true, createdAt: true } },
      },
    })
    if (!order) return res.status(404).json({ success: false, error: 'Commande introuvable' })
    res.json({ success: true, data: order })
  } catch (error) { next(error) }
})

// POST /api/public/:slug/orders/:orderNumber/cancel — customer self-cancel (PENDING only)
publicRouter.post('/:slug/orders/:orderNumber/cancel', async (req, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { slug: req.params.slug } })
    if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant introuvable' })

    const order = await prisma.order.findFirst({
      where: { restaurantId: restaurant.id, orderNumber: req.params.orderNumber },
    })
    if (!order) return res.status(404).json({ success: false, error: 'Commande introuvable' })
    if (order.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: 'La commande ne peut plus être annulée' })
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'CANCELLED',
        statusHistory: { create: { status: 'CANCELLED', notes: 'Annulée par le client' } },
      },
    })

    const io = req.app.get('io')
    io?.to(restaurant.id).emit('order:status_changed', { orderId: order.id, status: 'CANCELLED' })

    res.json({ success: true })
  } catch (error) { next(error) }
})

// GET /api/public/:slug/tables/:tableId
publicRouter.get('/:slug/tables/:tableId', async (req, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { slug: req.params.slug } })
    if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant introuvable' })
    const table = await prisma.diningTable.findFirst({
      where: { id: req.params.tableId, restaurantId: restaurant.id },
      select: { id: true, number: true, name: true, capacity: true, section: true },
    })
    if (!table) return res.status(404).json({ success: false, error: 'Table introuvable' })
    res.json({ success: true, data: table })
  } catch (error) { next(error) }
})

// POST /api/public/:slug/tables/:tableId/call-waiter
publicRouter.post('/:slug/tables/:tableId/call-waiter', async (req, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { slug: req.params.slug } })
    if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant introuvable' })

    const table = await prisma.diningTable.findFirst({
      where: { id: req.params.tableId, restaurantId: restaurant.id },
    })
    if (!table) return res.status(404).json({ success: false, error: 'Table introuvable' })

    // Emit socket event to dashboard
    const io = req.app.get('io')
    if (io) {
      io.to(restaurant.id).emit('table:call_waiter', {
        tableId: table.id,
        tableNumber: table.number,
        message: `Table ${table.number} appelle un serveur`,
        timestamp: new Date(),
      })
    }

    res.json({ success: true, message: 'Serveur appelé' })
  } catch (error) { next(error) }
})


// GET /api/public/:slug/reviews — public reviews list
publicRouter.get('/:slug/reviews', async (req, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { slug: req.params.slug } })
    if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant introuvable' })
    const reviews = await prisma.review.findMany({
      where: { restaurantId: restaurant.id, isPublic: true },
      select: { id: true, rating: true, title: true, content: true, reply: true, repliedAt: true, createdAt: true,
        customer: { select: { firstName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    res.json({ success: true, data: reviews })
  } catch (error) { next(error) }
})

// POST /api/public/:slug/reviews — submit a review
publicRouter.post('/:slug/reviews', async (req, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { slug: req.params.slug } })
    if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant introuvable' })
    const { rating, title, content, orderNumber } = z.object({
      rating: z.number().int().min(1).max(5),
      title: z.string().max(200).optional(),
      content: z.string().max(2000).optional(),
      orderNumber: z.string().min(1).max(64),
    }).parse(req.body)

    // Proof-of-order : la review doit référencer une commande COMPLETED de ce
    // restaurant, et il ne peut y avoir qu'une review par commande.
    const order = await prisma.order.findFirst({
      where: { restaurantId: restaurant.id, orderNumber, status: 'COMPLETED' },
      select: { id: true },
    })
    if (!order) {
      return res.status(400).json({ success: false, error: 'Commande introuvable ou non terminée' })
    }
    const existingReview = await prisma.review.findFirst({ where: { orderId: order.id } })
    if (existingReview) {
      return res.status(400).json({ success: false, error: 'Un avis a déjà été soumis pour cette commande' })
    }

    const review = await prisma.review.create({
      data: { restaurantId: restaurant.id, rating, title: title || undefined, content: content || undefined, orderId: order.id },
    })

    // Non-blocking: notify managers of new review
    prisma.notification.create({
      data: {
        type: 'REVIEW',
        title: `Nouvel avis ${rating}⭐`,
        message: content ? `« ${content.slice(0, 80)}${content.length > 80 ? '…' : ''} »` : `Nouvelle note ${rating}/5`,
        restaurantId: restaurant.id,
        targetRole: 'manager',
      },
    }).catch(() => {})

    const io = req.app.get('io')
    io?.to(restaurant.id).emit('notification:new', { type: 'REVIEW', rating })

    res.status(201).json({ success: true, data: review })
  } catch (error) { next(error) }
})

// GET /api/public/:slug/promotions — currently active public promotions
publicRouter.get('/:slug/promotions', async (req, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { slug: req.params.slug } })
    if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant introuvable' })
    const now = new Date()
    const promos = await prisma.promotion.findMany({
      where: {
        restaurantId: restaurant.id,
        isActive: true,
        OR: [{ channels: { has: 'ONLINE' } }, { channels: { has: 'BOTH' } }],
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      },
      select: { id: true, name: true, description: true, type: true, value: true, minOrderAmount: true, endDate: true },
      orderBy: { value: 'desc' },
      take: 5,
    })
    res.json({ success: true, data: promos })
  } catch (error) { next(error) }
})

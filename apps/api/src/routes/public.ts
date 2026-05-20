import { Router } from 'express'
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

// POST /api/public/:slug/orders — guest order
publicRouter.post('/:slug/orders', async (req, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { slug: req.params.slug } })
    if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant introuvable' })

    const { items, type = 'TAKEAWAY', notes, customerName, customerPhone, deliveryAddress, deliveryCity, tipAmount = 0 } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Panier vide' })
    }

    const subtotal = (items as Array<{ unitPrice: number; quantity: number }>)
      .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
    const deliveryFee = type === 'DELIVERY' ? (restaurant.deliveryFee ?? 0) : 0
    const taxRate = restaurant.defaultTaxRate ?? 20
    const taxAmount = subtotal * (taxRate / 100)
    const tip = Number(tipAmount) || 0
    const totalAmount = subtotal + taxAmount + deliveryFee + tip

    const contactNote = customerName ? `Client: ${customerName}${customerPhone ? ` — ${customerPhone}` : ''}` : undefined
    const fullNotes = [contactNote, notes].filter(Boolean).join(' | ') || undefined

    const order = await prisma.order.create({
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
        discountAmount: 0,
        totalAmount,
        items: {
          create: (items as Array<{ productId: string; quantity: number; unitPrice: number; notes?: string }>).map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.unitPrice * item.quantity,
            notes: item.notes,
          })),
        },
        statusHistory: {
          create: { status: 'PENDING', notes: 'Commande en ligne (client)' },
        },
      },
      include: { items: { include: { product: { select: { name: true } } } } },
    })

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
        notes: true,
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
    const { rating, title, content, orderNumber } = req.body as { rating: number; title?: string; content?: string; orderNumber?: string }
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ success: false, error: 'Note invalide (1-5)' })
    let orderId: string | undefined
    if (orderNumber) {
      const order = await prisma.order.findFirst({ where: { restaurantId: restaurant.id, orderNumber } })
      orderId = order?.id
    }
    const review = await prisma.review.create({
      data: { restaurantId: restaurant.id, rating, title: title || undefined, content: content || undefined, orderId },
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

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
        estimatedReadyAt: true, notes: true,
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

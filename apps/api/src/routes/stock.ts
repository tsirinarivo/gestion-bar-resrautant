import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const stockRouter = Router()
stockRouter.use(authenticate)

const stockItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sku: z.string().optional(),
  unit: z.string().min(1),
  currentQuantity: z.number().default(0),
  minQuantity: z.number().default(0),
  reorderQuantity: z.number().default(0),
  maxQuantity: z.number().optional(),
  location: z.string().optional(),
  costPerUnit: z.number().default(0),
  valuationMethod: z.enum(['FIFO', 'CMUP']).default('FIFO'),
  isPerishable: z.boolean().default(false),
  expiryDate: z.string().optional(),
  supplierId: z.string().optional(),
})

const movementSchema = z.object({
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'LOSS', 'TRANSFER']),
  quantity: z.number().positive(),
  unitCost: z.number().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  reference: z.string().optional(),
})

stockRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { location, search, lowStock } = req.query
    const where: any = { restaurantId: req.user!.restaurantId }
    if (location) where.location = location
    if (search) where.name = { contains: search as string, mode: 'insensitive' }
    if (lowStock === 'true') where.currentQuantity = { lte: prisma.stockItem.fields.minQuantity }

    const items = await prisma.stockItem.findMany({
      where,
      include: {
        supplier: true,
        alerts: { where: { isRead: false }, take: 3 },
        _count: { select: { movements: true } },
      },
      orderBy: { name: 'asc' },
    })

    const itemsWithStatus = items.map(item => ({
      ...item,
      stockStatus: item.currentQuantity <= 0 ? 'OUT_OF_STOCK'
        : item.currentQuantity <= item.minQuantity ? 'LOW_STOCK'
        : item.currentQuantity <= item.reorderQuantity ? 'REORDER_NEEDED'
        : 'OK',
    }))

    res.json({ success: true, data: itemsWithStatus })
  } catch (error) {
    next(error)
  }
})

stockRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const item = await prisma.stockItem.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: {
        supplier: true,
        movements: { orderBy: { createdAt: 'desc' }, take: 20 },
        alerts: { orderBy: { createdAt: 'desc' } },
        stockBatches: { orderBy: { receivedAt: 'asc' } },
      },
    })
    if (!item) throw new AppError('Article de stock introuvable', 404)
    res.json({ success: true, data: item })
  } catch (error) {
    next(error)
  }
})

stockRouter.post('/', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = stockItemSchema.parse(req.body)
    const item = await prisma.stockItem.create({
      data: {
        ...data,
        restaurantId: req.user!.restaurantId,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      },
    })
    res.status(201).json({ success: true, data: item })
  } catch (error) {
    next(error)
  }
})

stockRouter.put('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = stockItemSchema.partial().parse(req.body)
    const item = await prisma.stockItem.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!item) throw new AppError('Article introuvable', 404)
    const updated = await prisma.stockItem.update({ where: { id: item.id }, data })
    res.json({ success: true, data: updated })
  } catch (error) {
    next(error)
  }
})

// POST /api/stock/:id/movements — Record stock movement
stockRouter.post('/:id/movements', async (req: AuthRequest, res, next) => {
  try {
    const data = movementSchema.parse(req.body)
    const item = await prisma.stockItem.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!item) throw new AppError('Article introuvable', 404)

    const newQuantity = data.type === 'IN' || data.type === 'ADJUSTMENT'
      ? item.currentQuantity + data.quantity
      : item.currentQuantity - data.quantity

    if (newQuantity < 0) throw new AppError('Quantité insuffisante en stock', 400)

    const [movement, updatedItem] = await prisma.$transaction([
      prisma.stockMovement.create({
        data: {
          ...data,
          stockItemId: item.id,
          createdBy: req.user!.id,
        },
      }),
      prisma.stockItem.update({
        where: { id: item.id },
        data: { currentQuantity: newQuantity },
      }),
    ])

    // Check for low stock alert
    if (newQuantity <= item.minQuantity && item.currentQuantity > item.minQuantity) {
      await prisma.stockAlert.create({
        data: {
          type: newQuantity <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
          message: `Stock faible : ${item.name} (${newQuantity} ${item.unit} restants)`,
          stockItemId: item.id,
        },
      })

      const io = req.app.get('io')
      io?.to(req.user!.restaurantId).emit('stock:alert', {
        stockItemId: item.id,
        type: newQuantity <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
        message: `Stock faible : ${item.name}`,
      })
    }

    res.status(201).json({ success: true, data: { movement, stockItem: updatedItem } })
  } catch (error) {
    next(error)
  }
})

stockRouter.get('/:id/movements', async (req: AuthRequest, res, next) => {
  try {
    const { page = '1', limit = '50' } = req.query
    const item = await prisma.stockItem.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!item) throw new AppError('Article introuvable', 404)

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where: { stockItemId: item.id },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.stockMovement.count({ where: { stockItemId: item.id } }),
    ])

    res.json({ success: true, data: movements, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } })
  } catch (error) {
    next(error)
  }
})

// GET /api/stock/alerts — All stock alerts
stockRouter.get('/alerts/all', async (req: AuthRequest, res, next) => {
  try {
    const alerts = await prisma.stockAlert.findMany({
      where: { stockItem: { restaurantId: req.user!.restaurantId }, isRead: false },
      include: { stockItem: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: alerts })
  } catch (error) {
    next(error)
  }
})

stockRouter.patch('/alerts/:alertId/read', async (req: AuthRequest, res, next) => {
  try {
    await prisma.stockAlert.updateMany({
      where: { id: req.params.alertId, stockItem: { restaurantId: req.user!.restaurantId } },
      data: { isRead: true, resolvedAt: new Date() },
    })
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

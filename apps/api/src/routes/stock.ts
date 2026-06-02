import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const stockRouter = Router()
stockRouter.use(authenticate)

const supplierPriceSchema = z.object({
  supplierId: z.string(),
  unitCost: z.number().min(0),
  referenceCode: z.string().optional(),
  isPreferred: z.boolean().default(false),
})

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
  warehouseId: z.string().optional(),
  costPerUnit: z.number().default(0),
  valuationMethod: z.enum(['FIFO', 'CMUP']).default('FIFO'),
  isPerishable: z.boolean().default(false),
  expiryDate: z.string().optional(),
  supplierId: z.string().optional(),
  supplierPrices: z.array(supplierPriceSchema).optional(),
})

const movementSchema = z.object({
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'LOSS', 'TRANSFER']),
  quantity: z.number().min(0),
  unitCost: z.number().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  reference: z.string().optional(),
  expiryDate: z.string().optional(),
})

stockRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { location, search, lowStock } = req.query
    const where: any = { restaurantId: req.user!.restaurantId }
    if (location) where.location = location
    if (search) where.name = { contains: search as string, mode: 'insensitive' }
    // lowStock filter handled post-query via stockStatus field

    // Try with supplierPrices first; fall back without if table doesn't exist yet
    let items: any[]
    try {
      items = await prisma.stockItem.findMany({
        where,
        include: {
          supplier: true,
          alerts: { where: { isRead: false }, take: 3 },
          _count: { select: { movements: true } },
          supplierPrices: {
            include: { supplier: { select: { id: true, name: true } } },
            orderBy: { isPreferred: 'desc' },
          },
        },
        orderBy: { name: 'asc' },
        take: 200,
      })
    } catch {
      items = await prisma.stockItem.findMany({
        where,
        include: {
          supplier: true,
          alerts: { where: { isRead: false }, take: 3 },
          _count: { select: { movements: true } },
        },
        orderBy: { name: 'asc' },
        take: 200,
      })
    }

    const itemsWithStatus = items.map((item: any) => ({
      ...item,
      supplierPrices: item.supplierPrices ?? [],
      stockStatus: item.currentQuantity <= 0 ? 'OUT_OF_STOCK'
        : item.currentQuantity <= item.minQuantity ? 'LOW_STOCK'
        : item.currentQuantity <= item.reorderQuantity ? 'REORDER_NEEDED'
        : 'OK',
    }))

    const result = lowStock === 'true'
      ? itemsWithStatus.filter((i: any) => i.stockStatus === 'LOW_STOCK' || i.stockStatus === 'OUT_OF_STOCK')
      : itemsWithStatus

    res.json({ success: true, data: result })
  } catch (error) {
    next(error)
  }
})

// GET /api/stock/expiring — Perishable items expiring within N days
stockRouter.get('/expiring', async (req: AuthRequest, res, next) => {
  try {
    const days = parseInt(req.query.days as string) || 7
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + days)

    const items = await prisma.stockItem.findMany({
      where: {
        restaurantId: req.user!.restaurantId,
        isPerishable: true,
        expiryDate: { lte: cutoff },
        currentQuantity: { gt: 0 },
      },
      orderBy: { expiryDate: 'asc' },
    })
    res.json({ success: true, data: items })
  } catch (error) { next(error) }
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
    const { supplierPrices, ...rest } = stockItemSchema.parse(req.body)

    // Create base item first (always works)
    const item = await prisma.stockItem.create({
      data: {
        ...rest,
        restaurantId: req.user!.restaurantId,
        expiryDate: rest.expiryDate ? new Date(rest.expiryDate) : undefined,
      },
      include: { supplier: true },
    })

    // Add supplier prices if provided (requires stock_item_suppliers table — run db push)
    let itemWithPrices: any = { ...item, supplierPrices: [] }
    if (supplierPrices?.length) {
      try {
        await prisma.stockItemSupplier.createMany({
          data: supplierPrices.map((sp: any) => ({ ...sp, stockItemId: item.id })),
        })
        const withPrices = await prisma.stockItem.findUnique({
          where: { id: item.id },
          include: { supplier: true, supplierPrices: { include: { supplier: { select: { id: true, name: true } } } } },
        })
        itemWithPrices = withPrices ?? itemWithPrices
      } catch {
        // stock_item_suppliers table not yet created — prices ignored until db push
      }
    }

    res.status(201).json({ success: true, data: itemWithPrices })
  } catch (error) {
    next(error)
  }
})

stockRouter.put('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const { supplierPrices, ...rest } = stockItemSchema.partial().parse(req.body)
    const item = await prisma.stockItem.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!item) throw new AppError('Article introuvable', 404)

    const updated = await prisma.stockItem.update({
      where: { id: item.id },
      data: rest,
      include: { supplier: true },
    })

    // Update supplier prices (requires stock_item_suppliers table — run db push)
    let result: any = { ...updated, supplierPrices: [] }
    if (supplierPrices !== undefined) {
      try {
        await prisma.stockItemSupplier.deleteMany({ where: { stockItemId: item.id } })
        if (supplierPrices.length > 0) {
          await prisma.stockItemSupplier.createMany({
            data: supplierPrices.map((sp: any) => ({ ...sp, stockItemId: item.id })),
          })
        }
        const withPrices = await prisma.stockItem.findUnique({
          where: { id: item.id },
          include: { supplier: true, supplierPrices: { include: { supplier: { select: { id: true, name: true } } } } },
        })
        result = withPrices ?? result
      } catch {
        // stock_item_suppliers table not yet created — prices ignored until db push
      }
    }

    res.json({ success: true, data: result })
  } catch (error) {
    next(error)
  }
})

// POST /api/stock/:id/movements — Record stock movement
stockRouter.post('/:id/movements', async (req: AuthRequest, res, next) => {
  try {
    const { expiryDate, ...data } = movementSchema.parse(req.body)
    const item = await prisma.stockItem.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!item) throw new AppError('Article introuvable', 404)

    const newQuantity = data.type === 'IN'
      ? item.currentQuantity + data.quantity
      : data.type === 'ADJUSTMENT'
        ? data.quantity  // Pour ADJUSTMENT, quantity = nouvelle valeur absolue du stock
        : item.currentQuantity - data.quantity

    if (newQuantity < 0) throw new AppError('Quantité insuffisante en stock', 400)

    const stockUpdateData: any = { currentQuantity: newQuantity }
    if (data.type === 'IN' && expiryDate) stockUpdateData.expiryDate = new Date(expiryDate)

    const [movement, updatedItem] = await prisma.$transaction([
      prisma.stockMovement.create({
        data: { ...data, stockItemId: item.id, createdBy: req.user!.id },
      }),
      prisma.stockItem.update({
        where: { id: item.id },
        data: stockUpdateData,
      }),
    ])

    // Auto-create draft purchase order when stock falls below reorderQuantity
    if (
      item.reorderQuantity > 0 &&
      (data.type === 'OUT' || data.type === 'LOSS') &&
      newQuantity <= item.reorderQuantity &&
      item.currentQuantity > item.reorderQuantity &&
      item.supplierId
    ) {
      // Only create if no DRAFT order for this supplier already contains this item
      const existingDraft = await prisma.purchaseOrder.findFirst({
        where: { supplierId: item.supplierId, status: 'DRAFT', items: { some: { stockItemId: item.id } } },
      })
      if (!existingDraft) {
        const orderNumber = `BDC-AUTO-${Date.now()}`
        const reorderQty = Math.max(item.reorderQuantity * 2, item.maxQuantity ? item.maxQuantity - newQuantity : item.reorderQuantity * 2)
        const unitCost = item.costPerUnit
        await prisma.purchaseOrder.create({
          data: {
            orderNumber,
            status: 'DRAFT',
            supplierId: item.supplierId,
            notes: `Réapprovisionnement automatique — ${item.name} (stock: ${newQuantity} ${item.unit}, seuil: ${item.reorderQuantity})`,
            totalAmount: reorderQty * unitCost,
            items: { create: { stockItemId: item.id, quantity: reorderQty, unitCost, receivedQuantity: 0 } },
          },
        }).catch(() => {}) // non-blocking
        prisma.notification.create({
          data: {
            type: 'STOCK',
            title: 'BDC auto-généré',
            message: `BDC brouillon créé pour ${item.name} (seuil de réapprovisionnement atteint)`,
            targetRole: 'manager',
            restaurantId: req.user!.restaurantId,
            data: { stockItemId: item.id, supplierId: item.supplierId },
          },
        }).catch(() => {})
      }
    }

    // Check for low stock alert
    if (newQuantity <= item.minQuantity && item.currentQuantity > item.minQuantity) {
      const alertType = newQuantity <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK'
      const alertMessage = newQuantity <= 0
        ? `Rupture de stock : ${item.name}`
        : `Stock faible : ${item.name} (${newQuantity} ${item.unit} restants)`

      await Promise.all([
        prisma.stockAlert.create({
          data: { type: alertType, message: alertMessage, stockItemId: item.id },
        }),
        prisma.notification.create({
          data: {
            type: 'STOCK',
            title: alertType === 'OUT_OF_STOCK' ? 'Rupture de stock' : 'Stock faible',
            message: alertMessage,
            targetRole: 'manager',
            restaurantId: req.user!.restaurantId,
            data: { stockItemId: item.id, currentQuantity: newQuantity, unit: item.unit },
          },
        }),
      ])

      const io = req.app.get('io')
      if (io) {
        const payload = { stockItemId: item.id, type: alertType, message: alertMessage }
        io.to(req.user!.restaurantId).emit('stock:alert', payload)
        io.to(req.user!.restaurantId).emit('notification:new', payload)
      }
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

// GET /api/stock/movements/all — All stock movements for the restaurant
stockRouter.get('/movements/all', async (req: AuthRequest, res, next) => {
  try {
    const { page = '1', limit = '50', type, stockItemId, from, to } = req.query

    const where: any = { stockItem: { restaurantId: req.user!.restaurantId } }
    if (type) where.type = type
    if (stockItemId) where.stockItemId = stockItemId
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from as string)
      if (to) where.createdAt.lte = new Date(to as string)
    }

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: { stockItem: { select: { id: true, name: true, unit: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.stockMovement.count({ where }),
    ])

    res.json({
      success: true,
      data: movements,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/stock/alerts — All stock alerts (paginé pour éviter de charger
// des milliers d'alertes ignorées sur restaurant actif → OOM Node)
stockRouter.get('/alerts/all', async (req: AuthRequest, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const page = Math.max(Number(req.query.page) || 1, 1)
    const where = { stockItem: { restaurantId: req.user!.restaurantId }, isRead: false }
    const [alerts, total] = await Promise.all([
      prisma.stockAlert.findMany({
        where,
        select: {
          id: true, type: true, message: true, isRead: true, createdAt: true,
          stockItem: { select: { id: true, name: true, unit: true, currentQuantity: true, minQuantity: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.stockAlert.count({ where }),
    ])
    res.json({ success: true, data: alerts, pagination: { page, limit, total } })
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

// POST /api/stock/inventory-count — Physical inventory count: submit counted quantities, auto-create adjustments
stockRouter.post('/inventory-count', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const { items, notes } = z.object({
      items: z.array(z.object({
        stockItemId: z.string(),
        counted: z.number().min(0),
      })).min(1),
      notes: z.string().optional(),
    }).parse(req.body)

    const restaurantId = req.user!.restaurantId
    const userId = req.user!.id

    const stockItems = await prisma.stockItem.findMany({
      where: { id: { in: items.map(i => i.stockItemId) }, restaurantId },
      select: { id: true, name: true, currentQuantity: true, unit: true, minQuantity: true },
    })
    const stockMap = Object.fromEntries(stockItems.map(s => [s.id, s]))

    const adjustments: { stockItemId: string; name: string; system: number; counted: number; diff: number }[] = []
    const movements = []

    for (const item of items) {
      const stock = stockMap[item.stockItemId]
      if (!stock) continue
      const diff = item.counted - stock.currentQuantity
      if (Math.abs(diff) < 0.001) continue // no difference, skip

      adjustments.push({ stockItemId: item.stockItemId, name: stock.name, system: stock.currentQuantity, counted: item.counted, diff })
      movements.push({
        stockItemId: item.stockItemId,
        type: 'ADJUSTMENT' as const,
        quantity: Math.abs(diff),
        direction: diff > 0 ? 'IN' : 'OUT',
        reason: 'inventory_count',
        notes: notes || 'Inventaire physique',
        performedBy: userId,
        newQuantity: item.counted,
      })
    }

    // Apply all movements in a transaction
    if (movements.length > 0) {
      await prisma.$transaction(
        movements.map(m =>
          prisma.stockMovement.create({
            data: {
              stockItem: { connect: { id: m.stockItemId } },
              type: m.type,
              quantity: m.quantity,
              reason: m.reason,
              notes: m.notes,
              createdBy: m.performedBy,
            },
          })
        )
      )

      // Update stock quantities
      await prisma.$transaction(
        movements.map(m =>
          prisma.stockItem.update({
            where: { id: m.stockItemId },
            data: { currentQuantity: m.newQuantity },
          })
        )
      )
    }

    res.json({
      success: true,
      data: {
        adjusted: adjustments.length,
        unchanged: items.length - adjustments.length,
        adjustments,
      },
    })
  } catch (error) { next(error) }
})

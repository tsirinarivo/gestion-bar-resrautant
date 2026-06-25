import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'
import { moveStock, getLevelQty } from '../lib/stock-levels'

export const warehouseRouter = Router()
warehouseRouter.use(authenticate)
warehouseRouter.use(authorize('manager', 'superadmin'))

const warehouseSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

// GET /api/warehouses
warehouseRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId
    const warehouses = await prisma.warehouse.findMany({
      where: { restaurantId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    })
    const stats = await prisma.stockLevel.groupBy({
      by: ['warehouseId'],
      where: { warehouseId: { in: warehouses.map(w => w.id) }, quantity: { gt: 0 } },
      _count: { _all: true },
      _sum: { quantity: true },
    })
    const statMap = Object.fromEntries(stats.map(s => [s.warehouseId, s]))
    const data = warehouses.map(w => ({
      ...w,
      stockCount: statMap[w.id]?._count?._all ?? 0,
      stockQuantity: statMap[w.id]?._sum?.quantity ?? 0,
    }))
    res.json({ success: true, data })
  } catch (error) { next(error) }
})

// POST /api/warehouses
warehouseRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = warehouseSchema.parse(req.body)
    const restaurantId = req.user!.restaurantId
    if (data.isDefault) {
      await prisma.warehouse.updateMany({ where: { restaurantId }, data: { isDefault: false } })
    }
    const warehouse = await prisma.warehouse.create({ data: { ...data, restaurantId } })
    res.status(201).json({ success: true, data: warehouse })
  } catch (error) { next(error) }
})

// PUT /api/warehouses/:id
warehouseRouter.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const data = warehouseSchema.parse(req.body)
    const restaurantId = req.user!.restaurantId
    const existing = await prisma.warehouse.findFirst({ where: { id: req.params.id, restaurantId } })
    if (!existing) throw new AppError('Entrepôt introuvable', 404)
    if (data.isDefault) {
      await prisma.warehouse.updateMany({
        where: { restaurantId, id: { not: req.params.id } },
        data: { isDefault: false },
      })
    }
    const warehouse = await prisma.warehouse.update({ where: { id: req.params.id }, data })
    res.json({ success: true, data: warehouse })
  } catch (error) { next(error) }
})

// DELETE /api/warehouses/:id
warehouseRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId
    const warehouse = await prisma.warehouse.findFirst({ where: { id: req.params.id, restaurantId } })
    if (!warehouse) throw new AppError('Entrepôt introuvable', 404)
    if (warehouse.isDefault) throw new AppError("Impossible de supprimer l'entrepôt par défaut", 400)
    const stockCount = await prisma.stockLevel.count({ where: { warehouseId: req.params.id, quantity: { gt: 0 } } })
    if (stockCount > 0) throw new AppError(`Cet entrepôt contient ${stockCount} article(s) en stock`, 400)
    await prisma.stockLevel.deleteMany({ where: { warehouseId: req.params.id } })
    await prisma.warehouse.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (error) { next(error) }
})

// GET /api/warehouses/:id/stock — stock items in this warehouse
warehouseRouter.get('/:id/stock', async (req: AuthRequest, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId
    const warehouse = await prisma.warehouse.findFirst({ where: { id: req.params.id, restaurantId } })
    if (!warehouse) throw new AppError('Entrepôt introuvable', 404)
    const levels = await prisma.stockLevel.findMany({
      where: { warehouseId: req.params.id, stockItem: { restaurantId } },
      include: { stockItem: { include: { supplier: { select: { id: true, name: true } } } } },
      orderBy: { stockItem: { name: 'asc' } },
    })
    // On expose l'article enrichi de sa quantité DANS cet entrepôt.
    // `quantity` = niveau local (attendu par l'UI transfert) ; `currentQuantity`
    // reste le total tous entrepôts confondus.
    const items = levels.map((l: any) => ({
      ...l.stockItem,
      quantity: l.quantity,
      warehouseQuantity: l.quantity,
    }))
    res.json({ success: true, data: items })
  } catch (error) { next(error) }
})

// GET /api/warehouses/:id/movements — historique des mouvements dans cet entrepôt
warehouseRouter.get('/:id/movements', async (req: AuthRequest, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId
    const warehouse = await prisma.warehouse.findFirst({ where: { id: req.params.id, restaurantId } })
    if (!warehouse) throw new AppError('Entrepôt introuvable', 404)
    const movements = await prisma.stockMovement.findMany({
      where: { warehouseId: req.params.id, stockItem: { restaurantId } },
      include: { stockItem: { select: { id: true, name: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    res.json({ success: true, data: movements })
  } catch (error) { next(error) }
})

// ─── TRANSFERS ─────────────────────────────────────────────────────────────────

const transferSchema = z.object({
  fromWarehouseId: z.string(),
  toWarehouseId: z.string(),
  notes: z.string().optional(),
  reference: z.string().optional(),
  items: z.array(z.object({
    stockItemId: z.string(),
    quantity: z.number().positive(),
    unitCost: z.number().optional(),
    notes: z.string().optional(),
  })).min(1),
})

// GET /api/warehouses/transfers
warehouseRouter.get('/transfers', async (req: AuthRequest, res, next) => {
  try {
    const { status, page = '1', perPage = '20' } = req.query
    const where: Record<string, unknown> = { restaurantId: req.user!.restaurantId }
    if (status) where.status = status
    const [transfers, total] = await Promise.all([
      prisma.stockTransfer.findMany({
        where,
        include: {
          fromWarehouse: { select: { id: true, name: true } },
          toWarehouse: { select: { id: true, name: true } },
          items: { include: { stockItem: { select: { id: true, name: true, unit: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(perPage),
        take: Number(perPage),
      }),
      prisma.stockTransfer.count({ where }),
    ])
    res.json({
      success: true,
      data: transfers,
      meta: {
        total,
        page: Number(page),
        perPage: Number(perPage),
        pageCount: Math.ceil(total / Number(perPage)),
      },
    })
  } catch (error) { next(error) }
})

// POST /api/warehouses/transfers
warehouseRouter.post('/transfers', async (req: AuthRequest, res, next) => {
  try {
    const data = transferSchema.parse(req.body)
    const restaurantId = req.user!.restaurantId
    if (data.fromWarehouseId === data.toWarehouseId) {
      throw new AppError('Les entrepôts source et destination doivent être différents', 400)
    }
    const [from, to] = await Promise.all([
      prisma.warehouse.findFirst({ where: { id: data.fromWarehouseId, restaurantId } }),
      prisma.warehouse.findFirst({ where: { id: data.toWarehouseId, restaurantId } }),
    ])
    if (!from) throw new AppError('Entrepôt source introuvable', 404)
    if (!to) throw new AppError('Entrepôt destination introuvable', 404)
    // Validate all stock items exist and have enough quantity IN THE SOURCE WAREHOUSE
    for (const item of data.items) {
      const stockItem = await prisma.stockItem.findFirst({
        where: { id: item.stockItemId, restaurantId },
      })
      if (!stockItem) {
        throw new AppError(`Article ${item.stockItemId} introuvable`, 404)
      }
      const available = await getLevelQty(prisma, item.stockItemId, data.fromWarehouseId)
      if (available < item.quantity) {
        throw new AppError(
          `Stock insuffisant pour "${stockItem.name}" dans l'entrepôt source : ${available} ${stockItem.unit} disponible(s), ${item.quantity} demandé(s)`,
          400,
        )
      }
    }
    const transfer = await prisma.stockTransfer.create({
      data: {
        restaurantId,
        fromWarehouseId: data.fromWarehouseId,
        toWarehouseId: data.toWarehouseId,
        notes: data.notes,
        reference: data.reference,
        createdBy: req.user!.id,
        items: { create: data.items },
      },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        items: { include: { stockItem: true } },
      },
    })
    res.status(201).json({ success: true, data: transfer })
  } catch (error) { next(error) }
})

// POST /api/warehouses/transfers/:id/confirm — move to IN_TRANSIT
warehouseRouter.post('/transfers/:id/confirm', async (req: AuthRequest, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id: req.params.id, restaurantId },
      include: { items: { include: { stockItem: true } } },
    })
    if (!transfer) throw new AppError('Transfert introuvable', 404)
    if (transfer.status !== 'PENDING') throw new AppError("Ce transfert n'est plus en attente", 400)
    await prisma.stockTransfer.update({
      where: { id: req.params.id },
      data: { status: 'IN_TRANSIT' },
    })
    res.json({ success: true, data: { status: 'IN_TRANSIT' } })
  } catch (error) { next(error) }
})

// POST /api/warehouses/transfers/:id/complete — actually move the stock
warehouseRouter.post('/transfers/:id/complete', async (req: AuthRequest, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id: req.params.id, restaurantId },
      include: { items: { include: { stockItem: true } }, fromWarehouse: true, toWarehouse: true },
    })
    if (!transfer) throw new AppError('Transfert introuvable', 404)
    if (!['PENDING', 'IN_TRANSIT'].includes(transfer.status)) {
      throw new AppError('Ce transfert ne peut pas être complété', 400)
    }
    // Execute stock movements in a transaction
    await prisma.$transaction(async (tx) => {
      // Verrou logique : claim atomique du transfert en COMPLETED. Si un autre
      // appel concurrent l'a déjà passé en COMPLETED, count===0 → on rejette.
      const claim = await tx.stockTransfer.updateMany({
        where: { id: req.params.id, status: { in: ['PENDING', 'IN_TRANSIT'] } },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })
      if (claim.count === 0) {
        throw new AppError('Ce transfert a déjà été complété', 409)
      }
      for (const item of transfer.items) {
        const src = item.stockItem
        // Re-vérif du niveau source dans la transaction (anti survente concurrente)
        const available = await getLevelQty(tx, src.id, transfer.fromWarehouseId)
        if (available < item.quantity) {
          throw new AppError(
            `Stock insuffisant pour "${src.name}" dans ${transfer.fromWarehouse.name} : ${available} ${src.unit} disponible(s)`,
            400,
          )
        }
        // Déplacement du même article entre niveaux d'entrepôt (pas de duplication).
        // Le total currentQuantity est conservé.
        await moveStock(tx, {
          stockItemId: src.id,
          fromWarehouseId: transfer.fromWarehouseId,
          toWarehouseId: transfer.toWarehouseId,
          quantity: item.quantity,
        })
        await tx.stockMovement.create({
          data: {
            stockItemId: src.id,
            warehouseId: transfer.fromWarehouseId,
            type: 'TRANSFER',
            quantity: -item.quantity,
            unitCost: item.unitCost ?? src.costPerUnit,
            reference: transfer.id,
            notes: `Transfert vers ${transfer.toWarehouse.name}`,
            createdBy: req.user!.id,
          },
        })
        await tx.stockMovement.create({
          data: {
            stockItemId: src.id,
            warehouseId: transfer.toWarehouseId,
            type: 'TRANSFER',
            quantity: item.quantity,
            unitCost: item.unitCost ?? src.costPerUnit,
            reference: transfer.id,
            notes: `Transfert depuis ${transfer.fromWarehouse.name}`,
            createdBy: req.user!.id,
          },
        })
      }
    })
    res.json({ success: true, data: { status: 'COMPLETED' } })
  } catch (error) { next(error) }
})

// POST /api/warehouses/transfers/:id/cancel
warehouseRouter.post('/transfers/:id/cancel', async (req: AuthRequest, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId
    const transfer = await prisma.stockTransfer.findFirst({ where: { id: req.params.id, restaurantId } })
    if (!transfer) throw new AppError('Transfert introuvable', 404)
    if (transfer.status === 'COMPLETED') {
      throw new AppError('Impossible d\'annuler un transfert complété', 400)
    }
    await prisma.stockTransfer.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    })
    res.json({ success: true })
  } catch (error) { next(error) }
})

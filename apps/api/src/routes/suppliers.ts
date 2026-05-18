import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const supplierRouter = Router()
supplierRouter.use(authenticate)

const supplierSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default('MG'),
  notes: z.string().optional(),
  paymentTerms: z.string().optional(),
  deliveryDays: z.array(z.string()).default([]),
  leadTimeDays: z.number().int().default(2),
  isActive: z.boolean().default(true),
})

// GET /api/suppliers
supplierRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { restaurantId: req.user!.restaurantId },
      include: {
        _count: { select: { stockItems: true, purchaseOrders: true } },
      },
      orderBy: { name: 'asc' },
    })
    res.json({ success: true, data: suppliers })
  } catch (error) { next(error) }
})

// GET /api/suppliers/:id
supplierRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const supplier = await prisma.supplier.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: {
        stockItems: { select: { id: true, name: true, unit: true, currentQuantity: true, costPerUnit: true } },
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { items: { include: { stockItem: { select: { name: true, unit: true } } } } },
        },
        _count: { select: { stockItems: true, purchaseOrders: true } },
      },
    })
    if (!supplier) throw new AppError('Fournisseur introuvable', 404)
    res.json({ success: true, data: supplier })
  } catch (error) { next(error) }
})

// POST /api/suppliers
supplierRouter.post('/', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = supplierSchema.parse(req.body)
    const supplier = await prisma.supplier.create({
      data: { ...data, restaurantId: req.user!.restaurantId },
    })
    res.status(201).json({ success: true, data: supplier })
  } catch (error) { next(error) }
})

// PUT /api/suppliers/:id
supplierRouter.put('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = supplierSchema.partial().parse(req.body)
    const existing = await prisma.supplier.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!existing) throw new AppError('Fournisseur introuvable', 404)
    const supplier = await prisma.supplier.update({ where: { id: existing.id }, data })
    res.json({ success: true, data: supplier })
  } catch (error) { next(error) }
})

// DELETE /api/suppliers/:id
supplierRouter.delete('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const supplier = await prisma.supplier.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: { _count: { select: { purchaseOrders: true } } },
    })
    if (!supplier) throw new AppError('Fournisseur introuvable', 404)
    if (supplier._count.purchaseOrders > 0) {
      throw new AppError('Impossible de supprimer un fournisseur avec des commandes', 400)
    }
    await prisma.supplier.delete({ where: { id: supplier.id } })
    res.json({ success: true, message: 'Fournisseur supprimé' })
  } catch (error) { next(error) }
})

// ─── Purchase Orders ──────────────────────────────────────────────────────────

const poSchema = z.object({
  supplierId: z.string(),
  notes: z.string().optional(),
  expectedAt: z.string().optional(),
  items: z.array(z.object({
    stockItemId: z.string(),
    quantity: z.number().positive(),
    unitCost: z.number().min(0),
    notes: z.string().optional(),
  })).default([]),
})

// GET /api/suppliers/purchase-orders
supplierRouter.get('/purchase-orders/all', async (req: AuthRequest, res, next) => {
  try {
    const { status, supplierId } = req.query
    const where: any = { supplier: { restaurantId: req.user!.restaurantId } }
    if (status) where.status = status
    if (supplierId) where.supplierId = supplierId

    const orders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: { stockItem: { select: { name: true, unit: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: orders })
  } catch (error) { next(error) }
})

// GET /api/suppliers/purchase-orders/:id
supplierRouter.get('/purchase-orders/:id', async (req: AuthRequest, res, next) => {
  try {
    const order = await prisma.purchaseOrder.findFirst({
      where: {
        id: req.params.id,
        supplier: { restaurantId: req.user!.restaurantId },
      },
      include: {
        supplier: true,
        items: { include: { stockItem: true } },
      },
    })
    if (!order) throw new AppError('Bon de commande introuvable', 404)
    res.json({ success: true, data: order })
  } catch (error) { next(error) }
})

// POST /api/suppliers/purchase-orders — create draft
supplierRouter.post('/purchase-orders', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = poSchema.parse(req.body)
    const supplier = await prisma.supplier.findFirst({
      where: { id: data.supplierId, restaurantId: req.user!.restaurantId },
    })
    if (!supplier) throw new AppError('Fournisseur introuvable', 404)

    const orderNumber = `BC-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`
    const totalAmount = data.items.reduce((s, i) => s + i.quantity * i.unitCost, 0)

    const order = await prisma.purchaseOrder.create({
      data: {
        orderNumber,
        supplierId: data.supplierId,
        notes: data.notes,
        expectedAt: data.expectedAt ? new Date(data.expectedAt) : undefined,
        totalAmount,
        items: {
          create: data.items.map(i => ({
            stockItemId: i.stockItemId,
            quantity: i.quantity,
            unitCost: i.unitCost,
            notes: i.notes,
          })),
        },
      },
      include: { supplier: true, items: { include: { stockItem: true } } },
    })
    res.status(201).json({ success: true, data: order })
  } catch (error) { next(error) }
})

// PUT /api/suppliers/purchase-orders/:id — update draft
supplierRouter.put('/purchase-orders/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const order = await prisma.purchaseOrder.findFirst({
      where: { id: req.params.id, supplier: { restaurantId: req.user!.restaurantId } },
    })
    if (!order) throw new AppError('Bon de commande introuvable', 404)
    if (order.status !== 'DRAFT') throw new AppError('Seul un brouillon peut être modifié', 400)

    const data = poSchema.partial().parse(req.body)

    // Replace items if provided
    if (data.items) {
      await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: order.id } })
      const totalAmount = data.items.reduce((s, i) => s + i.quantity * i.unitCost, 0)
      await prisma.purchaseOrder.update({
        where: { id: order.id },
        data: {
          notes: data.notes,
          expectedAt: data.expectedAt ? new Date(data.expectedAt) : undefined,
          totalAmount,
          items: {
            create: data.items.map(i => ({
              stockItemId: i.stockItemId,
              quantity: i.quantity,
              unitCost: i.unitCost,
              notes: i.notes,
            })),
          },
        },
      })
    }

    const updated = await prisma.purchaseOrder.findUnique({
      where: { id: order.id },
      include: { supplier: true, items: { include: { stockItem: true } } },
    })
    res.json({ success: true, data: updated })
  } catch (error) { next(error) }
})

// PATCH /api/suppliers/purchase-orders/:id/status
supplierRouter.patch('/purchase-orders/:id/status', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const { status } = z.object({
      status: z.enum(['SENT', 'CONFIRMED', 'RECEIVED', 'CANCELLED']),
    }).parse(req.body)

    const order = await prisma.purchaseOrder.findFirst({
      where: { id: req.params.id, supplier: { restaurantId: req.user!.restaurantId } },
      include: { items: { include: { stockItem: true } } },
    })
    if (!order) throw new AppError('Bon de commande introuvable', 404)

    // Enforce forward-only workflow: DRAFT→SENT→CONFIRMED→RECEIVED, or any→CANCELLED
    const FLOW: Record<string, number> = { DRAFT: 0, SENT: 1, CONFIRMED: 2, RECEIVED: 3, CANCELLED: 4 }
    const currentRank = FLOW[order.status] ?? -1
    const newRank = FLOW[status] ?? -1
    if (status !== 'CANCELLED' && newRank <= currentRank) {
      throw new AppError(`Impossible de revenir à "${status}" depuis "${order.status}"`, 400)
    }
    if (order.status === 'RECEIVED' || order.status === 'CANCELLED') {
      throw new AppError(`Ce bon de commande est déjà "${order.status}"`, 400)
    }

    const updateData: any = { status }
    if (status === 'SENT') updateData.orderedAt = new Date()
    if (status === 'RECEIVED') updateData.receivedAt = new Date()

    const createdBy = req.user!.id

    await prisma.$transaction(async (tx) => {
      await tx.purchaseOrder.update({ where: { id: order.id }, data: updateData })

      if (status === 'RECEIVED') {
        for (const item of order.items) {
          const qty = item.receivedQuantity > 0 ? item.receivedQuantity : item.quantity
          const stockData: any = { currentQuantity: { increment: qty } }
          // Only update costPerUnit if supplier actually provided a price
          if (item.unitCost > 0) stockData.costPerUnit = item.unitCost
          await tx.stockItem.update({ where: { id: item.stockItemId }, data: stockData })
          await tx.stockMovement.create({
            data: {
              stockItemId: item.stockItemId,
              type: 'IN',
              quantity: qty,
              unitCost: item.unitCost,
              reason: `Réception BDC ${order.orderNumber}`,
              reference: order.id,
              createdBy,
            },
          })
        }
      }
    })

    const updated = await prisma.purchaseOrder.findUnique({
      where: { id: order.id },
      include: { supplier: true, items: { include: { stockItem: true } } },
    })
    res.json({ success: true, data: updated })
  } catch (error) { next(error) }
})

// DELETE /api/suppliers/purchase-orders/:id — only DRAFT
supplierRouter.delete('/purchase-orders/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const order = await prisma.purchaseOrder.findFirst({
      where: { id: req.params.id, supplier: { restaurantId: req.user!.restaurantId } },
    })
    if (!order) throw new AppError('Bon de commande introuvable', 404)
    if (!['DRAFT', 'CANCELLED'].includes(order.status)) {
      throw new AppError('Seuls les brouillons et annulations peuvent être supprimés', 400)
    }
    await prisma.purchaseOrder.delete({ where: { id: order.id } })
    res.json({ success: true, message: 'Bon de commande supprimé' })
  } catch (error) { next(error) }
})

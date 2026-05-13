import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const tableRouter = Router()
tableRouter.use(authenticate)

const tableSchema = z.object({
  number: z.number().int().positive(),
  name: z.string().optional(),
  capacity: z.number().int().positive(),
  minCapacity: z.number().int().default(1),
  shape: z.enum(['rectangle', 'circle', 'square']).default('rectangle'),
  width: z.number().default(100),
  height: z.number().default(80),
  posX: z.number().default(0),
  posY: z.number().default(0),
  rotation: z.number().default(0),
  section: z.string().optional(),
  isActive: z.boolean().default(true),
})

tableRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { status, section } = req.query
    const where: any = { restaurantId: req.user!.restaurantId }
    if (status) where.status = status
    if (section) where.section = section

    const tables = await prisma.diningTable.findMany({
      where,
      include: {
        orders: {
          where: { status: { in: ['CONFIRMED', 'PREPARING', 'READY', 'PENDING'] } },
          include: {
            items: { include: { product: true } },
            payments: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        reservations: {
          where: {
            date: { gte: new Date() },
            status: { in: ['CONFIRMED', 'PENDING'] },
          },
          orderBy: { date: 'asc' },
          take: 1,
        },
      },
      orderBy: { number: 'asc' },
    })

    res.json({ success: true, data: tables })
  } catch (error) {
    next(error)
  }
})

tableRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const table = await prisma.diningTable.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: {
        orders: {
          include: { items: { include: { product: true, modifiers: true } }, payments: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        reservations: { orderBy: { date: 'desc' }, take: 5 },
      },
    })
    if (!table) throw new AppError('Table introuvable', 404)
    res.json({ success: true, data: table })
  } catch (error) {
    next(error)
  }
})

tableRouter.post('/', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = tableSchema.parse(req.body)
    const restaurantId = req.user!.restaurantId

    const exists = await prisma.diningTable.findUnique({
      where: { restaurantId_number: { restaurantId, number: data.number } },
    })
    if (exists) throw new AppError(`La table numéro ${data.number} existe déjà`, 409)

    const table = await prisma.diningTable.create({ data: { ...data, restaurantId } })
    res.status(201).json({ success: true, data: table })
  } catch (error) {
    next(error)
  }
})

tableRouter.put('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = tableSchema.partial().parse(req.body)
    const table = await prisma.diningTable.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!table) throw new AppError('Table introuvable', 404)

    const updated = await prisma.diningTable.update({ where: { id: table.id }, data })
    res.json({ success: true, data: updated })
  } catch (error) {
    next(error)
  }
})

tableRouter.patch('/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const { status } = z.object({
      status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'BLOCKED']),
    }).parse(req.body)

    const table = await prisma.diningTable.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!table) throw new AppError('Table introuvable', 404)

    const updated = await prisma.diningTable.update({ where: { id: table.id }, data: { status } })

    const io = req.app.get('io')
    io?.to(req.user!.restaurantId).emit('table:status_changed', { tableId: table.id, status })

    res.json({ success: true, data: updated })
  } catch (error) {
    next(error)
  }
})

// Bulk update table positions (floor plan drag-and-drop)
tableRouter.put('/positions/bulk', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const { tables } = z.object({
      tables: z.array(z.object({
        id: z.string(),
        posX: z.number(),
        posY: z.number(),
        rotation: z.number().optional(),
      })),
    }).parse(req.body)

    await Promise.all(
      tables.map(t => prisma.diningTable.updateMany({
        where: { id: t.id, restaurantId: req.user!.restaurantId },
        data: { posX: t.posX, posY: t.posY, rotation: t.rotation },
      }))
    )

    res.json({ success: true, message: 'Positions mises à jour' })
  } catch (error) {
    next(error)
  }
})

tableRouter.delete('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const table = await prisma.diningTable.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!table) throw new AppError('Table introuvable', 404)
    if (table.status === 'OCCUPIED') throw new AppError('Impossible de supprimer une table occupée', 400)

    await prisma.diningTable.delete({ where: { id: table.id } })
    res.json({ success: true, message: 'Table supprimée' })
  } catch (error) {
    next(error)
  }
})

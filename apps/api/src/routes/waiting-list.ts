import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const waitingListRouter = Router()
waitingListRouter.use(authenticate)

const entrySchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().nullable(),
  partySize: z.number().int().min(1),
})

// GET /api/waiting-list
waitingListRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { status } = req.query
    const where: any = { restaurantId: req.user!.restaurantId }
    if (status) where.status = status
    else where.status = { in: ['WAITING', 'NOTIFIED'] } // default: active only

    const entries = await prisma.waitingList.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    })
    res.json({ success: true, data: entries })
  } catch (error) { next(error) }
})

// POST /api/waiting-list
waitingListRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = entrySchema.parse(req.body)
    const entry = await prisma.waitingList.create({
      data: { ...data, restaurantId: req.user!.restaurantId },
    })
    res.status(201).json({ success: true, data: entry })
  } catch (error) { next(error) }
})

// PATCH /api/waiting-list/:id/status
waitingListRouter.patch('/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const { status } = z.object({
      status: z.enum(['WAITING', 'NOTIFIED', 'SEATED', 'LEFT']),
    }).parse(req.body)

    const entry = await prisma.waitingList.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!entry) throw new AppError('Entrée introuvable', 404)

    const updateData: any = { status }
    if (status === 'NOTIFIED') updateData.notifiedAt = new Date()

    const updated = await prisma.waitingList.update({ where: { id: entry.id }, data: updateData })
    res.json({ success: true, data: updated })
  } catch (error) { next(error) }
})

// DELETE /api/waiting-list/:id
waitingListRouter.delete('/:id', authorize('manager', 'superadmin', 'serveur'), async (req: AuthRequest, res, next) => {
  try {
    const entry = await prisma.waitingList.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!entry) throw new AppError('Entrée introuvable', 404)
    await prisma.waitingList.delete({ where: { id: entry.id } })
    res.json({ success: true })
  } catch (error) { next(error) }
})

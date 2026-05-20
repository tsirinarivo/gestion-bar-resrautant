import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const notificationRouter = Router()
notificationRouter.use(authenticate)

function userFilter(req: AuthRequest) {
  return {
    restaurantId: req.user!.restaurantId,
    OR: [
      { recipientId: req.user!.id },
      { targetRole: (req.user as any).roleName, recipientId: null },
      { targetRole: null, recipientId: null },
    ],
  }
}

// GET /api/notifications
notificationRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { unreadOnly, limit = '30', skip = '0' } = req.query
    const filter = userFilter(req)
    const where: any = { ...filter }
    if (unreadOnly === 'true') where.isRead = false

    const [notifications, unreadCount, total] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: Math.min(Number(limit), 100), skip: Number(skip) }),
      prisma.notification.count({ where: { ...filter, isRead: false } }),
      prisma.notification.count({ where }),
    ])
    res.json({ success: true, data: notifications, unreadCount, total })
  } catch (error) { next(error) }
})

// DELETE /api/notifications/read — clear all read notifications
notificationRouter.delete('/read', async (req: AuthRequest, res, next) => {
  try {
    await prisma.notification.deleteMany({ where: { ...userFilter(req), isRead: true } })
    res.json({ success: true })
  } catch (error) { next(error) }
})

// PATCH /api/notifications/read-all
notificationRouter.patch('/read-all', async (req: AuthRequest, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { ...userFilter(req), isRead: false },
      data: { isRead: true, readAt: new Date() },
    })
    res.json({ success: true })
  } catch (error) { next(error) }
})

// PATCH /api/notifications/:id/read
notificationRouter.patch('/:id/read', async (req: AuthRequest, res, next) => {
  try {
    const n = await prisma.notification.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!n) throw new AppError('Notification introuvable', 404)
    const updated = await prisma.notification.update({
      where: { id: n.id },
      data: { isRead: true, readAt: new Date() },
    })
    res.json({ success: true, data: updated })
  } catch (error) { next(error) }
})

// DELETE /api/notifications/:id
notificationRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const n = await prisma.notification.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!n) throw new AppError('Notification introuvable', 404)
    await prisma.notification.delete({ where: { id: n.id } })
    res.json({ success: true })
  } catch (error) { next(error) }
})

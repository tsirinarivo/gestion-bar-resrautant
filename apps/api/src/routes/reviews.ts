import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const reviewRouter = Router()
reviewRouter.use(authenticate)

reviewRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { page = '1', limit = '20', isPublic } = req.query
    const where: any = { restaurantId: req.user!.restaurantId }
    if (isPublic !== undefined) where.isPublic = isPublic === 'true'

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: { customer: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.review.count({ where }),
    ])

    res.json({
      success: true,
      data: reviews,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
    })
  } catch (error) { next(error) }
})

reviewRouter.patch('/:id/reply', async (req: AuthRequest, res, next) => {
  try {
    const { reply } = z.object({ reply: z.string().min(1) }).parse(req.body)
    const review = await prisma.review.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!review) throw new AppError('Avis introuvable', 404)
    const updated = await prisma.review.update({
      where: { id: review.id },
      data: { reply, repliedAt: new Date() },
    })
    res.json({ success: true, data: updated })
  } catch (error) { next(error) }
})

reviewRouter.patch('/:id/visibility', async (req: AuthRequest, res, next) => {
  try {
    const { isPublic } = z.object({ isPublic: z.boolean() }).parse(req.body)
    const review = await prisma.review.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!review) throw new AppError('Avis introuvable', 404)
    const updated = await prisma.review.update({ where: { id: review.id }, data: { isPublic } })
    res.json({ success: true, data: updated })
  } catch (error) { next(error) }
})

reviewRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const review = await prisma.review.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!review) throw new AppError('Avis introuvable', 404)
    await prisma.review.delete({ where: { id: review.id } })
    res.json({ success: true, message: 'Avis supprimé' })
  } catch (error) { next(error) }
})

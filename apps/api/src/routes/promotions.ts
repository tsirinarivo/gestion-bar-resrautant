import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const promotionRouter = Router()
promotionRouter.use(authenticate)

const promoSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'BUY_X_GET_Y', 'FREE_DELIVERY']),
  value: z.number().positive(),
  minOrderAmount: z.number().optional(),
  maxDiscount: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.boolean().default(true),
  usageLimit: z.number().int().optional(),
  channels: z.array(z.string()).default(['BOTH']),
})

promotionRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const promos = await prisma.promotion.findMany({
      where: { restaurantId: req.user!.restaurantId },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: promos })
  } catch (error) { next(error) }
})

promotionRouter.post('/', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = promoSchema.parse(req.body)
    const promo = await prisma.promotion.create({
      data: {
        ...data,
        restaurantId: req.user!.restaurantId,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    })
    res.status(201).json({ success: true, data: promo })
  } catch (error) { next(error) }
})

promotionRouter.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const promo = await prisma.promotion.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!promo) throw new AppError('Promotion introuvable', 404)

    const data = promoSchema.partial().parse(req.body)
    const updated = await prisma.promotion.update({
      where: { id: promo.id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    })
    res.json({ success: true, data: updated })
  } catch (error) { next(error) }
})

promotionRouter.delete('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const promo = await prisma.promotion.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!promo) throw new AppError('Promotion introuvable', 404)
    await prisma.promotion.delete({ where: { id: promo.id } })
    res.json({ success: true, message: 'Promotion supprimée' })
  } catch (error) { next(error) }
})

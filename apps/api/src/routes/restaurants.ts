import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const restaurantRouter = Router()
restaurantRouter.use(authenticate)

restaurantRouter.get('/me', async (req: AuthRequest, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.user!.restaurantId },
    })
    if (!restaurant) throw new AppError('Restaurant introuvable', 404)
    res.json({ success: true, data: restaurant })
  } catch (error) {
    next(error)
  }
})

restaurantRouter.put('/me', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      logo: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      openingHours: z.any().optional(),
      defaultTaxRate: z.number().optional(),
      deliveryEnabled: z.boolean().optional(),
      pickupEnabled: z.boolean().optional(),
      dineInEnabled: z.boolean().optional(),
      minOrderAmount: z.number().optional(),
      deliveryFee: z.number().optional(),
      estimatedPrepTime: z.number().optional(),
    }).parse(req.body)

    const restaurant = await prisma.restaurant.update({
      where: { id: req.user!.restaurantId },
      data,
    })
    res.json({ success: true, data: restaurant })
  } catch (error) {
    next(error)
  }
})

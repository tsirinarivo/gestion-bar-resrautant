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
    // Schéma typé strict (pas de z.any()) + objet 'data' construit avec
    // whitelist explicite → impossible d'injecter un champ Prisma non listé
    // ici (ex: id, status, slug, abonnement) via le body.
    // openingHours est stocké tel quel en JSON. Le front utilise le format
    // { [jour]: { open: boolean, start: string, end: string } } → schéma
    // permissif (passthrough) pour ne jamais rejeter la sauvegarde sur ce champ.
    const openingHoursSchema = z.record(
      z.string(),
      z.object({
        open: z.boolean().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
      }).passthrough(),
    )
    const parsed = z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      logo: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      phone: z.string().optional(),
      // email souple : on ne bloque jamais la sauvegarde des réglages dessus
      email: z.string().optional(),
      openingHours: openingHoursSchema.optional(),
      defaultTaxRate: z.coerce.number().optional(),
      deliveryEnabled: z.boolean().optional(),
      pickupEnabled: z.boolean().optional(),
      dineInEnabled: z.boolean().optional(),
      minOrderAmount: z.coerce.number().optional(),
      deliveryFee: z.coerce.number().optional(),
      estimatedPrepTime: z.coerce.number().optional(),
      monthlyRevenueTarget: z.coerce.number().nullable().optional(),
      allowNegativeStock: z.boolean().optional(),
    }).parse(req.body)

    const data: Record<string, unknown> = {}
    for (const key of [
      'name', 'description', 'logo', 'address', 'city', 'phone', 'email',
      'openingHours', 'defaultTaxRate', 'deliveryEnabled', 'pickupEnabled',
      'dineInEnabled', 'minOrderAmount', 'deliveryFee', 'estimatedPrepTime',
      'monthlyRevenueTarget', 'allowNegativeStock',
    ] as const) {
      if (parsed[key] !== undefined) data[key] = parsed[key]
    }

    const restaurant = await prisma.restaurant.update({
      where: { id: req.user!.restaurantId },
      data,
    })
    res.json({ success: true, data: restaurant })
  } catch (error) {
    next(error)
  }
})

restaurantRouter.get('/users', authenticate, async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { restaurantId: req.user!.restaurantId, isActive: true },
      select: {
        id: true, firstName: true, lastName: true, email: true, avatar: true,
        role: { select: { displayName: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    })
    res.json({ success: true, data: users })
  } catch {
    res.status(500).json({ success: false, error: 'Erreur serveur' })
  }
})

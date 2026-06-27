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
    // openingHours est stocké tel quel en JSON et a connu plusieurs formats
    // ({ open: boolean, start, end } côté front, { open: "09:00", close } en
    // ancien). On ne valide pas sa structure pour ne jamais bloquer la
    // sauvegarde des réglages dessus.
    const openingHoursSchema = z.any()
    const parsed = z.object({
      // .nullable() : le formulaire renvoie les valeurs de la base telles
      // quelles, et les colonnes optionnelles (description, logo…) peuvent être
      // null → ne jamais bloquer la sauvegarde dessus.
      name: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      logo: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
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
      invoiceHeader: z.string().nullable().optional(),
      invoiceFooter: z.string().nullable().optional(),
      siteTemplate: z.enum(['classic', 'modern', 'compact']).optional(),
      sitePrimaryColor: z.string().nullable().optional(),
      siteTagline: z.string().nullable().optional(),
      siteHeroImage: z.string().nullable().optional(),
    }).parse(req.body)

    const data: Record<string, unknown> = {}
    for (const key of [
      'name', 'description', 'logo', 'address', 'city', 'phone', 'email',
      'openingHours', 'defaultTaxRate', 'deliveryEnabled', 'pickupEnabled',
      'dineInEnabled', 'minOrderAmount', 'deliveryFee', 'estimatedPrepTime',
      'monthlyRevenueTarget', 'allowNegativeStock', 'invoiceHeader', 'invoiceFooter',
      'siteTemplate', 'sitePrimaryColor', 'siteTagline', 'siteHeroImage',
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

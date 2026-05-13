import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'
import { slugify } from '@restaurant/utils'

export const categoryRouter = Router()
categoryRouter.use(authenticate)

const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  image: z.string().optional(),
  sortOrder: z.number().default(0),
  isActive: z.boolean().default(true),
  parentId: z.string().optional(),
})

categoryRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { withProducts } = req.query
    const categories = await prisma.category.findMany({
      where: { restaurantId: req.user!.restaurantId },
      include: {
        products: withProducts === 'true' ? {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: { variants: true },
        } : false,
        children: true,
        _count: { select: { products: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
    res.json({ success: true, data: categories })
  } catch (error) {
    next(error)
  }
})

categoryRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const category = await prisma.category.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: {
        products: { include: { variants: true } },
        children: true,
      },
    })
    if (!category) throw new AppError('Catégorie introuvable', 404)
    res.json({ success: true, data: category })
  } catch (error) {
    next(error)
  }
})

categoryRouter.post('/', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = categorySchema.parse(req.body)
    const restaurantId = req.user!.restaurantId
    const slug = slugify(data.name)

    const category = await prisma.category.create({
      data: { ...data, slug, restaurantId },
    })
    res.status(201).json({ success: true, data: category })
  } catch (error) {
    next(error)
  }
})

categoryRouter.put('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = categorySchema.partial().parse(req.body)
    const existing = await prisma.category.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!existing) throw new AppError('Catégorie introuvable', 404)

    const updateData: any = { ...data }
    if (data.name) updateData.slug = slugify(data.name)

    const category = await prisma.category.update({ where: { id: existing.id }, data: updateData })
    res.json({ success: true, data: category })
  } catch (error) {
    next(error)
  }
})

categoryRouter.delete('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const category = await prisma.category.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: { _count: { select: { products: true } } },
    })
    if (!category) throw new AppError('Catégorie introuvable', 404)
    if (category._count.products > 0) {
      throw new AppError('Impossible de supprimer une catégorie contenant des produits', 400)
    }
    await prisma.category.delete({ where: { id: category.id } })
    res.json({ success: true, message: 'Catégorie supprimée' })
  } catch (error) {
    next(error)
  }
})

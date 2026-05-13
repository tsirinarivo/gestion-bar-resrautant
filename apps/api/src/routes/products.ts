import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'
import { slugify } from '@restaurant/utils'

export const productRouter = Router()
productRouter.use(authenticate)

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  shortDesc: z.string().optional(),
  sku: z.string().optional(),
  price: z.number().positive(),
  comparePrice: z.number().optional(),
  costPrice: z.number().optional(),
  taxRate: z.number().default(10),
  image: z.string().optional(),
  images: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isNew: z.boolean().default(false),
  sortOrder: z.number().default(0),
  calories: z.number().optional(),
  proteins: z.number().optional(),
  carbs: z.number().optional(),
  fats: z.number().optional(),
  allergens: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  prepTime: z.number().default(10),
  categoryId: z.string(),
})

// GET /api/products
productRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const {
      categoryId, isActive, isAvailable, isFeatured,
      search, page = '1', limit = '50',
    } = req.query

    const where: any = { restaurantId: req.user!.restaurantId }
    if (categoryId) where.categoryId = categoryId
    if (isActive !== undefined) where.isActive = isActive === 'true'
    if (isAvailable !== undefined) where.isAvailable = isAvailable === 'true'
    if (isFeatured !== undefined) where.isFeatured = isFeatured === 'true'
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { sku: { contains: search as string, mode: 'insensitive' } },
      ]
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          variants: true,
          modifierGroups: { include: { modifierGroup: { include: { modifiers: true } } } },
          recipeItems: { include: { ingredient: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.product.count({ where }),
    ])

    res.json({
      success: true,
      data: products,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/products/:id
productRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: {
        category: true,
        variants: true,
        modifierGroups: { include: { modifierGroup: { include: { modifiers: true } } } },
        recipeItems: { include: { ingredient: true } },
      },
    })

    if (!product) throw new AppError('Produit introuvable', 404)
    res.json({ success: true, data: product })
  } catch (error) {
    next(error)
  }
})

// POST /api/products
productRouter.post('/', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = productSchema.parse(req.body)
    const restaurantId = req.user!.restaurantId

    const slug = slugify(data.name)

    const exists = await prisma.product.findUnique({ where: { restaurantId_slug: { restaurantId, slug } } })
    const finalSlug = exists ? `${slug}-${Date.now()}` : slug

    const product = await prisma.product.create({
      data: { ...data, slug: finalSlug, restaurantId, images: data.images || [] },
      include: { category: true, variants: true },
    })

    res.status(201).json({ success: true, data: product })
  } catch (error) {
    next(error)
  }
})

// PUT /api/products/:id
productRouter.put('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = productSchema.partial().parse(req.body)
    const restaurantId = req.user!.restaurantId

    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, restaurantId },
    })
    if (!existing) throw new AppError('Produit introuvable', 404)

    const updateData: any = { ...data }
    if (data.name && data.name !== existing.name) {
      const slug = slugify(data.name)
      const exists = await prisma.product.findFirst({
        where: { restaurantId, slug, id: { not: existing.id } },
      })
      updateData.slug = exists ? `${slug}-${Date.now()}` : slug
    }

    const product = await prisma.product.update({
      where: { id: existing.id },
      data: updateData,
      include: { category: true, variants: true },
    })

    res.json({ success: true, data: product })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/products/:id/availability
productRouter.patch('/:id/availability', authorize('manager', 'superadmin', 'caissier'), async (req: AuthRequest, res, next) => {
  try {
    const { isAvailable } = z.object({ isAvailable: z.boolean() }).parse(req.body)

    const product = await prisma.product.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!product) throw new AppError('Produit introuvable', 404)

    const updated = await prisma.product.update({
      where: { id: product.id },
      data: { isAvailable },
    })

    res.json({ success: true, data: updated })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/products/:id
productRouter.delete('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!product) throw new AppError('Produit introuvable', 404)

    await prisma.product.delete({ where: { id: product.id } })
    res.json({ success: true, message: 'Produit supprimé' })
  } catch (error) {
    next(error)
  }
})

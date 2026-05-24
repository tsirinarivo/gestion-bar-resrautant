import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const modifierGroupRouter = Router()
modifierGroupRouter.use(authenticate)

const groupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  minSelect: z.number().int().min(0).default(0),
  maxSelect: z.number().int().min(1).default(1),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
})

const modifierSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0).default(0),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

// GET /api/modifier-groups
modifierGroupRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const groups = await prisma.modifierGroup.findMany({
      where: { products: { some: { product: { restaurantId: req.user!.restaurantId } } } },
      include: {
        modifiers: { orderBy: { sortOrder: 'asc' } },
        products: { select: { productId: true, product: { select: { name: true } } } },
        _count: { select: { products: true, modifiers: true } },
      },
      orderBy: { sortOrder: 'asc' },
    })
    // Also include groups not assigned to any product (orphan groups)
    const orphanGroups = await prisma.modifierGroup.findMany({
      where: { products: { none: {} } },
      include: {
        modifiers: { orderBy: { sortOrder: 'asc' } },
        products: { select: { productId: true } },
        _count: { select: { products: true, modifiers: true } },
      },
      orderBy: { sortOrder: 'asc' },
    })
    const allGroups = [...groups, ...orphanGroups]
    const uniqueGroups = allGroups.filter((g, i, arr) => arr.findIndex(x => x.id === g.id) === i)
    res.json({ success: true, data: uniqueGroups })
  } catch (error) { next(error) }
})

// POST /api/modifier-groups
modifierGroupRouter.post('/', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = groupSchema.parse(req.body)
    const group = await prisma.modifierGroup.create({
      data,
      include: { modifiers: true, _count: { select: { products: true, modifiers: true } } },
    })
    res.status(201).json({ success: true, data: group })
  } catch (error) { next(error) }
})

// PUT /api/modifier-groups/:id
modifierGroupRouter.put('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = groupSchema.partial().parse(req.body)
    const restaurantId = req.user!.restaurantId
    const existing = await prisma.modifierGroup.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { products: { some: { product: { restaurantId } } } },
          { products: { none: {} } },
        ],
      },
    })
    if (!existing) throw new AppError('Groupe de modificateurs introuvable', 404)
    const group = await prisma.modifierGroup.update({
      where: { id: req.params.id },
      data,
      include: { modifiers: { orderBy: { sortOrder: 'asc' } }, _count: { select: { products: true, modifiers: true } } },
    })
    res.json({ success: true, data: group })
  } catch (error) { next(error) }
})

// DELETE /api/modifier-groups/:id
modifierGroupRouter.delete('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId
    const existing = await prisma.modifierGroup.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { products: { some: { product: { restaurantId } } } },
          { products: { none: {} } },
        ],
      },
    })
    if (!existing) throw new AppError('Groupe de modificateurs introuvable', 404)
    await prisma.modifierGroup.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (error) { next(error) }
})

// POST /api/modifier-groups/:id/modifiers
modifierGroupRouter.post('/:id/modifiers', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = modifierSchema.parse(req.body)
    const modifier = await prisma.modifier.create({ data: { ...data, groupId: req.params.id } })
    res.status(201).json({ success: true, data: modifier })
  } catch (error) { next(error) }
})

// PUT /api/modifier-groups/:id/modifiers/:modId
modifierGroupRouter.put('/:id/modifiers/:modId', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = modifierSchema.partial().parse(req.body)
    const modifier = await prisma.modifier.update({ where: { id: req.params.modId }, data })
    res.json({ success: true, data: modifier })
  } catch (error) { next(error) }
})

// DELETE /api/modifier-groups/:id/modifiers/:modId
modifierGroupRouter.delete('/:id/modifiers/:modId', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.modifier.delete({ where: { id: req.params.modId } })
    res.json({ success: true })
  } catch (error) { next(error) }
})

// POST /api/modifier-groups/:id/assign — assign group to a product
modifierGroupRouter.post('/:id/assign', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const { productId } = z.object({ productId: z.string() }).parse(req.body)
    await prisma.productModifierGroup.upsert({
      where: { productId_modifierGroupId: { productId, modifierGroupId: req.params.id } },
      create: { productId, modifierGroupId: req.params.id },
      update: {},
    })
    res.json({ success: true })
  } catch (error) { next(error) }
})

// DELETE /api/modifier-groups/:id/assign/:productId — unassign group from product
modifierGroupRouter.delete('/:id/assign/:productId', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.productModifierGroup.delete({
      where: { productId_modifierGroupId: { productId: req.params.productId, modifierGroupId: req.params.id } },
    })
    res.json({ success: true })
  } catch (error) { next(error) }
})

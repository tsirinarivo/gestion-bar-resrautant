import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const customerRouter = Router()
customerRouter.use(authenticate)

const customerSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  birthDate: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  acceptsMarketing: z.boolean().default(false),
  acceptsSms: z.boolean().default(false),
})

customerRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { search, page = '1', limit = '20' } = req.query
    const where: any = { restaurantId: req.user!.restaurantId }

    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string } },
      ]
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          loyaltyAccount: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.customer.count({ where }),
    ])

    res.json({
      success: true,
      data: customers,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
    })
  } catch (error) {
    next(error)
  }
})

customerRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: {
        loyaltyAccount: { include: { transactions: { orderBy: { createdAt: 'desc' }, take: 10 } } },
        orders: { include: { items: { include: { product: true } } }, orderBy: { createdAt: 'desc' }, take: 10 },
        reservations: { orderBy: { date: 'desc' }, take: 5 },
        addresses: true,
      },
    })
    if (!customer) throw new AppError('Client introuvable', 404)
    res.json({ success: true, data: customer })
  } catch (error) {
    next(error)
  }
})

customerRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = customerSchema.parse(req.body)
    const restaurantId = req.user!.restaurantId

    const customer = await prisma.customer.create({
      data: {
        ...data,
        restaurantId,
        birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
        loyaltyAccount: {
          create: { points: 0, totalEarned: 0, totalSpent: 0, tier: 'BRONZE' },
        },
      },
      include: { loyaltyAccount: true },
    })

    res.status(201).json({ success: true, data: customer })
  } catch (error) {
    next(error)
  }
})

customerRouter.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const data = customerSchema.partial().parse(req.body)
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!customer) throw new AppError('Client introuvable', 404)

    const updated = await prisma.customer.update({ where: { id: customer.id }, data })
    res.json({ success: true, data: updated })
  } catch (error) {
    next(error)
  }
})

// GET /api/customers/:id/loyalty — Loyalty stats
customerRouter.get('/:id/loyalty', async (req: AuthRequest, res, next) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: {
        loyaltyAccount: { include: { transactions: { orderBy: { createdAt: 'desc' }, take: 20 } } },
      },
    })
    if (!customer) throw new AppError('Client introuvable', 404)
    res.json({ success: true, data: customer.loyaltyAccount })
  } catch (error) {
    next(error)
  }
})

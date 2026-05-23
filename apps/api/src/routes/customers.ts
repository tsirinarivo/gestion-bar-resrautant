import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
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
  notes: z.string().nullable().optional(),
})

customerRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { search, page = '1', limit = '20', tier, acceptsMarketing, city, hasEmail, hasBirthday, sortBy } = req.query
    const where: any = { restaurantId: req.user!.restaurantId }

    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string } },
      ]
    }
    if (tier) where.loyaltyAccount = { tier: tier as string }
    if (acceptsMarketing === 'true') where.acceptsMarketing = true
    if (acceptsMarketing === 'false') where.acceptsMarketing = false
    if (city) where.city = { contains: city as string, mode: 'insensitive' }
    if (hasEmail === 'true') where.email = { not: null }
    if (hasBirthday === 'true') where.birthDate = { not: null }

    const orderBy: any = sortBy === 'orders' ? { orders: { _count: 'desc' } }
      : sortBy === 'points' ? { loyaltyAccount: { points: 'desc' } }
      : { createdAt: 'desc' }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          loyaltyAccount: true,
          _count: { select: { orders: true } },
        },
        orderBy,
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

// GET /api/customers/birthdays?days=7 — customers with upcoming birthdays
customerRouter.get('/birthdays', async (req: AuthRequest, res, next) => {
  try {
    const days = Math.min(Number(req.query.days ?? 7), 30)
    const all = await prisma.customer.findMany({
      where: { restaurantId: req.user!.restaurantId, birthDate: { not: null } },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, birthDate: true,
        loyaltyAccount: { select: { tier: true, points: true } } },
    })

    const today = new Date()
    const upcoming = all.filter(c => {
      if (!c.birthDate) return false
      const bd = new Date(c.birthDate)
      const thisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate())
      const nextYear = new Date(today.getFullYear() + 1, bd.getMonth(), bd.getDate())
      const nearest = thisYear >= today ? thisYear : nextYear
      const diff = (nearest.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      return diff <= days
    }).map(c => {
      const bd = new Date(c.birthDate!)
      const thisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate())
      const nearest = thisYear >= today ? thisYear : new Date(today.getFullYear() + 1, bd.getMonth(), bd.getDate())
      return { ...c, daysUntil: Math.round((nearest.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)), nextBirthday: nearest }
    }).sort((a, b) => a.daysUntil - b.daysUntil)

    res.json({ success: true, data: upcoming })
  } catch (error) { next(error) }
})

// GET /api/customers/check-duplicate?phone=&email= — check for existing customer (MUST be before /:id)
customerRouter.get('/check-duplicate', async (req: AuthRequest, res, next) => {
  try {
    const { phone, email } = req.query
    if (!phone && !email) return res.json({ success: true, data: null })

    const orConditions: any[] = []
    if (phone) orConditions.push({ phone: phone as string })
    if (email) orConditions.push({ email: email as string })

    const existing = await prisma.customer.findFirst({
      where: { restaurantId: req.user!.restaurantId, OR: orConditions },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true },
    })
    res.json({ success: true, data: existing })
  } catch (error) { next(error) }
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

customerRouter.put('/:id', authorize('manager', 'superadmin', 'caissier'), async (req: AuthRequest, res, next) => {
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

const adjustSchema = z.object({
  points: z.number().int().refine(n => n !== 0, { message: 'Points must be non-zero' }),
  reason: z.string().min(1, 'Reason is required'),
})

// POST /api/customers/:id/loyalty/adjust — Manual points adjustment
customerRouter.post('/:id/loyalty/adjust', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const { points, reason } = adjustSchema.parse(req.body)

    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: { loyaltyAccount: true },
    })
    if (!customer) throw new AppError('Client introuvable', 404)
    if (!customer.loyaltyAccount) throw new AppError('Compte fidélité introuvable', 404)

    const account = customer.loyaltyAccount
    const newBalance = account.points + points
    if (newBalance < 0) throw new AppError('Solde de points insuffisant', 400)

    // Recalculate tier based on totalEarned
    const totalEarned = points > 0 ? account.totalEarned + points : account.totalEarned
    let tier = 'BRONZE'
    if (totalEarned >= 10000) tier = 'PLATINUM'
    else if (totalEarned >= 5000) tier = 'GOLD'
    else if (totalEarned >= 1000) tier = 'SILVER'

    const [updatedAccount] = await prisma.$transaction([
      prisma.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          points: newBalance,
          totalEarned,
          tier,
          transactions: {
            create: {
              type: 'ADJUSTMENT',
              points,
              balance: newBalance,
              description: reason,
            },
          },
        },
        include: { transactions: { orderBy: { createdAt: 'desc' }, take: 20 } },
      }),
    ])

    res.json({ success: true, data: updatedAccount })
  } catch (error) {
    next(error)
  }
})

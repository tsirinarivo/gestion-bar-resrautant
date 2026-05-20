import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'
import { generateCouponCode } from '@restaurant/utils'

export const couponRouter = Router()
couponRouter.use(authenticate)

couponRouter.get('/', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const coupons = await prisma.coupon.findMany({
      where: { restaurantId: req.user!.restaurantId },
      include: { _count: { select: { usages: true } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: coupons })
  } catch (error) {
    next(error)
  }
})

couponRouter.post('/', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = z.object({
      code: z.string().optional(),
      description: z.string().optional(),
      type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_DELIVERY']),
      value: z.number().positive(),
      minOrderAmount: z.number().optional(),
      maxDiscount: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      usageLimit: z.number().int().optional(),
      usagePerUser: z.number().int().default(1),
      isActive: z.boolean().default(true),
      channels: z.array(z.string()).default(['ONLINE', 'POS']),
    }).parse(req.body)

    const coupon = await prisma.coupon.create({
      data: {
        ...data,
        code: (data.code || generateCouponCode()).toUpperCase(),
        restaurantId: req.user!.restaurantId,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    })

    res.status(201).json({ success: true, data: coupon })
  } catch (error) {
    next(error)
  }
})

// PUT /api/coupons/:id — Update coupon
couponRouter.put('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = z.object({
      code: z.string().optional(),
      description: z.string().optional(),
      type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_DELIVERY']).optional(),
      value: z.number().positive().optional(),
      minOrderAmount: z.number().nullable().optional(),
      maxDiscount: z.number().nullable().optional(),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
      usageLimit: z.number().int().nullable().optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body)

    const existing = await prisma.coupon.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!existing) throw new AppError('Coupon introuvable', 404)

    const coupon = await prisma.coupon.update({
      where: { id: req.params.id },
      data: {
        ...data,
        startDate: data.startDate === null ? null : data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate === null ? null : data.endDate ? new Date(data.endDate) : undefined,
      },
    })

    res.json({ success: true, data: coupon })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/coupons/:id — Delete coupon
couponRouter.delete('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.coupon.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!existing) throw new AppError('Coupon introuvable', 404)

    await prisma.coupon.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

// POST /api/coupons/bulk — Bulk generate coupons
couponRouter.post('/bulk', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const { count, prefix, type, value, description, endDate, usageLimit, minOrderAmount } = z.object({
      count: z.number().int().min(1).max(500),
      prefix: z.string().max(10).optional(),
      type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_DELIVERY']),
      value: z.number().positive(),
      description: z.string().optional(),
      endDate: z.string().optional(),
      usageLimit: z.number().int().optional(),
      minOrderAmount: z.number().optional(),
    }).parse(req.body)

    const restaurantId = req.user!.restaurantId
    const codes: string[] = []
    const maxAttempts = count * 5

    for (let i = 0; i < maxAttempts && codes.length < count; i++) {
      const raw = generateCouponCode(8)
      const code = prefix ? `${prefix.toUpperCase()}-${raw}` : raw
      if (!codes.includes(code)) codes.push(code)
    }

    const bulkData = codes.map(code => ({
      code,
      type,
      value,
      description: description || null,
      endDate: endDate ? new Date(endDate) : null,
      usageLimit: usageLimit || null,
      minOrderAmount: minOrderAmount || null,
      restaurantId,
      isActive: true,
    }))

    const result = await prisma.coupon.createMany({ data: bulkData, skipDuplicates: true })
    res.json({ success: true, data: { created: result.count } })
  } catch (error) { next(error) }
})

// POST /api/coupons/validate — Validate coupon code
couponRouter.post('/validate', async (req: AuthRequest, res, next) => {
  try {
    const { code, orderAmount } = z.object({
      code: z.string(),
      orderAmount: z.number(),
    }).parse(req.body)

    const coupon = await prisma.coupon.findFirst({
      where: { code: code.toUpperCase(), restaurantId: req.user!.restaurantId, isActive: true },
    })

    if (!coupon) throw new AppError('Code promo invalide', 404)
    if (coupon.endDate && coupon.endDate < new Date()) throw new AppError('Code promo expiré', 400)
    if (coupon.startDate && coupon.startDate > new Date()) throw new AppError('Code promo pas encore valide', 400)
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) throw new AppError('Code promo épuisé', 400)
    if (coupon.minOrderAmount && orderAmount < coupon.minOrderAmount) {
      throw new AppError(`Montant minimum de commande requis : Ar ${coupon.minOrderAmount}`, 400)
    }

    let discount = 0
    if (coupon.type === 'PERCENTAGE') {
      discount = orderAmount * (coupon.value / 100)
      if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount)
    } else if (coupon.type === 'FIXED_AMOUNT') {
      discount = Math.min(coupon.value, orderAmount)
    }

    res.json({ success: true, data: { coupon, discount } })
  } catch (error) {
    next(error)
  }
})

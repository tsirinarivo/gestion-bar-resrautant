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
        code: data.code || generateCouponCode(),
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

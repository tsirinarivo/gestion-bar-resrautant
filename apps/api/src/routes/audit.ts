import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'

export const auditRouter = Router()
auditRouter.use(authenticate)

// GET /api/audit
auditRouter.get('/', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const { action, resource, userId, from, to, page = '1', limit = '50' } = req.query
    const where: any = { restaurantId: req.user!.restaurantId }
    if (action) where.action = action
    if (resource) where.resource = resource
    if (userId) where.userId = userId
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from as string)
      if (to) where.createdAt.lte = new Date(to as string)
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.auditLog.count({ where }),
    ])

    res.json({
      success: true,
      data: logs,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
    })
  } catch (error) { next(error) }
})

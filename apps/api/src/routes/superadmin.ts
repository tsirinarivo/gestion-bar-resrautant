import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { startOfDay, endOfDay } from 'date-fns'

export const superadminRouter = Router()
superadminRouter.use(authenticate)
superadminRouter.use(authorize('superadmin'))

// GET /api/superadmin/restaurants — list all restaurants with today's KPIs
superadminRouter.get('/restaurants', async (_req: AuthRequest, res, next) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, slug: true, city: true, country: true,
        phone: true, email: true, monthlyRevenueTarget: true,
        createdAt: true,
      },
    })

    const todayStart = startOfDay(new Date())
    const todayEnd = endOfDay(new Date())

    const stats = await Promise.all(
      restaurants.map(async r => {
        const [todayAgg, ordersToday, openTables, lowStockCount, pendingReservations] = await Promise.all([
          prisma.order.aggregate({
            where: {
              restaurantId: r.id,
              createdAt: { gte: todayStart, lte: todayEnd },
              status: { notIn: ['CANCELLED'] },
            },
            _sum: { totalAmount: true },
            _count: { _all: true },
          }),
          prisma.order.count({
            where: { restaurantId: r.id, status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'] } },
          }),
          prisma.diningTable.count({
            where: { restaurantId: r.id, status: { in: ['OCCUPIED', 'RESERVED'] } },
          }),
          prisma.stockAlert.count({
            where: { stockItem: { restaurantId: r.id }, isRead: false },
          }),
          prisma.reservation.count({
            where: { restaurantId: r.id, status: 'PENDING' },
          }),
        ])

        return {
          ...r,
          stats: {
            revenueToday: todayAgg._sum.totalAmount ?? 0,
            ordersToday: todayAgg._count._all,
            activeOrders: ordersToday,
            tablesOccupied: openTables,
            stockAlerts: lowStockCount,
            pendingReservations,
          },
        }
      }),
    )

    res.json({ success: true, data: stats })
  } catch (error) { next(error) }
})

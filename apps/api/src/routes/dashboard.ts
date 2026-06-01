import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'

export const dashboardRouter = Router()
dashboardRouter.use(authenticate)

// GET /api/dashboard/kpis
dashboardRouter.get('/kpis', async (req: AuthRequest, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId
    const now = new Date()
    const todayStart = startOfDay(now)
    const todayEnd = endOfDay(now)
    const yesterdayStart = startOfDay(subDays(now, 1))
    const yesterdayEnd = endOfDay(subDays(now, 1))
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    const monthStart = startOfMonth(now)

    const [
      todayOrders,
      yesterdayOrders,
      weekOrders,
      monthOrders,
      pendingOrders,
      tables,
      topProducts,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: { restaurantId, createdAt: { gte: todayStart, lte: todayEnd }, status: { in: ['COMPLETED', 'DELIVERED'] } },
        _sum: { totalAmount: true, guestCount: true },
        _count: true,
        _avg: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: { restaurantId, createdAt: { gte: yesterdayStart, lte: yesterdayEnd }, status: { in: ['COMPLETED', 'DELIVERED'] } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { restaurantId, createdAt: { gte: weekStart }, status: { in: ['COMPLETED', 'DELIVERED'] } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { restaurantId, createdAt: { gte: monthStart }, status: { in: ['COMPLETED', 'DELIVERED'] } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.order.findMany({
        where: { restaurantId, status: { in: ['PENDING', 'CONFIRMED', 'PREPARING'] } },
        select: { id: true, status: true },
      }),
      prisma.diningTable.groupBy({
        by: ['status'],
        where: { restaurantId, isActive: true },
        _count: true,
      }),
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: {
            restaurantId,
            createdAt: { gte: todayStart },
            status: { in: ['COMPLETED', 'DELIVERED'] },
          },
        },
        _sum: { quantity: true, totalPrice: true },
        orderBy: { _sum: { totalPrice: 'desc' } },
        take: 10,
      }),
    ])

    const todayRevenue = todayOrders._sum.totalAmount || 0
    const yesterdayRevenue = yesterdayOrders._sum.totalAmount || 0
    const revenueTrend = yesterdayRevenue > 0
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
      : 0

    const tableStats = tables.reduce((acc, t) => {
      acc[t.status] = t._count
      return acc
    }, {} as Record<string, number>)

    const totalTables = Object.values(tableStats).reduce((s, c) => s + c, 0)
    const occupiedTables = tableStats['OCCUPIED'] || 0

    const topProductIds = topProducts.map(p => p.productId)
    const topProductData = await prisma.product.findMany({
      where: { id: { in: topProductIds } },
      select: { id: true, name: true },
    })
    const productMap = Object.fromEntries(topProductData.map(p => [p.id, p.name]))

    res.json({
      success: true,
      data: {
        revenue: {
          today: todayRevenue,
          yesterday: yesterdayRevenue,
          thisWeek: weekOrders._sum.totalAmount || 0,
          thisMonth: monthOrders._sum.totalAmount || 0,
          trend: Math.round(revenueTrend * 10) / 10,
        },
        orders: {
          today: todayOrders._count,
          pending: pendingOrders.filter(o => o.status === 'PENDING').length,
          inProgress: pendingOrders.filter(o => ['CONFIRMED', 'PREPARING'].includes(o.status)).length,
          completed: (weekOrders._count || 0),
        },
        tables: {
          total: totalTables,
          occupied: occupiedTables,
          available: tableStats['AVAILABLE'] || 0,
          reserved: tableStats['RESERVED'] || 0,
          occupancyRate: totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0,
        },
        averageTicket: Math.round((todayOrders._avg.totalAmount || 0) * 100) / 100,
        totalCovers: todayOrders._sum.guestCount || 0,
        topProducts: topProducts.map(p => ({
          productId: p.productId,
          name: productMap[p.productId] || 'Inconnu',
          quantity: p._sum.quantity || 0,
          revenue: p._sum.totalPrice || 0,
        })),
      },
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/dashboard/revenue-chart
dashboardRouter.get('/revenue-chart', async (req: AuthRequest, res, next) => {
  try {
    const { period = 'week' } = req.query
    const restaurantId = req.user!.restaurantId
    const now = new Date()

    let from: Date
    const to = endOfDay(now)
    const days = period === 'year' ? 365 : period === 'month' ? 30 : 7
    from = startOfDay(subDays(now, days - 1))

    const orders = await prisma.order.findMany({
      where: {
        restaurantId,
        createdAt: { gte: from, lte: to },
        status: { in: ['COMPLETED', 'DELIVERED'] },
      },
      select: {
        createdAt: true,
        totalAmount: true,
        guestCount: true,
      },
    })

    const dataMap = new Map<string, { revenue: number; orders: number; covers: number }>()
    for (let i = 0; i < days; i++) {
      const d = subDays(now, days - 1 - i)
      const key = d.toISOString().split('T')[0]
      dataMap.set(key, { revenue: 0, orders: 0, covers: 0 })
    }

    orders.forEach(order => {
      const key = order.createdAt.toISOString().split('T')[0]
      const existing = dataMap.get(key)
      if (existing) {
        existing.revenue += order.totalAmount
        existing.orders += 1
        existing.covers += order.guestCount
      }
    })

    const data = Array.from(dataMap.entries()).map(([date, values]) => ({ date, ...values }))

    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

// GET /api/dashboard/hourly-stats
dashboardRouter.get('/hourly-stats', async (req: AuthRequest, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId
    const { date } = req.query
    const targetDate = date ? new Date(date as string) : new Date()

    const orders = await prisma.order.findMany({
      where: {
        restaurantId,
        createdAt: { gte: startOfDay(targetDate), lte: endOfDay(targetDate) },
        status: { in: ['COMPLETED', 'DELIVERED'] },
      },
      select: { createdAt: true, totalAmount: true },
    })

    const hourlyData = Array.from({ length: 24 }, (_, i) => ({ hour: i, orders: 0, revenue: 0 }))

    orders.forEach(order => {
      const hour = order.createdAt.getHours()
      hourlyData[hour].orders += 1
      hourlyData[hour].revenue += order.totalAmount
    })

    res.json({ success: true, data: hourlyData })
  } catch (error) {
    next(error)
  }
})

// GET /api/dashboard/category-stats
dashboardRouter.get('/category-stats', async (req: AuthRequest, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId
    const { period = 'month' } = req.query
    const days = period === 'year' ? 365 : period === 'week' ? 7 : 30
    const from = startOfDay(subDays(new Date(), days))

    const data = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          restaurantId,
          createdAt: { gte: from },
          status: { in: ['COMPLETED', 'DELIVERED'] },
        },
      },
      _sum: { quantity: true, totalPrice: true },
    })

    const productIds = data.map(d => d.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { category: true },
    })
    const productMap = Object.fromEntries(products.map(p => [p.id, p]))

    const categoryMap = new Map<string, { name: string; revenue: number; quantity: number }>()

    data.forEach(item => {
      const product = productMap[item.productId]
      if (!product?.category) return
      const catId = product.category.id
      const existing = categoryMap.get(catId) || { name: product.category.name, revenue: 0, quantity: 0 }
      existing.revenue += item._sum.totalPrice || 0
      existing.quantity += item._sum.quantity || 0
      categoryMap.set(catId, existing)
    })

    const result = Array.from(categoryMap.entries()).map(([id, values]) => ({ id, ...values }))
      .sort((a, b) => b.revenue - a.revenue)

    res.json({ success: true, data: result })
  } catch (error) {
    next(error)
  }
})

// GET /api/dashboard/analytics
dashboardRouter.get('/analytics', async (req: AuthRequest, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId
    const now = new Date()

    // Daily revenue for last 30 days
    const thirtyDaysAgo = startOfDay(subDays(now, 29))
    const dailyOrders = await prisma.order.findMany({
      where: {
        restaurantId,
        createdAt: { gte: thirtyDaysAgo, lte: endOfDay(now) },
        status: { in: ['COMPLETED', 'DELIVERED'] },
      },
      select: { createdAt: true, totalAmount: true },
    })

    const dailyMap = new Map<string, { date: string; revenue: number; orders: number }>()
    for (let i = 29; i >= 0; i--) {
      const d = subDays(now, i)
      const key = d.toISOString().split('T')[0]
      dailyMap.set(key, { date: key, revenue: 0, orders: 0 })
    }
    dailyOrders.forEach(o => {
      const key = o.createdAt.toISOString().split('T')[0]
      const entry = dailyMap.get(key)
      if (entry) { entry.revenue += o.totalAmount; entry.orders += 1 }
    })
    const dailyRevenue = Array.from(dailyMap.values())

    // Hourly orders for last 7 days (rolling peak hours)
    const sevenDaysAgo = startOfDay(subDays(now, 6))
    const hourlyOrders7d = await prisma.order.findMany({
      where: {
        restaurantId,
        createdAt: { gte: sevenDaysAgo, lte: endOfDay(now) },
        status: { in: ['COMPLETED', 'DELIVERED'] },
      },
      select: { createdAt: true },
    })

    const hourlyMap = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }))
    hourlyOrders7d.forEach(o => {
      hourlyMap[o.createdAt.getHours()].count += 1
    })
    const hourlyOrders = hourlyMap

    // Orders by type for last 30 days
    const typeRaw = await prisma.order.groupBy({
      by: ['type'],
      where: {
        restaurantId,
        createdAt: { gte: thirtyDaysAgo },
        status: { in: ['COMPLETED', 'DELIVERED'] },
      },
      _count: true,
      _sum: { totalAmount: true },
    })

    const ordersByType = typeRaw.map(t => ({
      type: t.type,
      count: t._count,
      revenue: t._sum.totalAmount || 0,
    }))

    res.json({ success: true, data: { dailyRevenue, hourlyOrders, ordersByType } })
  } catch (error) {
    next(error)
  }
})

// GET /api/dashboard/staff-performance
dashboardRouter.get('/staff-performance', async (req: AuthRequest, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId
    const { from, to } = req.query
    const start = from ? new Date(from as string) : (() => { const d = new Date(); d.setDate(d.getDate() - 29); d.setHours(0,0,0,0); return d })()
    const end = to ? new Date(to as string) : new Date()

    // Use AuditLog to find who created each order
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        restaurantId,
        action: 'CREATE',
        resource: 'order',
        createdAt: { gte: start, lte: end },
        userId: { not: null },
      },
      select: { userId: true, resourceId: true },
    })

    if (auditLogs.length === 0) { res.json({ success: true, data: [] }); return }

    const orderIds = auditLogs.map(l => l.resourceId).filter(Boolean) as string[]
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds }, restaurantId, status: 'COMPLETED' },
      select: { id: true, totalAmount: true },
    })
    const orderMap = Object.fromEntries(orders.map(o => [o.id, o]))

    const byUser: Record<string, { userId: string; orderCount: number; totalRevenue: number }> = {}
    for (const log of auditLogs) {
      const uid = log.userId!
      const order = log.resourceId ? orderMap[log.resourceId] : undefined
      if (!order) continue
      if (!byUser[uid]) byUser[uid] = { userId: uid, orderCount: 0, totalRevenue: 0 }
      byUser[uid]!.orderCount++
      byUser[uid]!.totalRevenue += Number(order.totalAmount)
    }

    const userIds = Object.keys(byUser)
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    })
    const userMap = Object.fromEntries(users.map(u => [u.id, u]))

    const result = Object.values(byUser).map(row => ({
      ...row,
      user: userMap[row.userId] ?? null,
      avgTicket: row.orderCount > 0 ? row.totalRevenue / row.orderCount : 0,
    })).sort((a, b) => b.totalRevenue - a.totalRevenue)

    res.json({ success: true, data: result })
  } catch (error) { next(error) }
})

// GET /api/dashboard/kitchen-performance
dashboardRouter.get('/kitchen-performance', async (req: AuthRequest, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId
    const { from, to, days = '7' } = req.query as Record<string, string>
    const end = to ? endOfDay(new Date(to)) : endOfDay(new Date())
    const start = from ? startOfDay(new Date(from)) : startOfDay(subDays(end, (parseInt(days) || 7) - 1))

    // Fetch completed orders with timing data
    const orders = await prisma.order.findMany({
      where: {
        restaurantId,
        createdAt: { gte: start, lte: end },
        readyAt: { not: null },
        status: { in: ['READY', 'DELIVERED', 'COMPLETED'] },
      },
      select: {
        id: true,
        createdAt: true,
        confirmedAt: true,
        preparedAt: true,
        readyAt: true,
        completedAt: true,
        items: { select: { kdsStation: true } },
      },
    })

    // By-day breakdown
    const byDay: Record<string, { date: string; count: number; totalSecs: number; avgSecs: number }> = {}
    const byStation: Record<string, { station: string; count: number; totalSecs: number; avgSecs: number }> = {}

    let totalSecs = 0
    let totalCount = 0

    for (const order of orders) {
      if (!order.readyAt) continue
      const secs = (order.readyAt.getTime() - order.createdAt.getTime()) / 1000
      const dateKey = order.createdAt.toISOString().split('T')[0]!

      if (!byDay[dateKey]) byDay[dateKey] = { date: dateKey, count: 0, totalSecs: 0, avgSecs: 0 }
      byDay[dateKey]!.count++
      byDay[dateKey]!.totalSecs += secs

      // Per-station breakdown
      const stations = [...new Set(order.items.map(i => i.kdsStation || 'general'))]
      for (const station of stations) {
        if (!byStation[station]) byStation[station] = { station, count: 0, totalSecs: 0, avgSecs: 0 }
        byStation[station]!.count++
        byStation[station]!.totalSecs += secs
      }

      totalSecs += secs
      totalCount++
    }

    // Compute averages
    for (const d of Object.values(byDay)) d.avgSecs = d.count > 0 ? Math.round(d.totalSecs / d.count) : 0
    for (const s of Object.values(byStation)) s.avgSecs = s.count > 0 ? Math.round(s.totalSecs / s.count) : 0

    res.json({
      success: true,
      data: {
        period: { from: start, to: end },
        overall: {
          count: totalCount,
          avgSecs: totalCount > 0 ? Math.round(totalSecs / totalCount) : 0,
          avgMins: totalCount > 0 ? Math.round(totalSecs / totalCount / 60 * 10) / 10 : 0,
        },
        byDay: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
        byStation: Object.values(byStation).sort((a, b) => b.count - a.count),
      },
    })
  } catch (error) { next(error) }
})

// GET /api/dashboard/live
dashboardRouter.get('/live', async (req: AuthRequest, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId

    const [activeOrders, tables, stockAlerts, notifications] = await Promise.all([
      prisma.order.findMany({
        where: { restaurantId, status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'] } },
        include: { items: { include: { product: true } }, table: true },
        orderBy: { createdAt: 'asc' },
        take: 50,
      }),
      prisma.diningTable.findMany({
        where: { restaurantId, isActive: true },
        include: {
          orders: {
            where: { status: { in: ['CONFIRMED', 'PREPARING', 'READY'] } },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      prisma.stockAlert.findMany({
        where: { stockItem: { restaurantId }, isRead: false },
        include: { stockItem: true },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.findMany({
        where: { restaurantId, isRead: false },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
    ])

    res.json({
      success: true,
      data: { activeOrders, tables, stockAlerts, notifications },
    })
  } catch (error) {
    next(error)
  }
})

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const financesRouter = Router()
financesRouter.use(authenticate)
financesRouter.use(authorize('manager', 'superadmin'))

function getDateRange(period: string, year?: number, month?: number, from?: string, to?: string) {
  const now = new Date()
  const y = year ?? now.getFullYear()
  const m = month !== undefined ? month - 1 : now.getMonth()

  switch (period) {
    case 'today': {
      const start = new Date(now); start.setHours(0, 0, 0, 0)
      const end   = new Date(now); end.setHours(23, 59, 59, 999)
      return { start, end }
    }
    case 'week': {
      const start = new Date(now); start.setDate(now.getDate() - 6); start.setHours(0, 0, 0, 0)
      const end   = new Date(now); end.setHours(23, 59, 59, 999)
      return { start, end }
    }
    case 'month': {
      const start = new Date(y, m, 1)
      const end   = new Date(y, m + 1, 0, 23, 59, 59, 999)
      return { start, end }
    }
    case 'year': {
      const start = new Date(y, 0, 1)
      const end   = new Date(y, 11, 31, 23, 59, 59, 999)
      return { start, end }
    }
    case 'custom': {
      const start = from ? new Date(from) : new Date(now.getFullYear(), 0, 1)
      const end   = to   ? new Date(to)   : new Date()
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
    default: {
      const start = new Date(y, m, 1)
      const end   = new Date(y, m + 1, 0, 23, 59, 59, 999)
      return { start, end }
    }
  }
}

// GET /api/finances/summary?period=month&year=2024&month=5
financesRouter.get('/summary', async (req: AuthRequest, res, next) => {
  try {
    const { period = 'month', year, month, from, to } = req.query
    const restaurantId = req.user!.restaurantId
    const { start, end } = getDateRange(
      period as string,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
      from as string,
      to as string,
    )

    const [orders, expenses] = await Promise.all([
      prisma.order.findMany({
        where: {
          restaurantId,
          status: { in: ['COMPLETED', 'DELIVERED'] },
          createdAt: { gte: start, lte: end },
        },
        select: {
          totalAmount: true,
          subtotal: true,
          taxAmount: true,
          discountAmount: true,
          deliveryFee: true,
          items: {
            select: {
              quantity: true,
              product: { select: { costPrice: true } },
            },
          },
        },
      }),
      prisma.expense.findMany({
        where: { restaurantId, date: { gte: start, lte: end } },
      }),
    ])

    const revenue  = orders.reduce((s: number, o: any) => s + o.totalAmount, 0)
    const subtotal = orders.reduce((s: number, o: any) => s + o.subtotal, 0)
    const tax      = orders.reduce((s: number, o: any) => s + o.taxAmount, 0)
    const discount = orders.reduce((s: number, o: any) => s + o.discountAmount, 0)
    const delivery = orders.reduce((s: number, o: any) => s + (o.deliveryFee ?? 0), 0)

    let cogs = 0
    for (const order of orders) {
      for (const item of order.items) {
        if (item.product?.costPrice) {
          cogs += item.quantity * item.product.costPrice
        }
      }
    }

    const totalExpenses  = expenses.reduce((s: number, e: any) => s + e.amount, 0)
    const grossMargin    = revenue - cogs
    const grossMarginPct = revenue > 0 ? (grossMargin / revenue) * 100 : 0
    const netMargin      = grossMargin - totalExpenses
    const netMarginPct   = revenue > 0 ? (netMargin / revenue) * 100 : 0

    // Expenses by category
    const expensesByCategory: Record<string, number> = {}
    for (const e of expenses) {
      expensesByCategory[e.category] = (expensesByCategory[e.category] ?? 0) + e.amount
    }

    res.json({
      success: true,
      data: {
        period: { start, end },
        orders: orders.length,
        revenue,
        subtotal,
        tax,
        discount,
        delivery,
        cogs,
        grossMargin,
        grossMarginPct,
        totalExpenses,
        netMargin,
        netMarginPct,
        expensesByCategory,
      },
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/finances/trend?period=month&year=2024&month=5&granularity=day
financesRouter.get('/trend', async (req: AuthRequest, res, next) => {
  try {
    const { period = 'month', year, month, from, to, granularity = 'day' } = req.query
    const restaurantId = req.user!.restaurantId
    const { start, end } = getDateRange(
      period as string,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
      from as string,
      to as string,
    )

    const [orders, expenses] = await Promise.all([
      prisma.order.findMany({
        where: {
          restaurantId,
          status: { in: ['COMPLETED', 'DELIVERED'] },
          createdAt: { gte: start, lte: end },
        },
        select: {
          totalAmount: true,
          createdAt: true,
          items: {
            select: {
              quantity: true,
              product: { select: { costPrice: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.expense.findMany({
        where: { restaurantId, date: { gte: start, lte: end } },
        select: { amount: true, date: true },
        orderBy: { date: 'asc' },
      }),
    ])

    // Group by day or month
    const fmt = (d: Date) => granularity === 'month'
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      : d.toISOString().slice(0, 10)

    const map: Record<string, { revenue: number; cogs: number; expenses: number }> = {}

    for (const o of orders) {
      const key = fmt(new Date(o.createdAt))
      if (!map[key]) map[key] = { revenue: 0, cogs: 0, expenses: 0 }
      map[key].revenue += o.totalAmount
      for (const item of o.items) {
        if (item.product?.costPrice) map[key].cogs += item.quantity * item.product.costPrice
      }
    }

    for (const e of expenses) {
      const key = fmt(new Date(e.date))
      if (!map[key]) map[key] = { revenue: 0, cogs: 0, expenses: 0 }
      map[key].expenses += e.amount
    }

    const points = Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        revenue: Math.round(v.revenue),
        cogs: Math.round(v.cogs),
        expenses: Math.round(v.expenses),
        grossMargin: Math.round(v.revenue - v.cogs),
        netMargin: Math.round(v.revenue - v.cogs - v.expenses),
      }))

    res.json({ success: true, data: points })
  } catch (error) {
    next(error)
  }
})

// GET /api/finances/by-category?period=month&year=2024&month=5
financesRouter.get('/by-category', async (req: AuthRequest, res, next) => {
  try {
    const { period = 'month', year, month, from, to } = req.query
    const restaurantId = req.user!.restaurantId
    const { start, end } = getDateRange(
      period as string,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
      from as string,
      to as string,
    )

    const items = await prisma.orderItem.findMany({
      where: {
        order: {
          restaurantId,
          status: { in: ['COMPLETED', 'DELIVERED'] },
          createdAt: { gte: start, lte: end },
        },
      },
      select: {
        quantity: true,
        totalPrice: true,
        product: {
          select: {
            costPrice: true,
            category: { select: { id: true, name: true, icon: true } },
          },
        },
      },
    })

    const catMap: Record<string, { name: string; icon?: string; revenue: number; cogs: number; orders: number }> = {}

    for (const item of items) {
      const cat = item.product?.category
      if (!cat) continue
      if (!catMap[cat.id]) catMap[cat.id] = { name: cat.name, icon: cat.icon ?? undefined, revenue: 0, cogs: 0, orders: 0 }
      catMap[cat.id].revenue += item.totalPrice
      if (item.product?.costPrice) catMap[cat.id].cogs += item.quantity * item.product.costPrice
      catMap[cat.id].orders += item.quantity
    }

    const rows = Object.entries(catMap).map(([id, v]) => ({
      id,
      name: v.name,
      icon: v.icon,
      revenue: Math.round(v.revenue),
      cogs: Math.round(v.cogs),
      grossMargin: Math.round(v.revenue - v.cogs),
      grossMarginPct: v.revenue > 0 ? ((v.revenue - v.cogs) / v.revenue) * 100 : 0,
      itemsSold: v.orders,
    })).sort((a, b) => b.revenue - a.revenue)

    res.json({ success: true, data: rows })
  } catch (error) {
    next(error)
  }
})

// GET /api/finances/expenses?period=month&year=2024&month=5
financesRouter.get('/expenses', async (req: AuthRequest, res, next) => {
  try {
    const { period = 'month', year, month, from, to } = req.query
    const restaurantId = req.user!.restaurantId
    const { start, end } = getDateRange(
      period as string,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
      from as string,
      to as string,
    )

    const expenses = await prisma.expense.findMany({
      where: { restaurantId, date: { gte: start, lte: end } },
      orderBy: { date: 'desc' },
    })

    res.json({ success: true, data: expenses })
  } catch (error) {
    next(error)
  }
})

const expenseSchema = z.object({
  category: z.enum(['PERSONNEL', 'LOYER', 'ENERGIE', 'FOURNITURES', 'MARKETING', 'MAINTENANCE', 'AUTRE']),
  amount: z.number().positive(),
  date: z.string(),
  description: z.string().optional(),
})

// POST /api/finances/expenses
financesRouter.post('/expenses', async (req: AuthRequest, res, next) => {
  try {
    const data = expenseSchema.parse(req.body)
    const expense = await prisma.expense.create({
      data: {
        ...data,
        date: new Date(data.date),
        restaurantId: req.user!.restaurantId,
      },
    })
    res.status(201).json({ success: true, data: expense })
  } catch (error) {
    next(error)
  }
})

// PUT /api/finances/expenses/:id
financesRouter.put('/expenses/:id', async (req: AuthRequest, res, next) => {
  try {
    const expense = await prisma.expense.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!expense) throw new AppError('Charge introuvable', 404)

    const data = expenseSchema.parse(req.body)
    const updated = await prisma.expense.update({
      where: { id: expense.id },
      data: { ...data, date: new Date(data.date) },
    })
    res.json({ success: true, data: updated })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/finances/expenses/:id
financesRouter.delete('/expenses/:id', async (req: AuthRequest, res, next) => {
  try {
    const expense = await prisma.expense.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!expense) throw new AppError('Charge introuvable', 404)
    await prisma.expense.delete({ where: { id: expense.id } })
    res.json({ success: true, message: 'Charge supprimée' })
  } catch (error) {
    next(error)
  }
})

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'
import { loadPrinterCfg, sendPrintAndLog, escapeXprint } from '../lib/printer'

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
financesRouter.post('/expenses', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
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
financesRouter.put('/expenses/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
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

// GET /api/finances/rapport-journalier?date=YYYY-MM-DD
financesRouter.get('/rapport-journalier', async (req: AuthRequest, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId
    const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10)
    const day = new Date(dateStr)
    const start = new Date(day); start.setHours(0, 0, 0, 0)
    const end   = new Date(day); end.setHours(23, 59, 59, 999)

    const [orders, expenses, caisse, stockAlerts, topProducts] = await Promise.all([
      // Commandes complétées du jour
      prisma.order.findMany({
        where: { restaurantId, status: { in: ['COMPLETED', 'DELIVERED'] }, createdAt: { gte: start, lte: end } },
        include: { payments: true, items: { include: { product: { select: { name: true, costPrice: true } } } } },
      }),
      // Dépenses du jour
      prisma.expense.findMany({
        where: { restaurantId, date: { gte: start, lte: end } },
      }),
      // Session caisse du jour
      prisma.caisseSession.findFirst({
        where: { restaurantId, openedAt: { gte: start, lte: end } },
        include: { transactions: true },
        orderBy: { openedAt: 'desc' },
      }),
      // Alertes stock actives
      prisma.stockAlert.count({ where: { stockItem: { restaurantId }, isRead: false } }),
      // Top 10 produits vendus
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { restaurantId, status: { in: ['COMPLETED', 'DELIVERED'] }, createdAt: { gte: start, lte: end } } },
        _sum: { quantity: true, totalPrice: true },
        orderBy: { _sum: { totalPrice: 'desc' } },
        take: 10,
      }),
    ])

    // Calculs CA
    const totalRevenue  = orders.reduce((s, o) => s + o.totalAmount, 0)
    const totalTax      = orders.reduce((s, o) => s + o.taxAmount, 0)
    const totalDiscount = orders.reduce((s, o) => s + o.discountAmount, 0)
    const totalTip      = orders.reduce((s, o) => s + (o.tipAmount || 0), 0)
    const totalCOGS     = orders.reduce((s, o) => s + o.items.reduce((si, i) => si + (i.product?.costPrice || 0) * i.quantity, 0), 0)
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
    const grossMargin   = totalRevenue - totalCOGS
    const netMargin     = grossMargin - totalExpenses

    // CA par mode de paiement
    const byMethod: Record<string, number> = {}
    for (const order of orders) {
      for (const p of order.payments) {
        if (p.status === 'COMPLETED') byMethod[p.method] = (byMethod[p.method] || 0) + p.amount
      }
    }

    // Top produits enrichis
    const productIds = topProducts.map(p => p.productId)
    const productNames = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
    const nameMap = Object.fromEntries(productNames.map(p => [p.id, p.name]))
    const topProductsList = topProducts.map(p => ({
      productId: p.productId,
      name: nameMap[p.productId] || 'Inconnu',
      quantity: p._sum.quantity || 0,
      revenue: p._sum.totalPrice || 0,
    }))

    // Résumé caisse
    let caisseExpected = 0, caisseDiff: number | null = null
    if (caisse) {
      caisseExpected = caisse.openingFloat
      for (const t of caisse.transactions) {
        if (['SALE', 'WITHDRAWAL'].includes(t.type)) caisseExpected += t.amount
        else if (['REFUND', 'EXPENSE', 'DEPOSIT'].includes(t.type)) caisseExpected -= t.amount
        else if (t.type === 'ADJUSTMENT') caisseExpected += t.amount
      }
      if (caisse.closingFloat !== null) caisseDiff = caisse.closingFloat - caisseExpected
    }

    res.json({
      success: true,
      data: {
        date: dateStr,
        orders: { count: orders.length, totalRevenue, totalTax, totalDiscount, totalTip, totalCOGS, grossMargin, netMargin },
        byPaymentMethod: byMethod,
        expenses: { total: totalExpenses, items: expenses },
        caisse: caisse ? { id: caisse.id, status: caisse.status, openingFloat: caisse.openingFloat, expectedCash: caisseExpected, closingFloat: caisse.closingFloat, difference: caisseDiff, openedAt: caisse.openedAt, closedAt: caisse.closedAt } : null,
        topProducts: topProductsList,
        stockAlerts,
      },
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/finances/rapport-journalier/print?date=YYYY-MM-DD
financesRouter.post('/rapport-journalier/print', async (req: AuthRequest, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId
    const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10)
    const day = new Date(dateStr)
    const start = new Date(day); start.setHours(0, 0, 0, 0)
    const end   = new Date(day); end.setHours(23, 59, 59, 999)

    const cfg = await loadPrinterCfg(restaurantId)
    if (!cfg) throw new AppError('Imprimante non configurée', 404)

    const [restaurant, orders, expenses, caisse, stockAlerts, topProducts] = await Promise.all([
      prisma.restaurant.findUnique({ where: { id: restaurantId } }),
      prisma.order.findMany({
        where: { restaurantId, status: { in: ['COMPLETED', 'DELIVERED'] }, createdAt: { gte: start, lte: end } },
        include: { payments: true, items: { include: { product: { select: { name: true, costPrice: true } } } } },
      }),
      prisma.expense.findMany({ where: { restaurantId, date: { gte: start, lte: end } } }),
      prisma.caisseSession.findFirst({
        where: { restaurantId, openedAt: { gte: start, lte: end } },
        include: { transactions: true },
        orderBy: { openedAt: 'desc' },
      }),
      prisma.stockAlert.count({ where: { stockItem: { restaurantId }, isRead: false } }),
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { restaurantId, status: { in: ['COMPLETED', 'DELIVERED'] }, createdAt: { gte: start, lte: end } } },
        _sum: { quantity: true, totalPrice: true },
        orderBy: { _sum: { totalPrice: 'desc' } },
        take: 5,
      }),
    ])

    // Calculs
    const totalRevenue  = orders.reduce((s, o) => s + o.totalAmount, 0)
    const totalDiscount = orders.reduce((s, o) => s + o.discountAmount, 0)
    const totalTip      = orders.reduce((s, o) => s + (o.tipAmount || 0), 0)
    const totalCOGS     = orders.reduce((s, o) => s + o.items.reduce((si, i) => si + (i.product?.costPrice || 0) * i.quantity, 0), 0)
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
    const grossMargin   = totalRevenue - totalCOGS
    const netMargin     = grossMargin - totalExpenses

    const byMethod: Record<string, number> = {}
    for (const order of orders)
      for (const p of order.payments)
        if (p.status === 'COMPLETED') byMethod[p.method] = (byMethod[p.method] || 0) + p.amount

    let caisseExpected = 0, caisseDiff: number | null = null
    if (caisse) {
      caisseExpected = caisse.openingFloat
      for (const t of caisse.transactions) {
        if (['SALE', 'WITHDRAWAL'].includes(t.type)) caisseExpected += t.amount
        else if (['REFUND', 'EXPENSE', 'DEPOSIT'].includes(t.type)) caisseExpected -= t.amount
        else if (t.type === 'ADJUSTMENT') caisseExpected += t.amount
      }
      if (caisse.closingFloat !== null) caisseDiff = caisse.closingFloat - caisseExpected
    }

    const productIds  = topProducts.map(p => p.productId)
    const productNames = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
    const nameMap = Object.fromEntries(productNames.map(p => [p.id, p.name]))

    const PAYMENT_LABELS: Record<string, string> = {
      CASH: 'Especes', MVOLA: 'MVola', ORANGE_MONEY: 'Orange Money',
      AIRTEL_MONEY: 'Airtel Money', CARD: 'Carte', BNI_MOBILE: 'BNI Mobile',
      BOA_MOBILE: 'BOA Mobile', VIREMENT: 'Virement', CHEQUE: 'Cheque',
      VOUCHER: 'Bon', WALLET: 'Wallet',
    }

    // ── Formatage XPyun 48 chars ───────────────────────────────────────────
    const W = 48
    const div  = (c = '-') => c.repeat(W)
    const esc  = (s: string) => escapeXprint(String(s))
    const fmt  = (n: number) =>
      new Intl.NumberFormat('fr-FR').format(Math.round(n))
        .replace(/[   ]/g, '.') + ' MGA'
    function row(label: string, value: string): string {
      const pad = W - label.length - value.length
      if (pad > 0) return label + ' '.repeat(pad) + value
      return label.slice(0, Math.max(0, W - value.length - 1)) + ' ' + value
    }

    const L = (s: string) => `<L>${esc(s)}</L>`
    const C = (s: string) => `<C>${esc(s)}</C>`
    const B = (s: string) => `<C><B>${esc(s)}</B></C>`

    const lines: string[] = []
    const dateLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

    // En-tête
    lines.push(B(restaurant?.name?.toUpperCase() ?? 'RESTAURANT'))
    if (restaurant?.address) lines.push(C(restaurant.address))
    if (restaurant?.phone)   lines.push(C(restaurant.phone))
    lines.push(div('='))
    lines.push(B('RAPPORT JOURNALIER'))
    lines.push(C(dateLabel))
    lines.push(div('='))

    // Ventes
    lines.push(L('<B>VENTES</B>'))
    lines.push(div())
    lines.push(L(row(`Commandes`, String(orders.length))))
    lines.push(L(row('Chiffre d\'affaires', fmt(totalRevenue))))
    if (totalDiscount > 0) lines.push(L(row('Remises accordees', fmt(totalDiscount))))
    if (totalTip > 0)      lines.push(L(row('Pourboires', fmt(totalTip))))

    // Marge
    lines.push(div())
    lines.push(L('<B>MARGE</B>'))
    lines.push(div())
    lines.push(L(row('COGS (cout matieres)', fmt(totalCOGS))))
    lines.push(L(row('Marge brute', fmt(grossMargin))))
    if (totalExpenses > 0) lines.push(L(row('Depenses', fmt(totalExpenses))))
    lines.push(L(row('Marge nette', fmt(netMargin))))

    // Paiements par mode
    if (Object.keys(byMethod).length > 0) {
      lines.push(div())
      lines.push(L('<B>ENCAISSEMENTS</B>'))
      lines.push(div())
      for (const [method, amount] of Object.entries(byMethod)) {
        lines.push(L(row(PAYMENT_LABELS[method] ?? method, fmt(amount))))
      }
      lines.push(div())
      lines.push(L(row('TOTAL ENCAISSE', fmt(Object.values(byMethod).reduce((s, v) => s + v, 0)))))
    }

    // Top produits
    if (topProducts.length > 0) {
      lines.push(div())
      lines.push(L('<B>TOP PRODUITS</B>'))
      lines.push(div())
      topProducts.forEach((p, i) => {
        const name = (nameMap[p.productId] ?? 'Inconnu').slice(0, 28)
        const qty  = `${p._sum.quantity ?? 0} pcs`
        lines.push(L(row(`${i + 1}. ${name}`, qty)))
        lines.push(L(row('   ' + fmt(p._sum.totalPrice ?? 0), '')))
      })
    }

    // Caisse
    if (caisse) {
      lines.push(div())
      lines.push(L('<B>CAISSE</B>'))
      lines.push(div())
      lines.push(L(row('Statut', caisse.status === 'OPEN' ? 'Ouverte' : 'Fermee')))
      lines.push(L(row('Fond d\'ouverture', fmt(caisse.openingFloat))))
      lines.push(L(row('Especes attendues', fmt(caisseExpected))))
      if (caisse.closingFloat !== null) {
        lines.push(L(row('Fond de fermeture', fmt(caisse.closingFloat))))
        const ecart = caisseDiff ?? 0
        lines.push(L(row('Ecart', (ecart >= 0 ? '+' : '') + fmt(ecart))))
      }
    }

    // Alertes & pied de page
    lines.push(div('='))
    if (stockAlerts > 0) lines.push(C(`! ${stockAlerts} alerte(s) stock en cours`))
    lines.push(C(`Imprime le ${new Date().toLocaleString('fr-FR')}`))
    lines.push(C(`Par ${req.user!.firstName} ${req.user!.lastName}`.trim()))

    const content = lines.join('<BR>')
    await sendPrintAndLog(restaurantId, content, { kind: 'rapport_journalier', relatedId: dateStr })

    res.json({ success: true, message: 'Rapport envoyé à l\'imprimante' })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/finances/expenses/:id
financesRouter.delete('/expenses/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
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

// GET /api/finances/tax-report — TVA collectée par période
financesRouter.get('/tax-report', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId
    const { from, to } = req.query
    const start = from ? new Date(from as string) : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d })()
    const end = to ? new Date(to as string) : new Date()

    const orders = await prisma.order.findMany({
      where: {
        restaurantId,
        status: 'COMPLETED',
        completedAt: { gte: start, lte: end },
      },
      select: {
        id: true, orderNumber: true, completedAt: true,
        subtotal: true, taxAmount: true, totalAmount: true, discountAmount: true,
        items: { select: { unitPrice: true, quantity: true, product: { select: { taxRate: true } } } },
      },
    })

    // Aggregate TVA by tax rate
    const byRate: Record<number, { rate: number; baseHT: number; tva: number; count: number }> = {}
    let totalHT = 0
    let totalTVA = 0
    let totalTTC = 0

    for (const order of orders) {
      for (const item of order.items) {
        // Pas de fallback 20% : si le produit n'a pas de taxRate configuré, on
        // considère qu'il n'y a pas de TVA (cohérent avec orders.ts qui force
        // taxAmount=0). Pour avoir un rapport TVA correct, configurer taxRate
        // sur chaque produit côté admin.
        const rate = item.product?.taxRate ?? 0
        const ttc = item.unitPrice * item.quantity
        const ht = ttc / (1 + rate / 100)
        const tva = ttc - ht
        if (!byRate[rate]) byRate[rate] = { rate, baseHT: 0, tva: 0, count: 0 }
        byRate[rate]!.baseHT += ht
        byRate[rate]!.tva += tva
        byRate[rate]!.count++
        totalHT += ht
        totalTVA += tva
        totalTTC += ttc
      }
    }

    res.json({
      success: true,
      data: {
        period: { from: start, to: end },
        orderCount: orders.length,
        totalHT: Math.round(totalHT),
        totalTVA: Math.round(totalTVA),
        totalTTC: Math.round(totalTTC),
        byRate: Object.values(byRate).map(r => ({
          rate: r.rate,
          baseHT: Math.round(r.baseHT),
          tva: Math.round(r.tva),
          count: r.count,
        })).sort((a, b) => a.rate - b.rate),
        orders: orders.map(o => ({
          id: o.id,
          orderNumber: o.orderNumber,
          date: o.completedAt,
          subtotal: o.subtotal,
          taxAmount: o.taxAmount,
          total: o.totalAmount,
        })),
      },
    })
  } catch (error) { next(error) }
})

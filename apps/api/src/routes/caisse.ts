import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const caisseRouter = Router()
caisseRouter.use(authenticate)
caisseRouter.use(authorize('manager', 'superadmin', 'caissier'))

// GET /api/caisse/current — active session if any
caisseRouter.get('/current', async (req: AuthRequest, res, next) => {
  try {
    const session = await prisma.caisseSession.findFirst({
      where: { restaurantId: req.user!.restaurantId, status: 'OPEN' },
      include: { transactions: { orderBy: { createdAt: 'desc' } } },
    })
    res.json({ success: true, data: session })
  } catch (error) { next(error) }
})

// GET /api/caisse/sessions — list all sessions
caisseRouter.get('/sessions', async (req: AuthRequest, res, next) => {
  try {
    const { page = '1', perPage = '20' } = req.query
    const restaurantId = req.user!.restaurantId
    const [sessions, total] = await Promise.all([
      prisma.caisseSession.findMany({
        where: { restaurantId },
        include: { _count: { select: { transactions: true } } },
        orderBy: { openedAt: 'desc' },
        skip: (Number(page) - 1) * Number(perPage),
        take: Number(perPage),
      }),
      prisma.caisseSession.count({ where: { restaurantId } }),
    ])
    res.json({
      success: true,
      data: sessions,
      meta: {
        total,
        page: Number(page),
        perPage: Number(perPage),
        pageCount: Math.ceil(total / Number(perPage)),
      },
    })
  } catch (error) { next(error) }
})

// GET /api/caisse/sessions/:id — get session details
caisseRouter.get('/sessions/:id', async (req: AuthRequest, res, next) => {
  try {
    const session = await prisma.caisseSession.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: { transactions: { orderBy: { createdAt: 'asc' } } },
    })
    if (!session) throw new AppError('Session introuvable', 404)
    res.json({ success: true, data: session })
  } catch (error) { next(error) }
})

// POST /api/caisse/open — open a new session
caisseRouter.post('/open', async (req: AuthRequest, res, next) => {
  try {
    const { openingFloat = 0, notes } = z
      .object({ openingFloat: z.number().min(0).default(0), notes: z.string().optional() })
      .parse(req.body)
    const restaurantId = req.user!.restaurantId
    const existing = await prisma.caisseSession.findFirst({
      where: { restaurantId, status: 'OPEN' },
    })
    if (existing) throw new AppError('Une session de caisse est déjà ouverte', 400)
    const session = await prisma.caisseSession.create({
      data: { restaurantId, openingFloat, notes, openedById: req.user!.id },
    })
    res.status(201).json({ success: true, data: session })
  } catch (error) { next(error) }
})

// POST /api/caisse/sessions/:id/transaction — add a transaction
caisseRouter.post('/sessions/:id/transaction', async (req: AuthRequest, res, next) => {
  try {
    const data = z
      .object({
        type: z.enum(['SALE', 'REFUND', 'EXPENSE', 'DEPOSIT', 'WITHDRAWAL', 'ADJUSTMENT']),
        amount: z.number().refine(v => v !== 0, 'Le montant ne peut pas être zéro'),
        description: z.string().optional(),
        reference: z.string().optional(),
      })
      .parse(req.body)
    const restaurantId = req.user!.restaurantId
    const session = await prisma.caisseSession.findFirst({
      where: { id: req.params.id, restaurantId, status: 'OPEN' },
    })
    if (!session) throw new AppError('Session de caisse introuvable ou déjà fermée', 404)
    const transaction = await prisma.caisseTransaction.create({
      data: { sessionId: req.params.id, restaurantId, ...data },
    })
    res.status(201).json({ success: true, data: transaction })
  } catch (error) { next(error) }
})

// POST /api/caisse/sessions/:id/close — close session
caisseRouter.post('/sessions/:id/close', async (req: AuthRequest, res, next) => {
  try {
    const { closingFloat, notes } = z
      .object({ closingFloat: z.number().min(0), notes: z.string().optional() })
      .parse(req.body)
    const restaurantId = req.user!.restaurantId
    const session = await prisma.caisseSession.findFirst({
      where: { id: req.params.id, restaurantId, status: 'OPEN' },
      include: { transactions: true },
    })
    if (!session) throw new AppError('Session introuvable ou déjà fermée', 404)

    // Compute expected cash:
    // openingFloat + SALE + DEPOSIT - REFUND - EXPENSE - WITHDRAWAL + ADJUSTMENT
    // DEPOSIT = entrée d'argent dans le tiroir (ex: appoint fonds)
    // WITHDRAWAL = sortie d'argent du tiroir (ex: dépôt coffre, petite caisse)
    let expectedCash = session.openingFloat
    for (const t of session.transactions) {
      if (['SALE', 'DEPOSIT'].includes(t.type)) {
        expectedCash += t.amount
      } else if (['REFUND', 'EXPENSE', 'WITHDRAWAL'].includes(t.type)) {
        expectedCash -= t.amount
      } else if (t.type === 'ADJUSTMENT') {
        expectedCash += t.amount
      }
    }
    const difference = closingFloat - expectedCash

    const closed = await prisma.caisseSession.update({
      where: { id: req.params.id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedById: req.user!.id,
        closingFloat,
        expectedCash,
        difference,
        notes: notes ?? session.notes,
      },
    })
    res.json({ success: true, data: closed })
  } catch (error) { next(error) }
})

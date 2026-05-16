import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const bankRouter = Router()
bankRouter.use(authenticate)
bankRouter.use(authorize('manager', 'superadmin'))

const VALID_PAYMENT_METHODS = [
  'CASH', 'CARD',
  'MVOLA', 'ORANGE_MONEY', 'AIRTEL_MONEY',
  'BNI_MOBILE', 'BOA_MOBILE',
  'VIREMENT', 'CHEQUE',
  'VOUCHER', 'WALLET',
] as const

const accountSchema = z.object({
  name: z.string().min(1),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  type: z.enum(['CHECKING', 'SAVINGS']).default('CHECKING'),
  balance: z.number().default(0),
  currency: z.string().default('MGA'),
  isActive: z.boolean().default(true),
  paymentMethod: z.enum(VALID_PAYMENT_METHODS).nullable().optional(),
})

// Called by payments route to auto-wire a payment to the matching bank account
export async function autoPostPaymentToBank(
  restaurantId: string,
  paymentMethod: string,
  amount: number,
  type: 'CREDIT' | 'DEBIT',
  description: string,
  reference?: string,
) {
  const account = await prisma.bankAccount.findFirst({
    where: { restaurantId, paymentMethod, isActive: true },
  })
  if (!account) return // no linked account — silently skip
  const newBalance = type === 'CREDIT' ? account.balance + amount : account.balance - amount
  await prisma.$transaction([
    prisma.bankAccount.update({ where: { id: account.id }, data: { balance: newBalance } }),
    prisma.bankTransaction.create({
      data: { accountId: account.id, restaurantId, type, amount, balanceAfter: newBalance, description, reference },
    }),
  ])
}

// GET /api/bank/accounts
bankRouter.get('/accounts', async (req: AuthRequest, res, next) => {
  try {
    const accounts = await prisma.bankAccount.findMany({
      where: { restaurantId: req.user!.restaurantId },
      include: { _count: { select: { transactions: true } } },
      orderBy: { name: 'asc' },
    })
    res.json({ success: true, data: accounts })
  } catch (error) { next(error) }
})

// POST /api/bank/accounts
bankRouter.post('/accounts', async (req: AuthRequest, res, next) => {
  try {
    const data = accountSchema.parse(req.body)
    const account = await prisma.bankAccount.create({
      data: { ...data, restaurantId: req.user!.restaurantId },
    })
    res.status(201).json({ success: true, data: account })
  } catch (error) { next(error) }
})

// PUT /api/bank/accounts/:id
bankRouter.put('/accounts/:id', async (req: AuthRequest, res, next) => {
  try {
    const data = accountSchema.partial().parse(req.body)
    const restaurantId = req.user!.restaurantId
    const existing = await prisma.bankAccount.findFirst({ where: { id: req.params.id, restaurantId } })
    if (!existing) throw new AppError('Compte introuvable', 404)
    // Ensure no other account already claims this paymentMethod
    if (data.paymentMethod) {
      const conflict = await prisma.bankAccount.findFirst({
        where: { restaurantId, paymentMethod: data.paymentMethod, id: { not: req.params.id } },
      })
      if (conflict) throw new AppError(`Le mode "${data.paymentMethod}" est déjà lié au compte "${conflict.name}"`, 409)
    }
    const account = await prisma.bankAccount.update({ where: { id: req.params.id }, data })
    res.json({ success: true, data: account })
  } catch (error) { next(error) }
})

// DELETE /api/bank/accounts/:id
bankRouter.delete('/accounts/:id', async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.bankAccount.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!existing) throw new AppError('Compte introuvable', 404)
    await prisma.bankAccount.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (error) { next(error) }
})

// GET /api/bank/accounts/:id/transactions
bankRouter.get('/accounts/:id/transactions', async (req: AuthRequest, res, next) => {
  try {
    const { page = '1', perPage = '20', reconciled } = req.query
    const existing = await prisma.bankAccount.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!existing) throw new AppError('Compte introuvable', 404)
    const where: Record<string, unknown> = { accountId: req.params.id }
    if (reconciled !== undefined) where.reconciled = reconciled === 'true'
    const [transactions, total] = await Promise.all([
      prisma.bankTransaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (Number(page) - 1) * Number(perPage),
        take: Number(perPage),
      }),
      prisma.bankTransaction.count({ where }),
    ])
    res.json({
      success: true,
      data: transactions,
      meta: {
        total,
        page: Number(page),
        perPage: Number(perPage),
        pageCount: Math.ceil(total / Number(perPage)),
      },
    })
  } catch (error) { next(error) }
})

// POST /api/bank/accounts/:id/transactions — add transaction and adjust balance atomically
bankRouter.post('/accounts/:id/transactions', async (req: AuthRequest, res, next) => {
  try {
    const data = z
      .object({
        type: z.enum(['CREDIT', 'DEBIT']),
        amount: z.number().positive(),
        description: z.string().optional(),
        reference: z.string().optional(),
        date: z.string().optional(),
      })
      .parse(req.body)
    const restaurantId = req.user!.restaurantId
    const account = await prisma.bankAccount.findFirst({
      where: { id: req.params.id, restaurantId },
    })
    if (!account) throw new AppError('Compte introuvable', 404)
    const newBalance =
      data.type === 'CREDIT' ? account.balance + data.amount : account.balance - data.amount
    const [, transaction] = await prisma.$transaction([
      prisma.bankAccount.update({
        where: { id: req.params.id },
        data: { balance: newBalance },
      }),
      prisma.bankTransaction.create({
        data: {
          accountId: req.params.id,
          restaurantId,
          type: data.type,
          amount: data.amount,
          balanceAfter: newBalance,
          description: data.description,
          reference: data.reference,
          date: data.date ? new Date(data.date) : new Date(),
        },
      }),
    ])
    res.status(201).json({ success: true, data: transaction })
  } catch (error) { next(error) }
})

// PATCH /api/bank/transactions/:txId/reconcile — toggle reconciled flag
bankRouter.patch('/transactions/:txId/reconcile', async (req: AuthRequest, res, next) => {
  try {
    const tx = await prisma.bankTransaction.findFirst({
      where: { id: req.params.txId, restaurantId: req.user!.restaurantId },
    })
    if (!tx) throw new AppError('Transaction introuvable', 404)
    const updated = await prisma.bankTransaction.update({
      where: { id: req.params.txId },
      data: { reconciled: !tx.reconciled },
    })
    res.json({ success: true, data: updated })
  } catch (error) { next(error) }
})

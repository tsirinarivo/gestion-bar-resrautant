import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'

export const posTerminalRouter = Router()
posTerminalRouter.use(authenticate)

const terminalInclude = {
  warehouse: { select: { id: true, name: true } },
  assignedUsers: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
    },
  },
  caisseSessions: {
    where: { status: 'OPEN' },
    select: { id: true, openedAt: true, openedById: true, openingFloat: true },
    take: 1,
  },
}

// GET /api/pos-terminals
posTerminalRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const terminals = await prisma.posTerminal.findMany({
      where: { restaurantId: req.user!.restaurantId },
      include: terminalInclude,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    })
    res.json({ success: true, data: terminals })
  } catch (e) {
    res.status(500).json({ success: false, error: 'Erreur serveur' })
  }
})

// POST /api/pos-terminals
posTerminalRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const {
      name, code, description, status, isDefault,
      warehouseId, allowedPaymentMethods, printerSn, tableSection,
      userIds,
    } = req.body

    if (!name) return res.status(400).json({ success: false, error: 'Nom requis' })

    if (isDefault) {
      await prisma.posTerminal.updateMany({
        where: { restaurantId: req.user!.restaurantId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const terminal = await prisma.posTerminal.create({
      data: {
        restaurantId: req.user!.restaurantId,
        name,
        code: code || null,
        description: description || null,
        status: status || 'ACTIVE',
        isDefault: isDefault ?? false,
        warehouseId: warehouseId || null,
        allowedPaymentMethods: allowedPaymentMethods ?? null,
        printerSn: printerSn || null,
        tableSection: tableSection || null,
        assignedUsers: userIds?.length
          ? { create: (userIds as string[]).map((userId: string) => ({ userId })) }
          : undefined,
      },
      include: terminalInclude,
    })

    res.status(201).json({ success: true, data: terminal })
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(409).json({ success: false, error: 'Un terminal avec ce nom existe déjà' })
    res.status(500).json({ success: false, error: 'Erreur serveur' })
  }
})

// GET /api/pos-terminals/:id
posTerminalRouter.get('/:id', async (req: AuthRequest, res) => {
  try {
    const terminal = await prisma.posTerminal.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: terminalInclude,
    })
    if (!terminal) return res.status(404).json({ success: false, error: 'Terminal introuvable' })
    res.json({ success: true, data: terminal })
  } catch {
    res.status(500).json({ success: false, error: 'Erreur serveur' })
  }
})

// PATCH /api/pos-terminals/:id
posTerminalRouter.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.posTerminal.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!existing) return res.status(404).json({ success: false, error: 'Terminal introuvable' })

    const {
      name, code, description, status, isDefault,
      warehouseId, allowedPaymentMethods, printerSn, tableSection,
    } = req.body

    if (isDefault && !existing.isDefault) {
      await prisma.posTerminal.updateMany({
        where: { restaurantId: req.user!.restaurantId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const terminal = await prisma.posTerminal.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code: code || null }),
        ...(description !== undefined && { description: description || null }),
        ...(status !== undefined && { status }),
        ...(isDefault !== undefined && { isDefault }),
        ...(warehouseId !== undefined && { warehouseId: warehouseId || null }),
        ...(allowedPaymentMethods !== undefined && { allowedPaymentMethods }),
        ...(printerSn !== undefined && { printerSn: printerSn || null }),
        ...(tableSection !== undefined && { tableSection: tableSection || null }),
      },
      include: terminalInclude,
    })

    res.json({ success: true, data: terminal })
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(409).json({ success: false, error: 'Un terminal avec ce nom existe déjà' })
    res.status(500).json({ success: false, error: 'Erreur serveur' })
  }
})

// DELETE /api/pos-terminals/:id
posTerminalRouter.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.posTerminal.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!existing) return res.status(404).json({ success: false, error: 'Terminal introuvable' })
    await prisma.posTerminal.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ success: false, error: 'Erreur serveur' })
  }
})

// POST /api/pos-terminals/:id/users  — assign users
posTerminalRouter.post('/:id/users', async (req: AuthRequest, res) => {
  try {
    const terminal = await prisma.posTerminal.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!terminal) return res.status(404).json({ success: false, error: 'Terminal introuvable' })

    const { userIds } = req.body as { userIds: string[] }
    if (!userIds?.length) return res.status(400).json({ success: false, error: 'userIds requis' })

    await prisma.posTerminalUser.createMany({
      data: userIds.map((userId: string) => ({ terminalId: req.params.id, userId })),
      skipDuplicates: true,
    })

    const updated = await prisma.posTerminal.findUnique({
      where: { id: req.params.id },
      include: terminalInclude,
    })
    res.json({ success: true, data: updated })
  } catch {
    res.status(500).json({ success: false, error: 'Erreur serveur' })
  }
})

// DELETE /api/pos-terminals/:id/users/:userId  — remove user
posTerminalRouter.delete('/:id/users/:userId', async (req: AuthRequest, res) => {
  try {
    const terminal = await prisma.posTerminal.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!terminal) { res.status(404).json({ success: false, error: 'Terminal introuvable' }); return }
    await prisma.posTerminalUser.deleteMany({
      where: { terminalId: terminal.id, userId: req.params.userId },
    })
    res.json({ success: true })
  } catch {
    res.status(500).json({ success: false, error: 'Erreur serveur' })
  }
})

// GET /api/pos-terminals/:id/session  — current open caisse session
posTerminalRouter.get('/:id/session', async (req: AuthRequest, res) => {
  try {
    const session = await prisma.caisseSession.findFirst({
      where: {
        terminalId: req.params.id,
        restaurantId: req.user!.restaurantId,
        status: 'OPEN',
      },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 20 } },
    })
    res.json({ success: true, data: session })
  } catch {
    res.status(500).json({ success: false, error: 'Erreur serveur' })
  }
})

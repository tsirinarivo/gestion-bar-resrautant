import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const employeeRouter = Router()
employeeRouter.use(authenticate)

employeeRouter.get('/', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { restaurantId: req.user!.restaurantId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true, role: true } },
        timeEntries: { orderBy: { clockIn: 'desc' }, take: 1 },
        leaves: { where: { status: 'APPROVED', endDate: { gte: new Date() } } },
      },
      orderBy: { user: { lastName: 'asc' } },
    })
    res.json({ success: true, data: employees })
  } catch (error) {
    next(error)
  }
})

employeeRouter.get('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true, role: true } },
        shifts: { orderBy: { date: 'desc' }, take: 14 },
        timeEntries: { orderBy: { clockIn: 'desc' }, take: 20 },
        leaves: { orderBy: { startDate: 'desc' }, take: 10 },
      },
    })
    if (!employee) throw new AppError('Employé introuvable', 404)
    res.json({ success: true, data: employee })
  } catch (error) {
    next(error)
  }
})

// POST /api/employees/:id/clock-in
employeeRouter.post('/:id/clock-in', async (req: AuthRequest, res, next) => {
  try {
    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!employee) throw new AppError('Employé introuvable', 404)

    const activeEntry = await prisma.timeEntry.findFirst({
      where: { employeeId: employee.id, clockOut: null },
    })
    if (activeEntry) throw new AppError('L\'employé est déjà pointé', 400)

    const now = new Date()
    const entry = await prisma.timeEntry.create({
      data: { employeeId: employee.id, date: now, clockIn: now, status: 'ACTIVE' },
    })

    res.status(201).json({ success: true, data: entry })
  } catch (error) {
    next(error)
  }
})

// POST /api/employees/:id/clock-out
employeeRouter.post('/:id/clock-out', async (req: AuthRequest, res, next) => {
  try {
    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!employee) throw new AppError('Employé introuvable', 404)

    const activeEntry = await prisma.timeEntry.findFirst({
      where: { employeeId: employee.id, clockOut: null },
    })
    if (!activeEntry) throw new AppError('Aucun pointage actif trouvé', 400)

    const now = new Date()
    const totalHours = (now.getTime() - activeEntry.clockIn.getTime()) / (1000 * 60 * 60)

    const entry = await prisma.timeEntry.update({
      where: { id: activeEntry.id },
      data: { clockOut: now, totalHours: Math.round(totalHours * 100) / 100, status: 'COMPLETED' },
    })

    res.json({ success: true, data: entry })
  } catch (error) {
    next(error)
  }
})

employeeRouter.get('/:id/schedule', async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = req.query
    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!employee) throw new AppError('Employé introuvable', 404)

    const shifts = await prisma.scheduleShift.findMany({
      where: {
        employeeId: employee.id,
        date: {
          gte: from ? new Date(from as string) : new Date(),
          lte: to ? new Date(to as string) : undefined,
        },
      },
      orderBy: { date: 'asc' },
    })

    res.json({ success: true, data: shifts })
  } catch (error) {
    next(error)
  }
})

import { Router } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
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

// POST /api/employees — Create new employee + user account
employeeRouter.post('/', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
      role: z.enum(['superadmin', 'manager', 'serveur', 'cuisinier', 'caissier']),
      phone: z.string().optional(),
      address: z.string().optional(),
      salary: z.number().optional(),
      birthDate: z.string().optional(),
      hireDate: z.string().optional(),
      position: z.string().optional(),
    })

    const data = schema.parse(req.body)
    const restaurantId = req.user!.restaurantId

    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing) throw new AppError('Un utilisateur avec cet email existe déjà', 409)

    const roleRecord = await prisma.role.findUnique({ where: { name: data.role } })
    if (!roleRecord) throw new AppError('Rôle introuvable', 400)

    const passwordHash = await bcrypt.hash(data.password, 12)

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        restaurantId,
        roleId: roleRecord.id,
      },
    })

    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        restaurantId,
        position: data.position || data.role,
        salary: data.salary,
        hireDate: data.hireDate ? new Date(data.hireDate) : undefined,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true, role: true } },
        timeEntries: { orderBy: { clockIn: 'desc' }, take: 1 },
      },
    })

    res.status(201).json({ success: true, data: employee })
  } catch (error) {
    next(error)
  }
})

// PUT /api/employees/:id — Update employee
employeeRouter.put('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      email: z.string().email().optional(),
      role: z.enum(['superadmin', 'manager', 'serveur', 'cuisinier', 'caissier']).optional(),
      phone: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
      salary: z.number().optional().nullable(),
      birthDate: z.string().optional().nullable(),
      hireDate: z.string().optional().nullable(),
      position: z.string().optional(),
    })

    const data = schema.parse(req.body)
    const restaurantId = req.user!.restaurantId

    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, restaurantId },
      include: { user: true },
    })
    if (!employee) throw new AppError('Employé introuvable', 404)

    if (data.email && data.email !== employee.user.email) {
      const conflict = await prisma.user.findUnique({ where: { email: data.email } })
      if (conflict) throw new AppError('Un utilisateur avec cet email existe déjà', 409)
    }

    let roleId: string | undefined
    if (data.role) {
      const roleRecord = await prisma.role.findUnique({ where: { name: data.role } })
      if (!roleRecord) throw new AppError('Rôle introuvable', 400)
      roleId = roleRecord.id
    }

    await prisma.user.update({
      where: { id: employee.userId },
      data: {
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.email && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(roleId && { roleId }),
      },
    })

    const updated = await prisma.employee.update({
      where: { id: employee.id },
      data: {
        ...(data.position && { position: data.position }),
        ...(data.salary !== undefined && { salary: data.salary }),
        ...(data.hireDate !== undefined && { hireDate: data.hireDate ? new Date(data.hireDate) : null }),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true, role: true } },
        timeEntries: { orderBy: { clockIn: 'desc' }, take: 1 },
      },
    })

    res.json({ success: true, data: updated })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/employees/:id — Delete employee (and user)
employeeRouter.delete('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId

    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, restaurantId },
    })
    if (!employee) throw new AppError('Employé introuvable', 404)

    // Deleting the user cascades to the employee record
    await prisma.user.delete({ where: { id: employee.userId } })

    res.json({ success: true, message: 'Employé supprimé' })
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

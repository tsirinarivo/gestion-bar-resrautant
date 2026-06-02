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

// ─── Routes STATIQUES (doivent être déclarées AVANT /:id sinon Express
// les capture comme /:id avec id="active"/"hours-summary"/"schedule" → 404)

// GET /api/employees/active — currently clocked-in employees
employeeRouter.get('/active', async (req: AuthRequest, res, next) => {
  try {
    const entries = await prisma.timeEntry.findMany({
      where: {
        employee: { restaurantId: req.user!.restaurantId },
        clockOut: null,
      },
      include: {
        employee: {
          include: { user: { select: { firstName: true, lastName: true, avatar: true, role: true } } },
        },
      },
      orderBy: { clockIn: 'asc' },
    })
    const now = Date.now()
    const data = entries.map(e => ({
      employeeId: e.employee.id,
      firstName: e.employee.user.firstName,
      lastName: e.employee.user.lastName,
      avatar: e.employee.user.avatar,
      role: e.employee.user.role,
      clockIn: e.clockIn,
      durationMinutes: Math.floor((now - e.clockIn.getTime()) / 60000),
    }))
    res.json({ success: true, data })
  } catch (error) { next(error) }
})

// GET /api/employees/hours-summary — total hours worked per employee in a period
employeeRouter.get('/hours-summary', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = req.query
    const start = from ? new Date(from as string) : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d })()
    const end = to ? new Date(to as string) : new Date()

    const entries = await prisma.timeEntry.findMany({
      where: {
        employee: { restaurantId: req.user!.restaurantId },
        clockIn: { gte: start, lte: end },
        clockOut: { not: null },
      },
      include: {
        employee: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    })

    // Aggregate by employee
    const byEmployee = new Map<string, { employeeId: string; firstName: string; lastName: string; totalHours: number; sessionCount: number }>()
    for (const entry of entries) {
      const key = entry.employeeId
      if (!byEmployee.has(key)) {
        byEmployee.set(key, {
          employeeId: entry.employeeId,
          firstName: entry.employee.user.firstName,
          lastName: entry.employee.user.lastName,
          totalHours: 0,
          sessionCount: 0,
        })
      }
      const agg = byEmployee.get(key)!
      agg.totalHours += entry.totalHours ?? 0
      agg.sessionCount += 1
    }

    const summary = Array.from(byEmployee.values())
      .sort((a, b) => b.totalHours - a.totalHours)
      .map(e => ({ ...e, totalHours: Math.round(e.totalHours * 10) / 10 }))

    res.json({ success: true, data: summary, period: { from: start, to: end } })
  } catch (error) { next(error) }
})

// GET /api/employees/schedule — all employees, date range. Alias /shifts (same impl).
const scheduleHandler = async (req: AuthRequest, res: any, next: any) => {
  try {
    const { from, to } = req.query
    const start = from ? new Date(from as string) : (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); d.setHours(0,0,0,0); return d })()
    const end = to ? new Date(to as string) : new Date(start.getTime() + 6 * 86_400_000)
    const shifts = await prisma.scheduleShift.findMany({
      where: { employee: { restaurantId: req.user!.restaurantId }, date: { gte: start, lte: end } },
      include: { employee: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    })
    res.json({ success: true, data: shifts })
  } catch (error) { next(error) }
}
employeeRouter.get('/schedule', authorize('manager', 'superadmin'), scheduleHandler)
employeeRouter.get('/shifts', authorize('manager', 'superadmin'), scheduleHandler)

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

    if (data.role === 'superadmin' && req.user!.roleName !== 'superadmin') {
      throw new AppError('Seul un superadmin peut créer un autre superadmin', 403)
    }

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

    // Privilege escalation guard : seul un superadmin peut assigner/promouvoir
    // au rôle superadmin. Un manager qui PUT data.role='superadmin' sur son
    // propre employé est rejeté.
    if (data.role === 'superadmin' && req.user!.roleName !== 'superadmin') {
      throw new AppError('Seul un superadmin peut assigner le rôle superadmin', 403)
    }

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

// GET /api/employees/active — currently clocked-in employees
// POST /api/employees/shifts — create a shift
employeeRouter.post('/shifts', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const { employeeId, date, startTime, endTime, station, notes } = req.body
    const employee = await prisma.employee.findFirst({ where: { id: employeeId, restaurantId: req.user!.restaurantId } })
    if (!employee) throw new AppError('Employé introuvable', 404)
    const shift = await prisma.scheduleShift.create({
      data: { employeeId: employee.id, date: new Date(date), startTime, endTime, station, notes },
      include: { employee: { include: { user: { select: { firstName: true, lastName: true } } } } },
    })
    res.status(201).json({ success: true, data: shift })
  } catch (error) { next(error) }
})

// DELETE /api/employees/shifts/:shiftId
employeeRouter.delete('/shifts/:shiftId', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const shift = await prisma.scheduleShift.findFirst({
      where: { id: req.params.shiftId, employee: { restaurantId: req.user!.restaurantId } },
    })
    if (!shift) throw new AppError('Shift introuvable', 404)
    await prisma.scheduleShift.delete({ where: { id: shift.id } })
    res.json({ success: true })
  } catch (error) { next(error) }
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

// ─── Leaves ───────────────────────────────────────────────────────────────────

const leaveSchema = z.object({
  type: z.enum(['VACATION', 'SICK', 'PERSONAL', 'UNPAID', 'PUBLIC_HOLIDAY']),
  startDate: z.string(),
  endDate: z.string(),
  days: z.number().positive(),
  reason: z.string().optional(),
  notes: z.string().optional(),
})

// GET /api/employees/:id/leaves
employeeRouter.get('/:id/leaves', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!employee) throw new AppError('Employé introuvable', 404)
    const leaves = await prisma.leave.findMany({
      where: { employeeId: employee.id },
      orderBy: { startDate: 'desc' },
    })
    res.json({ success: true, data: leaves })
  } catch (error) { next(error) }
})

// POST /api/employees/:id/leaves
employeeRouter.post('/:id/leaves', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!employee) throw new AppError('Employé introuvable', 404)
    const data = leaveSchema.parse(req.body)
    const leave = await prisma.leave.create({
      data: {
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        employeeId: employee.id,
      },
    })
    res.status(201).json({ success: true, data: leave })
  } catch (error) { next(error) }
})

// PATCH /api/employees/leaves/:leaveId/status
employeeRouter.patch('/leaves/:leaveId/status', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const { status } = z.object({ status: z.enum(['APPROVED', 'REJECTED', 'CANCELLED']) }).parse(req.body)
    const leave = await prisma.leave.findFirst({
      where: { id: req.params.leaveId, employee: { restaurantId: req.user!.restaurantId } },
    })
    if (!leave) throw new AppError('Congé introuvable', 404)
    const updateData: any = { status }
    if (status === 'APPROVED') { updateData.approvedBy = req.user!.id; updateData.approvedAt = new Date() }
    const updated = await prisma.leave.update({ where: { id: leave.id }, data: updateData })
    res.json({ success: true, data: updated })
  } catch (error) { next(error) }
})

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'
import { generateReservationRef } from '@restaurant/utils'

export const reservationRouter = Router()
reservationRouter.use(authenticate)

const reservationSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(1),
  partySize: z.number().int().positive(),
  date: z.string().datetime(),
  duration: z.number().int().default(90),
  tableId: z.string().optional(),
  customerId: z.string().optional(),
  notes: z.string().optional(),
  specialRequest: z.string().optional(),
  source: z.enum(['ONLINE', 'PHONE', 'WALK_IN', 'GOOGLE']).default('PHONE'),
})

reservationRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { date, status, page = '1', limit = '20' } = req.query
    const where: any = { restaurantId: req.user!.restaurantId }

    if (status) where.status = status
    if (date) {
      const d = new Date(date as string)
      where.date = {
        gte: new Date(d.setHours(0, 0, 0, 0)),
        lt: new Date(d.setHours(23, 59, 59, 999)),
      }
    }

    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        include: { table: true, customer: true },
        orderBy: { date: 'asc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.reservation.count({ where }),
    ])

    res.json({
      success: true,
      data: reservations,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
    })
  } catch (error) {
    next(error)
  }
})

reservationRouter.get('/reminders', async (req: AuthRequest, res, next) => {
  try {
    const { status = 'PENDING', days = '7' } = req.query as Record<string, string>
    const restaurantId = req.user!.restaurantId
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + parseInt(days))

    const reminders = await prisma.reservationReminder.findMany({
      where: {
        status,
        scheduledAt: { lte: cutoff },
        reservation: { restaurantId },
      },
      include: {
        reservation: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            date: true,
            partySize: true,
            status: true,
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 100,
    })

    res.json({ success: true, data: reminders })
  } catch (error) { next(error) }
})

reservationRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const reservation = await prisma.reservation.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: { table: true, customer: true },
    })
    if (!reservation) throw new AppError('Réservation introuvable', 404)
    res.json({ success: true, data: reservation })
  } catch (error) {
    next(error)
  }
})

reservationRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = reservationSchema.parse(req.body)
    if (new Date(data.date) <= new Date()) {
      throw new AppError('La date de réservation doit être dans le futur', 400)
    }
    const restaurantId = req.user!.restaurantId

    // Double-booking check: same table reserved within ±90 min window
    if (data.tableId) {
      const reservationStart = new Date(data.date)
      const windowStart = new Date(reservationStart.getTime() - 90 * 60 * 1000)
      const windowEnd   = new Date(reservationStart.getTime() + 90 * 60 * 1000)
      const conflict = await prisma.reservation.findFirst({
        where: {
          restaurantId,
          tableId: data.tableId,
          status: { notIn: ['CANCELLED', 'NO_SHOW', 'COMPLETED'] },
          date: { gte: windowStart, lte: windowEnd },
        },
      })
      if (conflict) {
        throw new AppError(`Table déjà réservée à ${new Date(conflict.date).toLocaleString('fr-FR')} (réf. ${conflict.reservationRef})`, 409)
      }
    }

    const reservation = await prisma.reservation.create({
      data: {
        ...data,
        date: new Date(data.date),
        restaurantId,
        reservationRef: generateReservationRef(),
        status: 'CONFIRMED',
      },
      include: { table: true, customer: true },
    })

    if (data.tableId) {
      await prisma.diningTable.update({
        where: { id: data.tableId },
        data: { status: 'RESERVED' },
      })
    }

    // Auto-schedule reminders: 24h before and 2h before
    const reservationDate = new Date(data.date)
    const reminder24h = new Date(reservationDate.getTime() - 24 * 60 * 60 * 1000)
    const reminder2h  = new Date(reservationDate.getTime() - 2  * 60 * 60 * 1000)
    const now = new Date()
    const reminderData = [
      ...(reminder24h > now ? [{ type: 'SMS', scheduledAt: reminder24h, reservationId: reservation.id }] : []),
      ...(reminder2h  > now ? [{ type: 'SMS', scheduledAt: reminder2h,  reservationId: reservation.id }] : []),
    ]
    if (reminderData.length > 0) {
      await prisma.reservationReminder.createMany({ data: reminderData }).catch(() => {})
    }

    res.status(201).json({ success: true, data: reservation })
  } catch (error) {
    next(error)
  }
})

reservationRouter.patch('/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const { status } = z.object({
      status: z.enum(['PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
    }).parse(req.body)

    const reservation = await prisma.reservation.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!reservation) throw new AppError('Réservation introuvable', 404)

    const updated = await prisma.reservation.update({ where: { id: reservation.id }, data: { status } })

    if (status === 'SEATED' && reservation.tableId) {
      await prisma.diningTable.update({ where: { id: reservation.tableId }, data: { status: 'OCCUPIED' } })
    } else if (['CANCELLED', 'NO_SHOW'].includes(status) && reservation.tableId) {
      await prisma.diningTable.update({ where: { id: reservation.tableId }, data: { status: 'AVAILABLE' } })
    }

    const NOTIF_CONFIG: Record<string, { title: string; message: (r: typeof reservation) => string } | undefined> = {
      CONFIRMED:  { title: 'Réservation confirmée',   message: r => `Réservation de ${r?.firstName ?? ''} ${r?.lastName ?? ''} (${r?.partySize ?? 0} pers.) le ${new Date(r?.date ?? new Date()).toLocaleDateString('fr-FR')} confirmée` },
      SEATED:     { title: 'Client arrivé',            message: r => `${r?.firstName ?? ''} ${r?.lastName ?? ''} est arrivé et a été placé` },
      CANCELLED:  { title: 'Réservation annulée',     message: r => `Réservation de ${r?.firstName ?? ''} ${r?.lastName ?? ''} annulée` },
      NO_SHOW:    { title: 'No-show',                  message: r => `${r?.firstName ?? ''} ${r?.lastName ?? ''} ne s'est pas présenté` },
    }

    const notifConf = NOTIF_CONFIG[status]
    if (notifConf) {
      const message = notifConf.message(reservation)
      await prisma.notification.create({
        data: {
          type: 'RESERVATION',
          title: notifConf.title,
          message,
          restaurantId: req.user!.restaurantId,
          targetRole: 'manager',
        },
      })

      const io = req.app.get('io')
      io?.to(req.user!.restaurantId).emit('notification:new', { type: 'RESERVATION', message })
    }

    res.json({ success: true, data: updated })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/reservations/:id — update notes, specialRequest, tableId, date
reservationRouter.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { notes, specialRequest, tableId, date, duration } = z.object({
      notes: z.string().optional(),
      specialRequest: z.string().optional(),
      tableId: z.string().nullable().optional(),
      date: z.string().datetime().optional(),
      duration: z.number().int().optional(),
    }).parse(req.body)

    const reservation = await prisma.reservation.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!reservation) throw new AppError('Réservation introuvable', 404)

    const updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        ...(notes !== undefined && { notes }),
        ...(specialRequest !== undefined && { specialRequest }),
        ...(tableId !== undefined && { tableId }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(duration !== undefined && { duration }),
      },
    })
    res.json({ success: true, data: updated })
  } catch (error) {
    next(error)
  }
})

reservationRouter.delete('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const reservation = await prisma.reservation.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!reservation) throw new AppError('Réservation introuvable', 404)
    await prisma.reservation.delete({ where: { id: reservation.id } })
    res.json({ success: true, message: 'Réservation supprimée' })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/reservations/reminders/:id/sent — mark reminder as sent
reservationRouter.patch('/reminders/:id/sent', async (req: AuthRequest, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId
    const existing = await prisma.reservationReminder.findFirst({
      where: { id: req.params.id, reservation: { restaurantId } },
    })
    if (!existing) { res.status(404).json({ success: false, error: 'Rappel introuvable' }); return }

    const updated = await prisma.reservationReminder.update({
      where: { id: req.params.id },
      data: { sentAt: new Date(), status: 'SENT' },
    })
    res.json({ success: true, data: updated })
  } catch (error) { next(error) }
})

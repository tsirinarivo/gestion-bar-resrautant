import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
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

    res.json({ success: true, data: updated })
  } catch (error) {
    next(error)
  }
})

reservationRouter.delete('/:id', async (req: AuthRequest, res, next) => {
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

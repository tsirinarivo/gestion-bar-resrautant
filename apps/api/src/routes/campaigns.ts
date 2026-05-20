import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const campaignRouter = Router()
campaignRouter.use(authenticate)
campaignRouter.use(authorize('manager', 'superadmin'))

const campaignSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['EMAIL', 'SMS', 'PUSH']),
  subject: z.string().optional(),
  content: z.string().min(1),
  scheduledAt: z.string().optional(),
})

// GET /api/campaigns
campaignRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { status, type, page = '1', limit = '20' } = req.query
    const where: any = { restaurantId: req.user!.restaurantId }
    if (status) where.status = status
    if (type) where.type = type

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.campaign.count({ where }),
    ])

    res.json({
      success: true,
      data: campaigns,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
    })
  } catch (error) { next(error) }
})

// POST /api/campaigns
campaignRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = campaignSchema.parse(req.body)
    const campaign = await prisma.campaign.create({
      data: {
        ...data,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
        restaurantId: req.user!.restaurantId,
        status: data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
      },
    })
    res.status(201).json({ success: true, data: campaign })
  } catch (error) { next(error) }
})

// PUT /api/campaigns/:id
campaignRouter.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const data = campaignSchema.partial().parse(req.body)
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!campaign) throw new AppError('Campagne introuvable', 404)
    if (campaign.status === 'SENT') throw new AppError('Impossible de modifier une campagne déjà envoyée', 400)

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        ...data,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : campaign.scheduledAt,
        status: data.scheduledAt ? 'SCHEDULED' : campaign.status === 'SCHEDULED' ? 'DRAFT' : campaign.status,
      },
    })
    res.json({ success: true, data: updated })
  } catch (error) { next(error) }
})

// POST /api/campaigns/:id/send — mark as sent, count recipients from customer base
campaignRouter.post('/:id/send', async (req: AuthRequest, res, next) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!campaign) throw new AppError('Campagne introuvable', 404)
    if (campaign.status === 'SENT') throw new AppError('Cette campagne a déjà été envoyée', 400)

    // Count eligible recipients (customers with marketing consent + contact info for the channel)
    const recipientWhere: any = { restaurantId: req.user!.restaurantId, acceptsMarketing: true }
    if (campaign.type === 'SMS') recipientWhere.phone = { not: null }
    if (campaign.type === 'EMAIL') recipientWhere.email = { not: null }
    const recipientCount = await prisma.customer.count({ where: recipientWhere })

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'SENT', sentAt: new Date(), recipientCount },
    })
    res.json({ success: true, data: updated, recipientCount })
  } catch (error) { next(error) }
})

// POST /api/campaigns/:id/duplicate
campaignRouter.post('/:id/duplicate', async (req: AuthRequest, res, next) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!campaign) throw new AppError('Campagne introuvable', 404)

    const copy = await prisma.campaign.create({
      data: {
        name: `${campaign.name} (copie)`,
        type: campaign.type,
        subject: campaign.subject,
        content: campaign.content,
        restaurantId: campaign.restaurantId,
        status: 'DRAFT',
      },
    })
    res.status(201).json({ success: true, data: copy })
  } catch (error) { next(error) }
})

// DELETE /api/campaigns/:id
campaignRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!campaign) throw new AppError('Campagne introuvable', 404)
    if (campaign.status === 'SENDING') throw new AppError('Impossible de supprimer une campagne en cours d\'envoi', 400)

    await prisma.campaign.delete({ where: { id: campaign.id } })
    res.json({ success: true })
  } catch (error) { next(error) }
})

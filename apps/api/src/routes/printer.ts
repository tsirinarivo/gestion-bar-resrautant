import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import {
  getConfig, updateConfig,
  printTest, printerStatus,
  getLogs, refreshLogs,
  enrollPrinter,
} from '../lib/printer'

export const printerRouter = Router()
printerRouter.use(authenticate)
printerRouter.use(authorize('manager', 'superadmin'))

// GET /api/printer/config
printerRouter.get('/config', async (req: AuthRequest, res, next) => {
  try {
    const config = await getConfig(req.user!.restaurantId)
    res.json({ success: true, data: config })
  } catch (error) {
    next(error)
  }
})

// PUT /api/printer/config
printerRouter.put('/config', async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      enabled:                 z.boolean().optional(),
      user:                    z.string().optional(),
      key:                     z.string().optional(),
      baseUrl:                 z.string().url().optional().or(z.literal('')),
      sn:                      z.string().optional(),
      voice:                   z.number().int().min(0).max(3).optional(),
      header:                  z.string().max(200).optional(),
      footer:                  z.string().max(200).optional(),
      copies:                  z.number().int().min(1).max(5).optional(),
      autoOnSaleConfirm:       z.boolean().optional(),
      autoOnPaymentConfirm:    z.boolean().optional(),
      autoOnDeliveryRegister:  z.boolean().optional(),
    })
    const data = schema.parse(req.body)
    const config = await updateConfig(req.user!.restaurantId, data)
    res.json({ success: true, data: config })
  } catch (error) {
    next(error)
  }
})

// POST /api/printer/test
printerRouter.post('/test', async (req: AuthRequest, res, next) => {
  try {
    const result = await printTest(req.user!.restaurantId)
    res.json({ success: true, data: result })
  } catch (error) {
    next(error)
  }
})

// GET /api/printer/status
printerRouter.get('/status', async (req: AuthRequest, res, next) => {
  try {
    const status = await printerStatus(req.user!.restaurantId)
    res.json({ success: true, data: status })
  } catch (error) {
    next(error)
  }
})

// GET /api/printer/logs
printerRouter.get('/logs', async (req: AuthRequest, res, next) => {
  try {
    const { page = '1', perPage = '20', status } = req.query
    const logs = await getLogs(req.user!.restaurantId, {
      page:    Number(page),
      perPage: Number(perPage),
      status:  status as string | undefined,
    })
    res.json({ success: true, data: logs })
  } catch (error) {
    next(error)
  }
})

// POST /api/printer/refresh-logs
printerRouter.post('/refresh-logs', async (req: AuthRequest, res, next) => {
  try {
    const result = await refreshLogs(req.user!.restaurantId)
    res.json({ success: true, data: result })
  } catch (error) {
    next(error)
  }
})

// POST /api/printer/enroll
printerRouter.post('/enroll', async (req: AuthRequest, res, next) => {
  try {
    const { sn, name } = z.object({
      sn:   z.string().min(1),
      name: z.string().optional(),
    }).parse(req.body)
    const result = await enrollPrinter(req.user!.restaurantId, { sn, name })
    res.json({ success: true, data: result })
  } catch (error) {
    next(error)
  }
})

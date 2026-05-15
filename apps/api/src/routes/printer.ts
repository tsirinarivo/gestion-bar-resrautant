import { Router } from 'express'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import {
  getConfig, updateConfig,
  printTest, printerStatus,
  getLogs, refreshLogs,
  enrollPrinter,
  XPYUN_REGIONS,
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
    // Strip empty strings so optional fields with min(1) in PrinterConfigSchema
    // don't fail validation when the user leaves them blank
    const body = Object.fromEntries(
      Object.entries(req.body as Record<string, unknown>).filter(([, v]) => v !== '' && v !== null)
    )
    const result = await updateConfig(req.user!.restaurantId, body)
    if (!result.ok) {
      return res.status(422).json({ success: false, error: 'Données invalides', details: result.errors })
    }
    res.json({ success: true, data: result })
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
    const result = await printerStatus(req.user!.restaurantId)
    const STATE: Record<number, string> = { [-1]: 'unknown', 0: 'offline', 1: 'online', 2: 'busy' }
    res.json({ success: true, data: { ...result, state: STATE[result.status] ?? 'unknown' } })
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

// GET /api/printer/debug — diagnostic: URL utilisée + test fetch brut vers XPyun
printerRouter.get('/debug', async (req: AuthRequest, res, next) => {
  try {
    const config = await getConfig(req.user!.restaurantId)
    const region = (config as any)?.region ?? 'cn'
    const baseUrl = (XPYUN_REGIONS as any)[region] ?? XPYUN_REGIONS['cn']
    const testUrl = `${baseUrl}/queryPrinterStatus`

    let rawStatus: number | null = null
    let rawBody: string | null = null
    let fetchError: string | null = null
    try {
      const r = await fetch(testUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json;charset=UTF-8' },
        body: JSON.stringify({ user: '__test__', timestamp: '0', sign: '__test__', sn: '__test__', debug: '0' }),
        signal: AbortSignal.timeout(5000),
      })
      rawStatus = r.status
      rawBody = (await r.text()).slice(0, 300)
    } catch (e: any) {
      fetchError = e?.message ?? String(e)
    }

    res.json({
      success: true,
      data: { region, baseUrl, testUrl, httpStatus: rawStatus, bodySnippet: rawBody, fetchError },
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/printer/enroll
printerRouter.post('/enroll', async (req: AuthRequest, res, next) => {
  try {
    const result = await enrollPrinter(req.user!.restaurantId, req.body)
    if (!result.ok) {
      return res.status(422).json({ success: false, error: 'Données invalides', details: (result as any).errors })
    }
    res.json({ success: true, data: result })
  } catch (error) {
    next(error)
  }
})

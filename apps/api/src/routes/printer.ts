import { Router } from 'express'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import {
  getConfig, updateConfig,
  printTest, printerStatus,
  getLogs, refreshLogs,
  enrollPrinter,
  XPYUN_REGIONS,
  loadPrinterCfg,
  callXprint,
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

// GET /api/printer/debug — diagnostic avec vrais credentials
printerRouter.get('/debug', async (req: AuthRequest, res, next) => {
  try {
    const cfg = await (loadPrinterCfg as any)(req.user!.restaurantId)
    if (!cfg) {
      return res.json({ success: true, data: { error: 'Imprimante non configurée (enabled=false ou champs manquants)' } })
    }

    const testUrl = `${cfg.baseUrl}/queryPrinterStatus`
    const ts = Math.floor(Date.now() / 1000).toString()
    const crypto = await import('crypto')
    const sign = crypto.createHash('sha1').update(cfg.user + cfg.key + ts).digest('hex')

    let rawStatus: number | null = null
    let rawBody: string | null = null
    let fetchError: string | null = null
    try {
      const r = await fetch(testUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json;charset=UTF-8' },
        body: JSON.stringify({ user: cfg.user, timestamp: ts, sign, sn: cfg.sn, debug: '0' }),
        signal: AbortSignal.timeout(8000),
      })
      rawStatus = r.status
      rawBody = (await r.text()).slice(0, 500)
    } catch (e: any) {
      fetchError = (e?.cause?.message ?? e?.message ?? String(e))
    }

    res.json({
      success: true,
      data: { region: cfg.region, baseUrl: cfg.baseUrl, testUrl, user: cfg.user, sn: cfg.sn, httpStatus: rawStatus, body: rawBody, fetchError },
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

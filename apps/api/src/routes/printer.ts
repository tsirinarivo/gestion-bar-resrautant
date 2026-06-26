import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import {
  getConfig, updateConfig,
  printTest, printerStatus,
  getLogs, refreshLogs,
  enrollPrinter,
  sendPrintAndLog,
  XPYUN_REGIONS,
  loadPrinterCfg,
  callXprint,
} from '../lib/printer'

const WIDTH = 48

function esc(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe').replace(/Œ/g, 'OE')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/</g, '(').replace(/>/g, ')')
}

function rowLine(left: string, right: string): string {
  const pad = WIDTH - left.length - right.length
  if (pad > 0) return left + ' '.repeat(pad) + right
  return left.slice(0, WIDTH - right.length - 1) + ' ' + right
}

function fmtAr(amount: number): string {
  const formatted = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .format(amount)
    .replace(/[  ]/g, ' ')
  return `Ar ${formatted}`
}

function buildPOSReceipt(params: {
  shopName: string
  shopAddr: string | null
  shopPhone: string | null
  tableLabel: string
  items: Array<{ name: string; qty: number; total: number }>
  grandTotal: number
  header?: string | null
  footer?: string | null
}): string {
  const { shopName, shopAddr, shopPhone, tableLabel, items, grandTotal, header, footer } = params
  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const dDiv = '='.repeat(WIDTH)
  const div  = '-'.repeat(WIDTH)

  const lines: string[] = []

  // ── Logo & header ───────────────────────────────────────────────────────────
  lines.push(dDiv)
  lines.push(`<C><B>${esc(shopName).toUpperCase()}</B></C>`)
  if (shopAddr)  lines.push(`<C>${esc(shopAddr)}</C>`)
  if (shopPhone) lines.push(`<C>Tel: ${esc(shopPhone)}</C>`)
  if (header) for (const l of String(header).split('\n')) lines.push(`<C>${esc(l)}</C>`)
  lines.push(dDiv)
  if (tableLabel) lines.push(`<C><B>${esc(tableLabel).toUpperCase()}</B></C>`)
  lines.push(`<C>${dateStr}  ${timeStr}</C>`)
  lines.push(div)

  // ── Items (une ligne par article, comme l'écran) ────────────────────────────
  for (const item of items) {
    const name  = esc(item.name)
    const price = fmtAr(item.total)
    lines.push(`<L>${rowLine(`${item.qty}x ${name}`, price)}</L>`)
  }

  lines.push(div)

  // ── Total ───────────────────────────────────────────────────────────────────
  lines.push(`<C><B>${rowLine('TOTAL', fmtAr(grandTotal))}</B></C>`)
  lines.push(dDiv)
  lines.push('')
  if (footer) {
    for (const l of String(footer).split('\n')) lines.push(`<C>${esc(l)}</C>`)
  } else {
    lines.push(`<C>Merci de votre visite !</C>`)
  }
  lines.push('')

  return lines.join('<BR>')
}

export const printerRouter = Router()
printerRouter.use(authenticate)

// POST /api/printer/receipt — accessible à tous les rôles (caissier inclus)
printerRouter.post('/receipt', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      tableNumber:   z.number().optional(),
      tableLabel:    z.string().optional(),
      orderNumber:   z.string().optional(),
      paymentMethod: z.string().optional(),
      cashierName:   z.string().optional(),
      items: z.array(z.object({
        name:      z.string(),
        qty:       z.number(),
        unitPrice: z.number(),
        total:     z.number(),
      })),
      subtotal:    z.number(),
      grandTotal:  z.number(),
    }).parse(req.body)

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.user!.restaurantId },
      select: { name: true, address: true, phone: true, invoiceHeader: true, invoiceFooter: true },
    })

    const tableLabel = body.tableNumber
      ? `Table ${body.tableNumber}`
      : (body.tableLabel || 'Emporte')

    const content = buildPOSReceipt({
      shopName:   restaurant?.name ?? 'Restaurant',
      shopAddr:   (restaurant as any)?.address ?? null,
      shopPhone:  (restaurant as any)?.phone ?? null,
      tableLabel,
      items:      body.items,
      grandTotal: body.grandTotal,
      header:     (restaurant as any)?.invoiceHeader ?? null,
      footer:     (restaurant as any)?.invoiceFooter ?? null,
    })

    await sendPrintAndLog(req.user!.restaurantId, content, {
      kind:      'receipt',
      relatedId: body.orderNumber ?? `receipt-${Date.now()}`,
      copies:    1,
    })

    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

// Les routes suivantes nécessitent manager ou superadmin
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

// POST /api/printer/logs/:id/reprint — re-send a previous print job
printerRouter.post('/logs/:id/reprint', async (req: AuthRequest, res, next) => {
  try {
    const log = await prisma.printLog.findFirst({
      where: { id: req.params.id, ownerId: req.user!.restaurantId },
    })
    if (!log) return res.status(404).json({ success: false, error: 'Impression introuvable' })

    await sendPrintAndLog(req.user!.restaurantId, log.content, {
      kind:      log.kind,
      relatedId: log.relatedId ?? undefined,
      orderId:   log.orderId ?? undefined,
      copies:    log.copies,
    } as any)
    res.json({ success: true })
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

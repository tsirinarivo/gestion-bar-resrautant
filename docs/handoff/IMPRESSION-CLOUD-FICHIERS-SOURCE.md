# Impression cloud — 3 fichiers source (à recopier verbatim)

À utiliser AVEC le document IMPRESSION-CLOUD-HANDOFF.md (modèles Prisma, env, Dockerfile).
Adapte juste les chemins d'import (`../middleware/auth`, `../lib/prisma`, `@/lib/api`,
`@restaurant/utils`) à la structure de ton autre projet.

---

## 1) `apps/api/src/lib/printer.ts`

```ts
/**
 * Thin re-export from the imprimantcloud npm package.
 * Installed via: npm install "git+https://github.com/tsirinarivo/ImprimantCloud.git#claude/add-french-support-dgA4o"
 *
 * Env required:
 *   APP_ENCRYPTION_KEY  — 64 chars hex
 *   XPYUN_DEBUG         — "1" debug / "0" prod
 */
export {
  getConfig,
  updateConfig,
  printNow,
  printTest,
  printerStatus,
  getLogs,
  refreshLogs,
  enrollPrinter,
  autoPrintSaleReceipt,
  printSaleReceiptNow,
  formatSaleReceipt,
  formatDeliveryNote,
  formatInventorySheet,
  formatCreditNote,
  formatMoney,
  sendPrintAndLog,
  XPYUN_REGIONS,
  loadPrinterCfg,
  callXprint,
  escapeXprint,
} from 'imprimantcloud'

import {
  formatSaleReceipt,
  loadPrinterCfg,
  sendPrintAndLog,
  escapeXprint,
} from 'imprimantcloud'
import { prisma } from './prisma'

export type ReceiptData = {
  id: string
  code: string
  date: Date
  shopName: string
  shopAddr?: string | null
  shopPhone?: string | null
  cashierName?: string | null
  table?: string | null
  items: { name: string; qty: number; unitPrice: number; total: number }[]
  subtotal: number
  discount?: number
  total: number
  paymentMethod?: string | null
  currency?: string
}

/**
 * Impression auto du ticket de caisse avec numéro de table.
 * Le numéro de table est injecté après la ligne "Ticket :" dans le template.
 */
export async function autoPrintReceiptWithTable(
  restaurantId: string,
  sale: ReceiptData,
): Promise<void> {
  const cfg = await loadPrinterCfg(restaurantId)
  if (!cfg?.autoOnSaleConfirm) return

  // En-tête/pied de page : on privilégie les champs personnalisés du restaurant
  // (Paramètres → En-tête facture & ticket), avec repli sur ceux du printer config.
  const r = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { invoiceHeader: true, invoiceFooter: true },
  }).catch(() => null)

  let content = formatSaleReceipt({
    shopName:     sale.shopName,
    shopAddr:     sale.shopAddr ?? null,
    shopPhone:    sale.shopPhone ?? null,
    saleCode:     sale.code,
    cashierName:  sale.cashierName ?? '',
    date:         sale.date,
    items:        sale.items,
    subtotal:     sale.subtotal,
    discount:     sale.discount ?? 0,
    total:        sale.total,
    paymentLabel: sale.paymentMethod ?? '',
    currency:     sale.currency,
    header:       r?.invoiceHeader || (cfg as any).header,
    footer:       r?.invoiceFooter || (cfg as any).footer,
  })

  // Injecte "Table   : X" juste après la ligne "Ticket  : ..."
  if (sale.table) {
    const ticketLine = `<L>Ticket  : ${escapeXprint(sale.code)}</L>`
    const tableLine  = `<L>Table   : ${escapeXprint(sale.table)}</L>`
    content = content.replace(`${ticketLine}<BR>`, `${ticketLine}<BR>${tableLine}<BR>`)
  }

  await sendPrintAndLog(restaurantId, content, {
    kind:      'sale_receipt',
    relatedId: sale.id,
  })
}
```

---

## 2) `apps/api/src/routes/printer.ts`

Monter dans l'app : `app.use('/api/printer', printerRouter)`.

```ts
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
```

---

## 3) `apps/web/src/app/(dashboard)/settings/printer/page.tsx`

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Printer, Power, RefreshCw, CheckCircle, XCircle, AlertCircle,
  Eye, EyeOff, Save, TestTube2, Wifi, WifiOff, Clock, ChevronDown,
  RotateCcw, Settings2,
} from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { formatCurrency } from '@restaurant/utils'

const VOICE_OPTIONS = [
  { value: 0, label: 'Voix fort' },
  { value: 1, label: 'Voix moyen' },
  { value: 2, label: 'Voix bas' },
  { value: 3, label: 'Bip' },
  { value: 4, label: 'Muet' },
]

const REGION_OPTIONS = [
  { label: 'Chine — open.xpyun.net (par défaut)',    value: 'cn' },
  { label: 'Singapour — sg.open.xpyun.net',          value: 'sg' },
  { label: 'Europe — gm.open.xpyun.net',             value: 'de' },
]

const STATUS_META: Record<string, { label: string; icon: any; color: string }> = {
  online:  { label: 'En ligne',   icon: Wifi,     color: '#10B981' },
  offline: { label: 'Hors ligne', icon: WifiOff,  color: '#EF4444' },
  busy:    { label: 'Occupée',    icon: Clock,     color: '#F59E0B' },
  unknown: { label: 'Inconnu',    icon: WifiOff,  color: '#6B7280' },
}

const LOG_STATUS: Record<string, { label: string; color: string }> = {
  printed: { label: 'Imprimé',  color: '#10B981' },
  pending: { label: 'En attente', color: '#F59E0B' },
  failed:  { label: 'Échec',    color: '#EF4444' },
}

function StatusBadge({ status }: { status: string }) {
  const m = LOG_STATUS[status] ?? { label: status, color: '#6B7280' }
  return (
    <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: `${m.color}20`, color: m.color }}>
      {m.label}
    </span>
  )
}

export default function PrinterSettingsPage() {
  const qc = useQueryClient()
  const [showKey, setShowKey] = useState(false)
  const [logPage, setLogPage] = useState(1)

  // ── Fetch config ──────────────────────────────────────────────────────────
  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ['printer-config'],
    queryFn: () => api.get('/printer/config').then(r => r.data.data),
    retry: false,
  })

  const [form, setForm] = useState<any>(null)

  // configData is null  → no config yet (initialize form with defaults)
  // configData is undefined → API error (query failed)
  useEffect(() => {
    if (configData !== undefined && form === null) {
      setForm({
        enabled:                 configData?.enabled                ?? false,
        user:                    configData?.user                   ?? '',
        key:                     configData?.key                    ?? '',
        region:                  configData?.region                 ?? 'cn',
        sn:                      configData?.sn                     ?? '',
        voice:                   configData?.voice                  ?? 1,
        header:                  configData?.header                 ?? '',
        footer:                  configData?.footer                 ?? '',
        copies:                  configData?.copies                 ?? 1,
        autoOnSaleConfirm:       configData?.autoOnSaleConfirm      ?? true,
        autoOnPaymentConfirm:    configData?.autoOnPaymentConfirm   ?? true,
        autoOnDeliveryRegister:  configData?.autoOnDeliveryRegister ?? false,
      })
    }
  }, [configData]) // eslint-disable-line react-hooks/exhaustive-deps

  const f = form ?? {}
  function setF(key: string, val: any) {
    setForm((prev: any) => ({ ...prev, [key]: val }))
  }

  // ── Fetch printer status ──────────────────────────────────────────────────
  const { data: statusData, refetch: refetchStatus, isFetching: statusFetching } = useQuery({
    queryKey: ['printer-status'],
    queryFn: () => api.get('/printer/status').then(r => r.data.data),
    refetchInterval: 30_000,
    retry: false,
  })

  // ── Fetch logs ────────────────────────────────────────────────────────────
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['printer-logs', logPage],
    queryFn: () => api.get(`/printer/logs?page=${logPage}&perPage=20`).then(r => r.data),
    retry: false,
  })

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveConfig = useMutation({
    mutationFn: (data: any) => api.put('/printer/config', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['printer-config'] })
      qc.invalidateQueries({ queryKey: ['printer-status'] })
      toast.success('Configuration enregistrée')
    },
    onError: (e: any) => {
      const details = e?.response?.data?.details
      if (details) {
        const first = Object.entries(details as Record<string, string[]>).map(([k, v]) => `${k}: ${v[0]}`).join(', ')
        toast.error(`Données invalides — ${first}`)
      } else {
        toast.error(e?.response?.data?.error ?? 'Erreur de configuration')
      }
    },
  })

  const testPrint = useMutation({
    mutationFn: () => api.post('/printer/test'),
    onSuccess: () => toast.success('Ticket de test envoyé à l\'imprimante'),
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Impression de test échouée'),
  })

  const refreshLogs = useMutation({
    mutationFn: () => api.post('/printer/refresh-logs'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['printer-logs'] })
      toast.success('Statuts actualisés')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur actualisation'),
  })

  const reprint = useMutation({
    mutationFn: (logId: string) => api.post(`/printer/logs/${logId}/reprint`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['printer-logs'] })
      toast.success('Réimpression envoyée')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur réimpression'),
  })

  function handleSave() {
    if (!form) return
    saveConfig.mutate(form)
  }

  const printerOnline = statusData?.state === 'online'
  const printerStatus: string = statusData?.state ?? 'offline'
  const FALLBACK_META = { label: 'Hors ligne', icon: WifiOff, color: '#EF4444' }
  const statusMeta: { label: string; icon: any; color: string } = STATUS_META[printerStatus] ?? FALLBACK_META

  if (configLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="skeleton h-8 w-64 rounded-xl" />
        <div className="glass-card h-64 rounded-2xl" />
      </div>
    )
  }

  // Package not installed or other API error
  const notInstalled = !configLoading && configData === undefined

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Printer className="w-5 h-5 text-blue-400" />
            </div>
            Imprimante thermique
          </h1>
          <p className="text-brand-muted text-sm mt-1">
            Xprinter / xpyun.net via ImprimantCloud
          </p>
        </div>

        {/* Live status chip */}
        <div className="flex items-center gap-2">
          {statusData && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border"
                style={{ borderColor: `${statusMeta.color}40`, background: `${statusMeta.color}10` }}>
                <statusMeta.icon className="w-4 h-4" style={{ color: statusMeta.color }} />
                <span className="text-sm font-medium" style={{ color: statusMeta.color }}>
                  {statusMeta.label}
                </span>
              </div>
              {(statusData as any).msg && printerStatus !== 'online' && (
                <span className="text-xs text-brand-muted">{(statusData as any).msg}</span>
              )}
            </div>
          )}
          <button onClick={() => refetchStatus()}
            disabled={statusFetching}
            className="p-2 rounded-xl border border-brand-border text-brand-muted hover:text-white transition-colors">
            <RefreshCw className={`w-4 h-4 ${statusFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {notInstalled && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 border-yellow-500/30 bg-yellow-500/5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-400 text-sm">Module imprimantcloud non installé</p>
            <code className="text-xs text-brand-muted mt-1 block bg-black/20 px-2 py-1 rounded">
              npm install imprimantcloud --workspace=apps/api
            </code>
          </div>
        </motion.div>
      )}

      {/* ── Connexion & activation ────────────────────────────────────────────── */}
      <section className="glass-card divide-y divide-brand-border">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="font-semibold text-sm">Activer l'imprimante</p>
            <p className="text-xs text-brand-muted">Les impressions automatiques et manuelles seront disponibles</p>
          </div>
          <button
            onClick={() => setF('enabled', !f.enabled)}
            className={`relative w-12 h-6 rounded-full transition-colors ${f.enabled ? 'bg-brand-orange' : 'bg-brand-border'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${f.enabled ? 'translate-x-6' : ''}`} />
          </button>
        </div>

        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-brand-muted block mb-1.5">Numéro de série (SN) *</label>
            <input value={f.sn ?? ''} onChange={e => setF('sn', e.target.value)}
              placeholder="Ex: 7654321098" className="input-field font-mono text-sm" />
          </div>
          <div>
            <label className="text-xs text-brand-muted block mb-1.5">Région du serveur</label>
            <select value={f.region ?? 'cn'} onChange={e => setF('region', e.target.value)}
              className="input-field text-sm">
              {REGION_OPTIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-brand-muted block mb-1.5">Utilisateur (User)</label>
            <input value={f.user ?? ''} onChange={e => setF('user', e.target.value)}
              placeholder="email xpyun.net" className="input-field text-sm" />
          </div>
          <div>
            <label className="text-xs text-brand-muted block mb-1.5">UserKEY</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={f.key ?? ''}
                onChange={e => setF('key', e.target.value)}
                placeholder="Votre UserKEY xpyun"
                className="input-field text-sm pr-10 font-mono" />
              <button type="button" onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-white">
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {f.key === '••••••••' && (
              <p className="text-xs text-green-400 mt-1">✓ Clé enregistrée — effacez le champ pour la modifier</p>
            )}
          </div>
        </div>
      </section>

      {/* ── Impression automatique ────────────────────────────────────────────── */}
      <section className="glass-card">
        <div className="px-5 py-4 border-b border-brand-border">
          <p className="font-semibold text-sm flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-brand-orange" />
            Impressions automatiques
          </p>
          <p className="text-xs text-brand-muted mt-0.5">
            Choisissez à quel moment imprimer automatiquement un ticket de caisse
          </p>
        </div>
        <div className="px-5 py-4 space-y-3">
          {([
            ['autoOnSaleConfirm',       'À la confirmation de commande (CONFIRMED)',    'Imprime dès que le serveur confirme la commande'],
            ['autoOnPaymentConfirm',    'À la finalisation (COMPLETED)',                 'Imprime quand la commande est entièrement réglée'],
            ['autoOnDeliveryRegister',  'À l\'enregistrement d\'une livraison',          'Pour les commandes DELIVERY'],
          ] as [string, string, string][]).map(([key, label, desc]) => (
            <label key={key} className="flex items-start gap-3 cursor-pointer group">
              <div className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${f[key] ? 'bg-brand-orange border-brand-orange' : 'border-brand-border group-hover:border-brand-orange/50'}`}
                onClick={() => setF(key, !f[key])}>
                {f[key] && <CheckCircle className="w-3.5 h-3.5 text-white" />}
              </div>
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-brand-muted">{desc}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* ── Personnalisation ──────────────────────────────────────────────────── */}
      <section className="glass-card divide-y divide-brand-border">
        <div className="px-5 py-4">
          <p className="font-semibold text-sm mb-3">Personnalisation du ticket</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-brand-muted block mb-1.5">En-tête (header)</label>
              <textarea value={f.header ?? ''} onChange={e => setF('header', e.target.value)}
                placeholder="Nom du restaurant&#10;Adresse, téléphone..." rows={3}
                className="input-field text-sm resize-none w-full" />
            </div>
            <div>
              <label className="text-xs text-brand-muted block mb-1.5">Pied de page (footer)</label>
              <textarea value={f.footer ?? ''} onChange={e => setF('footer', e.target.value)}
                placeholder="Merci de votre visite !&#10;WiFi : ..." rows={3}
                className="input-field text-sm resize-none w-full" />
            </div>
            <div>
              <label className="text-xs text-brand-muted block mb-1.5">Nombre de copies</label>
              <select value={f.copies ?? 1} onChange={e => setF('copies', Number(e.target.value))}
                className="input-field text-sm">
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n} copie{n > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-brand-muted block mb-1.5">Bip sonore</label>
              <select value={f.voice ?? 1} onChange={e => setF('voice', Number(e.target.value))}
                className="input-field text-sm">
                {VOICE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* ── Action buttons ────────────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <button onClick={handleSave}
          disabled={saveConfig.isPending || !form}
          className="btn-primary flex items-center gap-2 disabled:opacity-50">
          <Save className="w-4 h-4" />
          {saveConfig.isPending ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        <button onClick={() => testPrint.mutate()}
          disabled={testPrint.isPending || !f.enabled}
          className="btn-secondary flex items-center gap-2 disabled:opacity-50">
          <TestTube2 className="w-4 h-4" />
          {testPrint.isPending ? 'Envoi...' : 'Ticket de test'}
        </button>
      </div>

      {/* ── Logs d'impression ────────────────────────────────────────────────── */}
      <section className="glass-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
          <p className="font-semibold text-sm">Historique des impressions</p>
          <button onClick={() => refreshLogs.mutate()}
            disabled={refreshLogs.isPending}
            className="flex items-center gap-1.5 text-xs text-brand-muted hover:text-white border border-brand-border px-3 py-1.5 rounded-lg transition-colors">
            <RotateCcw className={`w-3.5 h-3.5 ${refreshLogs.isPending ? 'animate-spin' : ''}`} />
            Actualiser en attente
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-brand-border text-left">
                {['Date', 'Type', 'Commande', 'Statut', 'Erreur', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-medium text-brand-muted uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-brand-border/50">
                    <td colSpan={6} className="px-4 py-3"><div className="skeleton h-4 rounded" /></td>
                  </tr>
                ))
              ) : (logsData?.data?.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-brand-muted">
                    <Printer className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Aucune impression enregistrée</p>
                  </td>
                </tr>
              ) : (logsData?.data?.data ?? []).map((log: any) => (
                <tr key={log.id} className="border-b border-brand-border/30 hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3 text-sm text-brand-muted whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    <span className="ml-1 text-xs opacity-60">
                      {new Date(log.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 bg-white/5 rounded-lg border border-brand-border font-mono">
                      {log.kind}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-brand-muted">
                    {log.orderId ? `#${log.orderId.slice(-6).toUpperCase()}` : log.relatedId ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={log.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-red-400 max-w-xs truncate">
                    {log.error ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {log.status === 'failed' && (
                      <button onClick={() => reprint.mutate(log.id)} disabled={reprint.isPending}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-brand-border hover:bg-white/5 disabled:opacity-50 transition-colors whitespace-nowrap">
                        <Printer className="w-3 h-3" />
                        Réimprimer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(logsData?.data?.meta?.pageCount ?? 0) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-brand-border">
            <p className="text-xs text-brand-muted">{logsData!.data.meta.total} impression(s)</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setLogPage(p => Math.max(1, p - 1))} disabled={logPage === 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-brand-border disabled:opacity-30">
                Précédent
              </button>
              <span className="text-xs text-brand-muted">{logPage} / {logsData!.data.meta.pageCount}</span>
              <button onClick={() => setLogPage(p => Math.min(logsData!.data.meta.pageCount, p + 1))}
                disabled={logPage === logsData!.data.meta.pageCount}
                className="px-3 py-1.5 text-xs rounded-lg border border-brand-border disabled:opacity-30">
                Suivant
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
```

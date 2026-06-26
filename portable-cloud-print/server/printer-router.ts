/**
 * Routeur d'impression cloud PORTABLE — factory à injection de dépendances.
 *
 * Aucune dépendance au projet hôte : tu fournis l'auth, le moyen de récupérer
 * l'ID du commerce, et (optionnel) les coordonnées boutique. Le module s'appuie
 * uniquement sur le package `imprimantcloud`.
 *
 *   import { createPrinterRouter } from './portable-cloud-print/server/printer-router'
 *   app.use('/api/printer', createPrinterRouter({
 *     authenticate,                       // middleware Express (req.user rempli)
 *     authorizeAdmin,                     // middleware Express (manager/admin)
 *     getOwnerId: (req) => req.user.shopId,
 *     resolveShop: async (ownerId) => ({ name, address, phone, header, footer }),
 *   }))
 */
import { Router, type RequestHandler, type Request } from 'express'
import {
  getConfig, updateConfig, printTest, printerStatus,
  getLogs, refreshLogs, sendPrintAndLog,
} from 'imprimantcloud'
import { buildReceipt, type ReceiptItem } from './receipt'

export type ShopInfo = {
  name: string
  address?: string | null
  phone?: string | null
  header?: string | null
  footer?: string | null
}

export type PrinterRouterOptions = {
  /** Middleware qui authentifie et remplit req.user (ou équivalent). */
  authenticate: RequestHandler
  /** Middleware qui restreint aux admins/managers (config, test, logs). */
  authorizeAdmin: RequestHandler
  /** Extrait l'ID du commerce (tenant/restaurant/shop) depuis la requête. */
  getOwnerId: (req: Request) => string
  /** (Optionnel) Coordonnées + en-tête/pied pour l'impression manuelle. */
  resolveShop?: (ownerId: string) => Promise<ShopInfo | null> | ShopInfo | null
}

export function createPrinterRouter(opts: PrinterRouterOptions): Router {
  const { authenticate, authorizeAdmin, getOwnerId, resolveShop } = opts
  const router = Router()
  router.use(authenticate)

  // ── Impression manuelle d'un ticket — tous rôles authentifiés ──────────────
  router.post('/receipt', async (req, res, next) => {
    try {
      const ownerId = getOwnerId(req)
      const body = req.body as {
        items: ReceiptItem[]; grandTotal: number
        label?: string; code?: string; copies?: number
      }
      const shop = (resolveShop ? await resolveShop(ownerId) : null) ?? { name: 'Boutique' }
      const content = buildReceipt({
        shopName: shop.name,
        shopAddr: shop.address ?? null,
        shopPhone: shop.phone ?? null,
        header: shop.header ?? null,
        footer: shop.footer ?? null,
        label: body.label ?? null,
        code: body.code ?? null,
        items: body.items ?? [],
        grandTotal: body.grandTotal ?? 0,
      })
      await sendPrintAndLog(ownerId, content, {
        kind: 'receipt',
        relatedId: body.code ?? `receipt-${Date.now()}`,
        copies: body.copies ?? 1,
      } as any)
      res.json({ success: true })
    } catch (e) { next(e) }
  })

  // ── Routes d'administration ────────────────────────────────────────────────
  router.use(authorizeAdmin)

  router.get('/config', async (req, res, next) => {
    try { res.json({ success: true, data: await getConfig(getOwnerId(req)) }) }
    catch (e) { next(e) }
  })

  router.put('/config', async (req, res, next) => {
    try {
      // Ignore les champs vides pour ne pas casser la validation du package.
      const body = Object.fromEntries(
        Object.entries(req.body as Record<string, unknown>).filter(([, v]) => v !== '' && v !== null),
      )
      const result = await updateConfig(getOwnerId(req), body)
      if (!result.ok) return res.status(422).json({ success: false, error: 'Données invalides', details: result.errors })
      res.json({ success: true, data: result })
    } catch (e) { next(e) }
  })

  router.post('/test', async (req, res, next) => {
    try { res.json({ success: true, data: await printTest(getOwnerId(req)) }) }
    catch (e) { next(e) }
  })

  router.get('/status', async (req, res, next) => {
    try {
      const result = await printerStatus(getOwnerId(req))
      const STATE: Record<number, string> = { [-1]: 'unknown', 0: 'offline', 1: 'online', 2: 'busy' }
      res.json({ success: true, data: { ...result, state: STATE[result.status] ?? 'unknown' } })
    } catch (e) { next(e) }
  })

  router.get('/logs', async (req, res, next) => {
    try {
      const { page = '1', perPage = '20', status } = req.query
      res.json({ success: true, data: await getLogs(getOwnerId(req), {
        page: Number(page), perPage: Number(perPage), status: status as string | undefined,
      }) })
    } catch (e) { next(e) }
  })

  router.post('/refresh-logs', async (req, res, next) => {
    try { res.json({ success: true, data: await refreshLogs(getOwnerId(req)) }) }
    catch (e) { next(e) }
  })

  return router
}

/**
 * Impression automatique d'un ticket de vente, à appeler après paiement /
 * finalisation (fire-and-forget). Prend des données BRUTES — aucune base.
 */
export async function printSaleReceipt(ownerId: string, sale: {
  shop: ShopInfo
  code?: string | null
  label?: string | null
  items: ReceiptItem[]
  grandTotal: number
  copies?: number
}): Promise<void> {
  const content = buildReceipt({
    shopName: sale.shop.name,
    shopAddr: sale.shop.address ?? null,
    shopPhone: sale.shop.phone ?? null,
    header: sale.shop.header ?? null,
    footer: sale.shop.footer ?? null,
    label: sale.label ?? null,
    code: sale.code ?? null,
    items: sale.items,
    grandTotal: sale.grandTotal,
  })
  await sendPrintAndLog(ownerId, content, {
    kind: 'sale_receipt',
    relatedId: sale.code ?? `sale-${Date.now()}`,
    copies: sale.copies ?? 1,
  } as any)
}

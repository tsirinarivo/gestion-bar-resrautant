/**
 * ImprimantCloud — implémentation directe xpyun.net (Xprinter)
 * Remplace le package npm externe par une intégration native.
 *
 * Vars d'env requises :
 *   APP_ENCRYPTION_KEY  64 chars hex (AES-256-GCM pour stocker UserKEY)
 *   XPYUN_DEBUG         "1" = simulation (pas d'impression physique)
 */

import crypto from 'crypto'
import { prisma } from './prisma'

const XPYUN_BASE    = 'https://open.xpyun.net'
const DEBUG         = process.env.XPYUN_DEBUG === '1'
const MASKED_KEY    = '••••••••'
const PRINT_WIDTH   = 32   // chars par ligne thermique

// ── Chiffrement AES-256-GCM ───────────────────────────────────────────────────

function encKey(): Buffer {
  const hex = process.env.APP_ENCRYPTION_KEY ?? ''
  if (hex.length !== 64) throw new Error('APP_ENCRYPTION_KEY manquante (64 chars hex requis)')
  return Buffer.from(hex, 'hex')
}

function encrypt(plain: string): string {
  const iv  = crypto.randomBytes(12)
  const c   = crypto.createCipheriv('aes-256-gcm', encKey(), iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64')
}

function decrypt(b64: string): string {
  const buf  = Buffer.from(b64, 'base64')
  const iv   = buf.subarray(0, 12)
  const tag  = buf.subarray(12, 28)
  const enc  = buf.subarray(28)
  const d    = crypto.createDecipheriv('aes-256-gcm', encKey(), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8')
}

// ── xpyun.net API ─────────────────────────────────────────────────────────────

function makeSign(user: string, key: string, ts: number): string {
  return crypto.createHash('sha256').update(`${user}${key}${ts}`).digest('hex')
}

async function xpyunCall(endpoint: string, body: any, cfg: any): Promise<any> {
  if (DEBUG) {
    console.log(`[ImprimantCloud DEBUG] ${endpoint}`, JSON.stringify(body))
    return { code: 0, data: { orderId: `debug-${Date.now()}` } }
  }

  const user  = cfg.user ?? ''
  const rawKey = cfg.key ? decrypt(cfg.key) : ''
  const ts    = Math.floor(Date.now() / 1000)
  const base  = cfg.baseUrl || XPYUN_BASE

  const payload = { ...body, user, sign: makeSign(user, rawKey, ts), timestamp: ts }

  // Retry: 4 tentatives (0s, 2s, 4s, 8s)
  const delays = [0, 2000, 4000, 8000]
  let lastErr: any
  for (const delay of delays) {
    if (delay > 0) await new Promise(r => setTimeout(r, delay))
    try {
      const res = await fetch(`${base}/api/openapi/xprinter/${endpoint}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const json = await res.json() as any
      if (json.code !== 0) throw new Error(json.msg || `xpyun error ${json.code}`)
      return json
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr
}

// ── Config ────────────────────────────────────────────────────────────────────

export async function getConfig(ownerId: string) {
  const cfg = await prisma.printerConfig.findUnique({ where: { ownerId } })
  if (!cfg) {
    return {
      ownerId, enabled: false, user: null, key: MASKED_KEY,
      baseUrl: null, sn: null, voice: 1, header: null, footer: null,
      copies: 1, autoOnSaleConfirm: true, autoOnPaymentConfirm: true,
      autoOnDeliveryRegister: false,
    }
  }
  return { ...cfg, key: cfg.key ? MASKED_KEY : '' }
}

export async function updateConfig(ownerId: string, data: any) {
  const existing = await prisma.printerConfig.findUnique({ where: { ownerId } })

  // Clé masquée reçue → conserver l'existante
  let storedKey: string | undefined = undefined
  if (data.key && data.key !== MASKED_KEY) {
    storedKey = encrypt(data.key)
  } else if (existing?.key) {
    storedKey = existing.key
  }

  const payload: any = { ...data }
  delete payload.key
  if (storedKey !== undefined) payload.key = storedKey

  const cfg = await prisma.printerConfig.upsert({
    where:  { ownerId },
    create: { ownerId, ...payload },
    update: payload,
  })
  return { ...cfg, key: cfg.key ? MASKED_KEY : '' }
}

// ── Statut ────────────────────────────────────────────────────────────────────

export async function printerStatus(ownerId: string) {
  const cfg = await prisma.printerConfig.findUnique({ where: { ownerId } })
  if (!cfg?.enabled || !cfg.sn) return { state: 'offline', reason: 'Non configurée' }

  try {
    const res = await xpyunCall('queryPrinterStatus', { sn: cfg.sn }, cfg)
    // xpyun: data 0=online 1=offline 2=abnormal
    const state = res.data === 0 ? 'online' : res.data === 2 ? 'busy' : 'offline'
    return { state, raw: res.data }
  } catch (e: any) {
    return { state: 'offline', error: e.message }
  }
}

// ── Impression ────────────────────────────────────────────────────────────────

export async function sendPrintAndLog(
  ownerId: string, sn: string, kind: string, relatedId: string | null,
  content: string, copies: number, cfg: any,
): Promise<any> {
  const safeContent = content.slice(0, 4096)

  const log = await prisma.printLog.create({
    data: { ownerId, sn, kind, relatedId, content: safeContent, copies, status: 'pending' },
  })

  try {
    const res = await xpyunCall('print', {
      sn, content: safeContent, copies,
      voice: cfg.voice ?? 1,
    }, cfg)
    await prisma.printLog.update({
      where: { id: log.id },
      data:  { status: 'printed', relatedId: res.data?.orderId ?? relatedId },
    })
    return { logId: log.id, xpyunOrderId: res.data?.orderId }
  } catch (err: any) {
    await prisma.printLog.update({
      where: { id: log.id },
      data:  { status: 'failed', error: err.message, failedAt: new Date() },
    })
    throw err
  }
}

export async function printTest(ownerId: string) {
  const cfg = await prisma.printerConfig.findUnique({ where: { ownerId } })
  if (!cfg?.enabled || !cfg.sn) throw new Error('Imprimante non configurée ou désactivée')
  return sendPrintAndLog(ownerId, cfg.sn, 'test', null, testTicket(), cfg.copies ?? 1, cfg)
}

export async function printNow(ownerId: string, content: string, copies = 1) {
  const cfg = await prisma.printerConfig.findUnique({ where: { ownerId } })
  if (!cfg?.enabled || !cfg.sn) throw new Error('Imprimante non configurée ou désactivée')
  return sendPrintAndLog(ownerId, cfg.sn, 'manual', null, content, copies, cfg)
}

// ── Logs ──────────────────────────────────────────────────────────────────────

export async function getLogs(
  ownerId: string,
  opts: { page?: number; limit?: number; status?: string } = {},
) {
  const { page = 1, limit = 30, status } = opts
  const where: any = { ownerId }
  if (status) where.status = status

  const [items, total] = await Promise.all([
    prisma.printLog.findMany({
      where, orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit, take: limit,
    }),
    prisma.printLog.count({ where }),
  ])
  return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }
}

export async function refreshLogs(ownerId: string) {
  const cfg = await prisma.printerConfig.findUnique({ where: { ownerId } })
  if (!cfg) return { updated: 0, checked: 0 }

  const pending = await prisma.printLog.findMany({
    where: { ownerId, status: 'pending' }, take: 50,
  })

  let updated = 0
  for (const log of pending) {
    if (!log.relatedId) continue
    try {
      const res = await xpyunCall('queryOrderState', { orderId: log.relatedId }, cfg)
      if (res.data === true || res.data === 1) {
        await prisma.printLog.update({ where: { id: log.id }, data: { status: 'printed' } })
        updated++
      }
    } catch { /* continue */ }
  }
  return { updated, checked: pending.length }
}

// ── Enrôlement ────────────────────────────────────────────────────────────────

export async function enrollPrinter(ownerId: string, { sn, name }: { sn: string; name?: string }) {
  const cfg = await prisma.printerConfig.findUnique({ where: { ownerId } })
  if (!cfg?.user || !cfg.key) throw new Error('Configurez d\'abord les identifiants xpyun (user + key)')
  const content = name ? `${sn}#${name}` : sn
  return xpyunCall('addPrinters', { printerContent: content }, cfg)
}

// ── Auto-print ────────────────────────────────────────────────────────────────

export async function autoPrintSaleReceipt(ownerId: string, sale: SaleData) {
  const cfg = await prisma.printerConfig.findUnique({ where: { ownerId } })
  if (!cfg?.enabled || !cfg.sn) return
  if (!cfg.autoOnSaleConfirm && !cfg.autoOnPaymentConfirm) return

  const content = formatSaleReceipt(sale, cfg)
  await sendPrintAndLog(ownerId, cfg.sn, 'sale', sale.id, content, cfg.copies ?? 1, cfg)
}

export async function printSaleReceiptNow(ownerId: string, sale: SaleData) {
  const cfg = await prisma.printerConfig.findUnique({ where: { ownerId } })
  if (!cfg?.enabled || !cfg.sn) throw new Error('Imprimante non configurée ou désactivée')
  const content = formatSaleReceipt(sale, cfg)
  return sendPrintAndLog(ownerId, cfg.sn, 'sale', sale.id, content, cfg.copies ?? 1, cfg)
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SaleData {
  id:            string
  code:          string
  date:          Date
  shopName:      string
  shopAddr?:     string | null
  shopPhone?:    string | null
  cashierName?:  string | null
  items:         { name: string; qty: number; unitPrice: number; total: number }[]
  subtotal:      number
  discount?:     number
  total:         number
  paymentMethod?: string | null
  currency?:     string
}

// ── Formatage tickets ─────────────────────────────────────────────────────────

export function formatMoney(amount: number, currency = 'MGA'): string {
  return `${Math.round(amount).toLocaleString('fr-MG')} ${currency}`
}

function line() { return '-'.repeat(PRINT_WIDTH) }

function center(text: string): string {
  const t = text.slice(0, PRINT_WIDTH)
  const pad = Math.max(0, Math.floor((PRINT_WIDTH - t.length) / 2))
  return ' '.repeat(pad) + t
}

function row(label: string, value: string): string {
  const space = PRINT_WIDTH - label.length - value.length
  return space > 0 ? label + ' '.repeat(space) + value : `${label}\n  ${value}`
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatSaleReceipt(sale: SaleData, cfg?: any): string {
  const cur    = sale.currency ?? 'MGA'
  const header = cfg?.header ?? sale.shopName
  const footer = cfg?.footer ?? 'Merci de votre visite !'
  const out: string[] = []

  if (header) { out.push(center(header)); out.push(line()) }
  if (sale.shopAddr)  out.push(center(sale.shopAddr))
  if (sale.shopPhone) out.push(center(`Tel: ${sale.shopPhone}`))
  out.push(line())
  out.push(`N° ${sale.code}`)
  out.push(`Date: ${fmtDate(sale.date)}`)
  if (sale.cashierName) out.push(`Caissier: ${sale.cashierName}`)
  out.push(line())

  for (const item of sale.items) {
    out.push(item.name.slice(0, PRINT_WIDTH))
    const qty  = `  ${item.qty} x ${formatMoney(item.unitPrice, cur)}`
    const tot  = formatMoney(item.total, cur)
    const space = PRINT_WIDTH - qty.length - tot.length
    out.push(space > 0 ? qty + ' '.repeat(space) + tot : qty)
  }

  out.push(line())
  out.push(row('Sous-total', formatMoney(sale.subtotal, cur)))
  if (sale.discount && sale.discount > 0) {
    out.push(row('Remise', `-${formatMoney(sale.discount, cur)}`))
  }
  out.push(`<B>${row('TOTAL', formatMoney(sale.total, cur))}</B>`)
  if (sale.paymentMethod) out.push(row('Règlement', sale.paymentMethod))
  out.push(line())
  if (footer) out.push(center(footer))
  out.push('')
  return out.join('\n')
}

export function formatDeliveryNote(data: any): string {
  const out = [`BON DE LIVRAISON`, line(), `Commande : ${data.orderNumber ?? data.id}`, '']
  if (data.address) out.push(`Adresse : ${data.address}`)
  out.push(line())
  for (const item of data.items ?? []) {
    out.push(`${item.qty}x ${item.name}`)
  }
  out.push(line(), '')
  return out.join('\n')
}

export function formatInventorySheet(data: any): string {
  const out = [`FICHE INVENTAIRE`, `Date: ${fmtDate(new Date())}`, line(), '']
  for (const item of data.items ?? []) {
    out.push(`${item.name}`.padEnd(20) + `${item.currentQuantity} ${item.unit}`)
  }
  out.push(line(), '')
  return out.join('\n')
}

export function formatCreditNote(data: any): string {
  const out = [
    `AVOIR`, line(),
    `N° ${data.id}`, `Date: ${fmtDate(new Date())}`,
    line(),
    row('Montant avoir', formatMoney(data.amount, data.currency ?? 'MGA')),
    line(), '',
  ]
  return out.join('\n')
}

function testTicket(): string {
  return [
    center('== TEST IMPRIMANTE =='),
    '',
    `Date: ${fmtDate(new Date())}`,
    '',
    line(),
    center('ImprimantCloud'),
    center('Xprinter / xpyun.net'),
    line(),
    center('Impression OK !'),
    '',
  ].join('\n')
}

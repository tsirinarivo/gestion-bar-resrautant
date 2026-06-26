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

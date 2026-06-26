/**
 * Générateur de ticket 80mm (48 colonnes) — FONCTION PURE, zéro dépendance.
 * Balises supportées par XPyun : <C> centre, <L> gauche, <B> gras, <BR> saut.
 * Réutilisable tel quel dans n'importe quel projet.
 */

export const RECEIPT_WIDTH = 48

export type ReceiptItem = { name: string; qty: number; total: number }

export type ReceiptInput = {
  shopName: string
  shopAddr?: string | null
  shopPhone?: string | null
  /** Lignes libres sous les coordonnées (mentions légales, MVola, etc.) */
  header?: string | null
  /** Lignes libres en bas (remerciement, WiFi…) */
  footer?: string | null
  /** Libellé table / mode (ex. "Table 4", "À emporter") */
  label?: string | null
  /** Référence ticket/commande affichée */
  code?: string | null
  items: ReceiptItem[]
  grandTotal: number
  /** Devise affichée devant les montants (def. "Ar") */
  currency?: string
  date?: Date
}

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
  const pad = RECEIPT_WIDTH - left.length - right.length
  if (pad > 0) return left + ' '.repeat(pad) + right
  return left.slice(0, RECEIPT_WIDTH - right.length - 1) + ' ' + right
}

function fmtMoney(amount: number, currency = 'Ar'): string {
  const n = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount).replace(/ /g, ' ')
  return `${currency} ${n}`
}

/** Construit le contenu XPyun (string) d'un ticket de caisse. */
export function buildReceipt(input: ReceiptInput): string {
  const { shopName, shopAddr, shopPhone, header, footer, label, code, items, grandTotal } = input
  const currency = input.currency ?? 'Ar'
  const now = input.date ?? new Date()
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const dDiv = '='.repeat(RECEIPT_WIDTH)
  const div = '-'.repeat(RECEIPT_WIDTH)

  const lines: string[] = []
  lines.push(dDiv)
  lines.push(`<C><B>${esc(shopName).toUpperCase()}</B></C>`)
  if (shopAddr) lines.push(`<C>${esc(shopAddr)}</C>`)
  if (shopPhone) lines.push(`<C>Tel: ${esc(shopPhone)}</C>`)
  if (header) for (const l of String(header).split('\n')) lines.push(`<C>${esc(l)}</C>`)
  lines.push(dDiv)
  if (code) lines.push(`<L>Ticket  : ${esc(code)}</L>`)
  if (label) lines.push(`<C><B>${esc(label).toUpperCase()}</B></C>`)
  lines.push(`<C>${dateStr}  ${timeStr}</C>`)
  lines.push(div)

  for (const it of items) {
    lines.push(`<L>${rowLine(`${it.qty}x ${esc(it.name)}`, fmtMoney(it.total, currency))}</L>`)
  }

  lines.push(div)
  lines.push(`<C><B>${rowLine('TOTAL', fmtMoney(grandTotal, currency))}</B></C>`)
  lines.push(dDiv)
  lines.push('')
  if (footer) for (const l of String(footer).split('\n')) lines.push(`<C>${esc(l)}</C>`)
  else lines.push('<C>Merci de votre visite !</C>')
  lines.push('')

  return lines.join('<BR>')
}

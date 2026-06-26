import { formatCurrency, formatDate } from '@restaurant/utils'

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Texte multi-ligne → HTML (échappé, sauts de ligne préservés)
function multiline(s: unknown): string {
  return esc(s).replace(/\n/g, '<br/>')
}

export function printInvoice(invoice: any, restaurant: any) {
  const r = restaurant ?? {}
  const customer = invoice?.payment?.order?.customer
  const customerName = customer ? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() : 'Client comptant'

  const legalLine = [r.siret ? `NIF/SIRET : ${esc(r.siret)}` : '', r.vatNumber ? `TVA : ${esc(r.vatNumber)}` : '']
    .filter(Boolean).join(' &nbsp;·&nbsp; ')

  const itemsRows = (invoice?.items ?? []).map((it: any) => `
    <tr>
      <td>${esc(it.description)}</td>
      <td class="r">${esc(it.quantity)}</td>
      <td class="r">${formatCurrency(it.unitPrice)}</td>
      <td class="r">${esc(it.taxRate)}%</td>
      <td class="r">${formatCurrency(it.totalTTC)}</td>
    </tr>`).join('')

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>Facture ${esc(invoice?.invoiceNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111; margin: 0; padding: 28px 32px; font-size: 13px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; border-bottom: 2px solid #111; padding-bottom: 14px; }
  .shop-name { font-size: 22px; font-weight: 800; letter-spacing: .3px; }
  .muted { color: #555; }
  .head-custom { margin-top: 6px; white-space: pre-line; }
  .doc-title { text-align: right; }
  .doc-title h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { margin: 18px 0 10px; display: flex; justify-content: space-between; gap: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { padding: 7px 8px; text-align: left; }
  thead th { border-bottom: 1.5px solid #111; font-size: 11px; text-transform: uppercase; color: #555; }
  tbody td { border-bottom: 1px solid #ddd; }
  .r { text-align: right; }
  .totals { margin-top: 12px; margin-left: auto; width: 280px; }
  .totals tr td { border: none; padding: 4px 8px; }
  .totals .grand td { border-top: 2px solid #111; font-weight: 800; font-size: 15px; }
  .footer { margin-top: 28px; border-top: 1px solid #ddd; padding-top: 12px; color: #444; white-space: pre-line; text-align: center; }
  @media print { body { padding: 0; } @page { margin: 16mm; } }
</style></head>
<body>
  <div class="top">
    <div>
      <div class="shop-name">${esc(r.name ?? 'Restaurant')}</div>
      <div class="muted">
        ${esc([r.address, r.city].filter(Boolean).join(', '))}<br/>
        ${[r.phone ? `Tél : ${esc(r.phone)}` : '', r.email ? esc(r.email) : ''].filter(Boolean).join(' · ')}
        ${legalLine ? `<br/>${legalLine}` : ''}
      </div>
      ${r.invoiceHeader ? `<div class="head-custom muted">${multiline(r.invoiceHeader)}</div>` : ''}
    </div>
    <div class="doc-title">
      <h1>FACTURE</h1>
      <div class="muted">N° <strong>${esc(invoice?.invoiceNumber)}</strong></div>
      <div class="muted">${esc(formatDate(invoice?.issueDate))}</div>
    </div>
  </div>

  <div class="meta">
    <div><span class="muted">Facturé à</span><br/><strong>${esc(customerName)}</strong></div>
  </div>

  <table>
    <thead><tr><th>Description</th><th class="r">Qté</th><th class="r">PU HT</th><th class="r">TVA</th><th class="r">Total TTC</th></tr></thead>
    <tbody>${itemsRows}</tbody>
  </table>

  <table class="totals">
    <tr><td class="muted">Total HT</td><td class="r">${formatCurrency(invoice?.totalHT ?? 0)}</td></tr>
    <tr><td class="muted">TVA</td><td class="r">${formatCurrency(invoice?.totalTax ?? 0)}</td></tr>
    <tr class="grand"><td>Total TTC</td><td class="r">${formatCurrency(invoice?.totalTTC ?? 0)}</td></tr>
  </table>

  ${invoice?.notes ? `<p class="muted" style="margin-top:16px;font-style:italic">${multiline(invoice.notes)}</p>` : ''}
  ${r.invoiceFooter ? `<div class="footer">${multiline(r.invoiceFooter)}</div>` : ''}

  <script>window.onload = function(){ window.print(); }</script>
</body></html>`

  const w = window.open('', '_blank', 'width=820,height=1000')
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
}

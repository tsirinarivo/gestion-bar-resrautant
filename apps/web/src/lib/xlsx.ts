import * as XLSX from 'xlsx'

export function exportToXLSX(
  filename: string,
  rows: Array<Record<string, any>>,
  sheetName = 'Données',
) {
  if (!rows.length) return
  const ws = XLSX.utils.json_to_sheet(rows)

  const keys = Object.keys(rows[0]!)
  const colWidths = keys.map(k => {
    const headerLen = k.length
    const maxValueLen = rows.reduce((m, r) => Math.max(m, String(r[k] ?? '').length), 0)
    return { wch: Math.min(40, Math.max(headerLen, maxValueLen) + 2) }
  })
  ws['!cols'] = colWidths

  ws['!autofilter'] = { ref: XLSX.utils.encode_range(XLSX.utils.decode_range(ws['!ref']!)) }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))

  const stamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}-${stamp}.xlsx`)
}

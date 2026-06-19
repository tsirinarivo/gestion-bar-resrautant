/**
 * Utilitaires CSV partagés pour les imports Dolibarr / generic.
 * Origine : factorise les helpers de apps/api/src/routes/products.ts.
 *
 * Convention :
 *  - normalizeHeader: insensible accents/casse/ponctuation, split CamelCase
 *  - parseCsv: auto-detect delimiter (, ou ;), tolère les quotes ""
 *  - pick: 1) match exact, 2) substring fallback
 */

import multer from 'multer'

export const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (/\.csv$/i.test(file.originalname) || file.mimetype.includes('csv') || file.mimetype.includes('plain')) {
      cb(null, true)
    } else {
      cb(new Error('Format non supporté : utilisez un fichier .csv'))
    }
  },
})

export function normalizeHeader(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
}

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const firstLine = text.split(/\r?\n/, 1)[0] || ''
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','

  const parseLine = (line: string): string[] => {
    const cells: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (inQuote) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
        else if (c === '"') inQuote = false
        else cur += c
      } else {
        if (c === '"') inQuote = true
        else if (c === delim) { cells.push(cur); cur = '' }
        else cur += c
      }
    }
    cells.push(cur)
    return cells.map(s => s.trim())
  }

  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }
  const rawHeaders = parseLine(lines[0]!).map(h => h.replace(/^"|"$/g, ''))
  const headers = rawHeaders.map(normalizeHeader)
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]!)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = cells[idx] ?? '' })
    rows.push(row)
  }
  return { headers, rows }
}

export function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    if (row[k] && row[k].trim()) return row[k].trim()
  }
  const headers = Object.keys(row)
  for (const k of keys) {
    const matching = headers.find(h => h.includes(k))
    if (matching && row[matching] && row[matching].trim()) return row[matching].trim()
  }
  return ''
}

export function toFloat(s: string): number | null {
  if (!s) return null
  const cleaned = s.replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

export function toInt(s: string): number | null {
  const f = toFloat(s)
  if (f === null) return null
  return Math.round(f)
}

export function prismaReason(err: unknown): string {
  const msg = String((err as { message?: string })?.message ?? '')
  if (!msg) return 'Erreur DB'
  const lines = msg.split('\n').map(l => l.trim()).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i]!
    if (/missing|unknown|invalid|expected|relation|constraint|violat|did you mean|required|null/i.test(l)) {
      return l.slice(0, 300)
    }
  }
  return (lines[lines.length - 1] || 'Erreur DB').slice(0, 300)
}

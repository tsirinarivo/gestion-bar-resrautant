/**
 * Recherche d'image produit sur internet, sans clé API :
 *  1. OpenFoodFacts (via code-barres) → vraie photo du produit emballé.
 *  2. Wikimedia Commons (recherche par nom) → repli générique libre de droits.
 * Retourne l'URL d'une image candidate, ou null.
 */

export type ImageCandidate = { url: string; source: 'openfoodfacts' | 'wikimedia' }

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SakafioBot/1.0 (menu image import)' },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// Nettoie le nom pour une meilleure recherche : retire volumes/quantités.
function cleanQuery(name: string): string {
  return name
    .replace(/\b\d+([.,]\d+)?\s?(cl|ml|l|g|kg|x\d+)\b/gi, ' ')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fromOpenFoodFacts(barcode: string): Promise<ImageCandidate | null> {
  const data = await fetchJson(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=image_front_url,image_url`)
  const url = data?.product?.image_front_url || data?.product?.image_url
  return url ? { url, source: 'openfoodfacts' } : null
}

async function fromWikimedia(name: string): Promise<ImageCandidate | null> {
  const q = cleanQuery(name)
  if (!q) return null
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=1&gsrnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=500&format=json&origin=*`
  const data = await fetchJson(url)
  const pages = data?.query?.pages
  if (!pages) return null
  const first: any = Object.values(pages)[0]
  const thumb = first?.imageinfo?.[0]?.thumburl || first?.imageinfo?.[0]?.url
  // On ne garde que les images raster (évite svg/pdf/tif).
  if (thumb && /\.(jpe?g|png|webp)$/i.test(thumb)) return { url: thumb, source: 'wikimedia' }
  return null
}

export async function searchProductImage(name: string, barcode?: string | null): Promise<ImageCandidate | null> {
  if (barcode && barcode.trim()) {
    const off = await fromOpenFoodFacts(barcode.trim())
    if (off) return off
  }
  return fromWikimedia(name)
}

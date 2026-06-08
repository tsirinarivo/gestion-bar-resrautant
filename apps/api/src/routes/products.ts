import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'
import { slugify, convertUnit } from '@restaurant/utils'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

export const productRouter = Router()
productRouter.use(authenticate)

// ── Image Upload ─────────────────────────────────────────────────────────────
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'products')
try {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
} catch (err) {
  console.warn(`[products] Cannot create upload dir ${uploadDir} — image uploads will be disabled until permissions are fixed:`, (err as Error).message)
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    cb(null, allowed.includes(file.mimetype))
  },
})

// Upload mémoire pour les CSV (parsing direct, pas besoin de disque)
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain']
    cb(null, allowed.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.csv'))
  },
})

// POST /api/products/upload-image
productRouter.post('/upload-image', authorize('manager', 'superadmin'), upload.single('image'), (req: AuthRequest, res) => {
  if (!req.file) { res.status(400).json({ success: false, error: 'Aucune image fournie' }); return }
  const baseUrl = process.env.API_BASE_URL || `http://localhost:4000`
  const url = `${baseUrl}/uploads/products/${req.file.filename}`
  res.json({ success: true, data: { url } })
})

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  shortDesc: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  kdsStation: z.enum(['hot', 'cold', 'drinks', 'desserts']).nullable().optional(),
  price: z.number().positive(),
  comparePrice: z.number().optional(),
  costPrice: z.number().optional(),
  taxRate: z.number().default(10),
  image: z.string().optional(),
  images: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isNew: z.boolean().default(false),
  requiresPreparation: z.boolean().default(true),
  sortOrder: z.number().default(0),
  calories: z.number().optional(),
  proteins: z.number().optional(),
  carbs: z.number().optional(),
  fats: z.number().optional(),
  allergens: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  prepTime: z.number().default(10),
  categoryId: z.string(),
  warehouseId: z.string().nullable().optional(),
  stockItemId: z.string().nullable().optional(),
})

// GET /api/products
productRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const {
      categoryId, isActive, isAvailable, isFeatured,
      search, page = '1', limit = '50', warehouseId,
    } = req.query

    // Filtre deletedAt par défaut (sauf si ?includeDeleted=true) — les produits
    // soft-deleted ne doivent jamais apparaître dans le menu/POS/dashboard.
    const where: any = { restaurantId: req.user!.restaurantId, deletedAt: null }
    if (categoryId) where.categoryId = categoryId
    if (isActive !== undefined) where.isActive = isActive === 'true'
    if (isAvailable !== undefined) where.isAvailable = isAvailable === 'true'
    if (isFeatured !== undefined) where.isFeatured = isFeatured === 'true'

    // Build AND conditions so warehouseId filter and search can coexist
    const andConditions: any[] = []
    if (warehouseId) {
      // correspondance stricte : seuls les produits assignés à cet entrepôt
      andConditions.push({ warehouseId: warehouseId as string })
    }
    if (search) {
      andConditions.push({ OR: [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { sku: { contains: search as string, mode: 'insensitive' } },
        { barcode: { equals: search as string } },
      ]})
    }
    if (andConditions.length > 0) where.AND = andConditions

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          variants: true,
          warehouse: { select: { id: true, name: true } },
          modifierGroups: { include: { modifierGroup: { include: { modifiers: true } } } },
          recipeItems: {
            include: {
              ingredient: {
                include: {
                  stockItem: { select: { id: true, currentQuantity: true, unit: true, minQuantity: true } },
                },
              },
            },
          },
          stockItem: { select: { id: true, currentQuantity: true, unit: true, minQuantity: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.product.count({ where }),
    ])

    const data = products.map((product: any) => {
      let stockAvailable: number | null = null

      if (product.stockItemId && product.stockItem) {
        // Produit lié directement à un article de stock
        stockAvailable = Math.max(0, Math.floor(product.stockItem.currentQuantity))
      } else if (product.recipeItems?.length > 0) {
        // Produit à recette : nombre de portions pouvant être produites
        let minServings = Infinity
        for (const ri of product.recipeItems) {
          const stock = ri.ingredient?.stockItem
          if (!stock) continue
          const converted = ri.unit && ri.unit !== stock.unit
            ? convertUnit(ri.quantity, ri.unit, stock.unit)
            : ri.quantity
          if (converted === null) continue // incompatible units — skip ingredient
          const baseQty = converted
          const neededPerServing = baseQty / (ri.yieldRate || 1)
          if (neededPerServing <= 0) continue
          const servings = Math.floor(stock.currentQuantity / neededPerServing)
          if (servings < minServings) minServings = servings
        }
        if (isFinite(minServings)) stockAvailable = Math.max(0, minServings)
      }

      return { ...product, stockAvailable }
    })

    res.json({
      success: true,
      data,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/products/:id
productRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: {
        category: true,
        variants: true,
        modifierGroups: { include: { modifierGroup: { include: { modifiers: true } } } },
        recipeItems: { include: { ingredient: true } },
      },
    })

    if (!product) throw new AppError('Produit introuvable', 404)
    res.json({ success: true, data: product })
  } catch (error) {
    next(error)
  }
})

// POST /api/products
productRouter.post('/', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = productSchema.parse(req.body)
    const restaurantId = req.user!.restaurantId

    const slug = slugify(data.name)

    const exists = await prisma.product.findUnique({ where: { restaurantId_slug: { restaurantId, slug } } })
    const finalSlug = exists ? `${slug}-${Date.now()}` : slug

    const product = await prisma.product.create({
      data: { ...data, slug: finalSlug, restaurantId, images: data.images || [] },
      include: { category: true, variants: true },
    })

    res.status(201).json({ success: true, data: product })
  } catch (error) {
    next(error)
  }
})

// PUT /api/products/:id
productRouter.put('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = productSchema.partial().parse(req.body)
    const restaurantId = req.user!.restaurantId

    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, restaurantId },
    })
    if (!existing) throw new AppError('Produit introuvable', 404)

    const updateData: any = { ...data }
    if (data.name && data.name !== existing.name) {
      const slug = slugify(data.name)
      const exists = await prisma.product.findFirst({
        where: { restaurantId, slug, id: { not: existing.id } },
      })
      updateData.slug = exists ? `${slug}-${Date.now()}` : slug
    }

    const product = await prisma.product.update({
      where: { id: existing.id },
      data: updateData,
      include: { category: true, variants: true },
    })

    res.json({ success: true, data: product })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/products/:id/availability
productRouter.patch('/:id/availability', authorize('manager', 'superadmin', 'caissier'), async (req: AuthRequest, res, next) => {
  try {
    const { isAvailable } = z.object({ isAvailable: z.boolean() }).parse(req.body)

    const product = await prisma.product.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!product) throw new AppError('Produit introuvable', 404)

    const updated = await prisma.product.update({
      where: { id: product.id },
      data: { isAvailable },
    })

    res.json({ success: true, data: updated })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/products/:id
productRouter.delete('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!product) throw new AppError('Produit introuvable', 404)

    // Soft delete : FK OrderItem.productId est en Restrict (déconnexion
    // impossible si le produit a déjà été vendu). On set deletedAt + isActive
    // false → caché des listings (GET / filtre `deletedAt: null`) mais
    // l'historique des commandes/factures reste consultable.
    await prisma.product.update({
      where: { id: product.id },
      data: { deletedAt: new Date(), isActive: false, isAvailable: false },
    })
    res.json({ success: true, message: 'Produit archivé' })
  } catch (error) {
    next(error)
  }
})

// ─── Product Variant Routes ────────────────────────────────────────────────────

const variantSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  price: z.number().positive(),
  costPrice: z.number().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().default(0),
})

// GET /api/products/:id/variants
productRouter.get('/:id/variants', async (req: AuthRequest, res, next) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!product) { res.status(404).json({ success: false, error: 'Produit introuvable' }); return }

    const variants = await prisma.productVariant.findMany({
      where: { productId: req.params.id },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
    })
    res.json({ success: true, data: variants })
  } catch (error) { next(error) }
})

// POST /api/products/:id/variants
productRouter.post('/:id/variants', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = variantSchema.parse(req.body)
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!product) { res.status(404).json({ success: false, error: 'Produit introuvable' }); return }

    // If new variant is default, unset all others
    if (data.isDefault) {
      await prisma.productVariant.updateMany({
        where: { productId: req.params.id },
        data: { isDefault: false },
      })
    }

    const variant = await prisma.productVariant.create({
      data: { ...data, productId: req.params.id },
    })
    res.status(201).json({ success: true, data: variant })
  } catch (error) { next(error) }
})

// PUT /api/products/:id/variants/:variantId
productRouter.put('/:id/variants/:variantId', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = variantSchema.partial().parse(req.body)
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!product) { res.status(404).json({ success: false, error: 'Produit introuvable' }); return }

    const existingVariant = await prisma.productVariant.findFirst({
      where: { id: req.params.variantId, productId: product.id },
    })
    if (!existingVariant) { res.status(404).json({ success: false, error: 'Variante introuvable' }); return }

    if (data.isDefault) {
      await prisma.productVariant.updateMany({
        where: { productId: req.params.id, id: { not: req.params.variantId } },
        data: { isDefault: false },
      })
    }

    const variant = await prisma.productVariant.update({
      where: { id: req.params.variantId },
      data,
    })
    res.json({ success: true, data: variant })
  } catch (error) { next(error) }
})

// DELETE /api/products/:id/variants/:variantId
productRouter.delete('/:id/variants/:variantId', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!product) { res.status(404).json({ success: false, error: 'Produit introuvable' }); return }

    const variant = await prisma.productVariant.findFirst({
      where: { id: req.params.variantId, productId: product.id },
    })
    if (!variant) { res.status(404).json({ success: false, error: 'Variante introuvable' }); return }

    await prisma.productVariant.delete({ where: { id: variant.id } })
    res.json({ success: true })
  } catch (error) { next(error) }
})

// GET /api/products/ingredients — stock items usable as recipe ingredients
productRouter.get('/ingredients/list', async (req: AuthRequest, res, next) => {
  try {
    const items = await prisma.stockItem.findMany({
      where: { restaurantId: req.user!.restaurantId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, unit: true, costPerUnit: true, currentQuantity: true },
    })
    res.json({ success: true, data: items })
  } catch (error) {
    next(error)
  }
})

// GET /api/products/:id/recipe
productRouter.get('/:id/recipe', async (req: AuthRequest, res, next) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!product) throw new AppError('Produit introuvable', 404)

    const items = await prisma.recipeItem.findMany({
      where: { productId: product.id },
      include: { ingredient: { include: { stockItem: true } } },
    })
    res.json({ success: true, data: items })
  } catch (error) {
    next(error)
  }
})

// PUT /api/products/:id/recipe — replace all recipe items
productRouter.put('/:id/recipe', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!product) throw new AppError('Produit introuvable', 404)

    const itemsSchema = z.array(z.object({
      stockItemId: z.string(),
      quantity: z.number().positive(),
      unit: z.string(),
      yieldRate: z.number().min(0.01).max(1).default(1),
      notes: z.string().optional(),
    }))
    const items = itemsSchema.parse(req.body.items ?? [])

    // Delete existing recipe items
    await prisma.recipeItem.deleteMany({ where: { productId: product.id } })

    let totalCost = 0

    for (const item of items) {
      const stockItem = await prisma.stockItem.findFirst({
        where: { id: item.stockItemId, restaurantId: req.user!.restaurantId },
      })
      if (!stockItem) continue

      // Find or create Ingredient linked to stockItem
      let ingredient = await prisma.ingredient.findFirst({
        where: { stockItemId: stockItem.id },
      })
      if (!ingredient) {
        ingredient = await prisma.ingredient.create({
          data: {
            name: stockItem.name,
            unit: stockItem.unit,
            costPerUnit: stockItem.costPerUnit,
            stockItemId: stockItem.id,
          },
        })
      } else {
        // Sync cost from stock
        ingredient = await prisma.ingredient.update({
          where: { id: ingredient.id },
          data: { costPerUnit: stockItem.costPerUnit, unit: stockItem.unit },
        })
      }

      await prisma.recipeItem.create({
        data: {
          productId: product.id,
          ingredientId: ingredient.id,
          quantity: item.quantity,
          unit: item.unit,
          yieldRate: item.yieldRate ?? 1,
          notes: item.notes,
        },
      })

      // Convert recipe unit → stock item unit before computing cost
      const qtyInStockUnit = item.unit && item.unit !== stockItem.unit
        ? (convertUnit(item.quantity, item.unit, stockItem.unit) ?? item.quantity)
        : item.quantity
      totalCost += (qtyInStockUnit * stockItem.costPerUnit) / (item.yieldRate || 1)
    }

    // Auto-update costPrice from recipe
    if (items.length > 0) {
      await prisma.product.update({
        where: { id: product.id },
        data: { costPrice: Math.round(totalCost) },
      })
    }

    const updatedItems = await prisma.recipeItem.findMany({
      where: { productId: product.id },
      include: { ingredient: { include: { stockItem: true } } },
    })

    res.json({ success: true, data: updatedItems, totalCost: Math.round(totalCost) })
  } catch (error) {
    next(error)
  }
})

// ─── Import CSV (Dolibarr, Sage, Excel générique) ──────────────────────────
//
// Parse un CSV au format Dolibarr (export Produits/Services) ou générique.
// Détection automatique du délimiteur (`,` ou `;`).
//
// Colonnes reconnues (insensible à la casse, prend la 1re qui matche) :
//   - nom        : label | name | nom | designation | libelle
//   - sku        : ref | sku | reference | code
//   - description: description | desc
//   - prix TTC   : price_ttc | prix_ttc | price | prix
//   - prix HT    : price_ht | prix_ht
//   - TVA %      : tva_tx | tva | taxrate | tax_rate
//   - barcode    : barcode | code_barre | ean
//   - catégorie  : categories | category | categorie | cat
//   - stock      : stock_reel | stock | quantity | qte
//
// Sécurité : limite à 5000 produits par import, validation des prix > 0.

function normalizeHeader(s: string): string {
  // 'Prix unitaire TTC' -> 'prix_unitaire_ttc'
  // 'Réf.'             -> 'ref'
  // 'Code-barres'      -> 'code_barres'
  // 'UnitPriceTTC'     -> 'unit_price_ttc'  (CamelCase split)
  // 'VATRate'          -> 'vat_rate'        (acronyme + casse)
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // strip accents
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')              // camelCase -> camel_Case
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')          // VATRate -> VAT_Rate
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')                           // ponctuation -> espace
    .trim()
    .replace(/\s+/g, '_')                               // espaces -> _
}

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Auto-detect delimiter (Dolibarr utilise souvent ;)
  const firstLine = text.split(/\r?\n/, 1)[0] || ''
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','

  // Parser tolérant aux quoted strings + escaped quotes ""
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

function pick(row: Record<string, string>, keys: string[]): string {
  // 1. Exact match sur la clé normalisée
  for (const k of keys) {
    if (row[k] && row[k].trim()) return row[k].trim()
  }
  // 2. Fallback : header qui CONTIENT le pattern (gère les variantes
  // 'unit_price_ttc' qui contient 'price_ttc', 'tva_taux' qui contient 'tva', etc.)
  const headers = Object.keys(row)
  for (const k of keys) {
    const matching = headers.find(h => h.includes(k))
    if (matching && row[matching] && row[matching].trim()) return row[matching].trim()
  }
  return ''
}

function toFloat(s: string): number | null {
  if (!s) return null
  // Accepte virgule décimale (format FR) + remove spaces
  const cleaned = s.replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

// POST /api/products/import — import CSV (Dolibarr ou générique)
productRouter.post('/import', authorize('manager', 'superadmin'), csvUpload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) throw new AppError('Fichier CSV requis (champ "file")', 400)
    const restaurantId = req.user!.restaurantId

    const dryRun = req.query.dryRun === 'true'

    const text = req.file.buffer.toString('utf8')
    const { headers, rows } = parseCsv(text)
    if (rows.length === 0) {
      return res.json({ success: true, data: { headers, total: 0, created: 0, skipped: 0, errors: [] } })
    }
    if (rows.length > 5000) {
      throw new AppError(`Trop de lignes (${rows.length}). Limite : 5000 par import. Coupez votre fichier.`, 400)
    }

    // Préparer les catégories : map des existantes + créer les nouvelles à la volée
    const existingCats = await prisma.category.findMany({
      where: { restaurantId },
      select: { id: true, name: true, slug: true },
    })
    const catMap = new Map(existingCats.map(c => [c.name.toLowerCase(), c.id]))

    // slug est requis + @@unique([restaurantId, slug]) sur Category ET Product.
    // On génère des slugs uniques au sein de l'import + vis-à-vis de l'existant.
    const usedCatSlugs = new Set(existingCats.map(c => c.slug))
    function uniqueSlug(name: string, used: Set<string>): string {
      const base = slugify(name) || 'item'
      let s = base
      let n = 2
      while (used.has(s)) s = `${base}-${n++}`
      used.add(s)
      return s
    }

    // Catégorie "Import" par défaut (si la ligne n'en spécifie pas)
    let defaultCatId = catMap.get('import')
    if (!defaultCatId && !dryRun) {
      const created = await prisma.category.create({
        data: { name: 'Import', slug: uniqueSlug('Import', usedCatSlugs), restaurantId, isActive: true },
      })
      defaultCatId = created.id
      catMap.set('import', created.id)
    }

    // SKUs + slugs déjà en DB pour skip les doublons / garantir l'unicité
    const existingProducts = await prisma.product.findMany({
      where: { restaurantId },
      select: { sku: true, slug: true },
    })
    const existingSkus = new Set(
      existingProducts.filter(p => p.sku).map(p => (p.sku || '').toLowerCase())
    )
    const usedProductSlugs = new Set(existingProducts.map(p => p.slug))

    const results = { created: 0, skipped: 0, errors: [] as { line: number; reason: string }[], preview: [] as any[] }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!
      const lineNo = i + 2 // +1 header, +1 1-indexed

      // Nom : EN + FR (Dolibarr exporte 'Libellé' → 'libelle' après normalisation)
      const name = pick(row, ['label', 'name', 'nom', 'designation', 'libelle', 'product_label'])
      if (!name) {
        results.errors.push({ line: lineNo, reason: 'Nom manquant' })
        continue
      }

      // SKU : Dolibarr FR 'Réf.' → 'ref', EN 'Ref' → 'ref'
      const sku = pick(row, ['ref', 'sku', 'reference', 'code', 'product_ref'])
      if (sku && existingSkus.has(sku.toLowerCase())) {
        results.skipped++
        continue
      }

      // TVA : Dolibarr FR 'Taux TVA' → 'taux_tva', EN 'VATRate' → 'vat_rate'
      const taxRate = toFloat(pick(row, [
        'tva_tx', 'tva', 'taux_tva', 'taxrate', 'tax_rate', 'vat_rate', 'vat',
      ])) ?? 0
      // Prix TTC : Dolibarr FR 'Prix unitaire TTC' → 'prix_unitaire_ttc',
      // EN 'UnitPriceTTC' → 'unit_price_ttc'
      let price = toFloat(pick(row, [
        'price_ttc', 'prix_ttc', 'prix_unitaire_ttc', 'prix_de_vente_ttc',
        'unit_price_ttc', 'price_with_tax', 'ttc_price',
        'price', 'prix', 'prix_unitaire', 'prix_vente', 'unit_price',
      ]))
      const priceHT = toFloat(pick(row, [
        'price_ht', 'prix_ht', 'prix_unitaire_ht', 'prix_de_vente_ht', 'prix_vente_ht',
        'unit_price_ht', 'price_excl_tax', 'ht_price',
      ]))
      if (price == null && priceHT != null) {
        price = priceHT * (1 + taxRate / 100)
      }
      if (price == null || price <= 0) {
        results.errors.push({ line: lineNo, reason: 'Prix manquant ou invalide' })
        continue
      }

      const description = pick(row, ['description', 'desc', 'note'])
      const barcode = pick(row, ['barcode', 'bar_code', 'code_barre', 'code_barres', 'ean', 'gencod'])
      const catName = pick(row, ['categories', 'category', 'categorie', 'cat', 'rubrique', 'famille'])

      // Stock : Dolibarr FR 'Stock désiré optimal' + 'Limite stock pour alerte',
      // EN 'DesiredStock' → 'desired_stock', 'StockLimit' → 'stock_limit'
      const reorderQty = toFloat(pick(row, [
        'stock_desire_optimal', 'stock_desire', 'reorder_quantity', 'reorder', 'optimal_stock',
        'desired_stock', 'desired', 'target_stock', 'optimal',
      ]))
      const minQty = toFloat(pick(row, [
        'limite_stock_pour_alerte', 'stock_alerte', 'min_quantity', 'alert_threshold', 'seuil_alerte',
        'stock_limit', 'min_stock', 'low_stock', 'alert_stock',
      ]))
      const initialStock = toFloat(pick(row, [
        'stock_reel', 'stock', 'quantity', 'qte', 'stock_initial', 'current_stock', 'on_hand',
      ]))

      let categoryId = defaultCatId
      if (catName) {
        const k = catName.toLowerCase()
        const found = catMap.get(k)
        if (found) categoryId = found
        else if (!dryRun) {
          try {
            const cat = await prisma.category.create({
              data: { name: catName, slug: uniqueSlug(catName, usedCatSlugs), restaurantId, isActive: true },
            })
            catMap.set(k, cat.id)
            categoryId = cat.id
          } catch {
            categoryId = defaultCatId
          }
        }
      }

      if (dryRun) {
        results.preview.push({ name, sku: sku || null, price: Math.round(price), category: catName || 'Import' })
        results.created++
        continue
      }

      try {
        // Si des données stock sont fournies, créer le StockItem associé en même
        // temps pour activer la gestion de stock du produit.
        const hasStockData = initialStock != null || minQty != null || reorderQty != null
        await prisma.product.create({
          data: {
            name,
            slug: uniqueSlug(name, usedProductSlugs),
            description: description || null,
            sku: sku || null,
            barcode: barcode || null,
            price: Math.round(price),
            taxRate,
            restaurantId,
            categoryId: categoryId!,
            isActive: true,
            isAvailable: true,
            ...(hasStockData && {
              stockItem: {
                create: {
                  name,
                  sku: sku || null,
                  barcode: barcode || null,
                  unit: 'pièce',
                  currentQuantity: initialStock ?? 0,
                  minQuantity: minQty ?? 0,
                  reorderQuantity: reorderQty ?? 0,
                  restaurantId,
                },
              },
            }),
          },
        })
        if (sku) existingSkus.add(sku.toLowerCase())
        results.created++
      } catch (err: any) {
        results.errors.push({ line: lineNo, reason: err?.message?.slice(0, 200) || 'Erreur DB' })
      }
    }

    res.json({
      success: true,
      data: {
        headers,
        total: rows.length,
        created: results.created,
        skipped: results.skipped,
        errors: results.errors,
        preview: dryRun ? results.preview.slice(0, 50) : undefined,
        dryRun,
      },
    })
  } catch (error) { next(error) }
})

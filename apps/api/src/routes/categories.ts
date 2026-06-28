import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'
import { slugify } from '@restaurant/utils'
import { CATEGORY_PRESETS } from '../lib/category-presets'
import { matchCategorySlug, PRESET_BY_SLUG } from '../lib/category-matcher'

export const categoryRouter = Router()
categoryRouter.use(authenticate)

const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  image: z.string().optional(),
  sortOrder: z.number().default(0),
  isActive: z.boolean().default(true),
  parentId: z.string().optional(),
})

// ─── ROUTES STATIQUES (avant /:id) ────────────────────────────────────────────

// GET /api/categories/presets → catalogue de catégories importables
categoryRouter.get('/presets', authorize('manager', 'superadmin'), (_req, res) => {
  res.json({ success: true, data: CATEGORY_PRESETS })
})

// POST /api/categories/import-presets → upsert en masse depuis le catalogue
const importSchema = z.object({
  groups: z.array(z.string()).min(1),
  slugs: z.array(z.string()).optional(),
})
categoryRouter.post('/import-presets', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const { groups, slugs } = importSchema.parse(req.body)
    const restaurantId = req.user!.restaurantId
    const wanted = new Set<string>(slugs ?? [])
    const useFilter = wanted.size > 0

    const maxSort = await prisma.category.aggregate({
      where: { restaurantId },
      _max: { sortOrder: true },
    })
    let nextSort = (maxSort._max.sortOrder ?? 0) + 1

    let created = 0
    let skipped = 0

    for (const groupKey of groups) {
      const group = CATEGORY_PRESETS.find(g => g.key === groupKey)
      if (!group) continue
      for (const cat of group.categories) {
        if (useFilter && !wanted.has(cat.slug)) continue
        const existing = await prisma.category.findUnique({
          where: { restaurantId_slug: { restaurantId, slug: cat.slug } },
        })
        if (existing) {
          skipped++
          continue
        }
        await prisma.category.create({
          data: {
            name: cat.name,
            slug: cat.slug,
            icon: cat.icon,
            color: cat.color,
            sortOrder: nextSort++,
            isActive: true,
            isAvailable: true,
            restaurantId,
          },
        })
        created++
      }
    }
    res.json({ success: true, data: { created, skipped } })
  } catch (error) {
    next(error)
  }
})

// POST /api/categories/auto-categorize — analyse le nom de chaque produit et le
// range dans la catégorie correspondante. dryRun=true : aperçu sans rien écrire.
// Crée automatiquement les catégories preset manquantes.
categoryRouter.post('/auto-categorize', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const { dryRun } = z.object({ dryRun: z.boolean().default(true) }).parse(req.body ?? {})
    const restaurantId = req.user!.restaurantId

    const [products, categories] = await Promise.all([
      prisma.product.findMany({
        where: { restaurantId, deletedAt: null },
        select: { id: true, name: true, categoryId: true },
        orderBy: { name: 'asc' },
      }),
      prisma.category.findMany({
        where: { restaurantId },
        select: { id: true, name: true, slug: true },
      }),
    ])

    const catById = new Map(categories.map(c => [c.id, c]))
    const catBySlug = new Map(categories.map(c => [c.slug, c]))

    const moves: { productId: string; name: string; from: string | null; toSlug: string; toName: string; willCreate: boolean }[] = []
    let unchanged = 0
    let unmatched = 0
    const neededSlugs = new Set<string>()

    for (const p of products) {
      const slug = matchCategorySlug(p.name)
      if (!slug) { unmatched++; continue }
      const target = catBySlug.get(slug)
      if (target && target.id === p.categoryId) { unchanged++; continue }
      const preset = PRESET_BY_SLUG.get(slug)!
      if (!target) neededSlugs.add(slug)
      moves.push({
        productId: p.id, name: p.name,
        from: p.categoryId ? (catById.get(p.categoryId)?.name ?? null) : null,
        toSlug: slug, toName: preset.name, willCreate: !target,
      })
    }

    const summary = {
      total: products.length,
      toMove: moves.length,
      unchanged,
      unmatched,
      categoriesToCreate: [...neededSlugs].map(s => PRESET_BY_SLUG.get(s)!.name),
    }

    if (dryRun) {
      res.json({ success: true, data: { dryRun: true, summary, sample: moves.slice(0, 100) } })
      return
    }

    // ── Application ──
    let nextSort = (await prisma.category.aggregate({ where: { restaurantId }, _max: { sortOrder: true } }))._max.sortOrder ?? 0
    for (const slug of neededSlugs) {
      const preset = PRESET_BY_SLUG.get(slug)!
      const cat = await prisma.category.create({
        data: { name: preset.name, slug: preset.slug, icon: preset.icon, color: preset.color, sortOrder: ++nextSort, isActive: true, isAvailable: true, restaurantId },
      })
      catBySlug.set(slug, { id: cat.id, name: cat.name, slug: cat.slug })
    }

    const bySlug = new Map<string, string[]>()
    for (const m of moves) {
      const arr = bySlug.get(m.toSlug) ?? []
      arr.push(m.productId)
      bySlug.set(m.toSlug, arr)
    }
    let moved = 0
    for (const [slug, ids] of bySlug) {
      const cat = catBySlug.get(slug)!
      const r = await prisma.product.updateMany({ where: { id: { in: ids }, restaurantId }, data: { categoryId: cat.id } })
      moved += r.count
    }

    res.json({ success: true, data: { dryRun: false, summary: { ...summary, moved } } })
  } catch (error) {
    next(error)
  }
})

categoryRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { withProducts } = req.query
    const categories = await prisma.category.findMany({
      where: { restaurantId: req.user!.restaurantId },
      include: {
        products: withProducts === 'true' ? {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: { variants: true },
        } : false,
        children: true,
        _count: { select: { products: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
    res.json({ success: true, data: categories })
  } catch (error) {
    next(error)
  }
})

categoryRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const category = await prisma.category.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: {
        products: { include: { variants: true } },
        children: true,
      },
    })
    if (!category) throw new AppError('Catégorie introuvable', 404)
    res.json({ success: true, data: category })
  } catch (error) {
    next(error)
  }
})

categoryRouter.post('/', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = categorySchema.parse(req.body)
    const restaurantId = req.user!.restaurantId
    const slug = slugify(data.name)

    const category = await prisma.category.create({
      data: { ...data, slug, restaurantId },
    })
    res.status(201).json({ success: true, data: category })
  } catch (error) {
    next(error)
  }
})

categoryRouter.put('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = categorySchema.partial().parse(req.body)
    const existing = await prisma.category.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!existing) throw new AppError('Catégorie introuvable', 404)

    const updateData: any = { ...data }
    if (data.name) updateData.slug = slugify(data.name)

    const category = await prisma.category.update({ where: { id: existing.id }, data: updateData })
    res.json({ success: true, data: category })
  } catch (error) {
    next(error)
  }
})

categoryRouter.delete('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const category = await prisma.category.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: { _count: { select: { products: true } } },
    })
    if (!category) throw new AppError('Catégorie introuvable', 404)
    if (category._count.products > 0) {
      throw new AppError('Impossible de supprimer une catégorie contenant des produits', 400)
    }
    await prisma.category.delete({ where: { id: category.id } })
    res.json({ success: true, message: 'Catégorie supprimée' })
  } catch (error) {
    next(error)
  }
})

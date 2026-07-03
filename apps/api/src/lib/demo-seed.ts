import { prisma } from './prisma'

export type DemoSeedResult = { categories: number; stockItems: number; products: number; recipes: number }

type CatDef = { name: string; slug: string; icon: string; color: string }
type StockDef = { name: string; unit: string; qty: number; cost: number; perishable?: boolean }
type SoldAsIs = { name: string; slug: string; price: number; cat: string; stock: string }
type RecipeLine = { stock: string; qty: number; unit: string; yieldRate?: number }
type RecipeProduct = { name: string; slug: string; price: number; cat: string; kds: string | null; lines: RecipeLine[] }
type SimpleProduct = { name: string; slug: string; price: number; cat: string; kds?: string | null }

const CATEGORIES: CatDef[] = [
  { name: 'THB & Bières', slug: 'thb-bieres', icon: '🍺', color: '#F59E0B' },
  { name: 'Sodas & Softs', slug: 'sodas-softs', icon: '🥤', color: '#3B82F6' },
  { name: 'Jus de fruits', slug: 'jus-fruits', icon: '🍊', color: '#EAB308' },
  { name: 'Brochettes & Grillades', slug: 'brochettes-grillades', icon: '🍢', color: '#B91C1C' },
  { name: 'Plats malgaches', slug: 'plats-malgaches', icon: '🍲', color: '#16A34A' },
  { name: 'Accompagnements', slug: 'accompagnements', icon: '🍚', color: '#A16207' },
  { name: 'Desserts', slug: 'desserts', icon: '🍰', color: '#DB2777' },
]

const STOCK: StockDef[] = [
  { name: 'THB 65cl', unit: 'bouteille', qty: 48, cost: 4000 },
  { name: 'Coca-Cola 33cl', unit: 'bouteille', qty: 60, cost: 2000 },
  { name: 'Eau vive 1.5L', unit: 'bouteille', qty: 40, cost: 1500 },
  { name: 'Viande de zébu', unit: 'kg', qty: 15, cost: 18000, perishable: true },
  { name: 'Poulet', unit: 'kg', qty: 12, cost: 12000, perishable: true },
  { name: 'Oignon', unit: 'kg', qty: 10, cost: 3000, perishable: true },
  { name: 'Riz', unit: 'kg', qty: 50, cost: 3500 },
  { name: 'Pic bambou', unit: 'unité', qty: 500, cost: 50 },
  { name: 'Huile', unit: 'L', qty: 20, cost: 8000 },
]

const SOLD_AS_IS: SoldAsIs[] = [
  { name: 'THB 65cl', slug: 'thb-65cl', price: 5000, cat: 'thb-bieres', stock: 'THB 65cl' },
  { name: 'Coca-Cola 33cl', slug: 'coca-cola-33cl', price: 3000, cat: 'sodas-softs', stock: 'Coca-Cola 33cl' },
  { name: 'Eau vive 1.5L', slug: 'eau-vive-1-5l', price: 2500, cat: 'sodas-softs', stock: 'Eau vive 1.5L' },
]

const RECIPES: RecipeProduct[] = [
  { name: 'Brochette de zébu', slug: 'brochette-de-zebu', price: 5000, cat: 'brochettes-grillades', kds: 'hot',
    lines: [
      { stock: 'Viande de zébu', qty: 0.15, unit: 'kg', yieldRate: 0.9 },
      { stock: 'Oignon', qty: 0.03, unit: 'kg' },
      { stock: 'Pic bambou', qty: 1, unit: 'unité' },
    ] },
  { name: 'Poulet grillé', slug: 'poulet-grille', price: 12000, cat: 'brochettes-grillades', kds: 'hot',
    lines: [
      { stock: 'Poulet', qty: 0.4, unit: 'kg', yieldRate: 0.85 },
      { stock: 'Huile', qty: 0.02, unit: 'L' },
    ] },
  { name: 'Riz cantonais', slug: 'riz-cantonais', price: 8000, cat: 'accompagnements', kds: 'hot',
    lines: [
      { stock: 'Riz', qty: 0.2, unit: 'kg' },
      { stock: 'Huile', qty: 0.02, unit: 'L' },
      { stock: 'Oignon', qty: 0.02, unit: 'kg' },
    ] },
]

const SIMPLE: SimpleProduct[] = [
  { name: 'Jus d\'orange frais', slug: 'jus-orange-frais', price: 4000, cat: 'jus-fruits' },
  { name: 'Romazava', slug: 'romazava', price: 9000, cat: 'plats-malgaches', kds: 'hot' },
  { name: 'Ravitoto sy henakisoa', slug: 'ravitoto-sy-henakisoa', price: 10000, cat: 'plats-malgaches', kds: 'hot' },
  { name: 'Riz blanc', slug: 'riz-blanc', price: 2000, cat: 'accompagnements', kds: 'hot' },
  { name: 'Mofo gasy (x5)', slug: 'mofo-gasy-x5', price: 2000, cat: 'desserts' },
  { name: 'Bonbon coco', slug: 'bonbon-coco', price: 1500, cat: 'desserts' },
]

// Peuple un tenant avec un jeu de données démo malgache (bar + resto).
// Idempotent : catégories/produits upsertés par slug, articles de stock et
// ingrédients créés seulement s'ils n'existent pas encore.
export async function seedDemoData(restaurantId: string): Promise<DemoSeedResult> {
  const result: DemoSeedResult = { categories: 0, stockItems: 0, products: 0, recipes: 0 }

  const catId = new Map<string, string>()
  let sort = 0
  for (const c of CATEGORIES) {
    const cat = await prisma.category.upsert({
      where: { restaurantId_slug: { restaurantId, slug: c.slug } },
      update: {},
      create: { name: c.name, slug: c.slug, icon: c.icon, color: c.color, sortOrder: sort++, isActive: true, isAvailable: true, restaurantId },
    })
    catId.set(c.slug, cat.id)
    result.categories++
  }

  const stockId = new Map<string, string>()
  for (const s of STOCK) {
    const existing = await prisma.stockItem.findFirst({ where: { restaurantId, name: s.name } })
    const item = existing ?? await prisma.stockItem.create({
      data: { name: s.name, unit: s.unit, currentQuantity: s.qty, costPerUnit: s.cost, minQuantity: 0, isPerishable: !!s.perishable, restaurantId },
    })
    stockId.set(s.name, item.id)
    if (!existing) result.stockItems++
  }

  async function upsertProduct(p: { name: string; slug: string; price: number; cat: string; kds?: string | null; stockItemId?: string | null; tags?: string[]; requiresPreparation: boolean }) {
    const categoryId = catId.get(p.cat)
    if (!categoryId) return null
    return prisma.product.upsert({
      where: { restaurantId_slug: { restaurantId, slug: p.slug } },
      update: {},
      create: {
        name: p.name, slug: p.slug, price: p.price, categoryId, restaurantId,
        kdsStation: p.kds ?? null, stockItemId: p.stockItemId ?? null,
        tags: p.tags ?? [], requiresPreparation: p.requiresPreparation,
        isActive: true, isAvailable: true,
      },
    })
  }

  for (const p of SOLD_AS_IS) {
    const prod = await upsertProduct({ ...p, stockItemId: stockId.get(p.stock) ?? null, tags: ['no-recipe'], requiresPreparation: false })
    if (prod) result.products++
  }

  for (const p of SIMPLE) {
    const prod = await upsertProduct({ name: p.name, slug: p.slug, price: p.price, cat: p.cat, kds: p.kds ?? null, requiresPreparation: true })
    if (prod) result.products++
  }

  for (const r of RECIPES) {
    const prod = await upsertProduct({ name: r.name, slug: r.slug, price: r.price, cat: r.cat, kds: r.kds, requiresPreparation: true })
    if (!prod) continue
    result.products++
    const existingRecipe = await prisma.recipeItem.count({ where: { productId: prod.id } })
    if (existingRecipe > 0) continue
    for (const line of r.lines) {
      const sId = stockId.get(line.stock)
      if (!sId) continue
      const stockDef = STOCK.find(s => s.name === line.stock)
      let ing = await prisma.ingredient.findFirst({ where: { stockItemId: sId } })
      if (!ing) {
        ing = await prisma.ingredient.create({
          data: { name: line.stock, unit: line.unit, costPerUnit: stockDef?.cost ?? 0, stockItemId: sId },
        })
      }
      await prisma.recipeItem.create({
        data: { productId: prod.id, ingredientId: ing.id, quantity: line.qty, unit: line.unit, yieldRate: line.yieldRate ?? 1 },
      })
    }
    result.recipes++
  }

  return result
}

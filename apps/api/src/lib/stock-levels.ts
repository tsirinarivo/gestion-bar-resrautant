import type { Prisma, PrismaClient } from '@prisma/client'

type Tx = Prisma.TransactionClient | PrismaClient

export async function resolveWarehouseId(
  tx: Tx,
  restaurantId: string,
  preferred?: string | null,
): Promise<string> {
  if (preferred) {
    const wh = await tx.warehouse.findFirst({ where: { id: preferred, restaurantId } })
    if (wh) return wh.id
  }
  const fallback = await tx.warehouse.findFirst({
    where: { restaurantId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })
  if (!fallback) {
    const created = await tx.warehouse.create({
      data: { restaurantId, name: 'Entrepôt principal', isDefault: true },
    })
    return created.id
  }
  return fallback.id
}

// Choisit l'entrepôt à débiter lors d'une vente : l'entrepôt préféré (du produit)
// s'il a du stock, sinon celui le mieux approvisionné, sinon n'importe lequel.
export async function pickConsumeWarehouse(
  tx: Tx,
  stockItemId: string,
  preferred?: string | null,
): Promise<string | null> {
  if (preferred) {
    const lvl = await tx.stockLevel.findUnique({
      where: { stockItemId_warehouseId: { stockItemId, warehouseId: preferred } },
    })
    if (lvl && lvl.quantity > 0) return preferred
  }
  const best = await tx.stockLevel.findFirst({
    where: { stockItemId, quantity: { gt: 0 } },
    orderBy: { quantity: 'desc' },
  })
  if (best) return best.warehouseId
  if (preferred) return preferred
  const any = await tx.stockLevel.findFirst({ where: { stockItemId } })
  return any?.warehouseId ?? null
}

export async function getLevelQty(tx: Tx, stockItemId: string, warehouseId: string): Promise<number> {
  const level = await tx.stockLevel.findUnique({
    where: { stockItemId_warehouseId: { stockItemId, warehouseId } },
  })
  return level?.quantity ?? 0
}

// Applique un delta (positif ou négatif) sur un entrepôt précis ET sur le total
// (StockItem.currentQuantity, cache global). À utiliser pour IN / OUT / LOSS / vente.
export async function applyStockDelta(
  tx: Tx,
  { stockItemId, warehouseId, delta }: { stockItemId: string; warehouseId: string; delta: number },
) {
  await tx.stockLevel.upsert({
    where: { stockItemId_warehouseId: { stockItemId, warehouseId } },
    create: { stockItemId, warehouseId, quantity: delta },
    update: { quantity: { increment: delta } },
  })
  await tx.stockItem.update({
    where: { id: stockItemId },
    data: { currentQuantity: { increment: delta } },
  })
}

// Fixe la quantité absolue d'un entrepôt (ADJUSTMENT / inventaire) et reporte
// l'écart sur le total. Retourne le delta appliqué.
export async function setStockLevelAbsolute(
  tx: Tx,
  { stockItemId, warehouseId, target }: { stockItemId: string; warehouseId: string; target: number },
): Promise<number> {
  const current = await getLevelQty(tx, stockItemId, warehouseId)
  const delta = target - current
  if (delta !== 0) await applyStockDelta(tx, { stockItemId, warehouseId, delta })
  return delta
}

// Déplace une quantité d'un entrepôt vers un autre (transfert). Le total global
// (currentQuantity) est conservé — on ne touche QUE les niveaux par entrepôt.
export async function moveStock(
  tx: Tx,
  {
    stockItemId,
    fromWarehouseId,
    toWarehouseId,
    quantity,
  }: { stockItemId: string; fromWarehouseId: string; toWarehouseId: string; quantity: number },
) {
  await tx.stockLevel.upsert({
    where: { stockItemId_warehouseId: { stockItemId, warehouseId: fromWarehouseId } },
    create: { stockItemId, warehouseId: fromWarehouseId, quantity: -quantity },
    update: { quantity: { decrement: quantity } },
  })
  await tx.stockLevel.upsert({
    where: { stockItemId_warehouseId: { stockItemId, warehouseId: toWarehouseId } },
    create: { stockItemId, warehouseId: toWarehouseId, quantity },
    update: { quantity: { increment: quantity } },
  })
}

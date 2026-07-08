import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, authorize, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'
import { csvUpload, parseCsv, pick, toFloat, toInt } from '../lib/csv-import'
import { resolveWarehouseId, applyStockDelta } from '../lib/stock-levels'

export const supplierRouter = Router()
supplierRouter.use(authenticate)

const supplierSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default('MG'),
  notes: z.string().optional(),
  paymentTerms: z.string().optional(),
  deliveryDays: z.array(z.string()).default([]),
  leadTimeDays: z.number().int().default(2),
  isActive: z.boolean().default(true),
})

// ─── ROUTES STATIQUES (avant /:id pour respecter l'ordre Express) ─────────────

// POST /api/suppliers/import — import CSV fournisseurs (Dolibarr ou generique)
// Headers Dolibarr courants : nom/name, contact_nom/contact, email, telephone/phone,
// adresse/address, ville/city, code_postal/postal_code, pays/country, code_tiers/ref,
// note/notes, conditions_paiement/payment_terms, siret
supplierRouter.post(
  '/import',
  authorize('manager', 'superadmin'),
  csvUpload.single('file'),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.file) throw new AppError('Fichier CSV manquant', 400)
      const text = req.file.buffer.toString('utf8')
      const { headers, rows } = parseCsv(text)
      if (rows.length === 0) throw new AppError('CSV vide ou invalide', 400)
      if (rows.length > 5000) throw new AppError('Import limité à 5000 fournisseurs', 400)

      const dryRun = String(req.query.dryRun || '').toLowerCase() === 'true'
      const restaurantId = req.user!.restaurantId
      const existing = (await prisma.supplier.findMany({
        where: { restaurantId },
        select: { id: true, name: true },
      })) as Array<{ id: string; name: string }>
      const byName = new Map<string, string>(
        existing.map(s => [s.name.trim().toLowerCase(), s.id]),
      )

      let created = 0
      let updated = 0
      let skipped = 0
      const errors: Array<{ line: number; reason: string }> = []
      const created_preview: Array<{ name: string; email?: string; phone?: string }> = []

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!
        const name = pick(row, ['nom', 'name', 'societe', 'raison_sociale', 'fournisseur', 'supplier', 'libelle'])
        if (!name) {
          skipped++
          continue
        }

        const data = {
          name,
          contactName: pick(row, ['contact_nom', 'contact', 'contact_name', 'civilite_nom', 'nom_contact']) || undefined,
          email: pick(row, ['email', 'mail', 'courriel']) || undefined,
          phone: pick(row, ['telephone', 'tel', 'phone', 'mobile', 'gsm']) || undefined,
          address: pick(row, ['adresse', 'address', 'rue']) || undefined,
          city: pick(row, ['ville', 'city']) || undefined,
          postalCode: pick(row, ['code_postal', 'postal_code', 'cp', 'zip']) || undefined,
          country: pick(row, ['pays', 'country']) || 'MG',
          siret: pick(row, ['siret', 'siren', 'tva', 'tva_intra', 'numero_tva']) || undefined,
          paymentTerms: pick(row, ['conditions_paiement', 'payment_terms', 'cond_reglement']) || undefined,
          notes: pick(row, ['note', 'notes', 'remarque', 'commentaire']) || undefined,
          leadTimeDays: toInt(pick(row, ['delai_livraison', 'lead_time', 'leadtime'])) ?? 2,
          isActive: true,
        }

        const key = name.trim().toLowerCase()
        const existingId = byName.get(key)
        try {
          if (dryRun) {
            if (existingId) updated++
            else {
              created++
              if (created_preview.length < 10) {
                created_preview.push({ name, email: data.email, phone: data.phone })
              }
            }
            continue
          }
          if (existingId) {
            await prisma.supplier.update({
              where: { id: existingId },
              data,
            })
            updated++
          } else {
            const inserted = await prisma.supplier.create({
              data: { ...data, restaurantId },
            })
            byName.set(key, inserted.id)
            created++
          }
        } catch (err: unknown) {
          errors.push({ line: i + 2, reason: (err as Error).message.slice(0, 200) })
        }
      }

      res.json({
        success: true,
        data: {
          dryRun,
          headers,
          total: rows.length,
          created,
          updated,
          skipped,
          errors: errors.slice(0, 20),
          preview: created_preview,
        },
      })
    } catch (error) {
      next(error)
    }
  },
)

// POST /api/suppliers/import-prices — import CSV prix d'achat par fournisseur
// Lie un StockItem (par nom ou SKU) a un Supplier (par nom) avec unitCost + reference
// Headers : produit/article/ref/sku/nom (cote stock_item), fournisseur/supplier (cote supplier),
// prix/cout/prix_achat/unit_cost, ref_fournisseur/supplier_ref/code_fournisseur
supplierRouter.post(
  '/import-prices',
  authorize('manager', 'superadmin'),
  csvUpload.single('file'),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.file) throw new AppError('Fichier CSV manquant', 400)
      const text = req.file.buffer.toString('utf8')
      const { headers, rows } = parseCsv(text)
      if (rows.length === 0) throw new AppError('CSV vide ou invalide', 400)
      if (rows.length > 20000) throw new AppError('Import limite a 20000 lignes', 400)

      const dryRun = String(req.query.dryRun || '').toLowerCase() === 'true'
      const restaurantId = req.user!.restaurantId

      const stockItems = (await prisma.stockItem.findMany({
        where: { restaurantId },
        select: { id: true, name: true },
      })) as Array<{ id: string; name: string }>
      const itemByName = new Map<string, string>(
        stockItems.map(s => [s.name.trim().toLowerCase(), s.id]),
      )

      const suppliers = (await prisma.supplier.findMany({
        where: { restaurantId },
        select: { id: true, name: true },
      })) as Array<{ id: string; name: string }>
      const supplierByName = new Map<string, string>(
        suppliers.map(s => [s.name.trim().toLowerCase(), s.id]),
      )

      let created = 0
      let updated = 0
      let skipped = 0
      const errors: Array<{ line: number; reason: string }> = []
      const missing = { stockItems: new Set<string>(), suppliers: new Set<string>() }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!
        const productKey = pick(row, [
          'produit', 'article', 'product', 'ref', 'sku', 'reference', 'nom_produit', 'libelle',
          'nom', 'name', 'designation',
        ])
        const supplierKey = pick(row, [
          'fournisseur', 'supplier', 'vendeur', 'societe', 'nom_fournisseur',
        ])
        const priceRaw = pick(row, [
          'prix_achat', 'prix', 'cout', 'unit_cost', 'unit_price', 'cost', 'prix_unitaire',
          'prix_ht', 'achat',
        ])
        const supplierRef = pick(row, [
          'ref_fournisseur', 'supplier_ref', 'code_fournisseur', 'reference_fournisseur',
          'reference_supplier',
        ]) || undefined

        const isPreferredRaw = pick(row, ['prefere', 'preferred', 'principal', 'is_preferred'])
        const isPreferred = /^(1|true|oui|yes|x)$/i.test(isPreferredRaw)

        if (!productKey || !supplierKey || !priceRaw) {
          skipped++
          continue
        }
        const price = toFloat(priceRaw)
        if (price === null || price < 0) {
          errors.push({ line: i + 2, reason: `Prix invalide: "${priceRaw}"` })
          continue
        }

        const stockItemId = itemByName.get(productKey.trim().toLowerCase())
        if (!stockItemId) {
          missing.stockItems.add(productKey)
          skipped++
          continue
        }
        const supplierId = supplierByName.get(supplierKey.trim().toLowerCase())
        if (!supplierId) {
          missing.suppliers.add(supplierKey)
          skipped++
          continue
        }

        try {
          if (dryRun) {
            const existing = await prisma.stockItemSupplier.findUnique({
              where: { stockItemId_supplierId: { stockItemId, supplierId } },
            })
            if (existing) updated++
            else created++
            continue
          }
          await prisma.stockItemSupplier.upsert({
            where: { stockItemId_supplierId: { stockItemId, supplierId } },
            update: {
              unitCost: price,
              referenceCode: supplierRef,
              isPreferred: isPreferred || undefined,
            },
            create: {
              stockItemId,
              supplierId,
              unitCost: price,
              referenceCode: supplierRef,
              isPreferred,
            },
          })
          // Note : on n'efface PAS isPreferred sur les autres fournisseurs de cet
          // article si l'admin coche manuellement plusieurs prix preferes — c'est
          // a lui de garder un seul prefere par article s'il le souhaite.
          updated++
        } catch (err: unknown) {
          errors.push({ line: i + 2, reason: (err as Error).message.slice(0, 200) })
        }
      }

      res.json({
        success: true,
        data: {
          dryRun,
          headers,
          total: rows.length,
          created,
          updated,
          skipped,
          errors: errors.slice(0, 20),
          missing: {
            stockItems: Array.from(missing.stockItems).slice(0, 30),
            suppliers: Array.from(missing.suppliers).slice(0, 30),
          },
        },
      })
    } catch (error) {
      next(error)
    }
  },
)

// GET /api/suppliers
supplierRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { restaurantId: req.user!.restaurantId },
      include: {
        _count: { select: { stockItems: true, purchaseOrders: true } },
      },
      orderBy: { name: 'asc' },
    })
    res.json({ success: true, data: suppliers })
  } catch (error) { next(error) }
})

// GET /api/suppliers/:id
supplierRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const supplier = await prisma.supplier.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: {
        stockItems: { select: { id: true, name: true, unit: true, currentQuantity: true, costPerUnit: true } },
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { items: { include: { stockItem: { select: { name: true, unit: true } } } } },
        },
        _count: { select: { stockItems: true, purchaseOrders: true } },
      },
    })
    if (!supplier) throw new AppError('Fournisseur introuvable', 404)
    res.json({ success: true, data: supplier })
  } catch (error) { next(error) }
})

// POST /api/suppliers
supplierRouter.post('/', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = supplierSchema.parse(req.body)
    const supplier = await prisma.supplier.create({
      data: { ...data, restaurantId: req.user!.restaurantId },
    })
    res.status(201).json({ success: true, data: supplier })
  } catch (error) { next(error) }
})

// PUT /api/suppliers/:id
supplierRouter.put('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = supplierSchema.partial().parse(req.body)
    const existing = await prisma.supplier.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    })
    if (!existing) throw new AppError('Fournisseur introuvable', 404)
    const supplier = await prisma.supplier.update({ where: { id: existing.id }, data })
    res.json({ success: true, data: supplier })
  } catch (error) { next(error) }
})

// DELETE /api/suppliers/:id
supplierRouter.delete('/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const supplier = await prisma.supplier.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: { _count: { select: { purchaseOrders: true } } },
    })
    if (!supplier) throw new AppError('Fournisseur introuvable', 404)
    if (supplier._count.purchaseOrders > 0) {
      throw new AppError('Impossible de supprimer un fournisseur avec des commandes', 400)
    }
    await prisma.supplier.delete({ where: { id: supplier.id } })
    res.json({ success: true, message: 'Fournisseur supprimé' })
  } catch (error) { next(error) }
})

// ─── Purchase Orders ──────────────────────────────────────────────────────────

const poSchema = z.object({
  supplierId: z.string(),
  notes: z.string().optional(),
  expectedAt: z.string().optional(),
  warehouseId: z.string().optional(),
  items: z.array(z.object({
    stockItemId: z.string(),
    quantity: z.number().positive(),
    unitCost: z.number().min(0),
    warehouseId: z.string().optional(),
    notes: z.string().optional(),
  })).default([]),
})

// GET /api/suppliers/purchase-orders
supplierRouter.get('/purchase-orders/all', async (req: AuthRequest, res, next) => {
  try {
    const { status, supplierId } = req.query
    const where: any = { supplier: { restaurantId: req.user!.restaurantId } }
    if (status) where.status = status
    if (supplierId) where.supplierId = supplierId

    const orders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: { stockItem: { select: { name: true, unit: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: orders })
  } catch (error) { next(error) }
})

// GET /api/suppliers/purchase-orders/:id
supplierRouter.get('/purchase-orders/:id', async (req: AuthRequest, res, next) => {
  try {
    const order = await prisma.purchaseOrder.findFirst({
      where: {
        id: req.params.id,
        supplier: { restaurantId: req.user!.restaurantId },
      },
      include: {
        supplier: true,
        items: { include: { stockItem: true } },
      },
    })
    if (!order) throw new AppError('Bon de commande introuvable', 404)
    res.json({ success: true, data: order })
  } catch (error) { next(error) }
})

// POST /api/suppliers/purchase-orders — create draft
supplierRouter.post('/purchase-orders', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const data = poSchema.parse(req.body)
    const supplier = await prisma.supplier.findFirst({
      where: { id: data.supplierId, restaurantId: req.user!.restaurantId },
    })
    if (!supplier) throw new AppError('Fournisseur introuvable', 404)

    const orderNumber = `BC-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`
    const totalAmount = data.items.reduce((s, i) => s + i.quantity * i.unitCost, 0)

    const order = await prisma.purchaseOrder.create({
      data: {
        orderNumber,
        supplierId: data.supplierId,
        notes: data.notes,
        expectedAt: data.expectedAt ? new Date(data.expectedAt) : undefined,
        warehouseId: data.warehouseId,
        totalAmount,
        items: {
          create: data.items.map(i => ({
            stockItemId: i.stockItemId,
            quantity: i.quantity,
            unitCost: i.unitCost,
            warehouseId: i.warehouseId,
            notes: i.notes,
          })),
        },
      },
      include: { supplier: true, items: { include: { stockItem: true } } },
    })
    res.status(201).json({ success: true, data: order })
  } catch (error) { next(error) }
})

// PUT /api/suppliers/purchase-orders/:id — update draft
supplierRouter.put('/purchase-orders/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const order = await prisma.purchaseOrder.findFirst({
      where: { id: req.params.id, supplier: { restaurantId: req.user!.restaurantId } },
    })
    if (!order) throw new AppError('Bon de commande introuvable', 404)
    if (order.status !== 'DRAFT') throw new AppError('Seul un brouillon peut être modifié', 400)

    const data = poSchema.partial().parse(req.body)

    // Replace items if provided
    if (data.items) {
      await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: order.id } })
      const totalAmount = data.items.reduce((s, i) => s + i.quantity * i.unitCost, 0)
      await prisma.purchaseOrder.update({
        where: { id: order.id },
        data: {
          notes: data.notes,
          expectedAt: data.expectedAt ? new Date(data.expectedAt) : undefined,
          totalAmount,
          items: {
            create: data.items.map(i => ({
              stockItemId: i.stockItemId,
              quantity: i.quantity,
              unitCost: i.unitCost,
              notes: i.notes,
            })),
          },
        },
      })
    }

    const updated = await prisma.purchaseOrder.findUnique({
      where: { id: order.id },
      include: { supplier: true, items: { include: { stockItem: true } } },
    })
    res.json({ success: true, data: updated })
  } catch (error) { next(error) }
})

// PATCH /api/suppliers/purchase-orders/:id/status
supplierRouter.patch('/purchase-orders/:id/status', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const { status } = z.object({
      status: z.enum(['SENT', 'CONFIRMED', 'RECEIVED', 'CANCELLED']),
    }).parse(req.body)

    const order = await prisma.purchaseOrder.findFirst({
      where: { id: req.params.id, supplier: { restaurantId: req.user!.restaurantId } },
      include: { items: { include: { stockItem: true } } },
    })
    if (!order) throw new AppError('Bon de commande introuvable', 404)

    // Enforce forward-only workflow: DRAFT→SENT→CONFIRMED→RECEIVED, or any→CANCELLED
    const FLOW: Record<string, number> = { DRAFT: 0, SENT: 1, CONFIRMED: 2, RECEIVED: 3, CANCELLED: 4 }
    const currentRank = FLOW[order.status] ?? -1
    const newRank = FLOW[status] ?? -1
    if (status !== 'CANCELLED' && newRank <= currentRank) {
      throw new AppError(`Impossible de revenir à "${status}" depuis "${order.status}"`, 400)
    }
    if (order.status === 'RECEIVED' || order.status === 'CANCELLED') {
      throw new AppError(`Ce bon de commande est déjà "${order.status}"`, 400)
    }

    const updateData: any = { status }
    if (status === 'SENT') updateData.orderedAt = new Date()
    if (status === 'RECEIVED') updateData.receivedAt = new Date()

    const createdBy = req.user!.id

    await prisma.$transaction(async (tx) => {
      await tx.purchaseOrder.update({ where: { id: order.id }, data: updateData })

      if (status === 'RECEIVED') {
        for (const item of order.items) {
          const qty = item.receivedQuantity > 0 ? item.receivedQuantity : item.quantity
          // Entrepôt de destination : celui de la ligne, sinon celui du bon de
          // commande, sinon celui de l'article, sinon l'entrepôt par défaut.
          const warehouseId = await resolveWarehouseId(tx, req.user!.restaurantId, item.warehouseId ?? order.warehouseId ?? item.stockItem.warehouseId)
          // Only update costPerUnit if supplier actually provided a price
          if (item.unitCost > 0) {
            await tx.stockItem.update({ where: { id: item.stockItemId }, data: { costPerUnit: item.unitCost } })
          }
          await applyStockDelta(tx, { stockItemId: item.stockItemId, warehouseId, delta: qty })
          await tx.stockMovement.create({
            data: {
              stockItemId: item.stockItemId,
              warehouseId,
              type: 'IN',
              quantity: qty,
              unitCost: item.unitCost,
              reason: `Réception BDC ${order.orderNumber}`,
              reference: order.id,
              createdBy,
            },
          })
        }
      }
    })

    const updated = await prisma.purchaseOrder.findUnique({
      where: { id: order.id },
      include: { supplier: true, items: { include: { stockItem: true } } },
    })
    res.json({ success: true, data: updated })
  } catch (error) { next(error) }
})

// DELETE /api/suppliers/purchase-orders/:id — only DRAFT
supplierRouter.delete('/purchase-orders/:id', authorize('manager', 'superadmin'), async (req: AuthRequest, res, next) => {
  try {
    const order = await prisma.purchaseOrder.findFirst({
      where: { id: req.params.id, supplier: { restaurantId: req.user!.restaurantId } },
    })
    if (!order) throw new AppError('Bon de commande introuvable', 404)
    if (!['DRAFT', 'CANCELLED'].includes(order.status)) {
      throw new AppError('Seuls les brouillons et annulations peuvent être supprimés', 400)
    }
    await prisma.purchaseOrder.delete({ where: { id: order.id } })
    res.json({ success: true, message: 'Bon de commande supprimé' })
  } catch (error) { next(error) }
})

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package, Plus, Search, AlertTriangle, RefreshCw, ArrowDown, ArrowUp,
  X, Edit2, ClipboardList, ArrowRightLeft, ShoppingCart, Truck, CheckSquare, Square, Star,
  UtensilsCrossed, History, ChevronLeft, ChevronRight, ExternalLink,
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatQuantity, formatCurrency } from '@restaurant/utils'
import { toast } from 'sonner'


const STOCK_STATUS = {
  OK:             { label: 'OK',           color: '#10B981' },
  REORDER_NEEDED: { label: 'Réappro.',     color: '#F59E0B' },
  LOW_STOCK:      { label: 'Stock faible', color: '#EF4444' },
  OUT_OF_STOCK:   { label: 'Rupture',      color: '#7F1D1D' },
}

const NEEDS_REORDER = ['REORDER_NEEDED', 'LOW_STOCK', 'OUT_OF_STOCK']

const UNITS = ['kg', 'g', 'L', 'cl', 'unité', 'bouteille', 'boîte', 'sachet', 'portion']

interface SupplierPriceLine {
  supplierId: string
  unitCost: number
  referenceCode: string
  isPreferred: boolean
}

const emptyItem = {
  name: '', description: '', sku: '', unit: 'unité',
  currentQuantity: 0, minQuantity: 0, reorderQuantity: 0, maxQuantity: '',
  warehouseId: '', costPerUnit: 0, isPerishable: false,
  supplierPrices: [] as SupplierPriceLine[],
}

interface ReorderLine {
  stockItemId: string
  name: string
  unit: string
  currentQty: number
  quantity: number
  unitCost: number
  supplierPrices: { supplierId: string; unitCost: number }[]
}

function suggestedQty(item: any): number {
  const target = item.maxQuantity || item.reorderQuantity * 2 || item.minQuantity * 3 || 10
  return Math.max(1, Math.ceil(target - item.currentQuantity))
}

// ─── Reorder Modal ────────────────────────────────────────────────────────────

function ReorderModal({ lines: initLines, suppliers, onClose, onCreated }: {
  lines: ReorderLine[]
  suppliers: any[]
  onClose: () => void
  onCreated: () => void
}) {
  const router = useRouter()

  // Auto-select the preferred supplier of the first line if available
  const preferredSupplierId = (() => {
    const first = initLines[0]
    if (!first) return suppliers[0]?.id ?? ''
    const preferred = first.supplierPrices.find(sp =>
      suppliers.some(s => s.id === sp.supplierId)
    )
    return preferred?.supplierId ?? suppliers[0]?.id ?? ''
  })()

  const [supplierId, setSupplierId] = useState(preferredSupplierId)
  const [expectedAt, setExpectedAt]  = useState('')
  const [notes, setNotes]            = useState('')
  const [lines, setLines]            = useState<ReorderLine[]>(() =>
    initLines.map(line => {
      const match = line.supplierPrices.find(sp => sp.supplierId === preferredSupplierId)
      return match ? { ...line, unitCost: match.unitCost } : line
    })
  )

  function handleSupplierChange(newSupplierId: string) {
    setSupplierId(newSupplierId)
    setLines(prev => prev.map(line => {
      const match = line.supplierPrices.find(sp => sp.supplierId === newSupplierId)
      return match ? { ...line, unitCost: match.unitCost } : line
    }))
  }

  const createPO = useMutation({
    mutationFn: (data: any) => api.post('/suppliers/purchase-orders', data),
    onSuccess: (res) => {
      const newPO = res.data.data
      toast.success('Bon de commande créé')
      onCreated()
      onClose()
      router.push(`/suppliers?po=${newPO.id}`)
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur création BDC'),
  })

  function updateLine(idx: number, field: keyof ReorderLine, value: any) {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }

  function removeLine(idx: number) {
    setLines(prev => prev.filter((_, i) => i !== idx))
  }

  const total = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        className="glass-card p-6 w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-brand-orange" />
            Nouveau bon de commande
          </h2>
          <button onClick={onClose} className="text-brand-muted hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Fournisseur *</label>
            <select value={supplierId} onChange={e => handleSupplierChange(e.target.value)} className="input-field">
              <option value="">— Sélectionner —</option>
              {suppliers.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Livraison prévue</label>
            <input type="date" value={expectedAt} onChange={e => setExpectedAt(e.target.value)}
              className="input-field" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Instructions particulières..." className="input-field" />
          </div>
        </div>

        {/* Lines table */}
        <div className="overflow-y-auto flex-1 mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-left text-xs text-brand-muted uppercase">
                <th className="pb-2 pr-3">Article</th>
                <th className="pb-2 pr-3 text-right">En stock</th>
                <th className="pb-2 pr-3 w-28">Qté à commander</th>
                <th className="pb-2 pr-3 w-32">Prix unit. (Ar)</th>
                <th className="pb-2 text-right w-28">Sous-total</th>
                <th className="pb-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={line.stockItemId} className="border-b border-brand-border/30">
                  <td className="py-2 pr-3">
                    <p className="font-medium">{line.name}</p>
                    <p className="text-xs text-brand-muted">{line.unit}</p>
                  </td>
                  <td className="py-2 pr-3 text-right text-brand-muted text-xs">
                    {formatQuantity(line.currentQty, line.unit)}
                  </td>
                  <td className="py-2 pr-3">
                    <input type="number" min="0.01" step="0.01"
                      value={line.quantity}
                      onChange={e => updateLine(idx, 'quantity', parseFloat(e.target.value) || 0)}
                      className="input-field py-1.5 text-sm" />
                  </td>
                  <td className="py-2 pr-3">
                    <input type="number" min="0" step="1"
                      value={line.unitCost}
                      onChange={e => updateLine(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                      className="input-field py-1.5 text-sm" />
                  </td>
                  <td className="py-2 text-right font-medium text-brand-orange">
                    {formatCurrency(line.quantity * line.unitCost)}
                  </td>
                  <td className="py-2 pl-2">
                    {lines.length > 1 && (
                      <button onClick={() => removeLine(idx)}
                        className="p-1 text-brand-muted hover:text-red-400 rounded">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-brand-border">
          <div>
            <p className="text-xs text-brand-muted">{lines.length} article(s)</p>
            <p className="font-bold text-brand-orange">{formatCurrency(total)}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Annuler</button>
            <button
              onClick={() => createPO.mutate({
                supplierId,
                notes: notes || undefined,
                expectedAt: expectedAt || undefined,
                items: lines.map(l => ({ stockItemId: l.stockItemId, quantity: l.quantity, unitCost: l.unitCost })),
              })}
              disabled={!supplierId || lines.length === 0 || createPO.isPending}
              className="btn-primary flex items-center gap-2 disabled:opacity-50">
              <ShoppingCart className="w-4 h-4" />
              {createPO.isPending ? 'Création...' : 'Créer le bon de commande'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Create Product from Stock Item ──────────────────────────────────────────

function CreateProductFromStockModal({
  stockItem,
  onClose,
}: { stockItem: any; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName]       = useState(stockItem.name)
  const [price, setPrice]     = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [saving, setSaving]   = useState(false)

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then(r => r.data.data ?? []),
    staleTime: 600_000,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!price || parseFloat(price) <= 0) { toast.error('Prix de vente requis'); return }
    if (!categoryId) { toast.error('Catégorie requise'); return }
    setSaving(true)
    try {
      // 1. Create product
      const res = await api.post('/products', {
        name: name.trim(),
        price: parseFloat(price),
        categoryId,
        warehouseId: stockItem.warehouseId || undefined,
        stockItemId: stockItem.id,
        isAvailable: true,
        requiresPreparation: false,
        costPrice: stockItem.costPerUnit || undefined,
        allergens: [],
        tags: [],
      })
      const product = res.data.data

      // 2. Link to stock item (recipe 1:1)
      await api.put(`/products/${product.id}/recipe`, {
        items: [{
          stockItemId: stockItem.id,
          quantity: 1,
          unit: stockItem.unit,
          yieldRate: 1,
        }],
      })

      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success(`"${name}" créé dans le menu et lié au stock`)
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Erreur lors de la création')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-brand-border">
          <div>
            <h2 className="font-bold text-base flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-brand-orange" />
              Créer un produit vendable
            </h2>
            <p className="text-xs text-brand-muted mt-0.5">
              Lié au stock : <span className="text-white">{stockItem.name}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs text-brand-muted block mb-1">Nom affiché au POS *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="input-field" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-brand-muted block mb-1">Prix de vente (Ar) *</label>
              <input type="number" min="0" step="1" value={price}
                onChange={e => setPrice(e.target.value)}
                className="input-field" placeholder="0" required />
            </div>
            <div>
              <label className="text-xs text-brand-muted block mb-1">Catégorie *</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                className="input-field" required>
                <option value="">Choisir...</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
          </div>
          {stockItem.costPerUnit > 0 && price && parseFloat(price) > 0 && (
            <div className={`px-3 py-2 rounded-xl text-xs font-medium ${
              (parseFloat(price) - stockItem.costPerUnit) / parseFloat(price) >= 0.5
                ? 'bg-green-500/10 text-green-400'
                : 'bg-yellow-500/10 text-yellow-400'
            }`}>
              Marge : {(((parseFloat(price) - stockItem.costPerUnit) / parseFloat(price)) * 100).toFixed(1)}%
              &nbsp;·&nbsp; Coût : {formatCurrency(stockItem.costPerUnit)} / {stockItem.unit}
            </div>
          )}
          <p className="text-xs text-brand-muted bg-white/3 rounded-xl px-3 py-2">
            ✅ Vendre 1 unité au POS déduira <strong>1 {stockItem.unit}</strong> du stock automatiquement.
          </p>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Annuler</button>
            <button type="submit" disabled={saving} className="flex-1 btn-primary disabled:opacity-50">
              {saving ? 'Création...' : 'Créer le produit'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}



// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StockPage() {
  const [activeTab, setActiveTab]       = useState<'stock' | 'reorder' | 'history'>('stock')
  const [search, setSearch]             = useState('')
  const [filter, setFilter]             = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('')
  // Movement modal
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [movementForm, setMovementForm] = useState({ type: 'IN', quantity: '', notes: '', expiryDate: '' })
  // New / edit item modal
  const [showItemModal, setShowItemModal] = useState(false)
  const [editItem, setEditItem]           = useState<any>(null)
  const [itemForm, setItemForm]           = useState<any>(emptyItem)
  // Inventory modal
  const [showInventory, setShowInventory] = useState(false)
  const [inventoryCounts, setInventoryCounts] = useState<Record<string, string>>({})
  // Transfer modal
  const [transferItem, setTransferItem] = useState<any>(null)
  const [transferForm, setTransferForm] = useState({ toLocation: '', quantity: '', notes: '' })
  const [batchItem, setBatchItem] = useState<any>(null)
  // Reorder
  const [reorderLines, setReorderLines]   = useState<ReorderLine[] | null>(null)
  const [selected, setSelected]           = useState<Set<string>>(new Set())
  // Create product from stock item
  const [createProductFrom, setCreateProductFrom] = useState<any>(null)
  // History filters
  const [historyType, setHistoryType]         = useState('')
  const [historyItem, setHistoryItem]         = useState('')
  const [historyFrom, setHistoryFrom]         = useState('')
  const [historyTo, setHistoryTo]             = useState('')
  const [historyPage, setHistoryPage]         = useState(1)

  const qc = useQueryClient()
  const router = useRouter()

  const { data, isLoading } = useQuery({
    queryKey: ['stock', search],
    queryFn: () => api.get(`/stock?${search ? `search=${search}` : ''}`).then(r => r.data.data),
    refetchInterval: 30000,
  })

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/suppliers').then(r => r.data.data ?? []),
    staleTime: 300_000,
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then(r => r.data.data ?? []),
    staleTime: 60_000,
  })

  const { data: batchItemDetail } = useQuery({
    queryKey: ['stock-item', batchItem?.id],
    queryFn: () => api.get(`/stock/${batchItem!.id}`).then(r => r.data.data),
    enabled: !!batchItem,
    staleTime: 30_000,
  })

  const historyParams = new URLSearchParams({ page: String(historyPage), limit: '50' })
  if (historyType) historyParams.set('type', historyType)
  if (historyItem) historyParams.set('stockItemId', historyItem)
  if (historyFrom) historyParams.set('from', historyFrom)
  if (historyTo)   historyParams.set('to', historyTo)

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['stock-movements', historyType, historyItem, historyFrom, historyTo, historyPage],
    queryFn: () => api.get(`/stock/movements/all?${historyParams}`).then(r => r.data),
    enabled: activeTab === 'history',
    staleTime: 10_000,
  })

  const recordMovement = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.post(`/stock/${id}/movements`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock'] })
      setSelectedItem(null)
      setMovementForm({ type: 'IN', quantity: '', notes: '', expiryDate: '' })
      toast.success('Mouvement enregistré')
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement'),
  })

  const createItem = useMutation({
    mutationFn: (data: any) => api.post('/stock', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock'] })
      setShowItemModal(false)
      setItemForm(emptyItem)
      toast.success('Article créé')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur création'),
  })

  const updateItem = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/stock/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock'] })
      setShowItemModal(false)
      setEditItem(null)
      toast.success('Article mis à jour')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur modification'),
  })

  const recordTransfer = useMutation({
    mutationFn: async ({ item, toLocation, quantity, notes }: any) => {
      const destWarehouse = (warehouses as any[]).find((w: any) => w.id === toLocation)
      await api.post(`/stock/${item.id}/movements`, {
        type: 'TRANSFER',
        quantity: parseFloat(quantity),
        notes: `Transfert vers ${destWarehouse?.name ?? toLocation}${notes ? ` — ${notes}` : ''}`,
      })
      await api.put(`/stock/${item.id}`, { ...item, warehouseId: toLocation })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock'] })
      setTransferItem(null)
      setTransferForm({ toLocation: '', quantity: '', notes: '' })
      toast.success('Transfert enregistré')
    },
    onError: () => toast.error('Erreur lors du transfert'),
  })

  const allItems: any[] = data || []
  const items = allItems
    .filter((item: any) => !filter || item.stockStatus === filter)
    .filter((item: any) => !warehouseFilter || item.warehouseId === warehouseFilter)
  const alerts = allItems.filter((item: any) => NEEDS_REORDER.includes(item.stockStatus))

  function toReorderLine(item: any): ReorderLine {
    return {
      stockItemId: item.id,
      name: item.name,
      unit: item.unit,
      currentQty: item.currentQuantity,
      quantity: suggestedQty(item),
      unitCost: item.costPerUnit || 0,
      supplierPrices: (item.supplierPrices || []).map((sp: any) => ({
        supplierId: sp.supplierId,
        unitCost: sp.unitCost,
      })),
    }
  }

  function openReorderSingle(item: any) {
    setReorderLines([toReorderLine(item)])
  }

  function openReorderSelected() {
    const lines = alerts
      .filter((item: any) => selected.size === 0 || selected.has(item.id))
      .map(toReorderLine)
    if (lines.length === 0) { toast.error('Aucun article sélectionné'); return }
    setReorderLines(lines)
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === alerts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(alerts.map((i: any) => i.id)))
    }
  }

  function openNewItem() {
    setEditItem(null)
    const defaultWarehouse = (warehouses as any[]).find((w: any) => w.isDefault) ?? (warehouses as any[])[0]
    setItemForm({ ...emptyItem, warehouseId: defaultWarehouse?.id ?? '' })
    setShowItemModal(true)
  }

  function openEditItem(item: any) {
    setEditItem(item)
    setItemForm({
      name: item.name, description: item.description ?? '', sku: item.sku ?? '',
      unit: item.unit, currentQuantity: item.currentQuantity,
      minQuantity: item.minQuantity, reorderQuantity: item.reorderQuantity,
      maxQuantity: item.maxQuantity ?? '', warehouseId: item.warehouseId ?? '',
      costPerUnit: item.costPerUnit, isPerishable: item.isPerishable,
      supplierPrices: (item.supplierPrices || []).map((sp: any) => ({
        supplierId: sp.supplierId,
        unitCost: sp.unitCost,
        referenceCode: sp.referenceCode ?? '',
        isPreferred: sp.isPreferred,
      })),
    })
    setShowItemModal(true)
  }

  function submitItem() {
    const payload = {
      ...itemForm,
      currentQuantity: Number(itemForm.currentQuantity),
      minQuantity: Number(itemForm.minQuantity),
      reorderQuantity: Number(itemForm.reorderQuantity),
      maxQuantity: itemForm.maxQuantity ? Number(itemForm.maxQuantity) : undefined,
      costPerUnit: Number(itemForm.costPerUnit),
      supplierPrices: (itemForm.supplierPrices as SupplierPriceLine[])
        .filter(sp => sp.supplierId && sp.unitCost >= 0)
        .map(sp => ({ ...sp, unitCost: Number(sp.unitCost) })),
    }
    if (editItem) {
      updateItem.mutate({ id: editItem.id, data: payload })
    } else {
      createItem.mutate(payload)
    }
  }

  function addSupplierPrice() {
    setItemForm((f: any) => ({
      ...f,
      supplierPrices: [...f.supplierPrices, { supplierId: '', unitCost: 0, referenceCode: '', isPreferred: false }],
    }))
  }

  function updateSupplierPrice(idx: number, field: keyof SupplierPriceLine, value: any) {
    setItemForm((f: any) => {
      const prices = [...f.supplierPrices] as SupplierPriceLine[]
      // If setting preferred, unset others
      if (field === 'isPreferred' && value === true) {
        prices.forEach((p, i) => { prices[i] = { ...p, isPreferred: i === idx } })
      } else {
        prices[idx] = { ...prices[idx], [field]: value } as SupplierPriceLine
      }
      // Auto-update costPerUnit to preferred supplier price
      const preferred = prices.find(p => p.isPreferred)
      return { ...f, supplierPrices: prices, costPerUnit: preferred ? preferred.unitCost : f.costPerUnit }
    })
  }

  function removeSupplierPrice(idx: number) {
    setItemForm((f: any) => ({
      ...f,
      supplierPrices: (f.supplierPrices as SupplierPriceLine[]).filter((_, i) => i !== idx),
    }))
  }

  async function submitInventory() {
    const entries = Object.entries(inventoryCounts).filter(([, v]) => v !== '')
    if (entries.length === 0) { toast.error('Aucune quantité saisie'); return }
    try {
      const payload = {
        items: entries.map(([stockItemId, counted]) => ({
          stockItemId,
          counted: parseFloat(counted) || 0,
        })),
        notes: 'Inventaire physique',
      }
      const res = await api.post('/stock/inventory-count', payload)
      const { adjusted } = res.data.data
      qc.invalidateQueries({ queryKey: ['stock'] })
      setShowInventory(false)
      setInventoryCounts({})
      toast.success(`Inventaire enregistré — ${adjusted} article(s) ajusté(s)`)
    } catch {
      toast.error('Erreur lors de l\'inventaire')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion des Stocks</h1>
          <p className="text-brand-muted text-sm">
            {allItems.length} articles · Valeur totale :{' '}
            <span className="font-semibold text-brand-orange">
              {formatCurrency(allItems.reduce((s, i) => s + (i.currentQuantity * i.costPerUnit), 0))}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const counts: Record<string, string> = {}
              allItems.forEach((i: any) => { counts[i.id] = String(i.currentQuantity) })
              setInventoryCounts(counts)
              setShowInventory(true)
            }}
            className="btn-secondary flex items-center gap-2"
          >
            <ClipboardList className="w-4 h-4" />
            Inventaire
          </button>
          <button onClick={openNewItem} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nouvel article
          </button>
        </div>
      </div>

      {/* Alerts banner */}
      {alerts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 border-red-500/30 bg-red-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span className="font-semibold text-red-400">{alerts.length} article{alerts.length > 1 ? 's' : ''} à réapprovisionner</span>
            </div>
            <button
              onClick={() => setActiveTab('reorder')}
              className="text-xs text-brand-orange hover:underline flex items-center gap-1">
              <Truck className="w-3 h-3" /> Voir tout
            </button>
          </div>
          <div className="flex gap-2 flex-wrap mt-2">
            {alerts.slice(0, 5).map((item: any) => (
              <span key={item.id} className="text-xs px-2 py-1 bg-red-500/20 text-red-300 rounded-lg">
                {item.name} : {formatQuantity(item.currentQuantity, item.unit)}
              </span>
            ))}
            {alerts.length > 5 && <span className="text-xs text-brand-muted">+{alerts.length - 5} autres</span>}
          </div>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-brand-card border border-brand-border rounded-xl w-fit">
        <button onClick={() => setActiveTab('stock')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'stock' ? 'bg-brand-orange text-white' : 'text-brand-muted hover:text-white'}`}>
          <Package className="w-4 h-4" /> Stock
        </button>
        <button onClick={() => setActiveTab('reorder')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'reorder' ? 'bg-brand-orange text-white' : 'text-brand-muted hover:text-white'}`}>
          <ShoppingCart className="w-4 h-4" />
          À réapprovisionner
          {alerts.length > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === 'reorder' ? 'bg-white/20' : 'bg-red-500 text-white'}`}>
              {alerts.length}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-brand-orange text-white' : 'text-brand-muted hover:text-white'}`}>
          <History className="w-4 h-4" /> Historique
        </button>
      </div>

      {/* ── Stock tab ─────────────────────────────────────────────────────────── */}
      {activeTab === 'stock' && (
        <>
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher..." className="input-field pl-10 w-full" />
            </div>
            {['', 'OK', 'LOW_STOCK', 'OUT_OF_STOCK'].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-3 py-2 rounded-xl text-sm border transition-all ${filter === s ? 'bg-brand-orange text-white border-brand-orange' : 'border-brand-border text-brand-muted'}`}>
                {s ? STOCK_STATUS[s as keyof typeof STOCK_STATUS].label : 'Tous'}
              </button>
            ))}
            {(warehouses as any[]).length > 1 && (
              <select value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)}
                className="input-field text-sm" style={{ width: 'auto' }}>
                <option value="">Tous dépôts</option>
                {(warehouses as any[]).map((w: any) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-brand-border text-left">
                    {['Article', 'Quantité', 'Seuil min.', 'Statut', 'Emplacement', 'Valeur', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-medium text-brand-muted uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-brand-border/50">
                        <td colSpan={7} className="px-4 py-3"><div className="skeleton h-5 rounded" /></td>
                      </tr>
                    ))
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-brand-muted">
                        <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p>Aucun article trouvé</p>
                      </td>
                    </tr>
                  ) : items.map((item: any) => {
                    const sc = STOCK_STATUS[item.stockStatus as keyof typeof STOCK_STATUS] ?? STOCK_STATUS.OK
                    const pct = item.minQuantity > 0
                      ? Math.min(100, (item.currentQuantity / (item.maxQuantity || item.minQuantity * 3)) * 100)
                      : 100
                    const needsReorder = NEEDS_REORDER.includes(item.stockStatus)
                    return (
                      <tr key={item.id} className="border-b border-brand-border/30 hover:bg-white/2 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-sm">{item.name}</p>
                          {item.sku && <p className="text-xs text-brand-muted">{item.sku}</p>}
                          {item.isPerishable && item.expiryDate && (() => {
                            const daysLeft = Math.ceil((new Date(item.expiryDate).getTime() - Date.now()) / 86400000)
                            if (daysLeft < 0) return <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full mt-0.5 inline-block">Expiré</span>
                            if (daysLeft <= 7) return <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full mt-0.5 inline-block">⚠ Expire dans {daysLeft}j</span>
                            return <span className="text-xs text-brand-muted mt-0.5 inline-block">DLC : {new Date(item.expiryDate).toLocaleDateString('fr-FR')}</span>
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold" style={{ color: sc.color }}>{formatQuantity(item.currentQuantity, item.unit)}</p>
                          <div className="w-24 h-1.5 bg-brand-border rounded-full mt-1">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: sc.color }} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-brand-muted">{formatQuantity(item.minQuantity, item.unit)}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: `${sc.color}20`, color: sc.color }}>{sc.label}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-brand-muted">
                          {(warehouses as any[]).find((w: any) => w.id === item.warehouseId)?.name || item.location || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">{formatCurrency(item.currentQuantity * item.costPerUnit)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => { setSelectedItem(item); setMovementForm({ type: 'IN', quantity: '', notes: '', expiryDate: '' }) }}
                              className="p-1.5 text-green-400 hover:bg-green-400/10 rounded-lg" title="Entrée">
                              <ArrowDown className="w-4 h-4" />
                            </button>
                            <button onClick={() => { setSelectedItem(item); setMovementForm({ type: 'OUT', quantity: '', notes: '', expiryDate: '' }) }}
                              className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg" title="Sortie">
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button onClick={() => { setTransferItem(item); setTransferForm({ toLocation: '', quantity: '', notes: '' }) }}
                              className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-lg" title="Transfert">
                              <ArrowRightLeft className="w-4 h-4" />
                            </button>
                            {needsReorder && (
                              <button onClick={() => openReorderSingle(item)}
                                className="p-1.5 text-brand-orange hover:bg-brand-orange/10 rounded-lg" title="Commander">
                                <ShoppingCart className="w-4 h-4" />
                              </button>
                            )}
                            <button onClick={() => openEditItem(item)}
                              className="p-1.5 text-brand-muted hover:text-white hover:bg-white/10 rounded-lg" title="Modifier">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setCreateProductFrom(item)}
                              className="p-1.5 text-purple-400 hover:bg-purple-400/10 rounded-lg" title="Créer un produit vendable (POS)">
                              <UtensilsCrossed className="w-4 h-4" />
                            </button>
                            {item.isPerishable && (
                              <button onClick={() => setBatchItem(item)}
                                className="p-1.5 text-amber-400 hover:bg-amber-400/10 rounded-lg" title="Voir les lots (FIFO)">
                                <ClipboardList className="w-4 h-4" />
                              </button>
                            )}
                            <button onClick={() => router.push(`/stock/${item.id}`)}
                              className="p-1.5 text-brand-muted hover:text-white hover:bg-white/10 rounded-lg" title="Voir la fiche détaillée">
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Réapprovisionnement tab ────────────────────────────────────────────── */}
      {activeTab === 'reorder' && (
        <div className="space-y-4">
          {alerts.length === 0 ? (
            <div className="glass-card p-12 text-center text-brand-muted">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Tous les stocks sont suffisants</p>
              <p className="text-sm mt-1">Aucun article n'a atteint son seuil de réapprovisionnement.</p>
            </div>
          ) : (
            <>
              {/* Actions bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={toggleAll}
                    className="flex items-center gap-2 text-sm text-brand-muted hover:text-white transition-colors">
                    {selected.size === alerts.length
                      ? <CheckSquare className="w-4 h-4 text-brand-orange" />
                      : <Square className="w-4 h-4" />}
                    {selected.size === 0 ? 'Tout sélectionner' : `${selected.size} sélectionné(s)`}
                  </button>
                </div>
                <button
                  onClick={openReorderSelected}
                  className="btn-primary flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  {selected.size === 0
                    ? `Commander tout (${alerts.length})`
                    : `Commander la sélection (${selected.size})`}
                </button>
              </div>

              {/* Cards grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {alerts.map((item: any) => {
                  const sc = STOCK_STATUS[item.stockStatus as keyof typeof STOCK_STATUS] ?? STOCK_STATUS.OK
                  const suggested = suggestedQty(item)
                  const isSelected = selected.has(item.id)
                  return (
                    <motion.div key={item.id}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className={`glass-card p-4 cursor-pointer transition-all border-2 ${isSelected ? 'border-brand-orange/60' : 'border-transparent'}`}
                      onClick={() => toggleSelect(item.id)}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isSelected ? 'bg-brand-orange border-brand-orange' : 'border-brand-border'}`}>
                            {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                          </div>
                          <p className="font-semibold text-sm truncate">{item.name}</p>
                          {item.isPerishable && item.expiryDate && (() => {
                            const dl = Math.ceil((new Date(item.expiryDate).getTime() - Date.now()) / 86400000)
                            if (dl < 0) return <span className="text-[10px] bg-red-500/20 text-red-400 px-1 rounded">Expiré</span>
                            if (dl <= 7) return <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1 rounded">⚠ {dl}j</span>
                            return null
                          })()}
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2"
                          style={{ background: `${sc.color}20`, color: sc.color }}>{sc.label}</span>
                      </div>

                      <div className="space-y-2 text-sm mb-4">
                        <div className="flex justify-between">
                          <span className="text-brand-muted">Stock actuel</span>
                          <span className="font-medium" style={{ color: sc.color }}>
                            {formatQuantity(item.currentQuantity, item.unit)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-brand-muted">Seuil minimum</span>
                          <span>{formatQuantity(item.minQuantity, item.unit)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-brand-muted">Qté suggérée</span>
                          <span className="font-semibold text-brand-orange">
                            {formatQuantity(suggested, item.unit)}
                          </span>
                        </div>
                        {item.supplier && (
                          <div className="flex justify-between">
                            <span className="text-brand-muted">Fournisseur</span>
                            <span className="text-xs">{item.supplier.name}</span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={e => { e.stopPropagation(); openReorderSingle(item) }}
                        className="w-full py-2 rounded-xl bg-brand-orange/10 border border-brand-orange/30 text-brand-orange text-sm font-medium hover:bg-brand-orange/20 transition-colors flex items-center justify-center gap-2">
                        <ShoppingCart className="w-4 h-4" />
                        Commander cet article
                      </button>
                    </motion.div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Historique des mouvements ─────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Type filter */}
            <select value={historyType}
              onChange={e => { setHistoryType(e.target.value); setHistoryPage(1) }}
              className="input-field w-auto text-sm">
              <option value="">Tous les types</option>
              <option value="IN">Entrée</option>
              <option value="OUT">Sortie</option>
              <option value="ADJUSTMENT">Ajustement</option>
              <option value="LOSS">Perte</option>
              <option value="TRANSFER">Transfert</option>
            </select>
            {/* Item filter */}
            <select value={historyItem}
              onChange={e => { setHistoryItem(e.target.value); setHistoryPage(1) }}
              className="input-field w-auto text-sm flex-1 min-w-40">
              <option value="">Tous les articles</option>
              {allItems.map((i: any) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
            {/* Date range */}
            <input type="date" value={historyFrom}
              onChange={e => { setHistoryFrom(e.target.value); setHistoryPage(1) }}
              className="input-field w-auto text-sm" />
            <span className="text-brand-muted text-sm">→</span>
            <input type="date" value={historyTo}
              onChange={e => { setHistoryTo(e.target.value); setHistoryPage(1) }}
              className="input-field w-auto text-sm" />
            {(historyType || historyItem || historyFrom || historyTo) && (
              <button onClick={() => { setHistoryType(''); setHistoryItem(''); setHistoryFrom(''); setHistoryTo(''); setHistoryPage(1) }}
                className="text-xs text-brand-muted hover:text-white flex items-center gap-1 px-2 py-1 border border-brand-border rounded-lg">
                <X className="w-3 h-3" /> Réinitialiser
              </button>
            )}
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-brand-border text-left">
                    {['Date', 'Article', 'Type', 'Quantité', 'Raison / Note', 'Référence'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-medium text-brand-muted uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i} className="border-b border-brand-border/50">
                        <td colSpan={6} className="px-4 py-3"><div className="skeleton h-4 rounded" /></td>
                      </tr>
                    ))
                  ) : (historyData?.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-brand-muted">
                        <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p>Aucun mouvement trouvé</p>
                      </td>
                    </tr>
                  ) : (historyData?.data ?? []).map((m: any) => {
                    const TYPE_META: Record<string, { label: string; color: string; icon: JSX.Element | null }> = {
                      IN:         { label: 'Entrée',      color: '#10B981', icon: <ArrowDown className="w-3.5 h-3.5" /> },
                      OUT:        { label: 'Sortie',      color: '#EF4444', icon: <ArrowUp className="w-3.5 h-3.5" /> },
                      ADJUSTMENT: { label: 'Ajustement',  color: '#F59E0B', icon: <RefreshCw className="w-3.5 h-3.5" /> },
                      LOSS:       { label: 'Perte',       color: '#F97316', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
                      TRANSFER:   { label: 'Transfert',   color: '#3B82F6', icon: <ArrowRightLeft className="w-3.5 h-3.5" /> },
                    }
                    const meta = TYPE_META[m.type] ?? { label: m.type, color: '#6B7280', icon: null }
                    return (
                      <tr key={m.id} className="border-b border-brand-border/30 hover:bg-white/2 transition-colors">
                        <td className="px-4 py-3 text-sm text-brand-muted whitespace-nowrap">
                          {new Date(m.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                          <span className="ml-1 text-xs opacity-60">
                            {new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium">{m.stockItem?.name ?? '—'}</p>
                          <p className="text-xs text-brand-muted">{m.stockItem?.unit}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: `${meta.color}20`, color: meta.color }}>
                            {meta.icon} {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-sm"
                          style={{ color: ['IN', 'ADJUSTMENT'].includes(m.type) ? '#10B981' : '#EF4444' }}>
                          {['IN', 'ADJUSTMENT'].includes(m.type) ? '+' : '-'}
                          {formatQuantity(m.quantity, m.stockItem?.unit ?? '')}
                        </td>
                        <td className="px-4 py-3 text-sm text-brand-muted max-w-xs truncate">
                          {m.reason || m.notes || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-brand-muted font-mono">
                          {m.reference || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {historyData?.pagination && historyData.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-brand-border">
                <p className="text-xs text-brand-muted">
                  {historyData.pagination.total} mouvement{historyData.pagination.total > 1 ? 's' : ''}
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                    disabled={historyPage === 1}
                    className="p-1.5 rounded-lg border border-brand-border text-brand-muted hover:text-white disabled:opacity-30">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-brand-muted">
                    {historyPage} / {historyData.pagination.totalPages}
                  </span>
                  <button onClick={() => setHistoryPage(p => Math.min(historyData.pagination.totalPages, p + 1))}
                    disabled={historyPage === historyData.pagination.totalPages}
                    className="p-1.5 rounded-lg border border-brand-border text-brand-muted hover:text-white disabled:opacity-30">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Reorder modal ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {reorderLines && (
          <ReorderModal
            lines={reorderLines}
            suppliers={suppliers as any[]}
            onClose={() => setReorderLines(null)}
            onCreated={() => {
              qc.invalidateQueries({ queryKey: ['stock'] })
              setSelected(new Set())
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Movement modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedItem(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="glass-card p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg">Mouvement de stock</h2>
                <button onClick={() => setSelectedItem(null)} className="text-brand-muted hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-brand-muted text-sm mb-4">{selectedItem.name} — stock actuel : <strong>{formatQuantity(selectedItem.currentQuantity, selectedItem.unit)}</strong></p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Type</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[['IN','Entrée'],['OUT','Sortie'],['ADJUSTMENT','Ajust.'],['LOSS','Perte']].map(([t, l]) => (
                      <button key={t} onClick={() => setMovementForm(f => ({ ...f, type: t ?? 'IN' }))}
                        className={`py-2 rounded-xl text-xs font-medium border transition-all ${movementForm.type === t ? 'bg-brand-orange border-brand-orange text-white' : 'border-brand-border text-brand-muted'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Quantité ({selectedItem.unit})</label>
                  <input type="number" value={movementForm.quantity}
                    onChange={e => setMovementForm(f => ({ ...f, quantity: e.target.value }))}
                    placeholder="0" min="0" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Note (optionnel)</label>
                  <input value={movementForm.notes}
                    onChange={e => setMovementForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Raison du mouvement..." className="input-field" />
                </div>
                {movementForm.type === 'IN' && selectedItem.isPerishable && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Date de péremption</label>
                    <input type="date" value={movementForm.expiryDate}
                      onChange={e => setMovementForm(f => ({ ...f, expiryDate: e.target.value }))}
                      className="input-field" />
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setSelectedItem(null)} className="btn-secondary flex-1">Annuler</button>
                  <button
                    onClick={() => recordMovement.mutate({ id: selectedItem.id, data: {
                      type: movementForm.type,
                      quantity: parseFloat(movementForm.quantity),
                      notes: movementForm.notes || undefined,
                      expiryDate: movementForm.type === 'IN' && movementForm.expiryDate ? movementForm.expiryDate : undefined,
                    }})}
                    disabled={!movementForm.quantity || recordMovement.isPending}
                    className="btn-primary flex-1">
                    {recordMovement.isPending ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── New / Edit item modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showItemModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowItemModal(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="glass-card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-bold text-lg">{editItem ? 'Modifier l\'article' : 'Nouvel article'}</h2>
                <button onClick={() => setShowItemModal(false)} className="text-brand-muted hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Nom *</label>
                    <input value={itemForm.name} onChange={e => setItemForm((f: any) => ({ ...f, name: e.target.value }))}
                      placeholder="Ex: Viande de zébu" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Unité *</label>
                    <select value={itemForm.unit} onChange={e => setItemForm((f: any) => ({ ...f, unit: e.target.value }))}
                      className="input-field">
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">SKU / Référence</label>
                    <input value={itemForm.sku} onChange={e => setItemForm((f: any) => ({ ...f, sku: e.target.value }))}
                      placeholder="REF-001" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Quantité actuelle</label>
                    <input type="number" value={itemForm.currentQuantity}
                      onChange={e => setItemForm((f: any) => ({ ...f, currentQuantity: e.target.value }))}
                      min="0" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Seuil minimum</label>
                    <input type="number" value={itemForm.minQuantity}
                      onChange={e => setItemForm((f: any) => ({ ...f, minQuantity: e.target.value }))}
                      min="0" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Seuil réappro.</label>
                    <input type="number" value={itemForm.reorderQuantity}
                      onChange={e => setItemForm((f: any) => ({ ...f, reorderQuantity: e.target.value }))}
                      min="0" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Quantité max.</label>
                    <input type="number" value={itemForm.maxQuantity}
                      onChange={e => setItemForm((f: any) => ({ ...f, maxQuantity: e.target.value }))}
                      min="0" placeholder="Optionnel" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Coût unitaire (Ar)</label>
                    <input type="number" value={itemForm.costPerUnit}
                      onChange={e => setItemForm((f: any) => ({ ...f, costPerUnit: e.target.value }))}
                      min="0" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Dépôt</label>
                    <select value={itemForm.warehouseId} onChange={e => setItemForm((f: any) => ({ ...f, warehouseId: e.target.value }))}
                      className="input-field">
                      <option value="">— Aucun dépôt —</option>
                      {(warehouses as any[]).map((w: any) => (
                        <option key={w.id} value={w.id}>{w.name}{w.description ? ` — ${w.description}` : ''}</option>
                      ))}
                    </select>
                    {(warehouses as any[]).length === 0 && (
                      <p className="text-xs text-brand-muted mt-1">
                        Aucun dépôt — <a href="/warehouses" className="text-brand-orange underline">créez-en un d'abord</a>
                      </p>
                    )}
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <input value={itemForm.description}
                      onChange={e => setItemForm((f: any) => ({ ...f, description: e.target.value }))}
                      placeholder="Description optionnelle" className="input-field" />
                  </div>
                  <div className="col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={itemForm.isPerishable}
                        onChange={e => setItemForm((f: any) => ({ ...f, isPerishable: e.target.checked }))}
                        className="rounded border-brand-border" />
                      <span className="text-sm">Produit périssable</span>
                    </label>
                  </div>
                </div>

                {/* ── Prix par fournisseur ── */}
                <div className="pt-2 border-t border-brand-border">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold">Prix par fournisseur</p>
                      <p className="text-xs text-brand-muted">Le fournisseur préféré met à jour le prix d'achat</p>
                    </div>
                    <button type="button" onClick={addSupplierPrice}
                      className="text-xs flex items-center gap-1 text-brand-orange hover:text-brand-orange/80 border border-brand-orange/40 px-2 py-1 rounded-lg">
                      <Plus className="w-3 h-3" /> Ajouter
                    </button>
                  </div>

                  {(itemForm.supplierPrices as SupplierPriceLine[]).length === 0 ? (
                    <p className="text-xs text-brand-muted text-center py-3 border border-dashed border-brand-border rounded-xl">
                      Aucun prix fournisseur configuré
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {/* Header */}
                      <div className="grid grid-cols-[1fr_100px_90px_32px_32px] gap-2 text-xs text-brand-muted px-1">
                        <span>Fournisseur</span>
                        <span>Prix (Ar)</span>
                        <span>Réf.</span>
                        <Star className="w-3 h-3 mx-auto" />
                        <span />
                      </div>
                      {(itemForm.supplierPrices as SupplierPriceLine[]).map((sp, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_100px_90px_32px_32px] gap-2 items-center">
                          <select
                            value={sp.supplierId}
                            onChange={e => updateSupplierPrice(idx, 'supplierId', e.target.value)}
                            className="input-field py-1.5 text-sm">
                            <option value="">— Fournisseur —</option>
                            {(suppliers as any[]).map((s: any) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          <input
                            type="number" min="0" step="1"
                            value={sp.unitCost}
                            onChange={e => updateSupplierPrice(idx, 'unitCost', Number(e.target.value))}
                            className="input-field py-1.5 text-sm" />
                          <input
                            type="text"
                            value={sp.referenceCode}
                            onChange={e => updateSupplierPrice(idx, 'referenceCode', e.target.value)}
                            placeholder="Réf."
                            className="input-field py-1.5 text-sm" />
                          <button
                            type="button"
                            onClick={() => updateSupplierPrice(idx, 'isPreferred', !sp.isPreferred)}
                            title="Fournisseur préféré"
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${sp.isPreferred ? 'text-brand-orange bg-brand-orange/10' : 'text-brand-muted hover:text-brand-orange'}`}>
                            <Star className="w-4 h-4" fill={sp.isPreferred ? 'currentColor' : 'none'} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSupplierPrice(idx)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-brand-muted hover:text-red-400 hover:bg-red-400/10 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button onClick={() => setShowItemModal(false)} className="btn-secondary flex-1">Annuler</button>
                  <button onClick={submitItem}
                    disabled={!itemForm.name || createItem.isPending || updateItem.isPending}
                    className="btn-primary flex-1">
                    {createItem.isPending || updateItem.isPending ? 'Enregistrement...' : editItem ? 'Mettre à jour' : 'Créer l\'article'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Inventory modal ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showInventory && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowInventory(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="glass-card p-6 w-full max-w-2xl max-h-[90vh] flex flex-col"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-bold text-lg">Inventaire physique</h2>
                <button onClick={() => setShowInventory(false)} className="text-brand-muted hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-brand-muted text-sm mb-4">Saisissez les quantités réellement comptées. Les ajustements seront créés automatiquement.</p>
              <div className="overflow-y-auto flex-1 space-y-1 mb-4">
                <div className="grid grid-cols-3 gap-2 px-2 pb-2 text-xs font-medium text-brand-muted uppercase">
                  <span>Article</span><span>Stock système</span><span>Compté</span>
                </div>
                {allItems.map((item: any) => {
                  const counted = inventoryCounts[item.id] ?? String(item.currentQuantity)
                  const diff = parseFloat(counted) - item.currentQuantity
                  return (
                    <div key={item.id} className="grid grid-cols-3 gap-2 items-center px-2 py-2 rounded-xl hover:bg-white/3">
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-brand-muted">{item.unit}</p>
                      </div>
                      <p className="text-sm text-brand-muted">{formatQuantity(item.currentQuantity, item.unit)}</p>
                      <div className="flex items-center gap-2">
                        <input type="number" min="0"
                          value={inventoryCounts[item.id] ?? String(item.currentQuantity)}
                          onChange={e => setInventoryCounts(c => ({ ...c, [item.id]: e.target.value }))}
                          className="input-field py-1.5 text-sm w-24" />
                        {!isNaN(diff) && diff !== 0 && (
                          <span className={`text-xs font-medium ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-2 pt-2 border-t border-brand-border">
                <button onClick={() => setShowInventory(false)} className="btn-secondary flex-1">Annuler</button>
                <button onClick={submitInventory} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Valider l'inventaire
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Transfer modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {transferItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setTransferItem(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="glass-card p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-blue-400" /> Transfert d&apos;emplacement
                </h2>
                <button onClick={() => setTransferItem(null)} className="text-brand-muted hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div className="p-3 bg-white/3 rounded-xl text-sm">
                  <p className="font-medium">{transferItem.name}</p>
                  <p className="text-brand-muted mt-0.5">
                    Dépôt actuel : <strong>{(warehouses as any[]).find((w: any) => w.id === transferItem.warehouseId)?.name || '—'}</strong>
                    {' · '}Stock : <strong>{formatQuantity(transferItem.currentQuantity, transferItem.unit)}</strong>
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Dépôt destination *</label>
                  <select value={transferForm.toLocation}
                    onChange={e => setTransferForm(f => ({ ...f, toLocation: e.target.value }))}
                    className="input-field">
                    <option value="">— Choisir un dépôt —</option>
                    {(warehouses as any[]).filter((w: any) => w.id !== transferItem.warehouseId).map((w: any) => (
                      <option key={w.id} value={w.id}>{w.name}{w.description ? ` — ${w.description}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Quantité à transférer ({transferItem.unit})</label>
                  <input type="number" value={transferForm.quantity}
                    onChange={e => setTransferForm(f => ({ ...f, quantity: e.target.value }))}
                    placeholder="0" min="0" max={transferItem.currentQuantity} className="input-field" />
                  <p className="text-xs text-brand-muted mt-1">Max disponible : {formatQuantity(transferItem.currentQuantity, transferItem.unit)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Note (optionnel)</label>
                  <input value={transferForm.notes}
                    onChange={e => setTransferForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Raison du transfert..." className="input-field" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setTransferItem(null)} className="btn-secondary flex-1">Annuler</button>
                  <button
                    onClick={() => recordTransfer.mutate({ item: transferItem, ...transferForm })}
                    disabled={!transferForm.toLocation || !transferForm.quantity || recordTransfer.isPending}
                    className="btn-primary flex-1 disabled:opacity-50">
                    {recordTransfer.isPending ? 'Transfert...' : 'Confirmer le transfert'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create product from stock item modal */}
      <AnimatePresence>
        {createProductFrom && (
          <CreateProductFromStockModal
            stockItem={createProductFrom}
            onClose={() => setCreateProductFrom(null)}
          />
        )}
      </AnimatePresence>

      {/* Batch (FIFO) modal */}
      <AnimatePresence>
        {batchItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setBatchItem(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="glass-card p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-lg">Lots FIFO</h2>
                  <p className="text-xs text-brand-muted">{batchItem.name} — {formatQuantity(batchItem.currentQuantity, batchItem.unit)} en stock</p>
                </div>
                <button onClick={() => setBatchItem(null)} className="text-brand-muted hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              {!batchItemDetail ? (
                <p className="text-sm text-brand-muted text-center py-6">Chargement…</p>
              ) : !batchItemDetail.stockBatches?.length ? (
                <p className="text-sm text-brand-muted text-center py-6">Aucun lot enregistré. Les lots sont créés automatiquement lors des entrées de stock.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {batchItemDetail.stockBatches.map((batch: any, i: number) => {
                    const isExpired = batch.expiryDate && new Date(batch.expiryDate) < new Date()
                    const expiresSoon = batch.expiryDate && !isExpired &&
                      (new Date(batch.expiryDate).getTime() - Date.now()) < 7 * 86_400_000
                    return (
                      <div key={batch.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border ${isExpired ? 'border-red-500/40 bg-red-500/5' : expiresSoon ? 'border-amber-500/40 bg-amber-500/5' : 'border-brand-border bg-white/4'}`}>
                        <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-xs font-bold text-brand-muted flex-shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {formatQuantity(batch.remainingQty, batchItemDetail.unit)}
                            <span className="text-brand-muted text-xs"> / {formatQuantity(batch.quantity, batchItemDetail.unit)}</span>
                          </p>
                          <p className="text-xs text-brand-muted">
                            Reçu le {new Date(batch.receivedAt).toLocaleDateString('fr-FR')}
                            {batch.costPerUnit > 0 && ` · ${formatCurrency(batch.costPerUnit)}/${batchItemDetail.unit}`}
                          </p>
                          {batch.expiryDate && (
                            <p className={`text-xs font-medium mt-0.5 ${isExpired ? 'text-red-400' : expiresSoon ? 'text-amber-400' : 'text-green-400'}`}>
                              {isExpired ? '⚠️ Expiré' : expiresSoon ? '⏰ Expire bientôt'  : '✓ Valide'} — {new Date(batch.expiryDate).toLocaleDateString('fr-FR')}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-orange rounded-full"
                              style={{ width: `${Math.min(100, (batch.remainingQty / batch.quantity) * 100)}%` }} />
                          </div>
                          <p className="text-[10px] text-brand-muted mt-0.5">
                            {Math.round((batch.remainingQty / batch.quantity) * 100)}%
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <p className="text-[10px] text-brand-muted mt-3 text-center">Les lots sont consommés dans l'ordre FIFO (premier entré, premier sorti)</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

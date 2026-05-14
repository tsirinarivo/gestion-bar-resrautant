'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, Plus, Search, AlertTriangle, RefreshCw, ArrowDown, ArrowUp, X, Edit2, ClipboardList } from 'lucide-react'
import { api } from '@/lib/api'
import { formatQuantity, formatCurrency } from '@restaurant/utils'
import { toast } from 'sonner'

const STOCK_STATUS = {
  OK:             { label: 'OK',          color: '#10B981' },
  REORDER_NEEDED: { label: 'Réappro.',    color: '#F59E0B' },
  LOW_STOCK:      { label: 'Stock faible', color: '#EF4444' },
  OUT_OF_STOCK:   { label: 'Rupture',     color: '#7F1D1D' },
}

const UNITS = ['kg', 'g', 'L', 'cl', 'unité', 'bouteille', 'boîte', 'sachet', 'portion']

const emptyItem = {
  name: '', description: '', sku: '', unit: 'unité',
  currentQuantity: 0, minQuantity: 0, reorderQuantity: 0, maxQuantity: '',
  location: '', costPerUnit: 0, isPerishable: false,
}

export default function StockPage() {
  const [search, setSearch]             = useState('')
  const [filter, setFilter]             = useState('')
  // Movement modal
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [movementForm, setMovementForm] = useState({ type: 'IN', quantity: '', notes: '' })
  // New / edit item modal
  const [showItemModal, setShowItemModal] = useState(false)
  const [editItem, setEditItem]           = useState<any>(null)
  const [itemForm, setItemForm]           = useState<any>(emptyItem)
  // Inventory modal
  const [showInventory, setShowInventory] = useState(false)
  const [inventoryCounts, setInventoryCounts] = useState<Record<string, string>>({})

  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['stock', search],
    queryFn: () => api.get(`/stock?${search ? `search=${search}` : ''}`).then(r => r.data.data),
    refetchInterval: 30000,
  })

  const recordMovement = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.post(`/stock/${id}/movements`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock'] })
      setSelectedItem(null)
      setMovementForm({ type: 'IN', quantity: '', notes: '' })
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

  const items = (data || []).filter((item: any) => !filter || item.stockStatus === filter)
  const alerts = (data || []).filter((item: any) => ['LOW_STOCK', 'OUT_OF_STOCK'].includes(item.stockStatus))

  function openNewItem() {
    setEditItem(null)
    setItemForm(emptyItem)
    setShowItemModal(true)
  }

  function openEditItem(item: any) {
    setEditItem(item)
    setItemForm({
      name: item.name, description: item.description ?? '', sku: item.sku ?? '',
      unit: item.unit, currentQuantity: item.currentQuantity,
      minQuantity: item.minQuantity, reorderQuantity: item.reorderQuantity,
      maxQuantity: item.maxQuantity ?? '', location: item.location ?? '',
      costPerUnit: item.costPerUnit, isPerishable: item.isPerishable,
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
    }
    if (editItem) {
      updateItem.mutate({ id: editItem.id, data: payload })
    } else {
      createItem.mutate(payload)
    }
  }

  async function submitInventory() {
    const entries = Object.entries(inventoryCounts).filter(([, v]) => v !== '')
    if (entries.length === 0) { toast.error('Aucune quantité saisie'); return }
    let ok = 0
    for (const [id, val] of entries) {
      const item = (data || []).find((i: any) => i.id === id)
      if (!item) continue
      const counted = parseFloat(val)
      if (isNaN(counted)) continue
      const diff = counted - item.currentQuantity
      if (diff === 0) continue
      await api.post(`/stock/${id}/movements`, {
        type: 'ADJUSTMENT',
        quantity: Math.abs(diff),
        notes: `Inventaire physique — ajustement ${diff > 0 ? '+' : ''}${diff} ${item.unit}`,
      })
      ok++
    }
    qc.invalidateQueries({ queryKey: ['stock'] })
    setShowInventory(false)
    setInventoryCounts({})
    toast.success(`Inventaire enregistré — ${ok} article(s) ajusté(s)`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion des Stocks</h1>
          <p className="text-brand-muted text-sm">{(data || []).length} articles</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const counts: Record<string, string> = {}
              ;(data || []).forEach((i: any) => { counts[i.id] = String(i.currentQuantity) })
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

      {/* Alerts */}
      {alerts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="font-semibold text-red-400">{alerts.length} alerte{alerts.length > 1 ? 's' : ''} de stock</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {alerts.slice(0, 5).map((item: any) => (
              <span key={item.id} className="text-xs px-2 py-1 bg-red-500/20 text-red-300 rounded-lg">
                {item.name} : {formatQuantity(item.currentQuantity, item.unit)}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Filters */}
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
      </div>

      {/* Table */}
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
                return (
                  <tr key={item.id} className="border-b border-brand-border/30 hover:bg-white/2 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm">{item.name}</p>
                      {item.sku && <p className="text-xs text-brand-muted">{item.sku}</p>}
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
                    <td className="px-4 py-3 text-sm text-brand-muted">{item.location || '—'}</td>
                    <td className="px-4 py-3 text-sm font-medium">{formatCurrency(item.currentQuantity * item.costPerUnit)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => { setSelectedItem(item); setMovementForm({ type: 'IN', quantity: '', notes: '' }) }}
                          className="p-1.5 text-green-400 hover:bg-green-400/10 rounded-lg" title="Entrée">
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setSelectedItem(item); setMovementForm({ type: 'OUT', quantity: '', notes: '' }) }}
                          className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg" title="Sortie">
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEditItem(item)}
                          className="p-1.5 text-brand-muted hover:text-white hover:bg-white/10 rounded-lg" title="Modifier">
                          <Edit2 className="w-4 h-4" />
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
                <div className="flex gap-2">
                  <button onClick={() => setSelectedItem(null)} className="btn-secondary flex-1">Annuler</button>
                  <button
                    onClick={() => recordMovement.mutate({ id: selectedItem.id, data: { type: movementForm.type, quantity: parseFloat(movementForm.quantity), notes: movementForm.notes || undefined } })}
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
                    <label className="block text-sm font-medium mb-1">Emplacement</label>
                    <input value={itemForm.location} onChange={e => setItemForm((f: any) => ({ ...f, location: e.target.value }))}
                      placeholder="Chambre froide, Cave..." className="input-field" />
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
                {(data || []).map((item: any) => {
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
    </div>
  )
}

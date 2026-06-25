'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Warehouse, ArrowRightLeft, Plus, Edit2, Trash2, X,
  CheckCircle2, Truck, XCircle, Clock, Package, Eye,
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency } from '@restaurant/utils'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ─────────────────────────────────────────────────────────────────────

type WarehouseItem = {
  id: string
  name: string
  description?: string
  location?: string
  isDefault: boolean
  isActive: boolean
  stockCount?: number
  stockQuantity?: number
}

type StockItem = {
  id: string
  name: string
  unit: string
  quantity: number
}

type TransferItem = {
  stockItemId: string
  quantity: number
}

type Transfer = {
  id: string
  fromWarehouse: { id: string; name: string }
  toWarehouse: { id: string; name: string }
  status: 'PENDING' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED'
  items: { id: string; stockItem: { name: string }; quantity: number }[]
  notes?: string
  createdAt: string
}

type Meta = { page: number; perPage: number; total: number; totalPages: number }

// ─── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Transfer['status'] }) {
  const cfg = {
    PENDING:    { label: 'En attente',  cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
    IN_TRANSIT: { label: 'En transit',  cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    COMPLETED:  { label: 'Complété',    cls: 'bg-green-500/15 text-green-400 border-green-500/30' },
    CANCELLED:  { label: 'Annulé',      cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
  }[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ─── Warehouse Modal ───────────────────────────────────────────────────────────

function WarehouseModal({
  warehouse,
  onClose,
  onSave,
}: {
  warehouse: WarehouseItem | null
  onClose: () => void
  onSave: (data: any) => void
}) {
  const [form, setForm] = useState({
    name: warehouse?.name ?? '',
    description: warehouse?.description ?? '',
    location: warehouse?.location ?? '',
    isDefault: warehouse?.isDefault ?? false,
    isActive: warehouse?.isActive ?? true,
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Le nom est requis'); return }
    onSave(form)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-brand-card border border-brand-border rounded-2xl shadow-xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-brand-border">
          <h2 className="font-bold text-lg">{warehouse ? 'Modifier l\'entrepôt' : 'Nouvel entrepôt'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs text-brand-muted mb-1 block">Nom *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input-field"
              placeholder="Ex: Entrepôt principal"
              required
            />
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1 block">Description</label>
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="input-field"
              placeholder="Description optionnelle"
            />
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1 block">Localisation</label>
            <input
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              className="input-field"
              placeholder="Ex: Bâtiment A, Rez-de-chaussée"
            />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
                className="w-4 h-4 accent-brand-orange"
              />
              <span className="text-sm">Entrepôt par défaut</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                className="w-4 h-4 accent-brand-orange"
              />
              <span className="text-sm">Actif</span>
            </label>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Annuler</button>
            <button type="submit" className="flex-1 btn-primary">
              {warehouse ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Transfer Modal ────────────────────────────────────────────────────────────

function TransferModal({
  warehouses,
  onClose,
  onSave,
}: {
  warehouses: WarehouseItem[]
  onClose: () => void
  onSave: (data: any) => void
}) {
  const [fromWarehouseId, setFromWarehouseId] = useState(warehouses[0]?.id ?? '')
  const [toWarehouseId, setToWarehouseId] = useState(warehouses[1]?.id ?? '')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<TransferItem[]>([{ stockItemId: '', quantity: 1 }])

  const { data: sourceStock = [] } = useQuery<StockItem[]>({
    queryKey: ['warehouse-stock', fromWarehouseId],
    queryFn: () => api.get(`/warehouses/${fromWarehouseId}/stock`).then(r => r.data.data),
    enabled: !!fromWarehouseId,
  })

  function addItem() {
    setItems(prev => [...prev, { stockItemId: '', quantity: 1 }])
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof TransferItem, value: string | number) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fromWarehouseId || !toWarehouseId) { toast.error('Sélectionnez les entrepôts'); return }
    if (fromWarehouseId === toWarehouseId) { toast.error('Les entrepôts doivent être différents'); return }
    const validItems = items.filter(it => it.stockItemId && it.quantity > 0)
    if (validItems.length === 0) { toast.error('Ajoutez au moins un article'); return }
    onSave({ fromWarehouseId, toWarehouseId, notes, items: validItems })
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-brand-card border border-brand-border rounded-2xl shadow-xl max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-5 border-b border-brand-border flex-shrink-0">
          <h2 className="font-bold text-lg">Nouveau transfert</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-brand-muted mb-1 block">De (source) *</label>
              <select
                value={fromWarehouseId}
                onChange={e => { setFromWarehouseId(e.target.value); setItems([{ stockItemId: '', quantity: 1 }]) }}
                className="input-field"
                required
              >
                <option value="">— Sélectionner —</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-brand-muted mb-1 block">Vers (destination) *</label>
              <select
                value={toWarehouseId}
                onChange={e => setToWarehouseId(e.target.value)}
                className="input-field"
                required
              >
                <option value="">— Sélectionner —</option>
                {warehouses.filter(w => w.id !== fromWarehouseId).map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-brand-muted mb-1 block">Notes</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="input-field"
              placeholder="Remarques optionnelles"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-brand-muted uppercase tracking-wide">Articles à transférer</label>
              <button type="button" onClick={addItem}
                className="text-xs text-brand-orange hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Ajouter un article
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    value={item.stockItemId}
                    onChange={e => updateItem(idx, 'stockItemId', e.target.value)}
                    className="input-field flex-1 text-sm"
                  >
                    <option value="">— Article —</option>
                    {sourceStock.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.quantity} {s.unit})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value))}
                    className="input-field w-24 text-sm"
                    placeholder="Qté"
                  />
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)}
                      className="p-1.5 text-brand-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Annuler</button>
            <button type="submit" className="flex-1 btn-primary">Créer le transfert</button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function WarehousesPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'warehouses' | 'transfers'>('warehouses')
  const [warehouseModal, setWarehouseModal] = useState<{ open: boolean; warehouse: WarehouseItem | null }>({
    open: false, warehouse: null,
  })
  const [transferModal, setTransferModal] = useState(false)
  const [transferPage, setTransferPage] = useState(1)
  const [detailWarehouse, setDetailWarehouse] = useState<WarehouseItem | null>(null)

  // ── Warehouses ──
  const { data: warehouses = [], isLoading: loadingWarehouses } = useQuery<WarehouseItem[]>({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then(r => r.data.data),
  })

  const createWarehouse = useMutation({
    mutationFn: (d: any) => api.post('/warehouses', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Entrepôt créé')
      setWarehouseModal({ open: false, warehouse: null })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  const updateWarehouse = useMutation({
    mutationFn: ({ id, d }: { id: string; d: any }) => api.put(`/warehouses/${id}`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Entrepôt mis à jour')
      setWarehouseModal({ open: false, warehouse: null })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  const deleteWarehouse = useMutation({
    mutationFn: (id: string) => api.delete(`/warehouses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Entrepôt supprimé')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  // ── Transfers ──
  const { data: transfersRes, isLoading: loadingTransfers } = useQuery<{ data: Transfer[]; meta: Meta }>({
    queryKey: ['transfers', transferPage],
    queryFn: () =>
      api.get(`/warehouses/transfers?page=${transferPage}&perPage=10`).then(r => r.data),
    placeholderData: prev => prev,
  })

  const transfers = transfersRes?.data ?? []
  const transferMeta = transfersRes?.meta

  const createTransfer = useMutation({
    mutationFn: (d: any) => api.post('/warehouses/transfers', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers'] })
      toast.success('Transfert créé')
      setTransferModal(false)
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  const confirmTransfer = useMutation({
    mutationFn: (id: string) => api.post(`/warehouses/transfers/${id}/confirm`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transfers'] }); toast.success('Transfert confirmé') },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  const completeTransfer = useMutation({
    mutationFn: (id: string) => api.post(`/warehouses/transfers/${id}/complete`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transfers'] }); toast.success('Transfert complété') },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  const cancelTransfer = useMutation({
    mutationFn: (id: string) => api.post(`/warehouses/transfers/${id}/cancel`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transfers'] }); toast.success('Transfert annulé') },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  function handleWarehouseSave(data: any) {
    if (warehouseModal.warehouse) {
      updateWarehouse.mutate({ id: warehouseModal.warehouse.id, d: data })
    } else {
      createWarehouse.mutate(data)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Entrepôts</h1>
          <p className="text-brand-muted text-sm">Gestion des entrepôts et transferts de stock</p>
        </div>
        <div className="flex gap-2">
          {tab === 'warehouses' && (
            <button
              onClick={() => setWarehouseModal({ open: true, warehouse: null })}
              className="btn-primary flex items-center gap-1.5 text-sm"
            >
              <Plus className="w-4 h-4" /> Nouvel entrepôt
            </button>
          )}
          {tab === 'transfers' && (
            <button
              onClick={() => setTransferModal(true)}
              className="btn-primary flex items-center gap-1.5 text-sm"
              disabled={warehouses.length < 2}
            >
              <Plus className="w-4 h-4" /> Nouveau transfert
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-brand-border">
        {([['warehouses', 'Entrepôts', Warehouse], ['transfers', 'Transferts', ArrowRightLeft]] as const).map(
          ([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === key
                  ? 'border-brand-orange text-brand-orange'
                  : 'border-transparent text-brand-muted hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          )
        )}
      </div>

      {/* ── Entrepôts Tab ── */}
      {tab === 'warehouses' && (
        <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
          {loadingWarehouses ? (
            <div className="p-8 text-center text-brand-muted">Chargement…</div>
          ) : warehouses.length === 0 ? (
            <div className="p-12 text-center">
              <Warehouse className="w-12 h-12 text-brand-muted mx-auto mb-3 opacity-50" />
              <p className="text-brand-muted">Aucun entrepôt. Créez-en un pour commencer.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-border text-xs text-brand-muted">
                    <th className="px-4 py-3 text-left">Nom</th>
                    <th className="px-4 py-3 text-left">Localisation</th>
                    <th className="px-4 py-3 text-center">Stock</th>
                    <th className="px-4 py-3 text-center">Statut</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouses.map(w => (
                    <tr key={w.id} className="border-b border-brand-border/30 hover:bg-white/2 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setDetailWarehouse(w)} className="font-medium hover:text-brand-orange transition-colors text-left">{w.name}</button>
                          {w.isDefault && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border bg-brand-orange/15 text-brand-orange border-brand-orange/30">
                              Défaut
                            </span>
                          )}
                        </div>
                        {w.description && (
                          <p className="text-xs text-brand-muted mt-0.5">{w.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-brand-muted">{w.location ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => setDetailWarehouse(w)}
                          className="inline-flex items-center gap-1 text-brand-muted hover:text-brand-orange transition-colors">
                          <Package className="w-3.5 h-3.5" />
                          <span>{w.stockCount ?? 0} {(w.stockCount ?? 0) > 1 ? 'articles' : 'article'}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${
                          w.isActive
                            ? 'bg-green-500/15 text-green-400 border-green-500/30'
                            : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                        }`}>
                          {w.isActive ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setDetailWarehouse(w)}
                            className="p-1.5 text-brand-muted hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="Voir le stock et l'historique"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setWarehouseModal({ open: true, warehouse: w })}
                            className="p-1.5 text-brand-muted hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Supprimer l'entrepôt "${w.name}" ?`)) deleteWarehouse.mutate(w.id)
                            }}
                            className="p-1.5 text-brand-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Transferts Tab ── */}
      {tab === 'transfers' && (
        <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
          {loadingTransfers ? (
            <div className="p-8 text-center text-brand-muted">Chargement…</div>
          ) : transfers.length === 0 ? (
            <div className="p-12 text-center">
              <ArrowRightLeft className="w-12 h-12 text-brand-muted mx-auto mb-3 opacity-50" />
              <p className="text-brand-muted">Aucun transfert enregistré.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-border text-xs text-brand-muted">
                      <th className="px-4 py-3 text-left">De → Vers</th>
                      <th className="px-4 py-3 text-center">Articles</th>
                      <th className="px-4 py-3 text-center">Statut</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.map(t => (
                      <tr key={t.id} className="border-b border-brand-border/30 hover:bg-white/2 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 font-medium">
                            <span>{t.fromWarehouse.name}</span>
                            <ArrowRightLeft className="w-3.5 h-3.5 text-brand-muted flex-shrink-0" />
                            <span>{t.toWarehouse.name}</span>
                          </div>
                          {t.notes && <p className="text-xs text-brand-muted mt-0.5">{t.notes}</p>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1">
                            <Package className="w-3.5 h-3.5 text-brand-muted" />
                            {t.items.length}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={t.status} />
                        </td>
                        <td className="px-4 py-3 text-brand-muted text-xs">
                          {new Date(t.createdAt).toLocaleDateString('fr-FR', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {t.status === 'PENDING' && (
                              <button
                                onClick={() => confirmTransfer.mutate(t.id)}
                                title="Confirmer (→ En transit)"
                                className="p-1.5 text-brand-muted hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                              >
                                <Truck className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {t.status === 'IN_TRANSIT' && (
                              <button
                                onClick={() => completeTransfer.mutate(t.id)}
                                title="Marquer comme complété"
                                className="p-1.5 text-brand-muted hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {(t.status === 'PENDING' || t.status === 'IN_TRANSIT') && (
                              <button
                                onClick={() => {
                                  if (confirm('Annuler ce transfert ?')) cancelTransfer.mutate(t.id)
                                }}
                                title="Annuler"
                                className="p-1.5 text-brand-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {(t.status === 'COMPLETED' || t.status === 'CANCELLED') && (
                              <span className="text-xs text-brand-muted px-2">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {transferMeta && transferMeta.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-brand-border">
                  <span className="text-xs text-brand-muted">
                    {((transferMeta.page - 1) * transferMeta.perPage) + 1}–
                    {Math.min(transferMeta.page * transferMeta.perPage, transferMeta.total)} sur {transferMeta.total}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setTransferPage(p => Math.max(1, p - 1))}
                      disabled={transferPage === 1}
                      className="p-1.5 rounded-lg border border-brand-border text-brand-muted hover:text-white disabled:opacity-40 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setTransferPage(p => Math.min(transferMeta.totalPages, p + 1))}
                      disabled={transferPage === transferMeta.totalPages}
                      className="p-1.5 rounded-lg border border-brand-border text-brand-muted hover:text-white disabled:opacity-40 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {warehouseModal.open && (
          <WarehouseModal
            warehouse={warehouseModal.warehouse}
            onClose={() => setWarehouseModal({ open: false, warehouse: null })}
            onSave={handleWarehouseSave}
          />
        )}
        {transferModal && (
          <TransferModal
            warehouses={warehouses}
            onClose={() => setTransferModal(false)}
            onSave={d => createTransfer.mutate(d)}
          />
        )}
        {detailWarehouse && (
          <WarehouseDetailModal
            warehouse={detailWarehouse}
            onClose={() => setDetailWarehouse(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

const MOVEMENT_META: Record<string, { label: string; cls: string }> = {
  IN: { label: 'Entrée', cls: 'text-green-400 bg-green-500/10' },
  OUT: { label: 'Sortie', cls: 'text-red-400 bg-red-500/10' },
  ADJUSTMENT: { label: 'Ajust.', cls: 'text-blue-400 bg-blue-500/10' },
  LOSS: { label: 'Perte', cls: 'text-amber-400 bg-amber-500/10' },
  TRANSFER: { label: 'Transfert', cls: 'text-purple-400 bg-purple-500/10' },
}

function WarehouseDetailModal({ warehouse, onClose }: { warehouse: WarehouseItem; onClose: () => void }) {
  const [view, setView] = useState<'stock' | 'history'>('stock')

  const { data: stock = [], isLoading: loadingStock } = useQuery<any[]>({
    queryKey: ['warehouse-detail-stock', warehouse.id],
    queryFn: () => api.get(`/warehouses/${warehouse.id}/stock`).then(r => r.data.data ?? []),
  })
  const { data: movements = [], isLoading: loadingMov } = useQuery<any[]>({
    queryKey: ['warehouse-detail-movements', warehouse.id],
    queryFn: () => api.get(`/warehouses/${warehouse.id}/movements`).then(r => r.data.data ?? []),
  })

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-brand-card border border-brand-border rounded-2xl shadow-xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-brand-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-brand-orange" />
            <h2 className="font-bold text-lg">{warehouse.name}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex gap-1 px-5 pt-4 flex-shrink-0">
          {([['stock', 'Articles en stock'], ['history', 'Historique des mouvements']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${view === k ? 'bg-brand-orange text-white' : 'text-brand-muted hover:text-white'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          {view === 'stock' && (
            loadingStock ? <p className="text-brand-muted text-sm text-center py-6">Chargement…</p>
            : stock.length === 0 ? <p className="text-brand-muted text-sm text-center py-6">Aucun article en stock dans cet entrepôt.</p>
            : (
              <div className="space-y-1">
                {stock.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/3">
                    <span className="text-sm font-medium">{s.name}</span>
                    <span className={`text-sm font-semibold ${s.quantity <= 0 ? 'text-red-400' : 'text-white'}`}>{s.quantity} {s.unit}</span>
                  </div>
                ))}
              </div>
            )
          )}
          {view === 'history' && (
            loadingMov ? <p className="text-brand-muted text-sm text-center py-6">Chargement…</p>
            : movements.length === 0 ? <p className="text-brand-muted text-sm text-center py-6">Aucun mouvement enregistré dans cet entrepôt.</p>
            : (
              <div className="space-y-1.5">
                {movements.map((m: any) => {
                  const meta = MOVEMENT_META[m.type] ?? { label: m.type, cls: 'text-brand-muted bg-white/5' }
                  return (
                    <div key={m.id} className="flex items-center gap-3 text-sm px-3 py-2 rounded-xl hover:bg-white/3">
                      <span className={`text-xs px-2 py-0.5 rounded-lg font-medium flex-shrink-0 ${meta.cls}`}>{meta.label}</span>
                      <span className="font-medium truncate">{m.stockItem?.name ?? '—'}</span>
                      <span className={`flex items-center gap-0.5 flex-shrink-0 ${m.quantity < 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {m.quantity < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                        {Math.abs(m.quantity)} {m.stockItem?.unit}
                      </span>
                      <span className="ml-auto text-xs text-brand-muted flex-shrink-0">
                        {new Date(m.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>
      </motion.div>
    </div>
  )
}

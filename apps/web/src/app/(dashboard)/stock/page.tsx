'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, Plus, Search, AlertTriangle, TrendingDown, RefreshCw, ArrowDown, ArrowUp } from 'lucide-react'
import { api } from '@/lib/api'
import { formatQuantity, formatCurrency } from '@restaurant/utils'
import { toast } from 'sonner'

const STOCK_STATUS = {
  OK: { label: 'OK', color: '#10B981' },
  REORDER_NEEDED: { label: 'Réappro.', color: '#F59E0B' },
  LOW_STOCK: { label: 'Stock faible', color: '#EF4444' },
  OUT_OF_STOCK: { label: 'Rupture', color: '#7F1D1D' },
}

export default function StockPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [movementForm, setMovementForm] = useState({ type: 'IN', quantity: '', notes: '' })
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['stock', search],
    queryFn: () => api.get(`/stock?${search ? `search=${search}` : ''}`).then(r => r.data.data),
    refetchInterval: 30000,
  })

  const recordMovement = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.post(`/stock/${id}/movements`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock'] })
      setSelectedItem(null)
      setMovementForm({ type: 'IN', quantity: '', notes: '' })
      toast.success('Mouvement enregistré')
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement'),
  })

  const items = (data || []).filter((item: any) => {
    if (!filter) return true
    return item.stockStatus === filter
  })

  const alerts = (data || []).filter((item: any) => ['LOW_STOCK', 'OUT_OF_STOCK'].includes(item.stockStatus))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion des Stocks</h1>
          <p className="text-brand-muted text-sm">{(data || []).length} articles</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Inventaire
          </button>
          <button className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nouvel article
          </button>
        </div>
      </div>

      {/* Alerts banner */}
      {alerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 border-red-500/30 bg-red-500/5"
        >
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="font-semibold text-red-400">{alerts.length} alerte{alerts.length > 1 ? 's' : ''} de stock</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {alerts.slice(0, 5).map((item: any) => (
              <span key={item.id} className="text-xs px-2 py-1 bg-red-500/20 text-red-300 rounded-lg">
                {item.name}: {formatQuantity(item.currentQuantity, item.unit)}
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
          <button key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-2 rounded-xl text-sm border transition-all ${
              filter === s ? 'bg-brand-orange text-white border-brand-orange' : 'border-brand-border text-brand-muted'
            }`}>
            {s ? STOCK_STATUS[s as keyof typeof STOCK_STATUS].label : 'Tous'}
          </button>
        ))}
      </div>

      {/* Stock table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-brand-border text-left">
                <th className="px-4 py-3 text-xs font-medium text-brand-muted uppercase">Article</th>
                <th className="px-4 py-3 text-xs font-medium text-brand-muted uppercase">Quantité</th>
                <th className="px-4 py-3 text-xs font-medium text-brand-muted uppercase">Seuil min.</th>
                <th className="px-4 py-3 text-xs font-medium text-brand-muted uppercase">Statut</th>
                <th className="px-4 py-3 text-xs font-medium text-brand-muted uppercase">Emplacement</th>
                <th className="px-4 py-3 text-xs font-medium text-brand-muted uppercase">Valeur</th>
                <th className="px-4 py-3 text-xs font-medium text-brand-muted uppercase">Actions</th>
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
              ) : (
                items.map((item: any) => {
                  const statusConf = STOCK_STATUS[item.stockStatus as keyof typeof STOCK_STATUS]
                  const pct = item.minQuantity > 0
                    ? Math.min(100, (item.currentQuantity / (item.maxQuantity || item.minQuantity * 3)) * 100)
                    : 100

                  return (
                    <tr key={item.id} className="border-b border-brand-border/30 hover:bg-white/2 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-sm">{item.name}</p>
                          {item.sku && <p className="text-xs text-brand-muted">{item.sku}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold" style={{ color: statusConf.color }}>
                            {formatQuantity(item.currentQuantity, item.unit)}
                          </p>
                          <div className="w-24 h-1.5 bg-brand-border rounded-full mt-1">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: statusConf.color }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-brand-muted">
                        {formatQuantity(item.minQuantity, item.unit)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `${statusConf.color}20`, color: statusConf.color }}>
                          {statusConf.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-brand-muted">
                        {item.location || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {formatCurrency(item.currentQuantity * item.costPerUnit)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => setSelectedItem(item)}
                            className="p-1.5 text-green-400 hover:bg-green-400/10 rounded-lg transition-colors"
                            title="Entrée stock"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setSelectedItem(item); setMovementForm(f => ({ ...f, type: 'OUT' })) }}
                            className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                            title="Sortie stock"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movement modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedItem(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card p-6 w-full max-w-md"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="font-bold text-lg mb-2">Mouvement de stock</h2>
              <p className="text-brand-muted text-sm mb-4">{selectedItem.name}</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['IN', 'OUT', 'ADJUSTMENT', 'LOSS'].map(t => (
                      <button key={t}
                        onClick={() => setMovementForm(f => ({ ...f, type: t }))}
                        className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                          movementForm.type === t ? 'bg-brand-orange border-brand-orange text-white' : 'border-brand-border text-brand-muted'
                        }`}>
                        {t === 'IN' ? 'Entrée' : t === 'OUT' ? 'Sortie' : t === 'ADJUSTMENT' ? 'Ajust.' : 'Perte'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Quantité ({selectedItem.unit})
                  </label>
                  <input
                    type="number"
                    value={movementForm.quantity}
                    onChange={e => setMovementForm(f => ({ ...f, quantity: e.target.value }))}
                    placeholder="0"
                    min="0"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Note (optionnel)</label>
                  <input
                    value={movementForm.notes}
                    onChange={e => setMovementForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Raison du mouvement..."
                    className="input-field"
                  />
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setSelectedItem(null)} className="btn-secondary flex-1">
                    Annuler
                  </button>
                  <button
                    onClick={() => recordMovement.mutate({
                      id: selectedItem.id,
                      data: { type: movementForm.type, quantity: parseFloat(movementForm.quantity), notes: movementForm.notes },
                    })}
                    disabled={!movementForm.quantity || recordMovement.isPending}
                    className="btn-primary flex-1"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

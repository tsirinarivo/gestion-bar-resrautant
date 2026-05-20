'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Edit2, Trash2, ShoppingCart, Package,
  Phone, Mail, MapPin, Truck, FileText, ChevronRight,
  CheckCircle, Clock, Send, Ban, ArrowLeft, Search
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@restaurant/utils'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

type Supplier = {
  id: string; name: string; contactName?: string; email?: string; phone?: string
  address?: string; city?: string; country: string; notes?: string
  paymentTerms?: string; deliveryDays: string[]; leadTimeDays: number; isActive: boolean
  _count?: { stockItems: number; purchaseOrders: number }
}

type StockItem = { id: string; name: string; unit: string; currentQuantity: number; costPerUnit: number }

type POItem = {
  id: string; quantity: number; unitCost: number; receivedQuantity: number; notes?: string
  stockItem: { name: string; unit: string }
}

type PurchaseOrder = {
  id: string; orderNumber: string; status: string; totalAmount: number
  notes?: string; orderedAt?: string; expectedAt?: string; receivedAt?: string
  createdAt: string
  supplier: { id: string; name: string }
  items: POItem[]
}

const DAY_LABELS: Record<string, string> = {
  monday: 'Lun', tuesday: 'Mar', wednesday: 'Mer',
  thursday: 'Jeu', friday: 'Ven', saturday: 'Sam', sunday: 'Dim',
}
const ALL_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const PO_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT:     { label: 'Brouillon',  color: 'text-brand-muted border-brand-border',   icon: FileText },
  SENT:      { label: 'Envoyé',     color: 'text-blue-400 border-blue-500/30',        icon: Send },
  CONFIRMED: { label: 'Confirmé',   color: 'text-yellow-400 border-yellow-500/30',    icon: Clock },
  RECEIVED:  { label: 'Reçu',       color: 'text-green-400 border-green-500/30',      icon: CheckCircle },
  CANCELLED: { label: 'Annulé',     color: 'text-red-400 border-red-500/30',          icon: Ban },
}

// ─── Supplier Form Modal ──────────────────────────────────────────────────────

function SupplierModal({ supplier, onClose, onSave }: {
  supplier: Supplier | null; onClose: () => void; onSave: (d: any) => void
}) {
  const [form, setForm] = useState({
    name: supplier?.name ?? '',
    contactName: supplier?.contactName ?? '',
    email: supplier?.email ?? '',
    phone: supplier?.phone ?? '',
    address: supplier?.address ?? '',
    city: supplier?.city ?? '',
    notes: supplier?.notes ?? '',
    paymentTerms: supplier?.paymentTerms ?? '',
    leadTimeDays: supplier?.leadTimeDays?.toString() ?? '2',
    deliveryDays: supplier?.deliveryDays ?? [] as string[],
    isActive: supplier?.isActive ?? true,
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Nom requis'); return }
    onSave({
      name: form.name.trim(),
      contactName: form.contactName.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      notes: form.notes.trim() || undefined,
      paymentTerms: form.paymentTerms.trim() || undefined,
      leadTimeDays: parseInt(form.leadTimeDays) || 2,
      deliveryDays: form.deliveryDays,
      isActive: form.isActive,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-brand-border">
          <h2 className="text-xl font-bold">{supplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm text-brand-muted mb-1 block">Nom *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input-field" placeholder="Ex: Marché d'Analakely" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-brand-muted mb-1 block">Contact</label>
              <input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                className="input-field" placeholder="Nom du contact" />
            </div>
            <div>
              <label className="text-sm text-brand-muted mb-1 block">Téléphone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="input-field" placeholder="+261 34..." />
            </div>
          </div>
          <div>
            <label className="text-sm text-brand-muted mb-1 block">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="input-field" placeholder="contact@fournisseur.mg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-brand-muted mb-1 block">Adresse</label>
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                className="input-field" placeholder="Rue, quartier" />
            </div>
            <div>
              <label className="text-sm text-brand-muted mb-1 block">Ville</label>
              <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                className="input-field" placeholder="Antananarivo" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-brand-muted mb-1 block">Délai livraison (jours)</label>
              <input type="number" value={form.leadTimeDays} onChange={e => setForm(f => ({ ...f, leadTimeDays: e.target.value }))}
                className="input-field" min="0" />
            </div>
            <div>
              <label className="text-sm text-brand-muted mb-1 block">Conditions paiement</label>
              <input value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))}
                className="input-field" placeholder="Ex: 30 jours" />
            </div>
          </div>
          <div>
            <label className="text-sm text-brand-muted mb-2 block">Jours de livraison</label>
            <div className="flex flex-wrap gap-2">
              {ALL_DAYS.map(d => (
                <button key={d} type="button"
                  onClick={() => setForm(f => ({
                    ...f,
                    deliveryDays: f.deliveryDays.includes(d) ? f.deliveryDays.filter(x => x !== d) : [...f.deliveryDays, d]
                  }))}
                  className={`px-3 py-1.5 rounded-xl text-sm border transition-all ${
                    form.deliveryDays.includes(d) ? 'bg-brand-orange/20 border-brand-orange text-white' : 'border-brand-border text-brand-muted'
                  }`}>
                  {DAY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-brand-muted mb-1 block">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="input-field resize-none" rows={2} placeholder="Conditions particulières, remarques..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Annuler</button>
            <button type="submit" className="flex-1 btn-primary">{supplier ? 'Enregistrer' : 'Créer'}</button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Purchase Order Modal ─────────────────────────────────────────────────────

function POModal({ suppliers, editOrder, initialSupplierId, onClose, onCreated }: {
  suppliers: Supplier[]
  editOrder: PurchaseOrder | null
  initialSupplierId?: string
  onClose: () => void
  onCreated?: (order: PurchaseOrder) => void
}) {
  const qc = useQueryClient()
  const [supplierId, setSupplierId] = useState(
    editOrder?.supplier.id ?? initialSupplierId ?? suppliers[0]?.id ?? ''
  )
  const [notes, setNotes] = useState(editOrder?.notes ?? '')
  const [expectedAt, setExpectedAt] = useState(
    editOrder?.expectedAt ? editOrder.expectedAt.slice(0, 10) : ''
  )
  const [lines, setLines] = useState<{ stockItemId: string; name: string; unit: string; quantity: number; unitCost: number }[]>(
    editOrder?.items.map(i => ({
      stockItemId: '',
      name: i.stockItem.name,
      unit: i.stockItem.unit,
      quantity: i.quantity,
      unitCost: i.unitCost,
    })) ?? []
  )
  const [search, setSearch] = useState('')

  const { data: stockItems = [] } = useQuery<StockItem[]>({
    queryKey: ['stock-items-simple'],
    queryFn: () => api.get('/stock').then(r => r.data.data),
  })

  const createPO = useMutation({
    mutationFn: (data: any) => api.post('/suppliers/purchase-orders', data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Bon de commande créé')
      onCreated?.(res.data.data)
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Erreur'),
  })

  const filteredStock = stockItems.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) &&
    !lines.find(l => l.stockItemId === s.id)
  )

  function addLine(item: StockItem) {
    setLines(l => [...l, { stockItemId: item.id, name: item.name, unit: item.unit, quantity: 1, unitCost: item.costPerUnit }])
    setSearch('')
  }

  const total = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierId) { toast.error('Sélectionnez un fournisseur'); return }
    if (lines.length === 0) { toast.error('Ajoutez au moins un article'); return }
    createPO.mutate({ supplierId, notes, expectedAt: expectedAt || undefined, items: lines })
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-brand-border">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-brand-orange" />
            {editOrder ? `Modifier ${editOrder.orderNumber}` : 'Nouveau bon de commande'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-brand-muted mb-1 block">Fournisseur *</label>
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="input-field">
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-brand-muted mb-1 block">Livraison prévue</label>
              <input type="date" value={expectedAt} onChange={e => setExpectedAt(e.target.value)} className="input-field" />
            </div>
          </div>

          {/* Search stock items */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="input-field pl-10" placeholder="Ajouter un article du stock..." />
            {search && filteredStock.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 glass-card border border-brand-border rounded-xl overflow-hidden z-10 max-h-40 overflow-y-auto">
                {filteredStock.map(item => (
                  <button key={item.id} type="button" onClick={() => addLine(item)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 text-left text-sm">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-brand-muted text-xs">{formatCurrency(item.costPerUnit)}/{item.unit}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lines */}
          {lines.length > 0 && (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs text-brand-muted px-1">
                <span className="col-span-5">Article</span>
                <span className="col-span-2">Qté</span>
                <span className="col-span-2">Prix unit. (Ar)</span>
                <span className="col-span-2 text-right">Total</span>
                <span className="col-span-1"></span>
              </div>
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white/3 rounded-xl p-2">
                  <div className="col-span-5">
                    <p className="text-sm font-medium truncate">{line.name}</p>
                    <p className="text-xs text-brand-muted">{line.unit}</p>
                  </div>
                  <div className="col-span-2">
                    <input type="number" value={line.quantity} min="0.01" step="0.01"
                      onChange={e => setLines(l => l.map((r, i) => i === idx ? { ...r, quantity: parseFloat(e.target.value) || 0 } : r))}
                      className="input-field py-1 text-sm text-center" />
                  </div>
                  <div className="col-span-2">
                    <input type="number" value={line.unitCost} min="0"
                      onChange={e => setLines(l => l.map((r, i) => i === idx ? { ...r, unitCost: parseFloat(e.target.value) || 0 } : r))}
                      className="input-field py-1 text-sm text-center" />
                  </div>
                  <div className="col-span-2 text-xs text-right font-medium">
                    {formatCurrency(line.quantity * line.unitCost)}
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button type="button" onClick={() => setLines(l => l.filter((_, i) => i !== idx))}
                      className="p-1 text-red-400 hover:bg-red-500/20 rounded-lg">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex justify-end pt-1">
                <span className="text-sm font-bold">Total : {formatCurrency(total)}</span>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm text-brand-muted mb-1 block">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              className="input-field resize-none" rows={2} placeholder="Instructions de livraison, remarques..." />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Annuler</button>
            <button type="submit" disabled={createPO.isPending} className="flex-1 btn-primary disabled:opacity-50">
              {createPO.isPending ? 'Création...' : 'Créer le bon'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Purchase Order Detail ────────────────────────────────────────────────────

function PODetail({ order, onBack, onStatusChange }: {
  order: PurchaseOrder; onBack: () => void; onStatusChange: (updated: PurchaseOrder) => void
}) {
  const qc = useQueryClient()
  const st = PO_STATUS[order.status]!

  const changeStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/suppliers/purchase-orders/${order.id}/status`, { status }),
    onSuccess: (res) => {
      const updated = res.data.data
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      onStatusChange(updated)
      toast.success('Statut mis à jour')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Erreur'),
  })

  const deleteOrder = useMutation({
    mutationFn: () => api.delete(`/suppliers/purchase-orders/${order.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Bon de commande supprimé')
      onBack()
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Erreur'),
  })

  const NEXT_ACTIONS: Record<string, { label: string; status: string; color: string }[]> = {
    DRAFT: [
      { label: 'Envoyer au fournisseur', status: 'SENT', color: 'btn-primary' },
      { label: 'Annuler', status: 'CANCELLED', color: 'btn-secondary' },
    ],
    SENT: [
      { label: 'Confirmer réception commande', status: 'CONFIRMED', color: 'btn-primary' },
      { label: 'Annuler', status: 'CANCELLED', color: 'btn-secondary' },
    ],
    CONFIRMED: [
      { label: '✅ Marquer comme Reçu (met à jour le stock)', status: 'RECEIVED', color: 'btn-primary' },
    ],
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold">{order.orderNumber}</h2>
          <p className="text-brand-muted text-sm">{order.supplier.name} · créé le {formatDate(order.createdAt)}</p>
        </div>
        <span className={`px-3 py-1.5 rounded-xl text-sm border font-medium flex items-center gap-2 ${st.color}`}>
          <st.icon className="w-4 h-4" /> {st.label}
        </span>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-brand-border grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-brand-muted">Articles</p>
            <p className="font-bold text-lg">{order.items.length}</p>
          </div>
          <div>
            <p className="text-xs text-brand-muted">Montant total</p>
            <p className="font-bold text-lg text-brand-orange">{formatCurrency(order.totalAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-brand-muted">Livraison prévue</p>
            <p className="font-bold text-sm">{order.expectedAt ? formatDate(order.expectedAt) : '—'}</p>
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr className="text-xs text-brand-muted border-b border-brand-border">
              <th className="text-left px-4 py-3">Article</th>
              <th className="text-right px-4 py-3">Qté commandée</th>
              <th className="text-right px-4 py-3">Prix unitaire</th>
              <th className="text-right px-4 py-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, idx) => (
              <tr key={idx} className="border-b border-brand-border/50 text-sm">
                <td className="px-4 py-3">
                  <p className="font-medium">{item.stockItem.name}</p>
                  {item.notes && <p className="text-xs text-brand-muted">{item.notes}</p>}
                </td>
                <td className="px-4 py-3 text-right">{item.quantity} {item.stockItem.unit}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(item.unitCost)}</td>
                <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.quantity * item.unitCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {order.notes && (
        <div className="glass-card p-4">
          <p className="text-sm text-brand-muted mb-1">Notes</p>
          <p className="text-sm">{order.notes}</p>
        </div>
      )}

      {/* Actions */}
      {NEXT_ACTIONS[order.status] && (
        <div className="flex flex-wrap gap-3">
          {(NEXT_ACTIONS[order.status] ?? []).map(action => (
            <button key={action.status}
              onClick={() => changeStatus.mutate(action.status)}
              disabled={changeStatus.isPending}
              className={`${action.color} flex items-center gap-2 disabled:opacity-50`}>
              {action.label}
            </button>
          ))}
        </div>
      )}

      {['DRAFT', 'CANCELLED'].includes(order.status) && (
        <button
          onClick={() => { if (confirm('Supprimer ce bon de commande ?')) deleteOrder.mutate() }}
          className="text-sm text-red-400 hover:underline flex items-center gap-1">
          <Trash2 className="w-4 h-4" /> Supprimer
        </button>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<'suppliers' | 'orders'>('suppliers')
  const [supplierModal, setSupplierModal] = useState<{ open: boolean; supplier: Supplier | null }>({ open: false, supplier: null })
  const [poModal, setPOModal] = useState<{ open: boolean; supplierId?: string }>({ open: false })
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)
  const [filterStatus, setFilterStatus] = useState('')

  const { data: suppliers = [], isLoading: loadingSuppliers } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/suppliers').then(r => r.data.data),
  })

  const { data: orders = [], isLoading: loadingOrders } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchase-orders', filterStatus],
    queryFn: () => api.get(`/suppliers/purchase-orders/all${filterStatus ? `?status=${filterStatus}` : ''}`).then(r => r.data.data),
  })

  // Ouvrir automatiquement un bon de commande depuis ?po=<id> (redirection depuis stock)
  useEffect(() => {
    const poId = searchParams.get('po')
    if (!poId || selectedOrder) return
    api.get(`/suppliers/purchase-orders/${poId}`)
      .then(r => {
        setSelectedOrder(r.data.data)
        setTab('orders')
        router.replace('/suppliers')
      })
      .catch(() => {})
  }, [searchParams])

  const createSupplier = useMutation({
    mutationFn: (data: any) => api.post('/suppliers', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success('Fournisseur créé'); setSupplierModal({ open: false, supplier: null }) },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Erreur'),
  })
  const updateSupplier = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/suppliers/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success('Fournisseur mis à jour'); setSupplierModal({ open: false, supplier: null }) },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Erreur'),
  })
  const deleteSupplier = useMutation({
    mutationFn: (id: string) => api.delete(`/suppliers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success('Fournisseur supprimé') },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Impossible de supprimer'),
  })

  if (selectedOrder) {
    return (
      <div className="space-y-6">
        <PODetail
          order={selectedOrder}
          onBack={() => setSelectedOrder(null)}
          onStatusChange={(updated) => setSelectedOrder(updated)}
        />
      </div>
    )
  }

  const pendingOrders = orders.filter(o => ['DRAFT', 'SENT', 'CONFIRMED'].includes(o.status))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fournisseurs</h1>
          <p className="text-brand-muted text-sm">
            {suppliers.length} fournisseur{suppliers.length > 1 ? 's' : ''} ·{' '}
            {pendingOrders.length > 0 && (
              <span className="text-yellow-400">{pendingOrders.length} commande{pendingOrders.length > 1 ? 's' : ''} en cours</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {tab === 'orders' && (
            <button onClick={() => setPOModal({ open: true })} className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> Nouveau bon
            </button>
          )}
          {tab === 'suppliers' && (
            <button onClick={() => setSupplierModal({ open: true, supplier: null })} className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> Nouveau fournisseur
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-brand-border">
        {[
          { key: 'suppliers', label: `Fournisseurs (${suppliers.length})`, icon: Truck },
          { key: 'orders', label: `Bons de commande (${orders.length})`, icon: ShoppingCart },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${
              tab === t.key ? 'border-brand-orange text-white' : 'border-transparent text-brand-muted hover:text-white'
            }`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Suppliers tab ── */}
      {tab === 'suppliers' && (
        <AnimatePresence mode="wait">
          {loadingSuppliers ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}
            </div>
          ) : suppliers.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center py-20 text-brand-muted">
              <Truck className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Aucun fournisseur</p>
              <p className="text-sm mt-1">Ajoutez vos fournisseurs pour créer des bons de commande</p>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {suppliers.map(supplier => (
                <div key={supplier.id} className="glass-card p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{supplier.name}</h3>
                      {supplier.contactName && <p className="text-sm text-brand-muted">{supplier.contactName}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-lg ${supplier.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {supplier.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-sm text-brand-muted">
                    {supplier.phone && (
                      <a href={`tel:${supplier.phone}`} className="flex items-center gap-2 hover:text-brand-orange transition-colors">
                        <Phone className="w-3.5 h-3.5" /> {supplier.phone}
                      </a>
                    )}
                    {supplier.email && (
                      <a href={`mailto:${supplier.email}`} className="flex items-center gap-2 hover:text-brand-orange transition-colors">
                        <Mail className="w-3.5 h-3.5" /> {supplier.email}
                      </a>
                    )}
                    {supplier.city && (
                      <p className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> {supplier.city}</p>
                    )}
                  </div>

                  <div className="flex gap-3 text-center text-xs">
                    <div className="flex-1 bg-white/3 rounded-xl p-2">
                      <p className="font-bold text-base">{supplier._count?.stockItems ?? 0}</p>
                      <p className="text-brand-muted">Articles</p>
                    </div>
                    <div className="flex-1 bg-white/3 rounded-xl p-2">
                      <p className="font-bold text-base">{supplier._count?.purchaseOrders ?? 0}</p>
                      <p className="text-brand-muted">Commandes</p>
                    </div>
                    <div className="flex-1 bg-white/3 rounded-xl p-2">
                      <p className="font-bold text-base">{supplier.leadTimeDays}j</p>
                      <p className="text-brand-muted">Délai</p>
                    </div>
                  </div>

                  {supplier.deliveryDays.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {supplier.deliveryDays.map(d => (
                        <span key={d} className="text-xs px-2 py-0.5 bg-brand-orange/10 text-brand-orange rounded-lg">
                          {DAY_LABELS[d]}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1 border-t border-brand-border">
                    <button onClick={() => setSupplierModal({ open: true, supplier })}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm text-brand-muted hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                      <Edit2 className="w-3.5 h-3.5" /> Modifier
                    </button>
                    <button onClick={() => { setTab('orders'); setPOModal({ open: true, supplierId: supplier.id }) }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm text-brand-orange hover:bg-brand-orange/10 rounded-xl transition-colors">
                      <ShoppingCart className="w-3.5 h-3.5" /> Commander
                    </button>
                    <button onClick={() => { if (confirm(`Supprimer "${supplier.name}" ?`)) deleteSupplier.mutate(supplier.id) }}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* ── Purchase Orders tab ── */}
      {tab === 'orders' && (
        <div className="space-y-4">
          {/* Status filter */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[{ value: '', label: 'Tous' }, ...Object.entries(PO_STATUS).map(([k, v]) => ({ value: k, label: v.label }))].map(s => (
              <button key={s.value} onClick={() => setFilterStatus(s.value)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap border transition-all ${
                  filterStatus === s.value ? 'bg-brand-orange text-white border-brand-orange' : 'border-brand-border text-brand-muted'
                }`}>
                {s.label}
              </button>
            ))}
          </div>

          {loadingOrders ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 text-brand-muted">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Aucun bon de commande</p>
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-brand-muted border-b border-brand-border">
                    <th className="text-left px-4 py-3">N° Bon</th>
                    <th className="text-left px-4 py-3">Fournisseur</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Articles</th>
                    <th className="text-right px-4 py-3">Montant</th>
                    <th className="text-left px-4 py-3">Statut</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Date</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => {
                    const st = PO_STATUS[order.status]!
                    return (
                      <tr key={order.id} className="border-b border-brand-border/50 hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono font-medium">{order.orderNumber}</td>
                        <td className="px-4 py-3 text-sm">{order.supplier.name}</td>
                        <td className="px-4 py-3 text-sm text-brand-muted hidden md:table-cell">{order.items.length} article{order.items.length > 1 ? 's' : ''}</td>
                        <td className="px-4 py-3 text-sm font-bold text-right">{formatCurrency(order.totalAmount)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-lg border flex items-center gap-1 w-fit ${st.color}`}>
                            <st.icon className="w-3 h-3" /> {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-brand-muted hidden lg:table-cell">{formatDate(order.createdAt)}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => setSelectedOrder(order)}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {supplierModal.open && (
        <SupplierModal
          supplier={supplierModal.supplier}
          onClose={() => setSupplierModal({ open: false, supplier: null })}
          onSave={data => supplierModal.supplier
            ? updateSupplier.mutate({ id: supplierModal.supplier.id, data })
            : createSupplier.mutate(data)}
        />
      )}
      {poModal.open && (
        <POModal
          suppliers={suppliers}
          editOrder={null}
          initialSupplierId={poModal.supplierId}
          onClose={() => setPOModal({ open: false })}
          onCreated={(order) => {
            setPOModal({ open: false })
            setTab('orders')
            setSelectedOrder(order)
          }}
        />
      )}
    </div>
  )
}

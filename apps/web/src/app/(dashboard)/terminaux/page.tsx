'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Monitor, Plus, Pencil, Trash2, Warehouse, Users, CheckCircle,
  XCircle, AlertTriangle, Star, X, ChevronDown, Shield,
} from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

const ALL_METHODS = [
  { value: 'CASH',         label: 'Espèces' },
  { value: 'MVOLA',        label: 'MVola' },
  { value: 'ORANGE_MONEY', label: 'Orange Money' },
  { value: 'AIRTEL_MONEY', label: 'Airtel Money' },
  { value: 'CARD',         label: 'Carte bancaire' },
  { value: 'BNI_MOBILE',   label: 'BNI Mobile' },
  { value: 'BOA_MOBILE',   label: 'BOA Mobile' },
  { value: 'VIREMENT',     label: 'Virement' },
  { value: 'CHEQUE',       label: 'Chèque' },
  { value: 'VOUCHER',      label: 'Bon/Coupon' },
  { value: 'WALLET',       label: 'Wallet' },
]

const STATUS_CONFIG = {
  ACTIVE:      { label: 'Actif',        color: 'text-emerald-400', bg: 'bg-emerald-500/15', icon: CheckCircle },
  INACTIVE:    { label: 'Inactif',      color: 'text-gray-400',    bg: 'bg-gray-500/15',    icon: XCircle },
  MAINTENANCE: { label: 'Maintenance',  color: 'text-amber-400',   bg: 'bg-amber-500/15',   icon: AlertTriangle },
}

const EMPTY_FORM = {
  name: '', code: '', description: '', status: 'ACTIVE', isDefault: false,
  warehouseId: '', allowedPaymentMethods: null as string[] | null,
  printerSn: '', tableSection: '', userIds: [] as string[],
}

export default function TerminauxPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data: terminals = [], isLoading } = useQuery({
    queryKey: ['pos-terminals'],
    queryFn: () => api.get('/pos-terminals').then(r => r.data.data),
  })

  // Auto-ouvrir le modal de création si aucun terminal n'existe
  useEffect(() => {
    if (!isLoading && terminals.length === 0) {
      setShowModal(true)
    }
  }, [isLoading, terminals.length])

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => api.get('/warehouses').then(r => r.data.data),
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => api.get('/restaurants/users').then(r => r.data.data),
  })

  const saveMutation = useMutation({
    mutationFn: (data: any) => editing
      ? api.patch(`/pos-terminals/${editing.id}`, data)
      : api.post('/pos-terminals', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-terminals'] })
      toast.success(editing ? 'Terminal mis à jour' : 'Terminal créé')
      closeModal()
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/pos-terminals/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-terminals'] })
      toast.success('Terminal supprimé')
      setDeleteConfirm(null)
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  })

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setShowModal(true)
  }

  function openEdit(t: any) {
    setEditing(t)
    setForm({
      name: t.name,
      code: t.code || '',
      description: t.description || '',
      status: t.status,
      isDefault: t.isDefault,
      warehouseId: t.warehouseId || '',
      allowedPaymentMethods: t.allowedPaymentMethods ?? null,
      printerSn: t.printerSn || '',
      tableSection: t.tableSection || '',
      userIds: t.assignedUsers?.map((u: any) => u.userId) ?? [],
    })
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditing(null)
  }

  function toggleMethod(method: string) {
    if (form.allowedPaymentMethods === null) {
      setForm(f => ({ ...f, allowedPaymentMethods: ALL_METHODS.map(m => m.value).filter(m => m !== method) }))
    } else {
      const cur = form.allowedPaymentMethods
      setForm(f => ({
        ...f,
        allowedPaymentMethods: cur.includes(method) ? cur.filter(m => m !== method) : [...cur, method],
      }))
    }
  }

  function toggleUser(uid: string) {
    setForm(f => ({
      ...f,
      userIds: f.userIds.includes(uid) ? f.userIds.filter(id => id !== uid) : [...f.userIds, uid],
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    saveMutation.mutate({
      name: form.name.trim(),
      code: form.code.trim() || null,
      description: form.description.trim() || null,
      status: form.status,
      isDefault: form.isDefault,
      warehouseId: form.warehouseId || null,
      allowedPaymentMethods: form.allowedPaymentMethods,
      printerSn: form.printerSn.trim() || null,
      tableSection: form.tableSection.trim() || null,
      userIds: form.userIds,
    })
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Monitor className="w-6 h-6 text-brand-orange" />
            Terminaux POS
          </h1>
          <p className="text-brand-muted text-sm mt-1">Gérez vos caisses, entrepôts et accès caissiers</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouveau terminal
        </button>
      </div>

      {/* Terminal cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3].map(i => <div key={i} className="bg-brand-card border border-brand-border rounded-xl p-5 h-48 animate-pulse" />)}
        </div>
      ) : terminals.length === 0 ? (
        <div className="text-center py-20 text-brand-muted">
          <Monitor className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucun terminal configuré</p>
          <p className="text-sm mt-1">Créez votre premier terminal POS pour commencer</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {terminals.map((t: any) => {
            const sc = STATUS_CONFIG[t.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.INACTIVE
            const StatusIcon = sc.icon
            const session = t.caisseSessions?.[0]
            return (
              <div key={t.id} className="bg-brand-card border border-brand-border rounded-xl p-5 hover:border-brand-orange/40 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-orange/15 flex items-center justify-center">
                      <Monitor className="w-5 h-5 text-brand-orange" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base">{t.name}</h3>
                        {t.isDefault && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                        {t.code && <span className="text-xs text-brand-muted bg-brand-border px-2 py-0.5 rounded">{t.code}</span>}
                      </div>
                      {t.description && <p className="text-xs text-brand-muted mt-0.5">{t.description}</p>}
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${sc.color} ${sc.bg}`}>
                    <StatusIcon className="w-3 h-3" />
                    {sc.label}
                  </span>
                </div>

                {/* Info row */}
                <div className="space-y-1.5 text-sm mb-3">
                  {t.warehouse && (
                    <div className="flex items-center gap-2 text-brand-muted">
                      <Warehouse className="w-3.5 h-3.5" />
                      <span>{t.warehouse.name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-brand-muted">
                    <Users className="w-3.5 h-3.5" />
                    <span>{t.assignedUsers?.length ?? 0} caissier(s) assigné(s)</span>
                  </div>
                  <div className="flex items-center gap-2 text-brand-muted">
                    <Shield className="w-3.5 h-3.5" />
                    <span>
                      {t.allowedPaymentMethods === null
                        ? 'Tous les modes de paiement'
                        : `${(t.allowedPaymentMethods as string[]).length} mode(s) autorisé(s)`}
                    </span>
                  </div>
                  {session && (
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Session ouverte depuis {new Date(session.openedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                </div>

                {/* Assigned users avatars */}
                {t.assignedUsers?.length > 0 && (
                  <div className="flex items-center gap-1 mb-3">
                    {t.assignedUsers.slice(0, 5).map((tu: any) => (
                      <div key={tu.userId} className="w-7 h-7 rounded-full bg-brand-orange/20 flex items-center justify-center text-xs font-bold text-brand-orange border border-brand-border" title={`${tu.user.firstName} ${tu.user.lastName}`}>
                        {tu.user.firstName[0]}{tu.user.lastName[0]}
                      </div>
                    ))}
                    {t.assignedUsers.length > 5 && (
                      <div className="w-7 h-7 rounded-full bg-brand-border flex items-center justify-center text-xs text-brand-muted">
                        +{t.assignedUsers.length - 5}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-brand-border">
                  <button
                    onClick={() => openEdit(t)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-border hover:bg-white/10 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Modifier
                  </button>
                  {deleteConfirm === t.id ? (
                    <div className="flex gap-1">
                      <button onClick={() => deleteMutation.mutate(t.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600">Confirmer</button>
                      <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-border">Annuler</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(t.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/15 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-brand-card border border-brand-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-brand-border sticky top-0 bg-brand-card z-10">
              <h2 className="text-lg font-bold">{editing ? 'Modifier le terminal' : 'Nouveau terminal POS'}</h2>
              <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Identité */}
              <div>
                <h3 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3">Identité</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-xs text-brand-muted mb-1 block">Nom du terminal *</label>
                    <input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Ex: Caisse principale, Bar, Terrasse"
                      required
                      className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-brand-muted"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-brand-muted mb-1 block">Code court</label>
                    <input
                      value={form.code}
                      onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                      placeholder="Ex: C1, BAR"
                      className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-brand-muted"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-brand-muted mb-1 block">Description</label>
                    <input
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Description optionnelle"
                      className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-brand-muted"
                    />
                  </div>
                </div>
              </div>

              {/* Statut + défaut */}
              <div>
                <h3 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3">Statut</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-brand-muted mb-1 block">Statut</label>
                    <select
                      value={form.status}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-brand-muted"
                    >
                      <option value="ACTIVE">Actif</option>
                      <option value="INACTIVE">Inactif</option>
                      <option value="MAINTENANCE">Maintenance</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.isDefault}
                        onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
                        className="w-4 h-4 accent-orange-500"
                      />
                      <span className="text-sm">Terminal par défaut <Star className="w-3 h-3 text-amber-400 inline" /></span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Entrepôt */}
              <div>
                <h3 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3">
                  <Warehouse className="w-3.5 h-3.5 inline mr-1" />
                  Entrepôt / Dépôt lié
                </h3>
                <select
                  value={form.warehouseId}
                  onChange={e => setForm(f => ({ ...f, warehouseId: e.target.value }))}
                  className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-brand-muted"
                >
                  <option value="">— Aucun entrepôt spécifique —</option>
                  {warehouses.map((w: any) => (
                    <option key={w.id} value={w.id}>{w.name}{w.isDefault ? ' (défaut)' : ''}</option>
                  ))}
                </select>
                <p className="text-xs text-brand-muted mt-1">Les sorties de stock seront imputées à cet entrepôt</p>
              </div>

              {/* Caissiers */}
              <div>
                <h3 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3">
                  <Users className="w-3.5 h-3.5 inline mr-1" />
                  Caissiers assignés
                </h3>
                {users.length === 0 ? (
                  <p className="text-sm text-brand-muted">Aucun utilisateur disponible</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {users.map((u: any) => (
                      <label key={u.id} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${form.userIds.includes(u.id) ? 'border-brand-orange bg-brand-orange/10' : 'border-brand-border hover:bg-white/5'}`}>
                        <input
                          type="checkbox"
                          checked={form.userIds.includes(u.id)}
                          onChange={() => toggleUser(u.id)}
                          className="accent-orange-500"
                        />
                        <div className="w-7 h-7 rounded-full bg-brand-orange/20 flex items-center justify-center text-xs font-bold text-brand-orange flex-shrink-0">
                          {u.firstName?.[0]}{u.lastName?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{u.firstName} {u.lastName}</p>
                          <p className="text-xs text-brand-muted truncate">{u.role?.displayName ?? u.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Modes de paiement */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-brand-muted uppercase tracking-wider">
                    <Shield className="w-3.5 h-3.5 inline mr-1" />
                    Modes de paiement autorisés
                  </h3>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, allowedPaymentMethods: f.allowedPaymentMethods === null ? [] : null }))}
                    className="text-xs text-brand-orange hover:underline"
                  >
                    {form.allowedPaymentMethods === null ? 'Restreindre' : 'Tout autoriser'}
                  </button>
                </div>
                {form.allowedPaymentMethods === null ? (
                  <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                    Tous les modes de paiement sont autorisés sur ce terminal
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ALL_METHODS.map(m => (
                      <label key={m.value} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm transition-colors ${(form.allowedPaymentMethods ?? []).includes(m.value) ? 'border-brand-orange bg-brand-orange/10' : 'border-brand-border hover:bg-white/5 text-brand-muted'}`}>
                        <input
                          type="checkbox"
                          checked={(form.allowedPaymentMethods ?? []).includes(m.value)}
                          onChange={() => toggleMethod(m.value)}
                          className="accent-orange-500"
                        />
                        {m.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Options avancées */}
              <div>
                <h3 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3">Options avancées</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-brand-muted mb-1 block">N° série imprimante (override)</label>
                    <input
                      value={form.printerSn}
                      onChange={e => setForm(f => ({ ...f, printerSn: e.target.value }))}
                      placeholder="XPyun SN optionnel"
                      className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-brand-muted"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-brand-muted mb-1 block">Section de salle (filtre tables)</label>
                    <input
                      value={form.tableSection}
                      onChange={e => setForm(f => ({ ...f, tableSection: e.target.value }))}
                      placeholder="Ex: terrasse, salle, bar"
                      className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-brand-muted"
                    />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 py-2.5 rounded-lg border border-brand-border text-sm hover:bg-white/5 transition-colors">
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="flex-1 py-2.5 rounded-lg bg-brand-orange text-white text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer le terminal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

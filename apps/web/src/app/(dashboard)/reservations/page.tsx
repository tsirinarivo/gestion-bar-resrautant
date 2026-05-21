'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Plus, Search, Clock, Users, Phone, CheckCircle, X, Edit2, Save, MessageSquare, Bell, ChevronDown } from 'lucide-react'
import { api } from '@/lib/api'
import { formatTime } from '@restaurant/utils'
import { toast } from 'sonner'

const STATUS_CONFIG: Record<string, any> = {
  PENDING: { label: 'En attente', color: '#F59E0B' },
  CONFIRMED: { label: 'Confirmée', color: '#10B981' },
  SEATED: { label: 'Installée', color: '#3B82F6' },
  COMPLETED: { label: 'Terminée', color: '#6B7280' },
  CANCELLED: { label: 'Annulée', color: '#EF4444' },
  NO_SHOW: { label: 'No-show', color: '#7F1D1D' },
}

function NewReservationModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  const defaultDate = tomorrow.toISOString().slice(0, 16)
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', partySize: '2', date: defaultDate, duration: '90', notes: '', specialRequest: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.firstName || !form.phone || !form.partySize) { setError('Prénom, téléphone et nb pers. requis'); return }
    setLoading(true)
    try {
      await api.post('/reservations', {
        firstName: form.firstName, lastName: form.lastName, phone: form.phone,
        email: form.email || undefined, partySize: Number(form.partySize),
        date: new Date(form.date).toISOString(), duration: Number(form.duration),
        notes: form.notes || undefined, specialRequest: form.specialRequest || undefined,
      })
      onSaved(); onClose()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la création')
    } finally { setLoading(false) }
  }

  const field = (label: string, key: keyof typeof form, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-medium text-brand-muted mb-1">{label}</label>
      <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder} className="input-field text-sm" />
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-brand-surface rounded-2xl p-6 w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">Nouvelle réservation</h2>
          <button onClick={onClose} className="p-2 hover:bg-brand-muted/10 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {field('Prénom *', 'firstName', 'text', 'Jean')}
            {field('Nom', 'lastName', 'text', 'Dupont')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('Téléphone *', 'phone', 'tel', '+261 34 00 000 00')}
            {field('Email', 'email', 'email', 'jean@email.com')}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {field('Nb pers. *', 'partySize', 'number', '2')}
            {field('Date & heure *', 'date', 'datetime-local')}
            {field('Durée (min)', 'duration', 'number', '90')}
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-muted mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Allergies, préférences..." className="input-field text-sm resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-muted mb-1">Demande spéciale</label>
            <textarea value={form.specialRequest} onChange={e => setForm(f => ({ ...f, specialRequest: e.target.value }))}
              rows={2} placeholder="Anniversaire, table fenêtre..." className="input-field text-sm resize-none" />
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Enregistrement...' : 'Créer la réservation'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

export default function ReservationsPage() {
  const [search, setSearch] = useState('')
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]!)
  const [showNew, setShowNew] = useState(false)
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null)
  const [editingNotesValue, setEditingNotesValue] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'week'>('list')
  const [showReminders, setShowReminders] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['reservations', date],
    queryFn: () => api.get(`/reservations?date=${date}&limit=50`).then(r => r.data),
  })

  const { data: tablesData } = useQuery({
    queryKey: ['tables'],
    queryFn: () => api.get('/tables').then(r => r.data),
  })
  const tables = tablesData?.data ?? []

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/reservations/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] })
      toast.success('Statut mis à jour')
    },
  })

  const updateNotes = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      api.patch(`/reservations/${id}`, { notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] })
      setEditingNotesId(null)
      toast.success('Notes mises à jour')
    },
  })

  const updateTable = useMutation({
    mutationFn: ({ id, tableId }: { id: string; tableId: string | null }) =>
      api.patch(`/reservations/${id}`, { tableId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] })
      toast.success('Table assignée')
    },
  })

  const { data: remindersData } = useQuery({
    queryKey: ['reservation-reminders'],
    queryFn: () => api.get('/reservations/reminders?days=7').then(r => r.data.data),
    refetchInterval: 120_000,
  })
  const reminders: any[] = remindersData ?? []

  const markReminderSent = useMutation({
    mutationFn: (id: string) => api.patch(`/reservations/reminders/${id}/sent`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservation-reminders'] })
      toast.success('Rappel marqué comme envoyé')
    },
  })

  const reservations = (data?.data || []).filter((r: any) =>
    !search || `${r.firstName} ${r.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    r.phone?.includes(search)
  )

  const stats = {
    total: data?.data?.length || 0,
    confirmed: (data?.data || []).filter((r: any) => r.status === 'CONFIRMED').length,
    pending: (data?.data || []).filter((r: any) => r.status === 'PENDING').length,
    totalCovers: (data?.data || []).reduce((s: number, r: any) => s + r.partySize, 0),
  }

  return (
    <div className="space-y-6">
      {showNew && <NewReservationModal onClose={() => setShowNew(false)} onSaved={() => qc.invalidateQueries({ queryKey: ['reservations'] })} />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Réservations</h1>
          <p className="text-brand-muted text-sm">{stats.total} réservation{stats.total > 1 ? 's' : ''} • {stats.totalCovers} couverts</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nouvelle réservation
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Confirmées', value: stats.confirmed, color: '#10B981' },
          { label: 'En attente', value: stats.pending, color: '#F59E0B' },
          { label: 'Total couverts', value: stats.totalCovers, color: '#3B82F6' },
        ].map(s => (
          <div key={s.label} className="glass-card p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-brand-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Date & Search & View */}
      <div className="flex gap-3 flex-wrap">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="input-field w-auto" />
        <div className="flex gap-1 rounded-xl border border-brand-border p-1">
          {(['list', 'week'] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${viewMode === m ? 'bg-brand-orange text-white' : 'text-brand-muted hover:text-white'}`}>
              {m === 'list' ? '📋 Liste' : '📅 Semaine'}
            </button>
          ))}
        </div>
        {viewMode === 'list' && (
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou téléphone..." className="input-field pl-10" />
          </div>
        )}
      </div>

      {viewMode === 'week' && <WeekView startDate={date} onSelectDate={d => { setDate(d); setViewMode('list') }} />}

      {/* Reservations list */}
      {viewMode === 'list' && <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)
        ) : reservations.length === 0 ? (
          <div className="text-center py-16 text-brand-muted">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Aucune réservation ce jour</p>
          </div>
        ) : (
          reservations.map((reservation: any) => {
            const statusConf = STATUS_CONFIG[reservation.status]
            return (
              <motion.div key={reservation.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                      style={{ background: `${statusConf.color}15` }}>
                      👤
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-bold">{reservation.firstName} {reservation.lastName}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: `${statusConf.color}20`, color: statusConf.color }}>
                          {statusConf.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-brand-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(new Date(reservation.date))}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {reservation.partySize} pers.
                        </span>
                        {reservation.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {reservation.phone}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          🪑
                          <select
                            value={reservation.tableId ?? ''}
                            onChange={e => updateTable.mutate({ id: reservation.id, tableId: e.target.value || null })}
                            className="bg-transparent border border-brand-border rounded-md px-1 py-0.5 text-xs cursor-pointer hover:border-brand-orange/40"
                            onClick={e => e.stopPropagation()}
                          >
                            <option value="">— Table —</option>
                            {tables.map((t: any) => (
                              <option key={t.id} value={t.id}>
                                Table {t.number}{t.name ? ` (${t.name})` : ''} · {t.capacity} pl.
                              </option>
                            ))}
                          </select>
                        </span>
                      </div>
                      {reservation.specialRequest && (
                        <p className="text-xs text-amber-600 mt-1 italic">⭐ {reservation.specialRequest}</p>
                      )}
                      <div className="mt-1">
                        {editingNotesId === reservation.id ? (
                          <div className="flex items-center gap-2 mt-1">
                            <textarea
                              autoFocus
                              value={editingNotesValue}
                              onChange={e => setEditingNotesValue(e.target.value)}
                              rows={2}
                              className="input-field text-xs resize-none flex-1 py-1"
                              placeholder="Ajouter une note..."
                            />
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => updateNotes.mutate({ id: reservation.id, notes: editingNotesValue })}
                                className="p-1 text-green-500 hover:bg-green-500/10 rounded-lg"
                              >
                                <Save className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setEditingNotesId(null)}
                                className="p-1 text-red-400 hover:bg-red-400/10 rounded-lg"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingNotesId(reservation.id); setEditingNotesValue(reservation.notes || '') }}
                            className="flex items-center gap-1 text-xs text-brand-muted hover:text-brand-primary transition-colors group"
                          >
                            <MessageSquare className="w-3 h-3" />
                            {reservation.notes
                              ? <span className="italic">"{reservation.notes}"</span>
                              : <span className="opacity-0 group-hover:opacity-100 transition-opacity">Ajouter une note…</span>
                            }
                            <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {reservation.status === 'CONFIRMED' && (
                      <button
                        onClick={() => updateStatus.mutate({ id: reservation.id, status: 'SEATED' })}
                        className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Installer
                      </button>
                    )}
                    {reservation.status === 'PENDING' && (
                      <button
                        onClick={() => updateStatus.mutate({ id: reservation.id, status: 'CONFIRMED' })}
                        className="btn-primary px-3 py-1.5 text-xs"
                      >
                        Confirmer
                      </button>
                    )}
                    {!['COMPLETED', 'CANCELLED'].includes(reservation.status) && (
                      <button
                        onClick={() => updateStatus.mutate({ id: reservation.id, status: 'CANCELLED' })}
                        className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })
        )}
      </div>}

      {/* ── Rappels automatiques ── */}
      {reminders.length > 0 && (
        <div className="glass-card overflow-hidden">
          <button
            onClick={() => setShowReminders(v => !v)}
            className="w-full flex items-center justify-between p-4 hover:bg-brand-surface/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-brand-orange" />
              <span className="font-semibold text-sm">Rappels à envoyer</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-brand-orange text-white font-bold">{reminders.length}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-brand-muted transition-transform ${showReminders ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {showReminders && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="divide-y divide-brand-border">
                  {reminders.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {r.reservation?.firstName} {r.reservation?.lastName}
                          <span className="text-brand-muted ml-2 text-xs">({r.reservation?.partySize} pers.)</span>
                        </p>
                        <p className="text-xs text-brand-muted mt-0.5">
                          📅 {new Date(r.reservation?.date).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-xs text-brand-orange mt-0.5">
                          Rappel {r.type} · à envoyer le {new Date(r.scheduledAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {r.reservation?.phone && <p className="text-xs text-brand-muted">📞 {r.reservation.phone}</p>}
                      </div>
                      <button
                        onClick={() => markReminderSent.mutate(r.id)}
                        disabled={markReminderSent.isPending}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-400/10 text-green-400 border border-green-400/30 hover:bg-green-400/20 text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Envoyé
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function WeekView({ startDate, onSelectDate }: { startDate: string; onSelectDate: (d: string) => void }) {
  // Compute Monday of the week containing startDate
  const base = new Date(startDate)
  const dayOfWeek = (base.getDay() + 6) % 7 // 0 = Mon
  const monday = new Date(base); monday.setDate(base.getDate() - dayOfWeek)

  const days: string[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]!
  })

  const queries = useQuery({
    queryKey: ['reservations-week', days[0]],
    queryFn: async () => {
      const results = await Promise.all(days.map(d => api.get(`/reservations?date=${d}&limit=50`).then(r => r.data?.data ?? [])))
      const map: Record<string, any[]> = {}
      days.forEach((d, i) => { map[d] = results[i] ?? [] })
      return map
    },
  })

  const weekData = queries.data ?? {}
  const dayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d, i) => {
        const items = weekData[d] ?? []
        const isToday = d === new Date().toISOString().split('T')[0]
        return (
          <div key={d} className={`glass-card p-3 min-h-32 cursor-pointer hover:border-brand-orange/40 transition-all ${isToday ? 'border-brand-orange/60' : ''}`}
            onClick={() => onSelectDate(d)}>
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-xs font-semibold text-brand-muted">{dayLabels[i]}</p>
              <p className={`text-sm font-bold ${isToday ? 'text-brand-orange' : ''}`}>{Number(d.split('-')[2])}</p>
            </div>
            <p className="text-xs text-brand-muted mb-2">{items.length} rés.</p>
            <div className="space-y-1">
              {items.slice(0, 4).map((r: any) => (
                <div key={r.id} className="text-[10px] px-1.5 py-0.5 rounded bg-brand-orange/15 text-brand-orange truncate">
                  {new Date(r.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} {r.firstName}
                </div>
              ))}
              {items.length > 4 && <p className="text-[10px] text-brand-muted">+{items.length - 4} autres</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

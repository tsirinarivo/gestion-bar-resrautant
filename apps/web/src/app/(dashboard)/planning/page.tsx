'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Plus, Trash2, Calendar } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

type Shift = {
  id: string
  date: string
  startTime: string
  endTime: string
  station?: string
  notes?: string
  employee: {
    id: string
    user: { firstName: string; lastName: string }
  }
}

type Employee = {
  id: string
  user: { firstName: string; lastName: string }
}

const STATIONS = ['Cuisine', 'Bar', 'Salle', 'Livraison', 'Caisse']
const STATION_COLORS: Record<string, string> = {
  Cuisine: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  Bar:     'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Salle:   'bg-green-500/20 text-green-300 border-green-500/30',
  Livraison: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  Caisse:  'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekDates(refDate: Date): Date[] {
  const d = new Date(refDate)
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((day + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(monday)
    dt.setDate(monday.getDate() + i)
    return dt
  })
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

const FR_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const FR_MONTHS = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc']

// ─── Add Shift Modal ───────────────────────────────────────────────────────────

function AddShiftModal({
  employees, defaultDate,
  onClose, onSave,
}: {
  employees: Employee[];
  defaultDate: Date;
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const [form, setForm] = useState({
    employeeId: employees[0]?.id ?? '',
    date: defaultDate.toISOString().slice(0, 10),
    startTime: '08:00',
    endTime: '16:00',
    station: '',
    notes: '',
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.employeeId || !form.date || !form.startTime || !form.endTime) {
      toast.error('Remplissez tous les champs obligatoires')
      return
    }
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative glass-card w-full max-w-md mx-4 p-6 z-10"
      >
        <h3 className="text-lg font-bold mb-5">Nouveau shift</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-brand-muted mb-1">Employé *</label>
            <select value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} required
              className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-orange">
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.user.firstName} {emp.user.lastName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-brand-muted mb-1">Date *</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required
              className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-orange" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-brand-muted mb-1">Début *</label>
              <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} required
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-orange" />
            </div>
            <div>
              <label className="block text-xs text-brand-muted mb-1">Fin *</label>
              <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} required
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-orange" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-brand-muted mb-1">Poste</label>
            <select value={form.station} onChange={e => setForm(f => ({ ...f, station: e.target.value }))}
              className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-orange">
              <option value="">— Tous postes —</option>
              {STATIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-brand-muted mb-1">Notes</label>
            <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optionnel…"
              className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-orange" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm rounded-xl border border-brand-border hover:border-brand-orange/30 transition-colors">
              Annuler
            </button>
            <button type="submit"
              className="flex-1 btn-primary px-4 py-2 text-sm">
              Créer le shift
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlanningPage() {
  const qc = useQueryClient()
  const today = new Date()
  const [refDate, setRefDate] = useState(today)
  const [addModal, setAddModal] = useState<{ open: boolean; defaultDate: Date }>({ open: false, defaultDate: today })

  const weekDates = useMemo(() => getWeekDates(refDate), [refDate])
  const from = weekDates[0]!.toISOString().slice(0, 10)
  const to   = weekDates[6]!.toISOString().slice(0, 10)

  const { data: shifts = [], isLoading: shiftsLoading } = useQuery<Shift[]>({
    queryKey: ['schedule', from, to],
    queryFn: () => api.get(`/employees/schedule?from=${from}&to=${to}`).then(r => r.data.data),
  })

  const { data: empData } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees').then(r => r.data.data),
    staleTime: 300_000,
  })
  const employees: Employee[] = empData ?? []

  const addShift = useMutation({
    mutationFn: (data: any) => api.post('/employees/shifts', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] })
      toast.success('Shift créé')
      setAddModal({ open: false, defaultDate: today })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  const deleteShift = useMutation({
    mutationFn: (id: string) => api.delete(`/employees/shifts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] })
      toast.success('Shift supprimé')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  // Group shifts by employeeId
  const employeeIds = useMemo(() => {
    const seen = new Set<string>()
    const order: string[] = []
    for (const s of shifts) {
      if (!seen.has(s.employee.id)) { seen.add(s.employee.id); order.push(s.employee.id) }
    }
    return order
  }, [shifts])

  const shiftsByEmp: Record<string, Shift[]> = useMemo(() => {
    const map: Record<string, Shift[]> = {}
    for (const s of shifts) {
      if (!map[s.employee.id]) map[s.employee.id] = []
      map[s.employee.id]!.push(s)
    }
    return map
  }, [shifts])

  function getEmpName(empId: string) {
    const shift = shifts.find(s => s.employee.id === empId)
    if (shift) return `${shift.employee.user.firstName} ${shift.employee.user.lastName}`
    const emp = employees.find(e => e.id === empId)
    return emp ? `${emp.user.firstName} ${emp.user.lastName}` : '—'
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Planning des équipes</h1>
          <p className="text-sm text-brand-muted">Semaine du {weekDates[0]?.getDate()} au {weekDates[6]?.getDate()} {FR_MONTHS[weekDates[6]?.getMonth() ?? 0]}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setRefDate(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })}
            className="p-2 rounded-xl border border-brand-border hover:border-brand-orange/40 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setRefDate(new Date())}
            className="text-xs px-3 py-1.5 rounded-xl border border-brand-border hover:border-brand-orange/40 transition-colors">
            Aujourd'hui
          </button>
          <button onClick={() => setRefDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })}
            className="p-2 rounded-xl border border-brand-border hover:border-brand-orange/40 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setAddModal({ open: true, defaultDate: today })}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-sm ml-2">
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden">
        {/* Header row: days */}
        <div className="grid border-b border-brand-border" style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}>
          <div className="p-3 text-xs text-brand-muted font-medium">Employé</div>
          {weekDates.map((date, i) => {
            const isToday = isSameDay(date, today)
            return (
              <div key={i} className={`p-3 text-center border-l border-brand-border/50 ${isToday ? 'bg-brand-orange/10' : ''}`}>
                <p className={`text-xs font-semibold ${isToday ? 'text-brand-orange' : 'text-brand-muted'}`}>{FR_DAYS[i]}</p>
                <p className={`text-lg font-bold ${isToday ? 'text-brand-orange' : ''}`}>{date.getDate()}</p>
              </div>
            )
          })}
        </div>

        {/* Rows: one per employee */}
        {shiftsLoading ? (
          <div className="p-8 text-center text-brand-muted text-sm">Chargement…</div>
        ) : employeeIds.length === 0 ? (
          <div className="p-10 text-center">
            <Calendar className="w-10 h-10 mx-auto mb-3 text-brand-muted opacity-30" />
            <p className="text-brand-muted text-sm">Aucun shift cette semaine</p>
            <p className="text-brand-muted text-xs mt-1">Cliquez sur "Ajouter" pour planifier</p>
          </div>
        ) : (
          employeeIds.map(empId => (
            <div key={empId} className="grid border-b border-brand-border/30 last:border-0 min-h-[60px]"
              style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}>
              {/* Employee name */}
              <div className="p-3 flex items-center border-r border-brand-border/50">
                <div>
                  <p className="text-sm font-medium truncate">{getEmpName(empId)}</p>
                </div>
              </div>
              {/* Day cells */}
              {weekDates.map((date, i) => {
                const dayShifts = (shiftsByEmp[empId] ?? []).filter(s => isSameDay(new Date(s.date), date))
                const isToday = isSameDay(date, today)
                return (
                  <div key={i} className={`p-1.5 border-l border-brand-border/50 ${isToday ? 'bg-brand-orange/5' : ''}`}>
                    {dayShifts.map(shift => {
                      const stColor = shift.station ? (STATION_COLORS[shift.station] ?? 'bg-gray-500/20 text-gray-300 border-gray-500/30') : 'bg-brand-surface text-brand-muted border-brand-border'
                      return (
                        <div key={shift.id} className={`text-[10px] px-1.5 py-1 rounded-lg border mb-1 flex items-center justify-between gap-1 group ${stColor}`}>
                          <div>
                            <p className="font-semibold">{shift.startTime}–{shift.endTime}</p>
                            {shift.station && <p className="opacity-75">{shift.station}</p>}
                          </div>
                          <button onClick={() => { if (confirm('Supprimer ce shift ?')) deleteShift.mutate(shift.id) }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300">
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )
                    })}
                    <button
                      onClick={() => setAddModal({ open: true, defaultDate: date })}
                      className="w-full text-[10px] text-brand-muted hover:text-brand-orange opacity-0 hover:opacity-100 group-hover:opacity-60 py-0.5 rounded transition-all">
                      +
                    </button>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </motion.div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {STATIONS.map(s => (
          <span key={s} className={`px-2 py-1 rounded-lg border ${STATION_COLORS[s] ?? ''}`}>{s}</span>
        ))}
      </div>

      {addModal.open && (
        <AddShiftModal
          employees={employees}
          defaultDate={addModal.defaultDate}
          onClose={() => setAddModal({ open: false, defaultDate: today })}
          onSave={(data) => addShift.mutate(data)}
        />
      )}
    </div>
  )
}

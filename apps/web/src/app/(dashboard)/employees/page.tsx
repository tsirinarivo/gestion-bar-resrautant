'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { UserCog, Plus, Clock, Calendar, Pencil, Trash2, X, Mail, Phone, Banknote, Palmtree, CheckCircle2, XCircle, BarChart2, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDate, initials, formatCurrency } from '@restaurant/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Employee = {
  id: string
  position: string
  salary: number | null
  hireDate: string | null
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
    role: { name: string; displayName: string } | null
  }
  timeEntries: { clockOut: string | null }[]
  leaves?: { id: string; status: string; startDate: string; endDate: string; type: string }[]
}

type Leave = {
  id: string
  type: string
  startDate: string
  endDate: string
  days: number
  reason?: string
  status: string
}

const LEAVE_TYPES: { value: string; label: string; color: string }[] = [
  { value: 'VACATION',       label: 'Congés payés',   color: '#3B82F6' },
  { value: 'SICK',           label: 'Maladie',         color: '#EF4444' },
  { value: 'PERSONAL',       label: 'Personnel',       color: '#8B5CF6' },
  { value: 'UNPAID',         label: 'Non payé',        color: '#6B7280' },
  { value: 'PUBLIC_HOLIDAY', label: 'Jour férié',      color: '#10B981' },
]

const LEAVE_STATUS: Record<string, { label: string; color: string }> = {
  PENDING:   { label: 'En attente', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  APPROVED:  { label: 'Approuvé',   color: 'text-green-400 bg-green-500/10 border-green-500/30' },
  REJECTED:  { label: 'Refusé',     color: 'text-red-400 bg-red-500/10 border-red-500/30' },
  CANCELLED: { label: 'Annulé',     color: 'text-gray-400 bg-gray-500/10 border-gray-500/30' },
}

type FormData = {
  firstName: string
  lastName: string
  email: string
  password: string
  role: string
  phone: string
  address: string
  salary: string
  birthDate: string
  hireDate: string
  position: string
}

const ROLES = [
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'serveur', label: 'Serveur' },
  { value: 'cuisinier', label: 'Cuisinier' },
  { value: 'caissier', label: 'Caissier' },
]

const ROLE_COLORS: Record<string, string> = {
  superadmin: 'bg-purple-500/20 text-purple-300',
  manager: 'bg-blue-500/20 text-blue-300',
  serveur: 'bg-green-500/20 text-green-300',
  cuisinier: 'bg-orange-500/20 text-orange-300',
  caissier: 'bg-yellow-500/20 text-yellow-300',
}

const emptyForm: FormData = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: 'serveur',
  phone: '',
  address: '',
  salary: '',
  birthDate: '',
  hireDate: '',
  position: '',
}

// ─── Modal Backdrop ───────────────────────────────────────────────────────────

function ModalBackdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-brand-card border border-brand-border rounded-2xl shadow-2xl"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', duration: 0.3 }}
        >
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Employee Form ─────────────────────────────────────────────────────────────

function EmployeeForm({
  form,
  onChange,
  isCreate,
}: {
  form: FormData
  onChange: (field: keyof FormData, value: string) => void
  isCreate: boolean
}) {
  const field = (
    label: string,
    key: keyof FormData,
    opts?: { type?: string; required?: boolean; placeholder?: string }
  ) => (
    <div>
      <label className="block text-xs text-brand-muted mb-1">
        {label} {opts?.required && <span className="text-brand-orange">*</span>}
      </label>
      <input
        type={opts?.type || 'text'}
        value={form[key]}
        onChange={e => onChange(key, e.target.value)}
        placeholder={opts?.placeholder || ''}
        required={opts?.required}
        className="w-full bg-brand-darker border border-brand-border rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-orange/60 transition-colors"
      />
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Name row */}
      <div className="grid grid-cols-2 gap-3">
        {field('Prénom', 'firstName', { required: true })}
        {field('Nom', 'lastName', { required: true })}
      </div>

      {/* Email + Password */}
      <div className="grid grid-cols-2 gap-3">
        {field('Email', 'email', { type: 'email', required: true })}
        {isCreate && field('Mot de passe', 'password', { type: 'password', required: true, placeholder: 'Min. 6 caractères' })}
      </div>

      {/* Role + Position */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-brand-muted mb-1">
            Rôle <span className="text-brand-orange">*</span>
          </label>
          <select
            value={form.role}
            onChange={e => onChange('role', e.target.value)}
            required
            className="w-full bg-brand-darker border border-brand-border rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-orange/60 transition-colors"
          >
            {ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        {field('Poste / Position', 'position', { placeholder: 'ex: Chef de rang' })}
      </div>

      {/* Phone + Salary */}
      <div className="grid grid-cols-2 gap-3">
        {field('Téléphone', 'phone', { placeholder: '+261 34 ...' })}
        {field('Salaire (Ariary)', 'salary', { type: 'number', placeholder: 'ex: 500000' })}
      </div>

      {/* Address */}
      {field('Adresse', 'address', { placeholder: 'Adresse complète' })}

      {/* Dates row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-brand-muted mb-1">Date de naissance</label>
          <input
            type="date"
            value={form.birthDate}
            onChange={e => onChange('birthDate', e.target.value)}
            className="w-full bg-brand-darker border border-brand-border rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-orange/60 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs text-brand-muted mb-1">Date d&apos;embauche</label>
          <input
            type="date"
            value={form.hireDate}
            onChange={e => onChange('hireDate', e.target.value)}
            className="w-full bg-brand-darker border border-brand-border rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-orange/60 transition-colors"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirm Modal ──────────────────────────────────────────────────────

function DeleteModal({
  employee,
  onClose,
  onConfirm,
  isLoading,
}: {
  employee: Employee
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
}) {
  return (
    <ModalBackdrop onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Supprimer l&apos;employé</h2>
          <button onClick={onClose} className="text-brand-muted hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-brand-muted text-sm mb-6">
          Êtes-vous sûr de vouloir supprimer{' '}
          <span className="text-white font-semibold">
            {employee.user.firstName} {employee.user.lastName}
          </span>{' '}
          ? Cette action est irréversible.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl border border-brand-border hover:border-brand-orange/30 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Suppression...' : 'Supprimer'}
          </button>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Leave Modal ──────────────────────────────────────────────────────────────

function LeaveModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ type: 'VACATION', startDate: '', endDate: '', days: '1', reason: '' })

  const { data: leaves = [], isLoading } = useQuery<Leave[]>({
    queryKey: ['employee-leaves', employee.id],
    queryFn: () => api.get(`/employees/${employee.id}/leaves`).then(r => r.data.data),
  })

  const addLeave = useMutation({
    mutationFn: (d: any) => api.post(`/employees/${employee.id}/leaves`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-leaves', employee.id] })
      qc.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Congé ajouté'); setShowAdd(false)
      setForm({ type: 'VACATION', startDate: '', endDate: '', days: '1', reason: '' })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/employees/leaves/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-leaves', employee.id] })
      qc.invalidateQueries({ queryKey: ['employees'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur'),
  })

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    addLeave.mutate({ ...form, days: Number(form.days) })
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="flex items-center justify-between p-6 border-b border-brand-border">
        <div>
          <h2 className="text-lg font-bold">Congés — {employee.user.firstName} {employee.user.lastName}</h2>
          <p className="text-xs text-brand-muted mt-0.5">{leaves.length} demande{leaves.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(s => !s)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-brand-orange/10 text-brand-orange border border-brand-orange/30 rounded-lg hover:bg-brand-orange/20 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </button>
          <button onClick={onClose} className="text-brand-muted hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="p-4 border-b border-brand-border bg-white/2 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-brand-muted mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full bg-brand-surface border border-brand-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-orange">
                {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-brand-muted mb-1">Jours</label>
              <input type="number" min="0.5" step="0.5" value={form.days} onChange={e => setForm(f => ({ ...f, days: e.target.value }))}
                className="w-full bg-brand-surface border border-brand-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-orange" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-brand-muted mb-1">Début</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required
                className="w-full bg-brand-surface border border-brand-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-orange" />
            </div>
            <div>
              <label className="block text-xs text-brand-muted mb-1">Fin</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required
                className="w-full bg-brand-surface border border-brand-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-orange" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-brand-muted mb-1">Motif (optionnel)</label>
            <input type="text" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Raison du congé…"
              className="w-full bg-brand-surface border border-brand-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-orange" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAdd(false)}
              className="text-xs px-3 py-1.5 rounded-lg border border-brand-border hover:border-brand-orange/30 transition-colors">Annuler</button>
            <button type="submit" disabled={addLeave.isPending}
              className="btn-primary text-xs px-4 py-1.5 disabled:opacity-50">
              {addLeave.isPending ? 'Ajout…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}

      <div className="divide-y divide-brand-border/30 max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 text-center text-brand-muted text-sm">Chargement…</div>
        ) : leaves.length === 0 ? (
          <div className="p-8 text-center text-brand-muted text-sm">
            <Palmtree className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Aucun congé enregistré</p>
          </div>
        ) : leaves.map((leave) => {
          const ltype = LEAVE_TYPES.find(t => t.value === leave.type)
          const lstatus = LEAVE_STATUS[leave.status] ?? LEAVE_STATUS['PENDING']!
          return (
            <div key={leave.id} className="flex items-center gap-3 px-5 py-3">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: ltype?.color ?? '#6B7280' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{ltype?.label ?? leave.type}</p>
                <p className="text-xs text-brand-muted">
                  {new Date(leave.startDate).toLocaleDateString('fr-FR')} → {new Date(leave.endDate).toLocaleDateString('fr-FR')}
                  {' · '}{leave.days}j
                </p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${lstatus.color}`}>
                {lstatus.label}
              </span>
              {leave.status === 'PENDING' && (
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => updateStatus.mutate({ id: leave.id, status: 'APPROVED' })}
                    className="p-1 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors" title="Approuver">
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => updateStatus.mutate({ id: leave.id, status: 'REJECTED' })}
                    className="p-1 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Refuser">
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </ModalBackdrop>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const queryClient = useQueryClient()

  const [showCreate, setShowCreate] = useState(false)
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null)
  const [deleteEmployee, setDeleteEmployee] = useState<Employee | null>(null)
  const [leaveEmployee, setLeaveEmployee] = useState<Employee | null>(null)
  const [createForm, setCreateForm] = useState<FormData>(emptyForm)
  const [editForm, setEditForm] = useState<FormData>(emptyForm)
  const [hoursMonth, setHoursMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const { data, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees').then(r => r.data.data),
  })

  const hoursFrom = `${hoursMonth}-01`
  const hoursTo = (() => {
    const [y, m] = hoursMonth.split('-').map(Number)
    const last = new Date(y!, m!, 0)
    return `${y}-${String(m).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
  })()

  const { data: hoursSummaryData } = useQuery<{ data: { employeeId: string; firstName: string; lastName: string; totalHours: number; sessionCount: number }[] }>({
    queryKey: ['employees-hours', hoursMonth],
    queryFn: () => api.get(`/employees/hours-summary?from=${hoursFrom}&to=${hoursTo}`).then(r => r.data),
    staleTime: 60_000,
  })
  const hoursSummary = hoursSummaryData?.data ?? []

  const employees: Employee[] = data || []

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (body: object) => api.post('/employees', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Employé créé avec succès')
      setShowCreate(false)
      setCreateForm(emptyForm)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Erreur lors de la création')
    },
  })

  const editMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => api.put(`/employees/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Employé mis à jour')
      setEditEmployee(null)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Erreur lors de la modification')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/employees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Employé supprimé')
      setDeleteEmployee(null)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Erreur lors de la suppression')
    },
  })

  // ── Handlers ──
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({
      ...createForm,
      salary: createForm.salary ? Number(createForm.salary) : undefined,
    })
  }

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editEmployee) return
    editMutation.mutate({
      id: editEmployee.id,
      body: {
        ...editForm,
        salary: editForm.salary ? Number(editForm.salary) : null,
      },
    })
  }

  const openEdit = (emp: Employee) => {
    setEditForm({
      firstName: emp.user.firstName,
      lastName: emp.user.lastName,
      email: emp.user.email,
      password: '',
      role: emp.user.role?.name || 'serveur',
      phone: emp.user.phone || '',
      address: '',
      salary: emp.salary != null ? String(emp.salary) : '',
      birthDate: '',
      hireDate: emp.hireDate ? emp.hireDate.slice(0, 10) : '',
      position: emp.position || '',
    })
    setEditEmployee(emp)
  }

  const changeCreate = (field: keyof FormData, value: string) =>
    setCreateForm(f => ({ ...f, [field]: value }))
  const changeEdit = (field: keyof FormData, value: string) =>
    setEditForm(f => ({ ...f, [field]: value }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ressources Humaines</h1>
          <p className="text-brand-muted text-sm">
            {employees.length} employé{employees.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nouvel employé
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-56 rounded-2xl" />
          ))
        ) : employees.length === 0 ? (
          <div className="col-span-full text-center py-16 text-brand-muted">
            <UserCog className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Aucun employé trouvé</p>
          </div>
        ) : (
          employees.map((employee) => {
            const user = employee.user
            const isClockedIn =
              employee.timeEntries?.[0] && !employee.timeEntries[0].clockOut
            const roleName = user.role?.name || ''
            const roleColor = ROLE_COLORS[roleName] || 'bg-brand-muted/20 text-brand-muted'

            return (
              <motion.div
                key={employee.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5 flex flex-col gap-4"
              >
                {/* Top section: avatar + name + actions */}
                <div className="flex items-start gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #FF4D00, #FFB800)' }}
                  >
                    {user ? initials(user.firstName, user.lastName) : '??'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold truncate">
                        {user?.firstName} {user?.lastName}
                      </p>
                      <div
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isClockedIn ? 'bg-green-400' : 'bg-brand-muted/40'}`}
                      />
                    </div>
                    <p className="text-xs text-brand-muted truncate">{employee.position}</p>
                    <span
                      className={`inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${roleColor}`}
                    >
                      {user?.role?.displayName || roleName}
                    </span>
                  </div>
                </div>

                {/* Info rows */}
                <div className="space-y-1.5 text-xs text-brand-muted">
                  <div className="flex items-center gap-2 truncate">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  {user.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{user.phone}</span>
                    </div>
                  )}
                  {employee.salary != null && (
                    <div className="flex items-center gap-2">
                      <Banknote className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="text-brand-orange font-medium">
                        {formatCurrency(employee.salary)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {isClockedIn ? (
                        <span className="text-green-400">En service</span>
                      ) : (
                        <span>Hors service</span>
                      )}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {employee.hireDate ? formatDate(employee.hireDate) : '—'}
                    </span>
                  </div>
                </div>

                {/* Active leave badge */}
                {employee.leaves && employee.leaves.length > 0 && (
                  <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2 py-1 flex items-center gap-1.5">
                    <Palmtree className="w-3 h-3" />
                    En congé
                  </div>
                )}

                {/* Action buttons */}
                <div className="border-t border-brand-border pt-3 flex gap-1.5">
                  <button
                    onClick={() => openEdit(employee)}
                    className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg border border-brand-border hover:border-brand-orange/40 hover:text-brand-orange transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    Modifier
                  </button>
                  <button
                    onClick={() => setLeaveEmployee(employee)}
                    className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg border border-brand-border hover:border-blue-500/40 hover:text-blue-400 transition-colors"
                  >
                    <Palmtree className="w-3 h-3" />
                    Congés
                  </button>
                  <button
                    onClick={() => setDeleteEmployee(employee)}
                    className="flex items-center justify-center gap-1 text-xs py-1.5 px-2 rounded-lg border border-brand-border hover:border-red-500/40 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            )
          })
        )}
      </div>

      {/* ── Hours Summary ── */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-brand-orange" />
            <h2 className="font-semibold">Heures travaillées</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const [y, m] = hoursMonth.split('-').map(Number)
                const d = new Date(y!, m! - 2, 1)
                setHoursMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
              }}
              className="p-1 hover:bg-white/5 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-brand-muted min-w-[90px] text-center">
              {new Date(`${hoursMonth}-15`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={() => {
                const [y, m] = hoursMonth.split('-').map(Number)
                const d = new Date(y!, m!, 1)
                setHoursMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
              }}
              className="p-1 hover:bg-white/5 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {hoursSummary.length === 0 ? (
          <p className="text-sm text-brand-muted text-center py-6">Aucune donnée de pointage pour cette période</p>
        ) : (
          <div className="space-y-2">
            {hoursSummary.map((emp, i) => {
              const maxHours = hoursSummary[0]?.totalHours || 1
              const pct = Math.round((emp.totalHours / maxHours) * 100)
              return (
                <div key={emp.employeeId} className="flex items-center gap-3">
                  <span className="text-xs text-brand-muted w-4 flex-shrink-0">#{i + 1}</span>
                  <span className="text-sm w-36 flex-shrink-0 truncate">{emp.firstName} {emp.lastName}</span>
                  <div className="flex-1 bg-brand-darker rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-brand-orange rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-medium w-16 text-right text-brand-orange">{emp.totalHours}h</span>
                  <span className="text-xs text-brand-muted w-20 text-right">{emp.sessionCount} session{emp.sessionCount > 1 ? 's' : ''}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Create Modal ── */}
      {showCreate && (
        <ModalBackdrop onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            <div className="flex items-center justify-between p-6 border-b border-brand-border">
              <h2 className="text-lg font-bold">Nouvel employé</h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-brand-muted hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <EmployeeForm form={createForm} onChange={changeCreate} isCreate />
            </div>
            <div className="flex gap-3 justify-end p-6 border-t border-brand-border">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm rounded-xl border border-brand-border hover:border-brand-orange/30 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="btn-primary px-6 py-2 text-sm disabled:opacity-50"
              >
                {createMutation.isPending ? 'Création...' : 'Créer l\'employé'}
              </button>
            </div>
          </form>
        </ModalBackdrop>
      )}

      {/* ── Edit Modal ── */}
      {editEmployee && (
        <ModalBackdrop onClose={() => setEditEmployee(null)}>
          <form onSubmit={handleEdit}>
            <div className="flex items-center justify-between p-6 border-b border-brand-border">
              <h2 className="text-lg font-bold">
                Modifier — {editEmployee.user.firstName} {editEmployee.user.lastName}
              </h2>
              <button
                type="button"
                onClick={() => setEditEmployee(null)}
                className="text-brand-muted hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <EmployeeForm form={editForm} onChange={changeEdit} isCreate={false} />
            </div>
            <div className="flex gap-3 justify-end p-6 border-t border-brand-border">
              <button
                type="button"
                onClick={() => setEditEmployee(null)}
                className="px-4 py-2 text-sm rounded-xl border border-brand-border hover:border-brand-orange/30 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={editMutation.isPending}
                className="btn-primary px-6 py-2 text-sm disabled:opacity-50"
              >
                {editMutation.isPending ? 'Sauvegarde...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </ModalBackdrop>
      )}

      {/* ── Delete Modal ── */}
      {deleteEmployee && (
        <DeleteModal
          employee={deleteEmployee}
          onClose={() => setDeleteEmployee(null)}
          onConfirm={() => deleteMutation.mutate(deleteEmployee.id)}
          isLoading={deleteMutation.isPending}
        />
      )}

      {leaveEmployee && (
        <LeaveModal employee={leaveEmployee} onClose={() => setLeaveEmployee(null)} />
      )}
    </div>
  )
}

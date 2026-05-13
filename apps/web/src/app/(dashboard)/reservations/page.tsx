'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Plus, Search, Clock, Users, Phone, Mail, CheckCircle, X } from 'lucide-react'
import { api } from '@/lib/api'
import { formatDate, formatTime } from '@restaurant/utils'
import { toast } from 'sonner'

const STATUS_CONFIG: Record<string, any> = {
  PENDING: { label: 'En attente', color: '#F59E0B' },
  CONFIRMED: { label: 'Confirmée', color: '#10B981' },
  SEATED: { label: 'Installée', color: '#3B82F6' },
  COMPLETED: { label: 'Terminée', color: '#6B7280' },
  CANCELLED: { label: 'Annulée', color: '#EF4444' },
  NO_SHOW: { label: 'No-show', color: '#7F1D1D' },
}

export default function ReservationsPage() {
  const [search, setSearch] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['reservations', date],
    queryFn: () => api.get(`/reservations?date=${date}&limit=50`).then(r => r.data),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/reservations/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] })
      toast.success('Statut mis à jour')
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Réservations</h1>
          <p className="text-brand-muted text-sm">{stats.total} réservation{stats.total > 1 ? 's' : ''} • {stats.totalCovers} couverts</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
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

      {/* Date & Search */}
      <div className="flex gap-3">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="input-field w-auto" />
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou téléphone..." className="input-field pl-10" />
        </div>
      </div>

      {/* Reservations list */}
      <div className="space-y-3">
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
                      </div>
                      {reservation.notes && (
                        <p className="text-xs text-brand-muted mt-1 italic">"{reservation.notes}"</p>
                      )}
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
      </div>
    </div>
  )
}

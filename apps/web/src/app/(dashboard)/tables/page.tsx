'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Users, Plus, RefreshCw, Grid, List, Clock } from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency, formatRelative } from '@restaurant/utils'
import { toast } from 'sonner'

const TABLE_STATUS_CONFIG = {
  AVAILABLE: { label: 'Libre', color: '#10B981', bg: '#10B98110', border: '#10B98130' },
  OCCUPIED: { label: 'Occupée', color: '#EF4444', bg: '#EF444410', border: '#EF444430' },
  RESERVED: { label: 'Réservée', color: '#3B82F6', bg: '#3B82F610', border: '#3B82F630' },
  CLEANING: { label: 'Nettoyage', color: '#F59E0B', bg: '#F59E0B10', border: '#F59E0B30' },
  BLOCKED: { label: 'Bloquée', color: '#6B7280', bg: '#6B728010', border: '#6B728030' },
}

export default function TablesPage() {
  const [view, setView] = useState<'grid' | 'floor'>('grid')
  const qc = useQueryClient()

  const { data: tablesData, isLoading } = useQuery({
    queryKey: ['tables'],
    queryFn: () => api.get('/tables').then(r => r.data.data),
    refetchInterval: 15000,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/tables/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tables'] })
      toast.success('Statut de la table mis à jour')
    },
  })

  const tables = tablesData || []
  const stats = {
    total: tables.length,
    available: tables.filter((t: any) => t.status === 'AVAILABLE').length,
    occupied: tables.filter((t: any) => t.status === 'OCCUPIED').length,
    reserved: tables.filter((t: any) => t.status === 'RESERVED').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plan de Salle</h1>
          <p className="text-brand-muted text-sm">
            {stats.occupied}/{stats.total} tables occupées •{' '}
            Taux: {stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0}%
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex border border-brand-border rounded-xl overflow-hidden">
            <button
              onClick={() => setView('grid')}
              className={`p-2 transition-colors ${view === 'grid' ? 'bg-brand-orange text-white' : 'text-brand-muted hover:text-white'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('floor')}
              className={`p-2 transition-colors ${view === 'floor' ? 'bg-brand-orange text-white' : 'text-brand-muted hover:text-white'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Ajouter table
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        {Object.entries(TABLE_STATUS_CONFIG).slice(0, 4).map(([status, config]) => {
          const count = tables.filter((t: any) => t.status === status).length
          return (
            <div key={status} className="glass-card p-4 text-center"
              style={{ borderColor: config.border }}>
              <p className="text-2xl font-bold" style={{ color: config.color }}>{count}</p>
              <p className="text-xs text-brand-muted">{config.label}</p>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap">
        {Object.entries(TABLE_STATUS_CONFIG).map(([status, config]) => (
          <div key={status} className="flex items-center gap-2 text-xs text-brand-muted">
            <div className="w-3 h-3 rounded-full" style={{ background: config.color }} />
            {config.label}
          </div>
        ))}
      </div>

      {/* Tables Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="skeleton h-48 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {tables.map((table: any) => {
            const statusConf = TABLE_STATUS_CONFIG[table.status as keyof typeof TABLE_STATUS_CONFIG]
            const currentOrder = table.orders?.[0]

            return (
              <motion.div
                key={table.id}
                layout
                whileHover={{ y: -2 }}
                className="glass-card p-4 cursor-pointer group transition-all duration-200"
                style={{ borderColor: statusConf.border, background: statusConf.bg }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-lg">T{table.number}</h3>
                    {table.section && (
                      <p className="text-xs text-brand-muted">{table.section}</p>
                    )}
                  </div>
                  <div className="w-3 h-3 rounded-full" style={{ background: statusConf.color }} />
                </div>

                <div className="flex items-center gap-1 text-sm text-brand-muted mb-3">
                  <Users className="w-3.5 h-3.5" />
                  <span>{table.capacity} pers.</span>
                </div>

                <div className="text-xs font-medium px-2 py-1 rounded-lg text-center"
                  style={{ background: statusConf.bg, color: statusConf.color, border: `1px solid ${statusConf.border}` }}>
                  {statusConf.label}
                </div>

                {currentOrder && (
                  <div className="mt-3 pt-3 border-t border-brand-border/50 text-xs">
                    <div className="flex items-center justify-between text-brand-muted mb-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelative(currentOrder.createdAt)}
                      </span>
                    </div>
                    <p className="font-semibold text-brand-orange">{formatCurrency(currentOrder.totalAmount)}</p>
                    <p className="text-brand-muted">{currentOrder.items?.length || 0} article(s)</p>
                  </div>
                )}

                {/* Status actions */}
                <div className="mt-3 grid grid-cols-2 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {table.status !== 'AVAILABLE' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: table.id, status: 'AVAILABLE' }) }}
                      className="text-xs py-1 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                    >
                      Libérer
                    </button>
                  )}
                  {table.status !== 'CLEANING' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: table.id, status: 'CLEANING' }) }}
                      className="text-xs py-1 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
                    >
                      Nettoyage
                    </button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

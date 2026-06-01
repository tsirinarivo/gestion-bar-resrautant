'use client'

import { useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Plus, RefreshCw, Grid, List, Clock, QrCode, Download, X } from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency, formatRelative } from '@restaurant/utils'
import { toast } from 'sonner'

const QRCodeSVG = dynamic(() => import('qrcode.react').then(m => m.QRCodeSVG), { ssr: false })

const CLIENT_URL = process.env.NEXT_PUBLIC_CLIENT_URL || 'https://client.sakafio.mg'

function QRModal({ table, onClose }: { table: any; onClose: () => void }) {
  const svgRef = useRef<HTMLDivElement>(null)
  const tableUrl = `${CLIENT_URL}/table/${table.id}`

  function downloadQR() {
    const svg = svgRef.current?.querySelector('svg')
    if (!svg) return
    const canvas = document.createElement('canvas')
    const size = 300
    canvas.width = size; canvas.height = size + 40
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const img = new Image()
    const svgBlob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(svgBlob)
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size)
      ctx.fillStyle = '#000000'
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`Table ${table.number}`, size / 2, size + 26)
      URL.revokeObjectURL(url)
      const a = document.createElement('a')
      a.download = `table-${table.number}-qr.png`
      a.href = canvas.toDataURL()
      a.click()
    }
    img.src = url
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="relative bg-white rounded-2xl p-8 z-10 text-center shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-gray-900 font-bold text-lg mb-1">Table {table.number}</h3>
        <p className="text-gray-500 text-sm mb-6">Scanner pour commander</p>
        <div ref={svgRef} className="flex justify-center mb-4">
          <QRCodeSVG value={tableUrl} size={220} level="H" includeMargin />
        </div>
        <p className="text-gray-400 text-xs mb-5 break-all max-w-xs">{tableUrl}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={downloadQR}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors">
            <Download className="w-4 h-4" /> Télécharger
          </button>
          <button onClick={() => window.print()}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
            Imprimer
          </button>
        </div>
      </motion.div>
    </div>
  )
}

const TABLE_STATUS_CONFIG = {
  AVAILABLE: { label: 'Libre', color: '#10B981', bg: '#10B98110', border: '#10B98130' },
  OCCUPIED: { label: 'Occupée', color: '#EF4444', bg: '#EF444410', border: '#EF444430' },
  RESERVED: { label: 'Réservée', color: '#3B82F6', bg: '#3B82F610', border: '#3B82F630' },
  CLEANING: { label: 'Nettoyage', color: '#F59E0B', bg: '#F59E0B10', border: '#F59E0B30' },
  BLOCKED: { label: 'Bloquée', color: '#6B7280', bg: '#6B728010', border: '#6B728030' },
}

function AddTableModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ number: '', capacity: '4', section: '', name: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.number || !form.capacity) { setError('Numéro et capacité requis'); return }
    setLoading(true)
    try {
      await api.post('/tables', { number: Number(form.number), capacity: Number(form.capacity), section: form.section || undefined, name: form.name || undefined })
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la création')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="relative bg-brand-card border border-brand-border rounded-2xl p-6 z-10 w-full max-w-sm shadow-2xl">
        <h3 className="font-bold text-lg mb-4">Ajouter une table</h3>
        {error && <p className="text-red-400 text-sm mb-3 bg-red-500/10 px-3 py-2 rounded-xl">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-brand-muted mb-1 block">Numéro *</label>
              <input type="number" min="1" value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
                required className="input-field w-full" placeholder="1" />
            </div>
            <div>
              <label className="text-xs text-brand-muted mb-1 block">Capacité *</label>
              <input type="number" min="1" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
                required className="input-field w-full" placeholder="4" />
            </div>
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1 block">Nom (optionnel)</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input-field w-full" placeholder="Ex: Terrasse 1" />
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1 block">Section (optionnel)</label>
            <input value={form.section} onChange={e => setForm(f => ({ ...f, section: e.target.value }))}
              className="input-field w-full" placeholder="Salle principale, Terrasse..." />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl border border-brand-border text-sm text-brand-muted hover:border-brand-orange/40 transition-colors">Annuler</button>
            <button type="submit" disabled={loading} className="flex-1 btn-primary py-2 text-sm disabled:opacity-50">
              {loading ? 'Création...' : 'Créer la table'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

export default function TablesPage() {
  const [view, setView] = useState<'grid' | 'floor'>('grid')
  const [qrTable, setQrTable] = useState<any>(null)
  const [showAddTable, setShowAddTable] = useState(false)
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
          <button onClick={() => setShowAddTable(true)} className="btn-primary flex items-center gap-2">
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
                <div className="mt-3 grid grid-cols-2 gap-1">
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
                  <button
                    onClick={(e) => { e.stopPropagation(); setQrTable(table) }}
                    className="col-span-2 flex items-center justify-center gap-1 text-xs py-1 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                  >
                    <QrCode className="w-3 h-3" /> QR Code
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {qrTable && (
          <QRModal table={qrTable} onClose={() => setQrTable(null)} />
        )}
      </AnimatePresence>

      {showAddTable && (
        <AddTableModal
          onClose={() => setShowAddTable(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['tables'] })}
        />
      )}
    </div>
  )
}

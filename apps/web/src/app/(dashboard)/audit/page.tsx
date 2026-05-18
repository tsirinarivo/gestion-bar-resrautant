'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Shield, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '@/lib/api'
import { formatDateTime } from '@restaurant/utils'

type AuditLog = {
  id: string
  action: string
  resource: string
  resourceId?: string
  oldData?: any
  newData?: any
  ipAddress?: string
  createdAt: string
  user?: { firstName: string; lastName: string; email: string } | null
}

type Pagination = { page: number; limit: number; total: number; totalPages: number }

const ACTION_STYLE: Record<string, string> = {
  CREATE: 'text-green-400 bg-green-500/10 border-green-500/30',
  UPDATE: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  DELETE: 'text-red-400 bg-red-500/10 border-red-500/30',
  LOGIN:  'text-amber-400 bg-amber-500/10 border-amber-500/30',
  LOGOUT: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
}

function DiffView({ oldData, newData }: { oldData?: any; newData?: any }) {
  if (!oldData && !newData) return null
  const keys = Array.from(new Set([...Object.keys(oldData ?? {}), ...Object.keys(newData ?? {})]))
    .filter(k => !['updatedAt', 'createdAt'].includes(k))

  const changed = keys.filter(k => JSON.stringify(oldData?.[k]) !== JSON.stringify(newData?.[k]))
  if (changed.length === 0) return <p className="text-xs text-brand-muted italic">Aucun changement détecté</p>

  return (
    <div className="space-y-1 text-xs font-mono max-h-48 overflow-y-auto">
      {changed.map(k => (
        <div key={k} className="grid grid-cols-[120px_1fr_1fr] gap-2">
          <span className="text-brand-muted truncate">{k}</span>
          {oldData?.[k] !== undefined && (
            <span className="text-red-400 bg-red-500/10 px-1 rounded truncate">
              − {JSON.stringify(oldData[k])}
            </span>
          )}
          {newData?.[k] !== undefined && (
            <span className="text-green-400 bg-green-500/10 px-1 rounded truncate">
              + {JSON.stringify(newData[k])}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function LogRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false)
  const style = ACTION_STYLE[log.action] ?? 'text-gray-400 bg-gray-500/10 border-gray-500/30'
  const hasDiff = log.oldData || log.newData

  return (
    <div className="border-b border-brand-border last:border-0">
      <div className="px-4 py-3 flex items-center gap-4 hover:bg-white/5 transition-colors">
        <span className={`text-xs px-2 py-0.5 rounded-full border font-mono flex-shrink-0 ${style}`}>
          {log.action}
        </span>
        <span className="text-xs text-brand-muted bg-brand-darker px-2 py-0.5 rounded flex-shrink-0">
          {log.resource}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">
            {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Système'}
            {log.resourceId && <span className="text-brand-muted text-xs ml-2">#{log.resourceId.slice(-6)}</span>}
          </p>
          {log.ipAddress && <p className="text-xs text-brand-muted/60">{log.ipAddress}</p>}
        </div>
        <p className="text-xs text-brand-muted flex-shrink-0 hidden sm:block">{formatDateTime(new Date(log.createdAt))}</p>
        {hasDiff && (
          <button onClick={() => setExpanded(e => !e)} className="text-brand-muted hover:text-white p-1 rounded flex-shrink-0">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>
      {expanded && hasDiff && (
        <div className="px-4 pb-3">
          <DiffView oldData={log.oldData} newData={log.newData} />
        </div>
      )}
    </div>
  )
}

export default function AuditPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [resource, setResource] = useState('')

  const params = new URLSearchParams({ page: String(page), limit: '50' })
  if (action) params.set('action', action)
  if (resource) params.set('resource', resource)

  const { data } = useQuery<{ data: AuditLog[]; pagination: Pagination }>({
    queryKey: ['audit', page, action, resource],
    queryFn: () => api.get(`/audit?${params}`).then(r => r.data),
  })

  const logs = data?.data ?? []
  const pagination = data?.pagination

  const filtered = search
    ? logs.filter(l =>
        l.resource.includes(search) ||
        l.action.includes(search) ||
        l.user?.email.includes(search) ||
        `${l.user?.firstName} ${l.user?.lastName}`.toLowerCase().includes(search.toLowerCase())
      )
    : logs

  const resources = Array.from(new Set(logs.map(l => l.resource))).sort()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-brand-orange" />
        <div>
          <h1 className="text-2xl font-bold">Journal d'audit</h1>
          <p className="text-brand-muted text-sm">{pagination?.total ?? 0} entrées</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input-field pl-9 w-full" placeholder="Rechercher utilisateur, ressource..." />
        </div>
        <select value={action} onChange={e => { setAction(e.target.value); setPage(1) }}
          className="input-field">
          <option value="">Toutes les actions</option>
          {['CREATE','UPDATE','DELETE','LOGIN','LOGOUT'].map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select value={resource} onChange={e => { setResource(e.target.value); setPage(1) }}
          className="input-field">
          <option value="">Toutes les ressources</option>
          {resources.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-brand-muted">
            <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Aucune entrée trouvée</p>
          </div>
        ) : (
          <div className="divide-y divide-brand-border">
            {filtered.map(log => <LogRow key={log.id} log={log} />)}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="btn-secondary text-sm disabled:opacity-30">← Précédent</button>
          <span className="text-sm text-brand-muted">Page {page} / {pagination.totalPages}</span>
          <button disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)}
            className="btn-secondary text-sm disabled:opacity-30">Suivant →</button>
        </div>
      )}
    </div>
  )
}

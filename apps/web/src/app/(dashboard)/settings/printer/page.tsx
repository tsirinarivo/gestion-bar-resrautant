'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Printer, Power, RefreshCw, CheckCircle, XCircle, AlertCircle,
  Eye, EyeOff, Save, TestTube2, Wifi, WifiOff, Clock, ChevronDown,
  RotateCcw, Settings2,
} from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { formatCurrency } from '@restaurant/utils'

const VOICE_OPTIONS = [
  { value: 0, label: 'Silencieux' },
  { value: 1, label: 'Bip court' },
  { value: 2, label: 'Bip long' },
  { value: 3, label: 'Bip triple' },
]

const SERVER_PRESETS = [
  { label: 'XPyun (par défaut)',      value: 'https://open.xpyun.net/api/openapi/xprinter' },
  { label: 'Feiyin Cloud',            value: 'https://api.feiyin.com/v1/print' },
  { label: 'Serveur personnalisé…',   value: '__custom__' },
]

const STATUS_META: Record<string, { label: string; icon: any; color: string }> = {
  online:  { label: 'En ligne',   icon: Wifi,     color: '#10B981' },
  offline: { label: 'Hors ligne', icon: WifiOff,  color: '#EF4444' },
  busy:    { label: 'Occupée',    icon: Clock,     color: '#F59E0B' },
  unknown: { label: 'Inconnu',    icon: WifiOff,  color: '#6B7280' },
}

const LOG_STATUS: Record<string, { label: string; color: string }> = {
  printed: { label: 'Imprimé',  color: '#10B981' },
  pending: { label: 'En attente', color: '#F59E0B' },
  failed:  { label: 'Échec',    color: '#EF4444' },
}

function StatusBadge({ status }: { status: string }) {
  const m = LOG_STATUS[status] ?? { label: status, color: '#6B7280' }
  return (
    <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: `${m.color}20`, color: m.color }}>
      {m.label}
    </span>
  )
}

export default function PrinterSettingsPage() {
  const qc = useQueryClient()
  const [showKey, setShowKey] = useState(false)
  const [logPage, setLogPage] = useState(1)

  // ── Fetch config ──────────────────────────────────────────────────────────
  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ['printer-config'],
    queryFn: () => api.get('/printer/config').then(r => r.data.data),
    retry: false,
  })

  const [form, setForm] = useState<any>(null)

  // configData is null  → no config yet (initialize form with defaults)
  // configData is undefined → API error (query failed)
  useEffect(() => {
    if (configData !== undefined && form === null) {
      setForm({
        enabled:                 configData?.enabled                ?? false,
        user:                    configData?.user                   ?? '',
        key:                     configData?.key                    ?? '',
        baseUrl:                 configData?.baseUrl                ?? '',
        sn:                      configData?.sn                     ?? '',
        voice:                   configData?.voice                  ?? 1,
        header:                  configData?.header                 ?? '',
        footer:                  configData?.footer                 ?? '',
        copies:                  configData?.copies                 ?? 1,
        autoOnSaleConfirm:       configData?.autoOnSaleConfirm      ?? true,
        autoOnPaymentConfirm:    configData?.autoOnPaymentConfirm   ?? true,
        autoOnDeliveryRegister:  configData?.autoOnDeliveryRegister ?? false,
      })
    }
  }, [configData]) // eslint-disable-line react-hooks/exhaustive-deps

  const f = form ?? {}
  function setF(key: string, val: any) {
    setForm((prev: any) => ({ ...prev, [key]: val }))
  }

  // ── Fetch printer status ──────────────────────────────────────────────────
  const { data: statusData, refetch: refetchStatus, isFetching: statusFetching } = useQuery({
    queryKey: ['printer-status'],
    queryFn: () => api.get('/printer/status').then(r => r.data.data),
    refetchInterval: 30_000,
    retry: false,
  })

  // ── Fetch logs ────────────────────────────────────────────────────────────
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['printer-logs', logPage],
    queryFn: () => api.get(`/printer/logs?page=${logPage}&perPage=20`).then(r => r.data),
    retry: false,
  })

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveConfig = useMutation({
    mutationFn: (data: any) => api.put('/printer/config', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['printer-config'] })
      qc.invalidateQueries({ queryKey: ['printer-status'] })
      toast.success('Configuration enregistrée')
    },
    onError: (e: any) => {
      const details = e?.response?.data?.details
      if (details) {
        const first = Object.entries(details as Record<string, string[]>).map(([k, v]) => `${k}: ${v[0]}`).join(', ')
        toast.error(`Données invalides — ${first}`)
      } else {
        toast.error(e?.response?.data?.error ?? 'Erreur de configuration')
      }
    },
  })

  const testPrint = useMutation({
    mutationFn: () => api.post('/printer/test'),
    onSuccess: () => toast.success('Ticket de test envoyé à l\'imprimante'),
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Impression de test échouée'),
  })

  const refreshLogs = useMutation({
    mutationFn: () => api.post('/printer/refresh-logs'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['printer-logs'] })
      toast.success('Statuts actualisés')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erreur actualisation'),
  })

  function handleSave() {
    if (!form) return
    saveConfig.mutate(form)
  }

  const printerOnline = statusData?.state === 'online'
  const printerStatus: string = statusData?.state ?? 'offline'
  const FALLBACK_META = { label: 'Hors ligne', icon: WifiOff, color: '#EF4444' }
  const statusMeta: { label: string; icon: any; color: string } = STATUS_META[printerStatus] ?? FALLBACK_META

  if (configLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="skeleton h-8 w-64 rounded-xl" />
        <div className="glass-card h-64 rounded-2xl" />
      </div>
    )
  }

  // Package not installed or other API error
  const notInstalled = !configLoading && configData === undefined

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Printer className="w-5 h-5 text-blue-400" />
            </div>
            Imprimante thermique
          </h1>
          <p className="text-brand-muted text-sm mt-1">
            Xprinter / xpyun.net via ImprimantCloud
          </p>
        </div>

        {/* Live status chip */}
        <div className="flex items-center gap-2">
          {statusData && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border"
              style={{ borderColor: `${statusMeta.color}40`, background: `${statusMeta.color}10` }}>
              <statusMeta.icon className="w-4 h-4" style={{ color: statusMeta.color }} />
              <span className="text-sm font-medium" style={{ color: statusMeta.color }}>
                {statusMeta.label}
              </span>
            </div>
          )}
          <button onClick={() => refetchStatus()}
            disabled={statusFetching}
            className="p-2 rounded-xl border border-brand-border text-brand-muted hover:text-white transition-colors">
            <RefreshCw className={`w-4 h-4 ${statusFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {notInstalled && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 border-yellow-500/30 bg-yellow-500/5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-400 text-sm">Module imprimantcloud non installé</p>
            <code className="text-xs text-brand-muted mt-1 block bg-black/20 px-2 py-1 rounded">
              npm install imprimantcloud --workspace=apps/api
            </code>
          </div>
        </motion.div>
      )}

      {/* ── Connexion & activation ────────────────────────────────────────────── */}
      <section className="glass-card divide-y divide-brand-border">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="font-semibold text-sm">Activer l'imprimante</p>
            <p className="text-xs text-brand-muted">Les impressions automatiques et manuelles seront disponibles</p>
          </div>
          <button
            onClick={() => setF('enabled', !f.enabled)}
            className={`relative w-12 h-6 rounded-full transition-colors ${f.enabled ? 'bg-brand-orange' : 'bg-brand-border'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${f.enabled ? 'translate-x-6' : ''}`} />
          </button>
        </div>

        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-brand-muted block mb-1.5">Numéro de série (SN) *</label>
            <input value={f.sn ?? ''} onChange={e => setF('sn', e.target.value)}
              placeholder="Ex: 7654321098" className="input-field font-mono text-sm" />
          </div>
          <div>
            <label className="text-xs text-brand-muted block mb-1.5">Serveur d'impression</label>
            <select
              value={SERVER_PRESETS.find(p => p.value !== '__custom__' && p.value === (f.baseUrl || ''))?.value ?? '__custom__'}
              onChange={e => {
                if (e.target.value !== '__custom__') setF('baseUrl', e.target.value)
                else setF('baseUrl', '')
              }}
              className="input-field text-sm mb-2"
            >
              {SERVER_PRESETS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {/* Show custom URL input only when no preset is selected */}
            {!SERVER_PRESETS.find(p => p.value !== '__custom__' && p.value === (f.baseUrl || '')) && (
              <input value={f.baseUrl ?? ''} onChange={e => setF('baseUrl', e.target.value)}
                placeholder="https://mon-serveur.com/api/print" className="input-field text-sm font-mono" />
            )}
          </div>
          <div>
            <label className="text-xs text-brand-muted block mb-1.5">Utilisateur (User)</label>
            <input value={f.user ?? ''} onChange={e => setF('user', e.target.value)}
              placeholder="email xpyun.net" className="input-field text-sm" />
          </div>
          <div>
            <label className="text-xs text-brand-muted block mb-1.5">UserKEY</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={f.key ?? ''}
                onChange={e => setF('key', e.target.value)}
                placeholder="Votre UserKEY xpyun"
                className="input-field text-sm pr-10 font-mono" />
              <button onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-white">
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-brand-muted mt-1">
              Si vous renvoyez "••••••••", la clé existante est conservée.
            </p>
          </div>
        </div>
      </section>

      {/* ── Impression automatique ────────────────────────────────────────────── */}
      <section className="glass-card">
        <div className="px-5 py-4 border-b border-brand-border">
          <p className="font-semibold text-sm flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-brand-orange" />
            Impressions automatiques
          </p>
          <p className="text-xs text-brand-muted mt-0.5">
            Choisissez à quel moment imprimer automatiquement un ticket de caisse
          </p>
        </div>
        <div className="px-5 py-4 space-y-3">
          {([
            ['autoOnSaleConfirm',       'À la confirmation de commande (CONFIRMED)',    'Imprime dès que le serveur confirme la commande'],
            ['autoOnPaymentConfirm',    'À la finalisation (COMPLETED)',                 'Imprime quand la commande est entièrement réglée'],
            ['autoOnDeliveryRegister',  'À l\'enregistrement d\'une livraison',          'Pour les commandes DELIVERY'],
          ] as [string, string, string][]).map(([key, label, desc]) => (
            <label key={key} className="flex items-start gap-3 cursor-pointer group">
              <div className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${f[key] ? 'bg-brand-orange border-brand-orange' : 'border-brand-border group-hover:border-brand-orange/50'}`}
                onClick={() => setF(key, !f[key])}>
                {f[key] && <CheckCircle className="w-3.5 h-3.5 text-white" />}
              </div>
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-brand-muted">{desc}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* ── Personnalisation ──────────────────────────────────────────────────── */}
      <section className="glass-card divide-y divide-brand-border">
        <div className="px-5 py-4">
          <p className="font-semibold text-sm mb-3">Personnalisation du ticket</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-brand-muted block mb-1.5">En-tête (header)</label>
              <textarea value={f.header ?? ''} onChange={e => setF('header', e.target.value)}
                placeholder="Nom du restaurant&#10;Adresse, téléphone..." rows={3}
                className="input-field text-sm resize-none w-full" />
            </div>
            <div>
              <label className="text-xs text-brand-muted block mb-1.5">Pied de page (footer)</label>
              <textarea value={f.footer ?? ''} onChange={e => setF('footer', e.target.value)}
                placeholder="Merci de votre visite !&#10;WiFi : ..." rows={3}
                className="input-field text-sm resize-none w-full" />
            </div>
            <div>
              <label className="text-xs text-brand-muted block mb-1.5">Nombre de copies</label>
              <select value={f.copies ?? 1} onChange={e => setF('copies', Number(e.target.value))}
                className="input-field text-sm">
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n} copie{n > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-brand-muted block mb-1.5">Bip sonore</label>
              <select value={f.voice ?? 1} onChange={e => setF('voice', Number(e.target.value))}
                className="input-field text-sm">
                {VOICE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* ── Action buttons ────────────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <button onClick={handleSave}
          disabled={saveConfig.isPending || !form}
          className="btn-primary flex items-center gap-2 disabled:opacity-50">
          <Save className="w-4 h-4" />
          {saveConfig.isPending ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        <button onClick={() => testPrint.mutate()}
          disabled={testPrint.isPending || !f.enabled}
          className="btn-secondary flex items-center gap-2 disabled:opacity-50">
          <TestTube2 className="w-4 h-4" />
          {testPrint.isPending ? 'Envoi...' : 'Ticket de test'}
        </button>
      </div>

      {/* ── Logs d'impression ────────────────────────────────────────────────── */}
      <section className="glass-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
          <p className="font-semibold text-sm">Historique des impressions</p>
          <button onClick={() => refreshLogs.mutate()}
            disabled={refreshLogs.isPending}
            className="flex items-center gap-1.5 text-xs text-brand-muted hover:text-white border border-brand-border px-3 py-1.5 rounded-lg transition-colors">
            <RotateCcw className={`w-3.5 h-3.5 ${refreshLogs.isPending ? 'animate-spin' : ''}`} />
            Actualiser en attente
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-brand-border text-left">
                {['Date', 'Type', 'Commande', 'Statut', 'Erreur'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-medium text-brand-muted uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-brand-border/50">
                    <td colSpan={5} className="px-4 py-3"><div className="skeleton h-4 rounded" /></td>
                  </tr>
                ))
              ) : (logsData?.data?.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-brand-muted">
                    <Printer className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Aucune impression enregistrée</p>
                  </td>
                </tr>
              ) : (logsData?.data?.data ?? []).map((log: any) => (
                <tr key={log.id} className="border-b border-brand-border/30 hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3 text-sm text-brand-muted whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    <span className="ml-1 text-xs opacity-60">
                      {new Date(log.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 bg-white/5 rounded-lg border border-brand-border font-mono">
                      {log.kind}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-brand-muted">
                    {log.orderId ? `#${log.orderId.slice(-6).toUpperCase()}` : log.relatedId ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={log.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-red-400 max-w-xs truncate">
                    {log.error ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(logsData?.data?.meta?.pageCount ?? 0) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-brand-border">
            <p className="text-xs text-brand-muted">{logsData!.data.meta.total} impression(s)</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setLogPage(p => Math.max(1, p - 1))} disabled={logPage === 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-brand-border disabled:opacity-30">
                Précédent
              </button>
              <span className="text-xs text-brand-muted">{logPage} / {logsData!.data.meta.pageCount}</span>
              <button onClick={() => setLogPage(p => Math.min(logsData!.data.meta.pageCount, p + 1))}
                disabled={logPage === logsData!.data.meta.pageCount}
                className="px-3 py-1.5 text-xs rounded-lg border border-brand-border disabled:opacity-30">
                Suivant
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, RefreshCw, CheckCircle2, XCircle, RotateCw, Info, StopCircle } from 'lucide-react'
import { toast } from 'sonner'

type UpdateRun = {
  id: string
  status: 'RUNNING' | 'SUCCESS' | 'FAILED'
  startedAt: string
  completedAt: string | null
  startedBy: string | null
  exitCode: number | null
}

type RunDetail = UpdateRun & { logChunk: string; logLength: number }

export default function UpdatesPage() {
  const [history, setHistory] = useState<UpdateRun[]>([])
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [activeRun, setActiveRun] = useState<RunDetail | null>(null)
  const [log, setLog] = useState('')
  const [logOffset, setLogOffset] = useState(0)
  const [launching, setLaunching] = useState(false)
  const logRef = useRef<HTMLPreElement>(null)

  // Load history + détecter si un run est en cours
  async function refreshHistory() {
    try {
      const res = await fetch('/api/updates/run')
      if (!res.ok) return
      const data = await res.json() as { runs: UpdateRun[] }
      setHistory(data.runs)
      const running = data.runs.find(r => r.status === 'RUNNING')
      if (running && !activeRunId) {
        // Reprend un run déjà en cours (utile si page rechargée)
        setActiveRunId(running.id)
        setLog('')
        setLogOffset(0)
      }
    } catch { /* ignore */ }
  }

  useEffect(() => { refreshHistory() }, [])

  // Polling du run actif
  useEffect(() => {
    if (!activeRunId) return
    let cancelled = false
    let interval: NodeJS.Timeout | null = null

    const poll = async () => {
      try {
        const res = await fetch(`/api/updates/${activeRunId}?since=${logOffset}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json() as RunDetail
        if (cancelled) return
        if (data.logChunk) {
          setLog(prev => prev + data.logChunk)
          setLogOffset(data.logLength)
        }
        setActiveRun(data)
        if (data.status !== 'RUNNING') {
          if (interval) clearInterval(interval)
          refreshHistory()
          if (data.status === 'SUCCESS') toast.success('Déploiement terminé avec succès')
          else toast.error(`Déploiement échoué (exit ${data.exitCode})`)
        }
      } catch { /* ignore network blips */ }
    }

    void poll()
    interval = setInterval(poll, 1500)
    return () => { cancelled = true; if (interval) clearInterval(interval) }
  }, [activeRunId, logOffset])

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  async function startUpdate() {
    setLaunching(true)
    try {
      const res = await fetch('/api/updates/run', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur démarrage')
        if (data.runId) { setActiveRunId(data.runId); setLog(''); setLogOffset(0) }
        return
      }
      setActiveRunId(data.id)
      setActiveRun(null)
      setLog('')
      setLogOffset(0)
      toast.success('Déploiement démarré')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLaunching(false)
    }
  }

  const isRunning = activeRun?.status === 'RUNNING'
  const elapsedSec = activeRun
    ? Math.floor((new Date(activeRun.completedAt || Date.now()).getTime() - new Date(activeRun.startedAt).getTime()) / 1000)
    : 0
  const elapsedFmt = `${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, '0')}`

  return (
    <div className="px-6 py-8 md:px-10">
      <div className="mb-4">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
      </div>

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-brand-600" />
            Déploiements
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Lance <code className="rounded bg-slate-100 px-1 text-xs">bash deploy/update.sh</code> qui pull le code, rebuild les images, migre les DBs et recréé tous les containers (master + tenants).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <button
              onClick={async () => {
                if (!confirm('Annuler le déploiement en cours ? Si des tenants étaient en cours de recreate, ils peuvent rester dans un état incohérent.')) return
                try {
                  const res = await fetch(`/api/updates/${activeRunId}/cancel`, { method: 'POST' })
                  const body = await res.json().catch(() => ({}))
                  if (!res.ok) throw new Error(body.error || "Échec de l'annulation")
                  toast.success('Déploiement annulé')
                  refreshHistory()
                } catch (err) {
                  toast.error((err as Error).message)
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              <StopCircle className="h-4 w-4" />
              Annuler
            </button>
          )}
          <button
            onClick={startUpdate}
            disabled={launching || isRunning}
            className="btn-primary inline-flex items-center gap-2 whitespace-nowrap"
          >
            {launching || isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
            {isRunning ? `En cours… (${elapsedFmt})` : launching ? 'Démarrage…' : 'Déployer maintenant'}
          </button>
        </div>
      </header>

      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <Info className="mr-1 inline h-3 w-3" />
        <strong>Attention :</strong> le déploiement prend 5-15 min. Pendant ce temps, chaque tenant subit ~10-20s de downtime au moment du recreate de ses containers. Préviens tes clients pour les heures creuses.
      </div>

      {/* Live log */}
      {activeRunId && (
        <div className="card mb-6 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2">
              {activeRun?.status === 'SUCCESS' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : activeRun?.status === 'FAILED' ? (
                <XCircle className="h-4 w-4 text-red-600" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              )}
              <span className="text-sm font-medium text-slate-700">
                {activeRun?.status === 'SUCCESS' && 'Déploiement réussi'}
                {activeRun?.status === 'FAILED' && `Échoué (exit ${activeRun.exitCode})`}
                {(activeRun?.status === 'RUNNING' || !activeRun) && 'En cours…'}
              </span>
            </div>
            <span className="font-mono text-xs text-slate-500">{elapsedFmt}</span>
          </div>
          <pre
            ref={logRef}
            className="max-h-[60vh] min-h-64 overflow-auto bg-slate-900 p-4 font-mono text-xs leading-snug text-emerald-200"
          >
            {log || <span className="text-slate-500">Attente du premier output…</span>}
          </pre>
        </div>
      )}

      {/* Historique */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Historique des 10 derniers déploiements</h2>
        <div className="card overflow-hidden">
          {history.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">Aucun déploiement encore</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Démarré</th>
                  <th className="px-4 py-3">Durée</th>
                  <th className="px-4 py-3">Exit</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {history.map(r => {
                  const dur = r.completedAt
                    ? Math.floor((new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()) / 1000)
                    : null
                  return (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        {r.status === 'RUNNING' && <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"><Loader2 className="h-3 w-3 animate-spin" />En cours</span>}
                        {r.status === 'SUCCESS' && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-3 w-3" />Succès</span>}
                        {r.status === 'FAILED' && <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"><XCircle className="h-3 w-3" />Échec</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{new Date(r.startedAt).toLocaleString('fr-FR')}</td>
                      <td className="px-4 py-3 font-mono text-xs">{dur != null ? `${Math.floor(dur / 60)}m ${dur % 60}s` : '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.exitCode ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { setActiveRunId(r.id); setLog(''); setLogOffset(0); setActiveRun(null) }}
                          className="text-xs text-brand-600 hover:underline"
                        >
                          Voir le log
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}

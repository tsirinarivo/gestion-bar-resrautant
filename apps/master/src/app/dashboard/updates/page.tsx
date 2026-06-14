'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  RotateCw,
  Info,
  StopCircle,
  Terminal,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, StatusBadge } from '@/components/ui/PageHeader'

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

  async function refreshHistory() {
    try {
      const res = await fetch('/api/updates/run')
      if (!res.ok) return
      const data = (await res.json()) as { runs: UpdateRun[] }
      setHistory(data.runs)
      const running = data.runs.find(r => r.status === 'RUNNING')
      if (running && !activeRunId) {
        setActiveRunId(running.id)
        setLog('')
        setLogOffset(0)
      }
    } catch {}
  }

  useEffect(() => {
    refreshHistory()
  }, [])

  useEffect(() => {
    if (!activeRunId) return
    let cancelled = false
    let interval: NodeJS.Timeout | null = null
    const poll = async () => {
      try {
        const res = await fetch(`/api/updates/${activeRunId}?since=${logOffset}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as RunDetail
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
      } catch {}
    }
    void poll()
    interval = setInterval(poll, 1500)
    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
    }
  }, [activeRunId, logOffset])

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
        if (data.runId) {
          setActiveRunId(data.runId)
          setLog('')
          setLogOffset(0)
        }
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
    ? Math.floor(
        (new Date(activeRun.completedAt || Date.now()).getTime() -
          new Date(activeRun.startedAt).getTime()) /
          1000,
      )
    : 0
  const elapsedFmt = `${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, '0')}`

  async function cancelRun() {
    if (
      !confirm(
        'Annuler le déploiement en cours ? Si des tenants étaient en cours de recreate, ils peuvent rester dans un état incohérent.',
      )
    )
      return
    try {
      const res = await fetch(`/api/updates/${activeRunId}/cancel`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Échec de l'annulation")
      toast.success('Déploiement annulé')
      refreshHistory()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="container-x py-8 sm:py-10">
      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <RefreshCw className="h-6 w-6 text-brand-600" /> Déploiements
          </span>
        }
        subtitle="Déclenche un git pull + rebuild + migrations + recreate de tous les tenants"
        actions={
          <>
            {isRunning && (
              <button
                onClick={cancelRun}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50"
              >
                <StopCircle className="h-4 w-4" /> Annuler
              </button>
            )}
            <button
              onClick={startUpdate}
              disabled={launching || isRunning}
              className="btn-primary whitespace-nowrap"
            >
              {launching || isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCw className="h-4 w-4" />
              )}
              {isRunning
                ? `En cours… (${elapsedFmt})`
                : launching
                  ? 'Démarrage…'
                  : 'Déployer maintenant'}
            </button>
          </>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
      >
        <Info className="h-4 w-4 flex-shrink-0" />
        <div>
          <strong>Attention :</strong> le déploiement prend 5-15 min. Chaque tenant subit ~10-20s
          de downtime au moment du recreate de ses containers — préviens tes clients pour les
          heures creuses.
        </div>
      </motion.div>

      {activeRunId && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card mb-6 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-800">
                {activeRun?.status === 'SUCCESS' && 'Déploiement réussi'}
                {activeRun?.status === 'FAILED' && `Échoué (exit ${activeRun.exitCode})`}
                {(activeRun?.status === 'RUNNING' || !activeRun) && 'En cours…'}
              </span>
              {activeRun && <StatusBadge status={activeRun.status} />}
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5" /> {elapsedFmt}
            </div>
          </div>
          <pre
            ref={logRef}
            className="max-h-[60vh] min-h-64 overflow-auto bg-slate-950 p-4 font-mono text-[11px] leading-relaxed text-emerald-200"
          >
            {log || <span className="text-slate-500">Attente du premier output…</span>}
          </pre>
        </motion.div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-bold text-slate-900">10 derniers déploiements</h2>
        {history.length === 0 ? (
          <div className="card p-10 text-center text-sm text-slate-500">
            Aucun déploiement encore.
          </div>
        ) : (
          <>
            <div className="card hidden overflow-hidden sm:block">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/50">
                  <tr>
                    <Th>Statut</Th>
                    <Th>Démarré</Th>
                    <Th>Durée</Th>
                    <Th>Exit</Th>
                    <Th right>Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((r, i) => {
                    const dur = r.completedAt
                      ? Math.floor(
                          (new Date(r.completedAt).getTime() -
                            new Date(r.startedAt).getTime()) /
                            1000,
                        )
                      : null
                    return (
                      <motion.tr
                        key={r.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i, 8) * 0.03 }}
                        className="hover:bg-slate-50/60"
                      >
                        <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                        <td className="px-5 py-3 text-xs text-slate-600">
                          {new Date(r.startedAt).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs">
                          {dur != null ? `${Math.floor(dur / 60)}m ${dur % 60}s` : '—'}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs">{r.exitCode ?? '—'}</td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => {
                              setActiveRunId(r.id)
                              setLog('')
                              setLogOffset(0)
                              setActiveRun(null)
                            }}
                            className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50"
                          >
                            Voir le log
                          </button>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-2.5 sm:hidden">
              {history.map(r => {
                const dur = r.completedAt
                  ? Math.floor(
                      (new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()) / 1000,
                    )
                  : null
                return (
                  <div key={r.id} className="card p-4">
                    <div className="flex items-center justify-between">
                      <StatusBadge status={r.status} />
                      <span className="font-mono text-xs text-slate-500">
                        {dur != null ? `${Math.floor(dur / 60)}m ${dur % 60}s` : '—'}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-600">
                      {new Date(r.startedAt).toLocaleString('fr-FR')}
                    </div>
                    <button
                      onClick={() => {
                        setActiveRunId(r.id)
                        setLog('')
                        setLogOffset(0)
                        setActiveRun(null)
                      }}
                      className="mt-3 text-xs font-semibold text-brand-700"
                    >
                      Voir le log →
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}

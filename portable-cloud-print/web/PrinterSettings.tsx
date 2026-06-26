'use client'
/**
 * Page de réglages imprimante cloud — PORTABLE.
 * Aucune dépendance hôte : on injecte un client `api` (axios-like).
 *
 *   import { PrinterSettings } from './portable-cloud-print/web/PrinterSettings'
 *   <PrinterSettings api={api} />   // api.get/put/post → Promise<{ data: { data } }>
 *
 * Styles : classes Tailwind neutres (sans-effet si Tailwind absent).
 * Pas de react-query ni d'icônes externes → branchable partout.
 */
import { useEffect, useState, useCallback } from 'react'

type Api = {
  get: (url: string) => Promise<{ data: any }>
  put: (url: string, body: any) => Promise<{ data: any }>
  post: (url: string, body?: any) => Promise<{ data: any }>
}

type Cfg = {
  enabled: boolean; user: string; key: string; region: string; sn: string
  voice: number; header: string; footer: string; copies: number
  autoOnSaleConfirm: boolean; autoOnPaymentConfirm: boolean; autoOnDeliveryRegister: boolean
}

const DEFAULTS: Cfg = {
  enabled: false, user: '', key: '', region: 'cn', sn: '',
  voice: 1, header: '', footer: '', copies: 1,
  autoOnSaleConfirm: true, autoOnPaymentConfirm: true, autoOnDeliveryRegister: false,
}

const REGIONS = [
  { value: 'cn', label: 'Chine — open.xpyun.net' },
  { value: 'sg', label: 'Singapour — sg.open.xpyun.net' },
  { value: 'de', label: 'Europe — gm.open.xpyun.net' },
]

export function PrinterSettings({ api, basePath = '/printer' }: { api: Api; basePath?: string }) {
  const [form, setForm] = useState<Cfg | null>(null)
  const [status, setStatus] = useState<string>('unknown')
  const [logs, setLogs] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [showKey, setShowKey] = useState(false)

  const set = (k: keyof Cfg, v: any) => setForm(p => (p ? { ...p, [k]: v } : p))
  const flash = (ok: boolean, text: string) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 4000) }

  const loadAll = useCallback(async () => {
    try {
      const c = await api.get(`${basePath}/config`).then(r => r.data?.data)
      setForm({ ...DEFAULTS, ...(c ?? {}) })
    } catch { setForm({ ...DEFAULTS }) }
    api.get(`${basePath}/status`).then(r => setStatus(r.data?.data?.state ?? 'offline')).catch(() => {})
    api.get(`${basePath}/logs?page=1&perPage=20`).then(r => setLogs(r.data?.data?.data ?? [])).catch(() => {})
  }, [api, basePath])

  useEffect(() => { loadAll() }, [loadAll])

  async function save() {
    if (!form) return
    setSaving(true)
    try {
      await api.put(`${basePath}/config`, form)
      flash(true, 'Configuration enregistrée')
      loadAll()
    } catch (e: any) {
      const d = e?.response?.data
      const detail = d?.details ? Object.entries(d.details).map(([k, v]: any) => `${k}: ${v[0]}`).join(', ') : (d?.error ?? 'Erreur')
      flash(false, `Échec : ${detail}`)
    } finally { setSaving(false) }
  }

  async function test() {
    try { await api.post(`${basePath}/test`); flash(true, 'Ticket de test envoyé') }
    catch (e: any) { flash(false, e?.response?.data?.error ?? 'Test échoué') }
  }

  if (!form) return <div className="p-6 text-sm opacity-60">Chargement…</div>
  const f = form

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">🖨️ Imprimante cloud (XPyun)</h1>
        <span className="text-xs px-3 py-1 rounded-full border"
          style={{ color: status === 'online' ? '#10B981' : '#EF4444' }}>
          {status === 'online' ? 'En ligne' : status === 'busy' ? 'Occupée' : 'Hors ligne'}
        </span>
      </div>

      {msg && (
        <div className={`text-sm px-4 py-2 rounded-xl ${msg.ok ? 'bg-green-500/15 text-green-500' : 'bg-red-500/15 text-red-500'}`}>
          {msg.text}
        </div>
      )}

      {/* Connexion */}
      <section className="border border-gray-700 rounded-2xl p-4 space-y-4">
        <label className="flex items-center justify-between">
          <span className="text-sm font-medium">Activer l'imprimante</span>
          <input type="checkbox" checked={f.enabled} onChange={e => set('enabled', e.target.checked)} className="w-5 h-5 accent-orange-500" />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Numéro de série (SN) *">
            <input value={f.sn} onChange={e => set('sn', e.target.value)} placeholder="Ex: 7654321098" className="inp font-mono" />
          </Field>
          <Field label="Région du serveur">
            <select value={f.region} onChange={e => set('region', e.target.value)} className="inp">
              {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="Utilisateur (User)">
            <input value={f.user} onChange={e => set('user', e.target.value)} placeholder="email xpyun.net" className="inp" />
          </Field>
          <Field label="UserKEY">
            <div className="flex gap-2">
              <input type={showKey ? 'text' : 'password'} value={f.key} onChange={e => set('key', e.target.value)}
                placeholder="UserKEY xpyun" className="inp font-mono flex-1" />
              <button type="button" onClick={() => setShowKey(v => !v)} className="text-xs px-2 border border-gray-700 rounded-lg">
                {showKey ? '🙈' : '👁'}
              </button>
            </div>
            {f.key === '••••••••' && <p className="text-xs text-green-500 mt-1">✓ Clé enregistrée — videz le champ pour la changer</p>}
          </Field>
        </div>
      </section>

      {/* Impressions auto */}
      <section className="border border-gray-700 rounded-2xl p-4 space-y-2">
        <p className="text-sm font-semibold mb-2">Impressions automatiques</p>
        {([
          ['autoOnSaleConfirm', 'À la confirmation de commande'],
          ['autoOnPaymentConfirm', 'À la finalisation / paiement'],
          ['autoOnDeliveryRegister', 'À l’enregistrement d’une livraison'],
        ] as [keyof Cfg, string][]).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!f[k]} onChange={e => set(k, e.target.checked)} className="w-4 h-4 accent-orange-500" />
            {label}
          </label>
        ))}
      </section>

      {/* Personnalisation */}
      <section className="border border-gray-700 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="En-tête du ticket">
          <textarea value={f.header} onChange={e => set('header', e.target.value)} rows={3} className="inp resize-none" placeholder="Mentions, contacts…" />
        </Field>
        <Field label="Pied de page">
          <textarea value={f.footer} onChange={e => set('footer', e.target.value)} rows={3} className="inp resize-none" placeholder="Merci…" />
        </Field>
        <Field label="Copies">
          <select value={f.copies} onChange={e => set('copies', Number(e.target.value))} className="inp">
            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="Bip sonore">
          <select value={f.voice} onChange={e => set('voice', Number(e.target.value))} className="inp">
            {['Voix fort', 'Voix moyen', 'Voix bas', 'Bip', 'Muet'].map((l, i) => <option key={i} value={i}>{l}</option>)}
          </select>
        </Field>
      </section>

      <div className="flex gap-3">
        <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold disabled:opacity-50">
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button onClick={test} disabled={!f.enabled} className="px-5 py-2.5 rounded-xl border border-gray-700 text-sm disabled:opacity-50">
          Ticket de test
        </button>
      </div>

      {/* Historique */}
      <section className="border border-gray-700 rounded-2xl p-4">
        <p className="text-sm font-semibold mb-3">Dernières impressions</p>
        {logs.length === 0 ? <p className="text-sm opacity-60">Aucune impression.</p> : (
          <div className="space-y-1 text-sm">
            {logs.map((l: any) => (
              <div key={l.id} className="flex items-center justify-between gap-2 py-1 border-b border-gray-800">
                <span className="opacity-70">{new Date(l.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                <span className="font-mono text-xs">{l.kind}</span>
                <span className={l.status === 'printed' ? 'text-green-500' : l.status === 'failed' ? 'text-red-500' : 'text-amber-500'}>{l.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <style>{`.inp{width:100%;background:rgba(255,255,255,.05);border:1px solid #374151;border-radius:.75rem;padding:.5rem .75rem;font-size:.875rem;outline:none}`}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs opacity-60 block mb-1">{label}</label>
      {children}
    </div>
  )
}

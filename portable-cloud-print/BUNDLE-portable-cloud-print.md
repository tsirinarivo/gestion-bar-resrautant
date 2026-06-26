# portable-cloud-print — bundle complet (tous les fichiers)

Module d'impression cloud XPyun portable. Copie chaque bloc dans le fichier indiqué.

---

## `portable-cloud-print/README.md`

```md
# portable-cloud-print

Module **portable** d'impression de tickets via imprimante cloud **XPyun**.
Branchable sur n'importe quel projet (Express + Prisma + React) **par injection
de dépendances** — aucune dépendance au modèle métier de l'hôte.

```
portable-cloud-print/
├── server/
│   ├── receipt.ts          # buildReceipt() — fonction PURE (0 dépendance)
│   └── printer-router.ts   # createPrinterRouter() + printSaleReceipt()
├── web/
│   └── PrinterSettings.tsx # composant React (prop `api`, sans react-query/lucide)
├── prisma/models.prisma    # 2 modèles à coller dans le schema hôte
└── .env.example            # APP_ENCRYPTION_KEY, XPYUN_DEBUG, DATABASE_URL
```

## Pré-requis (les seules choses spécifiques à XPyun)

1. **Dépendance npm** (dans l'API) :
   ```json
   "imprimantcloud": "git+ssh://git@github.com/tsirinarivo/ImprimantCloud.git#e38c8bd41f33503be7f29e663a1754d31f03fa96"
   ```
   Installé en git+SSH → le build doit avoir un accès SSH au repo.

2. **Patch d'URL XPyun** (gotcha — sinon ça n'imprime pas). Après `npm install`,
   au build (Dockerfile) :
   ```dockerfile
   RUN sed -i \
     -e 's|platform.xpyun.net/api/openapi/xprinter|open.xpyun.net/api/openapi/xprinter|g' \
     -e 's|sg.xpyun.net/api/openapi/xprinter|sg.open.xpyun.net/api/openapi/xprinter|g' \
     -e 's|gm.xpyun.net/api/openapi/xprinter|gm.open.xpyun.net/api/openapi/xprinter|g' \
     node_modules/imprimantcloud/dist/lib/xprint.js
   ```

3. **Modèles Prisma** : copier `prisma/models.prisma` dans le schema hôte → `prisma db push`.

4. **Env** : voir `.env.example`. `APP_ENCRYPTION_KEY` = 64 hex, **constante à vie**.
   ⚠️ Multi-tenant : injecter la clé dans CHAQUE conteneur API tenant. Après ajout,
   **recréer** le conteneur (un `restart` ne relit pas l'env).

## Branchement backend (Express)

```ts
import { createPrinterRouter, printSaleReceipt } from './portable-cloud-print/server/printer-router'

app.use('/api/printer', createPrinterRouter({
  authenticate,                              // ton middleware (remplit req.user)
  authorizeAdmin,                            // ton middleware admin/manager
  getOwnerId: (req) => req.user.shopId,      // l'ID du commerce, à toi de l'extraire
  resolveShop: async (ownerId) => {          // optionnel : en-tête du ticket
    const s = await db.shop.findUnique({ where: { id: ownerId } })
    return s && { name: s.name, address: s.address, phone: s.phone, header: s.invoiceHeader, footer: s.invoiceFooter }
  },
}))

// Impression auto après paiement (fire-and-forget, ne bloque pas la réponse) :
printSaleReceipt(shopId, {
  shop: { name, address, phone, header, footer },
  code: orderNumber, label: `Table ${n}`,
  items: cart.map(i => ({ name: i.name, qty: i.qty, total: i.total })),
  grandTotal,
}).catch(() => {})
```

`getOwnerId` et `resolveShop` sont les **seuls** points d'adaptation : le module
ne sait rien de ton modèle métier, tu lui donnes juste un identifiant + des infos
boutique.

## Branchement frontend (React)

```tsx
import { PrinterSettings } from './portable-cloud-print/web/PrinterSettings'
import { api } from '@/lib/api' // n'importe quel client get/put/post → { data }

export default function Page() {
  return <PrinterSettings api={api} basePath="/printer" />
}
```

## Routes exposées

| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| POST | `/receipt` | authentifié | impression manuelle d'un ticket |
| GET/PUT | `/config` | admin | lire / écrire la config (SN, User, UserKEY…) |
| POST | `/test` | admin | ticket de test |
| GET | `/status` | admin | état imprimante (online/offline/busy) |
| GET | `/logs` | admin | historique |
| POST | `/refresh-logs` | admin | rafraîchir les statuts en attente |

## Vérifs

```bash
# la clé est bien vue par le process API
node -e "console.log(/^[0-9a-fA-F]{64}$/.test(process.env.APP_ENCRYPTION_KEY||''))"  # true
# le chiffrement marche
node -e "console.log(require('imprimantcloud/dist/lib/encrypt').encrypt('x').slice(0,8))"
```
```

---

## `portable-cloud-print/.env.example`

```bash
# Requis par l'impression cloud (à mettre dans l'env de l'API)

# Clé de chiffrement de la UserKEY xpyun (AES-256-GCM). 64 caractères HEX.
# Générer UNE FOIS, ne JAMAIS la changer ensuite :
#   openssl rand -hex 32
# (multi-tenant : la même clé doit être présente dans CHAQUE conteneur API tenant)
APP_ENCRYPTION_KEY=

# "1" = mode debug (n'imprime pas physiquement), "0" = production
XPYUN_DEBUG=0

# La base où sont créées les tables printer_configs / print_logs
# (le package a son propre client Prisma pointé dessus)
DATABASE_URL=
```

---

## `portable-cloud-print/prisma/models.prisma`

```prisma
// ── Modèles requis par le package imprimantcloud ────────────────────────────
// À copier-coller dans le schema.prisma du projet hôte, puis `prisma db push`.
// Le package y lit/écrit via son propre client (DATABASE_URL).

enum PrintLogStatus {
  pending
  printed
  failed
}

model PrinterConfig {
  id        String  @id @default(cuid())
  ownerId   String  @unique   // ID du commerce (tenant / restaurant / shop)
  enabled   Boolean @default(false)
  user      String?            // User xpyun.net
  key       String?            // UserKEY chiffrée (AES-256-GCM via APP_ENCRYPTION_KEY)
  region    String  @default("cn")
  sn        String?            // numéro de série imprimante
  voice     Int?
  header    String?
  footer    String?
  copies    Int     @default(1)
  autoOnSaleConfirm      Boolean @default(true)
  autoOnPaymentConfirm   Boolean @default(true)
  autoOnDeliveryRegister Boolean @default(false)
  updatedAt DateTime @updatedAt

  @@map("printer_configs")
}

model PrintLog {
  id        String         @id @default(cuid())
  ownerId   String
  sn        String
  kind      String
  relatedId String?
  content   String
  copies    Int            @default(1)
  status    PrintLogStatus @default(pending)
  orderId   String?
  error     String?
  failedAt  DateTime?
  createdAt DateTime       @default(now())

  @@index([ownerId, createdAt])
  @@index([status])
  @@map("print_logs")
}
```

---

## `portable-cloud-print/server/receipt.ts`

```ts
/**
 * Générateur de ticket 80mm (48 colonnes) — FONCTION PURE, zéro dépendance.
 * Balises supportées par XPyun : <C> centre, <L> gauche, <B> gras, <BR> saut.
 * Réutilisable tel quel dans n'importe quel projet.
 */

export const RECEIPT_WIDTH = 48

export type ReceiptItem = { name: string; qty: number; total: number }

export type ReceiptInput = {
  shopName: string
  shopAddr?: string | null
  shopPhone?: string | null
  /** Lignes libres sous les coordonnées (mentions légales, MVola, etc.) */
  header?: string | null
  /** Lignes libres en bas (remerciement, WiFi…) */
  footer?: string | null
  /** Libellé table / mode (ex. "Table 4", "À emporter") */
  label?: string | null
  /** Référence ticket/commande affichée */
  code?: string | null
  items: ReceiptItem[]
  grandTotal: number
  /** Devise affichée devant les montants (def. "Ar") */
  currency?: string
  date?: Date
}

function esc(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe').replace(/Œ/g, 'OE')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/</g, '(').replace(/>/g, ')')
}

function rowLine(left: string, right: string): string {
  const pad = RECEIPT_WIDTH - left.length - right.length
  if (pad > 0) return left + ' '.repeat(pad) + right
  return left.slice(0, RECEIPT_WIDTH - right.length - 1) + ' ' + right
}

function fmtMoney(amount: number, currency = 'Ar'): string {
  const n = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount).replace(/ /g, ' ')
  return `${currency} ${n}`
}

/** Construit le contenu XPyun (string) d'un ticket de caisse. */
export function buildReceipt(input: ReceiptInput): string {
  const { shopName, shopAddr, shopPhone, header, footer, label, code, items, grandTotal } = input
  const currency = input.currency ?? 'Ar'
  const now = input.date ?? new Date()
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const dDiv = '='.repeat(RECEIPT_WIDTH)
  const div = '-'.repeat(RECEIPT_WIDTH)

  const lines: string[] = []
  lines.push(dDiv)
  lines.push(`<C><B>${esc(shopName).toUpperCase()}</B></C>`)
  if (shopAddr) lines.push(`<C>${esc(shopAddr)}</C>`)
  if (shopPhone) lines.push(`<C>Tel: ${esc(shopPhone)}</C>`)
  if (header) for (const l of String(header).split('\n')) lines.push(`<C>${esc(l)}</C>`)
  lines.push(dDiv)
  if (code) lines.push(`<L>Ticket  : ${esc(code)}</L>`)
  if (label) lines.push(`<C><B>${esc(label).toUpperCase()}</B></C>`)
  lines.push(`<C>${dateStr}  ${timeStr}</C>`)
  lines.push(div)

  for (const it of items) {
    lines.push(`<L>${rowLine(`${it.qty}x ${esc(it.name)}`, fmtMoney(it.total, currency))}</L>`)
  }

  lines.push(div)
  lines.push(`<C><B>${rowLine('TOTAL', fmtMoney(grandTotal, currency))}</B></C>`)
  lines.push(dDiv)
  lines.push('')
  if (footer) for (const l of String(footer).split('\n')) lines.push(`<C>${esc(l)}</C>`)
  else lines.push('<C>Merci de votre visite !</C>')
  lines.push('')

  return lines.join('<BR>')
}
```

---

## `portable-cloud-print/server/printer-router.ts`

```ts
/**
 * Routeur d'impression cloud PORTABLE — factory à injection de dépendances.
 *
 * Aucune dépendance au projet hôte : tu fournis l'auth, le moyen de récupérer
 * l'ID du commerce, et (optionnel) les coordonnées boutique. Le module s'appuie
 * uniquement sur le package `imprimantcloud`.
 *
 *   import { createPrinterRouter } from './portable-cloud-print/server/printer-router'
 *   app.use('/api/printer', createPrinterRouter({
 *     authenticate,                       // middleware Express (req.user rempli)
 *     authorizeAdmin,                     // middleware Express (manager/admin)
 *     getOwnerId: (req) => req.user.shopId,
 *     resolveShop: async (ownerId) => ({ name, address, phone, header, footer }),
 *   }))
 */
import { Router, type RequestHandler, type Request } from 'express'
import {
  getConfig, updateConfig, printTest, printerStatus,
  getLogs, refreshLogs, sendPrintAndLog,
} from 'imprimantcloud'
import { buildReceipt, type ReceiptItem } from './receipt'

export type ShopInfo = {
  name: string
  address?: string | null
  phone?: string | null
  header?: string | null
  footer?: string | null
}

export type PrinterRouterOptions = {
  /** Middleware qui authentifie et remplit req.user (ou équivalent). */
  authenticate: RequestHandler
  /** Middleware qui restreint aux admins/managers (config, test, logs). */
  authorizeAdmin: RequestHandler
  /** Extrait l'ID du commerce (tenant/restaurant/shop) depuis la requête. */
  getOwnerId: (req: Request) => string
  /** (Optionnel) Coordonnées + en-tête/pied pour l'impression manuelle. */
  resolveShop?: (ownerId: string) => Promise<ShopInfo | null> | ShopInfo | null
}

export function createPrinterRouter(opts: PrinterRouterOptions): Router {
  const { authenticate, authorizeAdmin, getOwnerId, resolveShop } = opts
  const router = Router()
  router.use(authenticate)

  // ── Impression manuelle d'un ticket — tous rôles authentifiés ──────────────
  router.post('/receipt', async (req, res, next) => {
    try {
      const ownerId = getOwnerId(req)
      const body = req.body as {
        items: ReceiptItem[]; grandTotal: number
        label?: string; code?: string; copies?: number
      }
      const shop = (resolveShop ? await resolveShop(ownerId) : null) ?? { name: 'Boutique' }
      const content = buildReceipt({
        shopName: shop.name,
        shopAddr: shop.address ?? null,
        shopPhone: shop.phone ?? null,
        header: shop.header ?? null,
        footer: shop.footer ?? null,
        label: body.label ?? null,
        code: body.code ?? null,
        items: body.items ?? [],
        grandTotal: body.grandTotal ?? 0,
      })
      await sendPrintAndLog(ownerId, content, {
        kind: 'receipt',
        relatedId: body.code ?? `receipt-${Date.now()}`,
        copies: body.copies ?? 1,
      } as any)
      res.json({ success: true })
    } catch (e) { next(e) }
  })

  // ── Routes d'administration ────────────────────────────────────────────────
  router.use(authorizeAdmin)

  router.get('/config', async (req, res, next) => {
    try { res.json({ success: true, data: await getConfig(getOwnerId(req)) }) }
    catch (e) { next(e) }
  })

  router.put('/config', async (req, res, next) => {
    try {
      // Ignore les champs vides pour ne pas casser la validation du package.
      const body = Object.fromEntries(
        Object.entries(req.body as Record<string, unknown>).filter(([, v]) => v !== '' && v !== null),
      )
      const result = await updateConfig(getOwnerId(req), body)
      if (!result.ok) return res.status(422).json({ success: false, error: 'Données invalides', details: result.errors })
      res.json({ success: true, data: result })
    } catch (e) { next(e) }
  })

  router.post('/test', async (req, res, next) => {
    try { res.json({ success: true, data: await printTest(getOwnerId(req)) }) }
    catch (e) { next(e) }
  })

  router.get('/status', async (req, res, next) => {
    try {
      const result = await printerStatus(getOwnerId(req))
      const STATE: Record<number, string> = { [-1]: 'unknown', 0: 'offline', 1: 'online', 2: 'busy' }
      res.json({ success: true, data: { ...result, state: STATE[result.status] ?? 'unknown' } })
    } catch (e) { next(e) }
  })

  router.get('/logs', async (req, res, next) => {
    try {
      const { page = '1', perPage = '20', status } = req.query
      res.json({ success: true, data: await getLogs(getOwnerId(req), {
        page: Number(page), perPage: Number(perPage), status: status as string | undefined,
      }) })
    } catch (e) { next(e) }
  })

  router.post('/refresh-logs', async (req, res, next) => {
    try { res.json({ success: true, data: await refreshLogs(getOwnerId(req)) }) }
    catch (e) { next(e) }
  })

  return router
}

/**
 * Impression automatique d'un ticket de vente, à appeler après paiement /
 * finalisation (fire-and-forget). Prend des données BRUTES — aucune base.
 */
export async function printSaleReceipt(ownerId: string, sale: {
  shop: ShopInfo
  code?: string | null
  label?: string | null
  items: ReceiptItem[]
  grandTotal: number
  copies?: number
}): Promise<void> {
  const content = buildReceipt({
    shopName: sale.shop.name,
    shopAddr: sale.shop.address ?? null,
    shopPhone: sale.shop.phone ?? null,
    header: sale.shop.header ?? null,
    footer: sale.shop.footer ?? null,
    label: sale.label ?? null,
    code: sale.code ?? null,
    items: sale.items,
    grandTotal: sale.grandTotal,
  })
  await sendPrintAndLog(ownerId, content, {
    kind: 'sale_receipt',
    relatedId: sale.code ?? `sale-${Date.now()}`,
    copies: sale.copies ?? 1,
  } as any)
}
```

---

## `portable-cloud-print/web/PrinterSettings.tsx`

```tsx
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
```


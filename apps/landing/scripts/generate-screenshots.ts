/**
 * Génère les screenshots de la vitrine à partir de mockups HTML.
 * Aucune dépendance à un tenant réel, pas d'auth.
 *
 * Usage:
 *   npm --workspace=@restaurant/landing run screenshots
 *
 * Stocke les PNG dans apps/landing/public/screenshots/.
 */

import { chromium } from '@playwright/test'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const OUT_DIR = join(process.cwd(), 'public', 'screenshots')
const VIEWPORT = { width: 1920, height: 1200 } as const

const TAILWIND_HEAD = `
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          brand: {
            50:'#fff7ed',100:'#ffedd5',200:'#fed7aa',300:'#fdba74',400:'#fb923c',
            500:'#f97316',600:'#ea580c',700:'#c2410c',800:'#9a3412',900:'#7c2d12'
          }
        },
        fontFamily: { sans: ['Inter','system-ui','sans-serif'] }
      }
    }
  }
</script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<style>
  body { font-family: Inter, system-ui, sans-serif; }
  .scrollbar-hidden::-webkit-scrollbar { display: none; }
</style>
`

const Icon = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
  orders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  tables: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  stock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
  customers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>',
  employees: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
  caisse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  trending: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="h-4 w-4"><polyline points="20 6 9 17 4 12"/></svg>',
}

const SIDEBAR_ITEMS = [
  ['dashboard', 'Dashboard'],
  ['orders', 'Commandes'],
  ['tables', 'Tables'],
  ['menu', 'Menu'],
  ['stock', 'Stock'],
  ['caisse', 'Caisse'],
  ['customers', 'Clients'],
  ['employees', 'Équipe'],
] as const

function sidebar(active: string): string {
  return `
  <aside class="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
    <div class="flex h-16 items-center gap-2.5 border-b border-slate-200 px-5">
      <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg shadow-md shadow-brand-500/30">🍽️</div>
      <div class="font-bold text-slate-900 tracking-tight">Sakafio</div>
    </div>
    <nav class="flex-1 space-y-1 p-3">
      ${SIDEBAR_ITEMS.map(([k, label]) => `
        <div class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${k === active
          ? 'bg-brand-50 text-brand-700'
          : 'text-slate-600 hover:bg-slate-50'}">
          ${Icon[k as keyof typeof Icon]}
          <span>${label}</span>
        </div>
      `).join('')}
    </nav>
    <div class="border-t border-slate-200 p-3">
      <div class="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
        <div class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white">RH</div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-semibold text-slate-900">Rahaja H.</div>
          <div class="truncate text-xs text-slate-500">Gérant</div>
        </div>
      </div>
    </div>
  </aside>`
}

function topbar(title: string, subtitle?: string): string {
  return `
  <header class="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
    <div>
      <h1 class="text-xl font-bold text-slate-900">${title}</h1>
      ${subtitle ? `<p class="text-xs text-slate-500">${subtitle}</p>` : ''}
    </div>
    <div class="flex items-center gap-3">
      <div class="hidden md:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-500">
        ${Icon.search} <span>Rechercher…</span>
      </div>
      <button class="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
        ${Icon.bell}
        <span class="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand-500"></span>
      </button>
      <div class="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-bold text-white">RH</div>
    </div>
  </header>`
}

const TODAY = '12 juin 2026'

// ────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ────────────────────────────────────────────────────────────────────────────
const DASHBOARD_HTML = `<!DOCTYPE html><html lang="fr"><head>${TAILWIND_HEAD}</head><body class="bg-slate-50">
<div class="flex h-screen overflow-hidden">
  ${sidebar('dashboard')}
  <div class="flex flex-1 flex-col overflow-hidden">
    ${topbar('Dashboard', `Vue d'ensemble — ${TODAY}`)}
    <main class="flex-1 overflow-auto p-6">
      <div class="grid grid-cols-4 gap-4">
        ${[
          ['CA du jour', '1 847 500 Ar', '+12.4%', 'from-emerald-500 to-emerald-700'],
          ['Commandes', '87', '+8 vs hier', 'from-blue-500 to-blue-700'],
          ['Panier moyen', '21 235 Ar', '+5.2%', 'from-brand-500 to-brand-700'],
          ['Clients servis', '142', '+23%', 'from-violet-500 to-violet-700'],
        ].map(([label, value, delta, grad]) => `
          <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium uppercase tracking-wider text-slate-500">${label}</span>
              <div class="rounded-lg bg-gradient-to-br ${grad} p-1.5 text-white">${Icon.trending}</div>
            </div>
            <div class="mt-3 text-2xl font-extrabold text-slate-900">${value}</div>
            <div class="mt-1 text-xs font-semibold text-emerald-600">${delta}</div>
          </div>
        `).join('')}
      </div>

      <div class="mt-6 grid grid-cols-3 gap-4">
        <div class="col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-base font-bold text-slate-900">Chiffre d'affaires — 7 jours</h3>
              <p class="text-xs text-slate-500">Évolution quotidienne en Ariary</p>
            </div>
            <div class="flex gap-1 rounded-lg bg-slate-100 p-1 text-xs font-semibold">
              <span class="rounded-md bg-white px-3 py-1.5 text-slate-900 shadow-sm">7j</span>
              <span class="px-3 py-1.5 text-slate-500">30j</span>
              <span class="px-3 py-1.5 text-slate-500">90j</span>
            </div>
          </div>
          <div class="mt-6 h-56 relative">
            <svg viewBox="0 0 700 220" class="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#ea580c" stop-opacity="0.3"/>
                  <stop offset="100%" stop-color="#ea580c" stop-opacity="0"/>
                </linearGradient>
              </defs>
              <path d="M0,180 L100,140 L200,160 L300,90 L400,110 L500,60 L600,80 L700,40 L700,220 L0,220 Z" fill="url(#g1)" />
              <path d="M0,180 L100,140 L200,160 L300,90 L400,110 L500,60 L600,80 L700,40" stroke="#ea580c" stroke-width="3" fill="none" />
              ${[0,100,200,300,400,500,600,700].map((x,i) => {
                const ys = [180,140,160,90,110,60,80,40]
                return `<circle cx="${x}" cy="${ys[i]}" r="4" fill="#ea580c"/><circle cx="${x}" cy="${ys[i]}" r="2" fill="white"/>`
              }).join('')}
            </svg>
            <div class="absolute -bottom-2 left-0 right-0 flex justify-between text-xs text-slate-400 px-1">
              ${['Mer','Jeu','Ven','Sam','Dim','Lun','Mar','Auj'].map(d => `<span>${d}</span>`).join('')}
            </div>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 class="text-base font-bold text-slate-900">Top plats — aujourd'hui</h3>
          <div class="mt-4 space-y-3">
            ${[
              ['Romazava au zébu','42 portions','672 000 Ar'],
              ['Brochettes de poulet','38 portions','456 000 Ar'],
              ['Ravitoto au porc','29 portions','435 000 Ar'],
              ['Mofo Gasy','51 portions','153 000 Ar'],
              ['THB pression','67 verres','268 000 Ar'],
            ].map(([name,qty,ca], i) => `
              <div class="flex items-center gap-3">
                <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700">${i+1}</div>
                <div class="flex-1 min-w-0">
                  <div class="truncate text-sm font-semibold text-slate-900">${name}</div>
                  <div class="text-xs text-slate-500">${qty}</div>
                </div>
                <div class="text-sm font-bold text-slate-900">${ca}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="mt-6 grid grid-cols-2 gap-4">
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-bold text-slate-900">Alertes stock</h3>
            <span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">4</span>
          </div>
          <div class="mt-4 space-y-2.5">
            ${[
              ['Bœuf zébu (kg)', '2.4 kg', 'min. 5 kg', 'bg-red-50 text-red-700'],
              ['Riz blanc (kg)', '8 kg', 'min. 15 kg', 'bg-amber-50 text-amber-700'],
              ['THB 33cl', '24 btl', 'min. 48 btl', 'bg-amber-50 text-amber-700'],
              ['Huile végétale (L)', '3.5 L', 'min. 8 L', 'bg-red-50 text-red-700'],
            ].map(([name, cur, min, cls]) => `
              <div class="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <div class="flex items-center gap-2">
                  <div class="${cls} rounded-md p-1">${Icon.alert}</div>
                  <div>
                    <div class="text-sm font-semibold text-slate-900">${name}</div>
                    <div class="text-xs text-slate-500">Restant ${cur} · ${min}</div>
                  </div>
                </div>
                <button class="rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Commander</button>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 class="text-base font-bold text-slate-900">Planning de l'après-midi</h3>
          <div class="mt-4 space-y-3">
            ${[
              ['Rina A.', 'Service', '14:00 → 22:00', 'bg-blue-100 text-blue-700'],
              ['Tahina R.', 'Cuisine', '15:00 → 23:00', 'bg-emerald-100 text-emerald-700'],
              ['Noé F.', 'Caisse', '17:00 → 23:00', 'bg-violet-100 text-violet-700'],
              ['Lala M.', 'Bar', '18:00 → 02:00', 'bg-brand-100 text-brand-700'],
            ].map(([name, role, hours, cls]) => `
              <div class="flex items-center gap-3 rounded-lg border border-slate-100 p-2.5">
                <div class="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-400 to-slate-600 text-xs font-bold text-white">${name.split(' ').map(s=>s[0]).join('')}</div>
                <div class="flex-1">
                  <div class="text-sm font-semibold text-slate-900">${name}</div>
                  <span class="${cls} mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium">${role}</span>
                </div>
                <div class="flex items-center gap-1 text-xs font-medium text-slate-500">${Icon.clock} ${hours}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </main>
  </div>
</div>
</body></html>`

// ────────────────────────────────────────────────────────────────────────────
// STOCK
// ────────────────────────────────────────────────────────────────────────────
const STOCK_HTML = `<!DOCTYPE html><html lang="fr"><head>${TAILWIND_HEAD}</head><body class="bg-slate-50">
<div class="flex h-screen overflow-hidden">
  ${sidebar('stock')}
  <div class="flex flex-1 flex-col overflow-hidden">
    ${topbar('Stock', 'Inventaire multi-entrepôts')}
    <main class="flex-1 overflow-auto p-6">
      <div class="mb-5 flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          ${Icon.search} <span class="text-slate-400">Rechercher un article…</span>
        </div>
        <select class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          <option>Tous les entrepôts</option>
        </select>
        <select class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          <option>Toutes catégories</option>
        </select>
        <div class="ml-auto flex gap-2">
          <button class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Importer CSV</button>
          <button class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm">+ Nouvel article</button>
        </div>
      </div>

      <div class="grid grid-cols-4 gap-3 mb-5">
        ${[
          ['Articles', '247', 'text-slate-900'],
          ['Stock critique', '4', 'text-red-600'],
          ['Stock faible', '12', 'text-amber-600'],
          ['Valeur stock', '38.4M Ar', 'text-emerald-600'],
        ].map(([l,v,c]) => `
          <div class="rounded-xl border border-slate-200 bg-white p-4">
            <div class="text-xs font-medium uppercase tracking-wider text-slate-500">${l}</div>
            <div class="mt-1 text-2xl font-extrabold ${c}">${v}</div>
          </div>
        `).join('')}
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-5 py-3 text-left">Article</th>
              <th class="px-5 py-3 text-left">Catégorie</th>
              <th class="px-5 py-3 text-left">Entrepôt</th>
              <th class="px-5 py-3 text-right">Stock</th>
              <th class="px-5 py-3 text-right">Prix unitaire</th>
              <th class="px-5 py-3 text-right">Valeur</th>
              <th class="px-5 py-3 text-center">État</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${[
              ['Bœuf zébu', '🥩', 'Viandes', 'Cuisine', '2.4 kg', '24 000 Ar/kg', '57 600 Ar', 'critique'],
              ['Riz blanc', '🌾', 'Féculents', 'Sec', '8 kg', '2 800 Ar/kg', '22 400 Ar', 'faible'],
              ['Poulet fermier', '🐔', 'Viandes', 'Cuisine', '14.2 kg', '18 000 Ar/kg', '255 600 Ar', 'ok'],
              ['THB 33cl', '🍺', 'Boissons', 'Bar', '24 btl', '3 200 Ar', '76 800 Ar', 'faible'],
              ['Brèdes mafana', '🌿', 'Légumes', 'Cuisine', '6.8 kg', '4 500 Ar/kg', '30 600 Ar', 'ok'],
              ['Huile végétale', '🛢️', 'Épicerie', 'Sec', '3.5 L', '12 000 Ar/L', '42 000 Ar', 'critique'],
              ['Tomates fraîches', '🍅', 'Légumes', 'Cuisine', '11.5 kg', '3 800 Ar/kg', '43 700 Ar', 'ok'],
              ['Cocacola 1.5L', '🥤', 'Boissons', 'Bar', '38 btl', '5 500 Ar', '209 000 Ar', 'ok'],
              ['Vanille Madagascar', '🌱', 'Épicerie', 'Sec', '450 g', '180 000 Ar/kg', '81 000 Ar', 'ok'],
              ['Crevettes', '🦐', 'Poissons', 'Cuisine', '4.2 kg', '38 000 Ar/kg', '159 600 Ar', 'faible'],
            ].map(([name, emo, cat, wh, stock, price, value, state]) => {
              const stateClass = state === 'critique'
                ? 'bg-red-100 text-red-700'
                : state === 'faible' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
              const stateLabel = state === 'critique' ? '⚠ Critique' : state === 'faible' ? '! Faible' : '✓ OK'
              return `
                <tr class="hover:bg-slate-50">
                  <td class="px-5 py-3.5">
                    <div class="flex items-center gap-3">
                      <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-lg">${emo}</div>
                      <div class="font-semibold text-slate-900">${name}</div>
                    </div>
                  </td>
                  <td class="px-5 py-3.5 text-slate-600">${cat}</td>
                  <td class="px-5 py-3.5 text-slate-600">${wh}</td>
                  <td class="px-5 py-3.5 text-right font-semibold text-slate-900">${stock}</td>
                  <td class="px-5 py-3.5 text-right text-slate-700">${price}</td>
                  <td class="px-5 py-3.5 text-right font-semibold text-slate-900">${value}</td>
                  <td class="px-5 py-3.5 text-center"><span class="rounded-full ${stateClass} px-2.5 py-1 text-xs font-semibold">${stateLabel}</span></td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>
      </div>
    </main>
  </div>
</div>
</body></html>`

// ────────────────────────────────────────────────────────────────────────────
// CAISSE
// ────────────────────────────────────────────────────────────────────────────
const CAISSE_HTML = `<!DOCTYPE html><html lang="fr"><head>${TAILWIND_HEAD}</head><body class="bg-slate-50">
<div class="flex h-screen overflow-hidden">
  ${sidebar('caisse')}
  <div class="flex flex-1 flex-col overflow-hidden">
    ${topbar('Caisse', `Session ouverte par Noé F. — depuis 14h12 · ${TODAY}`)}
    <main class="flex-1 overflow-auto p-6">
      <div class="grid grid-cols-3 gap-4">
        ${[
          ['Fond de caisse initial', '150 000 Ar', '', 'text-slate-900'],
          ['Encaissements', '1 847 500 Ar', '+87 ventes', 'text-emerald-600'],
          ['Solde théorique', '1 997 500 Ar', '', 'text-slate-900'],
        ].map(([l,v,sub,c]) => `
          <div class="rounded-2xl border border-slate-200 bg-white p-5">
            <div class="text-xs font-medium uppercase tracking-wider text-slate-500">${l}</div>
            <div class="mt-2 text-3xl font-extrabold ${c}">${v}</div>
            ${sub ? `<div class="mt-1 text-xs font-semibold text-slate-500">${sub}</div>` : ''}
          </div>
        `).join('')}
      </div>

      <div class="mt-6 grid grid-cols-2 gap-4">
        <div class="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 class="font-bold text-slate-900">Comptage des coupures MGA</h3>
          <p class="text-xs text-slate-500 mt-0.5">Saisissez le nombre de billets par coupure</p>
          <div class="mt-4 space-y-2">
            ${[
              [20000, 12, 240000],
              [10000, 38, 380000],
              [5000, 67, 335000],
              [2000, 89, 178000],
              [1000, 124, 124000],
              [500, 87, 43500],
              [200, 156, 31200],
              [100, 234, 23400],
            ].map(([denom, count, total]) => `
              <div class="flex items-center gap-3 rounded-lg border border-slate-100 p-2.5">
                <div class="w-20 text-sm font-bold text-slate-900">${(denom as number).toLocaleString('fr-FR')} Ar</div>
                <input type="text" value="${count}" class="w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-sm font-semibold" />
                <div class="flex-1 text-right text-sm font-semibold text-slate-900">${(total as number).toLocaleString('fr-FR')} Ar</div>
              </div>
            `).join('')}
            <div class="flex items-center justify-between rounded-lg bg-brand-50 border border-brand-200 px-4 py-3 mt-3">
              <span class="text-sm font-bold text-brand-900">Total compté</span>
              <span class="text-lg font-extrabold text-brand-700">1 355 100 Ar</span>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <div class="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 class="font-bold text-slate-900">Ventilation des paiements</h3>
            <div class="mt-4 space-y-3">
              ${[
                ['💵 Cash', '1 355 100 Ar', '73.4%', 'bg-emerald-500'],
                ['📱 MVola', '215 000 Ar', '11.6%', 'bg-amber-500'],
                ['🟠 Orange Money', '128 500 Ar', '7.0%', 'bg-orange-500'],
                ['💳 Carte', '98 900 Ar', '5.4%', 'bg-blue-500'],
                ['🏦 BNI Mobile', '50 000 Ar', '2.7%', 'bg-violet-500'],
              ].map(([label, val, pct, bar]) => `
                <div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="font-medium text-slate-700">${label}</span>
                    <span class="font-bold text-slate-900">${val}</span>
                  </div>
                  <div class="mt-1 flex items-center gap-2">
                    <div class="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div class="h-full ${bar}" style="width:${pct}"></div>
                    </div>
                    <span class="w-12 text-right text-xs font-semibold text-slate-500">${pct}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 p-5 text-white shadow-lg shadow-brand-500/30">
            <div class="text-xs uppercase tracking-wider text-brand-100">Écart caisse</div>
            <div class="mt-1 text-3xl font-extrabold">+ 0 Ar</div>
            <div class="mt-1 text-sm text-brand-100">Compte juste ✓</div>
            <button class="mt-4 w-full rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-brand-700 shadow-md">Clôturer la session</button>
          </div>
        </div>
      </div>
    </main>
  </div>
</div>
</body></html>`

// ────────────────────────────────────────────────────────────────────────────
// EMPLOYEES
// ────────────────────────────────────────────────────────────────────────────
const EMPLOYEES_HTML = `<!DOCTYPE html><html lang="fr"><head>${TAILWIND_HEAD}</head><body class="bg-slate-50">
<div class="flex h-screen overflow-hidden">
  ${sidebar('employees')}
  <div class="flex flex-1 flex-col overflow-hidden">
    ${topbar('Équipe', '12 membres actifs · 4 en service')}
    <main class="flex-1 overflow-auto p-6">
      <div class="mb-5 flex items-center gap-2">
        <div class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          ${Icon.search} <span class="text-slate-400">Rechercher…</span>
        </div>
        <div class="flex gap-1 rounded-lg bg-white border border-slate-200 p-1 text-xs font-semibold">
          <span class="rounded-md bg-brand-50 px-3 py-1.5 text-brand-700">Tous</span>
          <span class="px-3 py-1.5 text-slate-500">Cuisine</span>
          <span class="px-3 py-1.5 text-slate-500">Service</span>
          <span class="px-3 py-1.5 text-slate-500">Bar</span>
          <span class="px-3 py-1.5 text-slate-500">Caisse</span>
        </div>
        <div class="ml-auto flex gap-2">
          <button class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Voir planning</button>
          <button class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm">+ Nouvel employé</button>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-4">
        ${[
          ['Rina A.', 'Serveuse', 'Service', '🟢 En service', '152h ce mois', 'from-pink-400 to-pink-600'],
          ['Tahina R.', 'Chef de cuisine', 'Cuisine', '🟢 En service', '168h ce mois', 'from-emerald-400 to-emerald-600'],
          ['Noé F.', 'Caissier', 'Caisse', '🟢 En service', '144h ce mois', 'from-violet-400 to-violet-600'],
          ['Lala M.', 'Barmaid', 'Bar', '🟢 En service', '160h ce mois', 'from-brand-400 to-brand-600'],
          ['Andry P.', 'Cuisinier', 'Cuisine', '🌙 Repos', '128h ce mois', 'from-blue-400 to-blue-600'],
          ['Hery N.', 'Plongeur', 'Cuisine', '🌙 Repos', '140h ce mois', 'from-slate-400 to-slate-600'],
          ['Faly R.', 'Serveur', 'Service', '🌙 Repos', '136h ce mois', 'from-amber-400 to-amber-600'],
          ['Mialy A.', 'Hôtesse', 'Service', '🟢 En service', '124h ce mois', 'from-rose-400 to-rose-600'],
          ['Tojo K.', 'Aide-cuisine', 'Cuisine', '🌙 Congé', '88h ce mois', 'from-teal-400 to-teal-600'],
        ].map(([name, role, dept, status, hours, grad]) => `
          <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div class="flex items-start gap-4">
              <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${grad} text-base font-bold text-white shadow-md">${name.split(' ').map(s=>s[0]).join('')}</div>
              <div class="flex-1 min-w-0">
                <div class="text-base font-bold text-slate-900">${name}</div>
                <div class="text-sm text-slate-500">${role}</div>
                <span class="mt-1.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">${dept}</span>
              </div>
            </div>
            <div class="mt-4 flex items-center justify-between text-xs">
              <span class="font-semibold">${status}</span>
              <span class="text-slate-500">${hours}</span>
            </div>
            <div class="mt-3 grid grid-cols-7 gap-1">
              ${['L','M','M','J','V','S','D'].map((d,i) => {
                const on = i < 5
                return `<div class="text-center">
                  <div class="text-[10px] font-semibold text-slate-400">${d}</div>
                  <div class="mt-1 h-2 rounded-full ${on ? 'bg-emerald-400' : 'bg-slate-200'}"></div>
                </div>`
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </main>
  </div>
</div>
</body></html>`

// ────────────────────────────────────────────────────────────────────────────
// POS
// ────────────────────────────────────────────────────────────────────────────
const POS_HTML = `<!DOCTYPE html><html lang="fr"><head>${TAILWIND_HEAD}</head><body class="bg-slate-900">
<div class="flex h-screen text-white">
  <!-- LEFT: products / tables -->
  <div class="flex-1 flex flex-col">
    <header class="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950 px-6">
      <div class="flex items-center gap-3">
        <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg">🍽️</div>
        <div class="font-bold tracking-tight">Sakafio POS</div>
        <span class="ml-3 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">● En ligne</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="rounded-lg bg-slate-800 px-3 py-1.5 text-sm">
          <span class="text-slate-400">Session :</span> <span class="font-semibold">14h12 → maintenant</span>
        </div>
        <div class="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-bold">NF</div>
      </div>
    </header>

    <div class="flex gap-2 px-6 pt-5 flex-wrap">
      ${[
        ['Toutes', true], ['🍽️ Plats', false], ['🥗 Entrées', false], ['🍰 Desserts', false], ['🍺 Bières', false], ['🥤 Soft', false], ['☕ Cafés', false], ['🍷 Vins', false],
      ].map(([label, active]) => `
        <button class="rounded-full px-4 py-2 text-sm font-semibold ${active ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30' : 'bg-slate-800 text-slate-300'}">${label}</button>
      `).join('')}
    </div>

    <div class="grid grid-cols-4 gap-3 p-6 overflow-auto flex-1">
      ${[
        ['Romazava au zébu', '16 000 Ar', '🥩', 'Plat'],
        ['Ravitoto au porc', '15 000 Ar', '🐷', 'Plat'],
        ['Brochettes poulet', '12 000 Ar', '🍢', 'Plat'],
        ['Akoho gasy', '14 000 Ar', '🐔', 'Plat'],
        ['Crevettes coco', '22 000 Ar', '🦐', 'Plat'],
        ['Salade composée', '8 500 Ar', '🥗', 'Entrée'],
        ['Mofo gasy', '3 000 Ar', '🥯', 'Petit-déj'],
        ['Frites maison', '6 000 Ar', '🍟', 'Side'],
        ['Mousse vanille', '6 500 Ar', '🍮', 'Dessert'],
        ['Glace coco', '5 000 Ar', '🍨', 'Dessert'],
        ['THB pression 50cl', '4 000 Ar', '🍺', 'Boisson'],
        ['Cocacola 33cl', '3 500 Ar', '🥤', 'Boisson'],
      ].map(([name, price, emo, badge]) => `
        <button class="group rounded-2xl bg-slate-800 hover:bg-slate-700 transition-colors p-4 text-left border border-slate-700 hover:border-brand-500/50">
          <div class="aspect-square rounded-xl bg-slate-700/50 flex items-center justify-center text-5xl mb-3">${emo}</div>
          <div class="text-xs uppercase tracking-wider text-slate-400">${badge}</div>
          <div class="mt-1 font-bold text-sm leading-tight">${name}</div>
          <div class="mt-2 font-extrabold text-brand-400">${price}</div>
        </button>
      `).join('')}
    </div>
  </div>

  <!-- RIGHT: cart -->
  <aside class="w-[420px] border-l border-slate-800 bg-slate-950 flex flex-col">
    <div class="border-b border-slate-800 p-5">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xs uppercase tracking-wider text-slate-400">Table en cours</div>
          <div class="font-extrabold text-xl">Table 7 · 4 couverts</div>
        </div>
        <span class="rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold text-red-400">● Occupée</span>
      </div>
    </div>

    <div class="flex-1 overflow-auto px-5 py-4 space-y-3">
      ${[
        ['Romazava au zébu', 2, '16 000 Ar', '32 000 Ar'],
        ['Brochettes poulet', 3, '12 000 Ar', '36 000 Ar'],
        ['THB pression 50cl', 4, '4 000 Ar', '16 000 Ar'],
        ['Mousse vanille', 2, '6 500 Ar', '13 000 Ar'],
        ['Frites maison', 1, '6 000 Ar', '6 000 Ar'],
      ].map(([name, qty, unit, total]) => `
        <div class="rounded-xl bg-slate-800 p-3 border border-slate-700">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <div class="font-semibold truncate">${name}</div>
              <div class="text-xs text-slate-400">${unit} l'unité</div>
            </div>
            <div class="font-bold text-brand-400">${total}</div>
          </div>
          <div class="mt-2 flex items-center gap-2">
            <button class="h-7 w-7 rounded-md bg-slate-700 font-bold">−</button>
            <span class="font-bold w-6 text-center">${qty}</span>
            <button class="h-7 w-7 rounded-md bg-slate-700 font-bold">+</button>
            <button class="ml-auto text-xs text-slate-500 hover:text-red-400">Retirer</button>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="border-t border-slate-800 p-5 space-y-2">
      <div class="flex justify-between text-sm text-slate-400">
        <span>Sous-total</span><span>103 000 Ar</span>
      </div>
      <div class="flex justify-between text-sm text-slate-400">
        <span>Service (10%)</span><span>10 300 Ar</span>
      </div>
      <div class="flex justify-between text-xl font-extrabold pt-2 border-t border-slate-800">
        <span>Total</span><span class="text-brand-400">113 300 Ar</span>
      </div>
      <div class="grid grid-cols-2 gap-2 pt-3">
        <button class="rounded-xl bg-slate-800 py-3 text-sm font-bold">Envoyer en cuisine</button>
        <button class="rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 py-3 text-sm font-bold shadow-lg shadow-brand-500/40">Encaisser →</button>
      </div>
      <div class="grid grid-cols-5 gap-1.5 pt-2">
        ${['💵','📱','🟠','🔴','💳'].map(e => `<button class="rounded-lg bg-slate-800 py-2 text-lg">${e}</button>`).join('')}
      </div>
    </div>
  </aside>
</div>
</body></html>`

// ────────────────────────────────────────────────────────────────────────────
// KDS
// ────────────────────────────────────────────────────────────────────────────
const KDS_HTML = `<!DOCTYPE html><html lang="fr"><head>${TAILWIND_HEAD}</head><body class="bg-slate-950">
<div class="flex h-screen flex-col text-white">
  <header class="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-900 px-6">
    <div class="flex items-center gap-3">
      <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg">🍽️</div>
      <div class="font-bold tracking-tight">Sakafio — KDS Cuisine</div>
    </div>
    <div class="flex gap-2">
      ${[
        ['Toutes',true,'8'],['Chaud',false,'4'],['Froid',false,'2'],['Boissons',false,'1'],['Desserts',false,'1'],
      ].map(([l,a,n]) => `
        <button class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${a ? 'bg-brand-500 text-white' : 'bg-slate-800 text-slate-300'}">${l} <span class="rounded-full bg-black/30 px-2 py-0.5 text-xs">${n}</span></button>
      `).join('')}
    </div>
    <div class="text-right">
      <div class="text-xs text-slate-400">Cuisinier</div>
      <div class="font-bold">Tahina R.</div>
    </div>
  </header>

  <div class="flex-1 grid grid-cols-4 gap-4 p-5 overflow-auto">
    ${[
      {
        table:'Table 7', n:'#1287', time:'3 min', station:'Chaud', urgency:'normal',
        items:[
          ['Romazava au zébu', 2, ''],
          ['Brochettes poulet', 3, 'bien cuit'],
          ['Frites maison', 1, ''],
        ],
        sent:'14:42'
      },
      {
        table:'Table 3', n:'#1286', time:'7 min', station:'Chaud', urgency:'warn',
        items:[
          ['Ravitoto au porc', 1, 'sans piment'],
          ['Akoho gasy', 2, ''],
        ],
        sent:'14:38'
      },
      {
        table:'Emporté', n:'#1285', time:'12 min', station:'Chaud', urgency:'late',
        items:[
          ['Crevettes coco', 1, ''],
          ['Riz blanc x2', 1, ''],
          ['Salade composée', 1, ''],
        ],
        sent:'14:33'
      },
      {
        table:'Table 12', n:'#1288', time:'1 min', station:'Froid', urgency:'normal',
        items:[
          ['Salade composée', 2, 'sans tomate'],
          ['Mofo gasy', 4, ''],
        ],
        sent:'14:44'
      },
      {
        table:'Table 5', n:'#1284', time:'9 min', station:'Chaud', urgency:'warn',
        items:[
          ['Brochettes poulet', 4, ''],
          ['Frites maison', 2, ''],
        ],
        sent:'14:36'
      },
      {
        table:'Bar', n:'#1289', time:'2 min', station:'Boissons', urgency:'normal',
        items:[
          ['THB pression 50cl', 4, ''],
          ['Cocacola 33cl', 2, ''],
        ],
        sent:'14:43'
      },
      {
        table:'Table 9', n:'#1283', time:'15 min', station:'Chaud', urgency:'late',
        items:[
          ['Akoho gasy', 1, 'à point'],
          ['Romazava au zébu', 1, ''],
        ],
        sent:'14:30'
      },
      {
        table:'Table 2', n:'#1290', time:'4 min', station:'Desserts', urgency:'normal',
        items:[
          ['Mousse vanille', 3, ''],
          ['Glace coco', 1, ''],
        ],
        sent:'14:41'
      },
    ].map(t => {
      const headerBg = t.urgency === 'late' ? 'bg-red-600' : t.urgency === 'warn' ? 'bg-amber-500' : 'bg-emerald-600'
      return `
      <div class="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden flex flex-col">
        <div class="${headerBg} px-4 py-3 flex items-center justify-between">
          <div>
            <div class="text-xs font-bold uppercase tracking-wider text-white/80">${t.station}</div>
            <div class="font-extrabold text-lg leading-tight">${t.table}</div>
          </div>
          <div class="text-right">
            <div class="text-xs font-semibold text-white/80">${t.n}</div>
            <div class="text-2xl font-extrabold font-mono">${t.time}</div>
          </div>
        </div>
        <div class="flex-1 p-4 space-y-2.5">
          ${t.items.map(([name, qty, note]) => `
            <div>
              <div class="flex items-baseline gap-2">
                <span class="text-2xl font-extrabold text-brand-400">×${qty}</span>
                <span class="font-bold text-base leading-tight">${name}</span>
              </div>
              ${note ? `<div class="ml-9 text-xs font-semibold text-amber-300">→ ${note}</div>` : ''}
            </div>
          `).join('')}
        </div>
        <div class="border-t border-slate-800 px-4 py-2.5 flex items-center justify-between">
          <div class="text-xs text-slate-500">Envoyée à ${t.sent}</div>
          <button class="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold shadow-md">${Icon.check} Prête</button>
        </div>
      </div>
      `
    }).join('')}
  </div>
</div>
</body></html>`

const SCREENS: Array<{ id: string; html: string }> = [
  { id: 'dashboard', html: DASHBOARD_HTML },
  { id: 'stock', html: STOCK_HTML },
  { id: 'caisse', html: CAISSE_HTML },
  { id: 'employees', html: EMPLOYEES_HTML },
  { id: 'pos', html: POS_HTML },
  { id: 'kds', html: KDS_HTML },
]

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    locale: 'fr-FR',
  })

  try {
    for (const screen of SCREENS) {
      const tmpFile = join(tmpdir(), `sakafio-${screen.id}-${Date.now()}.html`)
      await writeFile(tmpFile, screen.html)

      const page = await context.newPage()
      console.log(`→ ${screen.id}`)
      await page.goto(`file://${tmpFile}`, { waitUntil: 'networkidle' })
      // attend que Tailwind CDN + fonts soient appliqués
      await page.waitForTimeout(2500)

      const out = join(OUT_DIR, `${screen.id}.png`)
      await page.screenshot({ path: out, fullPage: false })
      console.log(`  ✓ ${out}`)

      await page.close()
      await rm(tmpFile, { force: true })
    }
  } finally {
    await context.close()
    await browser.close()
  }

  console.log('\n✓ Screenshots générés dans', OUT_DIR)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

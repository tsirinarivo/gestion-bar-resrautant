/**
 * Génère les screenshots de l'app pour la vitrine sakafio.mg
 *
 * Usage:
 *   SCREENSHOT_TENANT=bar \
 *   SCREENSHOT_EMAIL=botonavao@gmail.com \
 *   SCREENSHOT_PASSWORD='xxx' \
 *   npm --workspace=@restaurant/landing run screenshots
 *
 * Stocke les PNG dans apps/landing/public/screenshots/.
 * À commit après chaque grosse évolution UI.
 */

import { chromium, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const TENANT = process.env.SCREENSHOT_TENANT || 'bar'
const EMAIL = process.env.SCREENSHOT_EMAIL || 'botonavao@gmail.com'
const PASSWORD = process.env.SCREENSHOT_PASSWORD || ''
const BASE_DOMAIN = process.env.SCREENSHOT_BASE_DOMAIN || 'sakafio.mg'

const OUT_DIR = join(process.cwd(), 'public', 'screenshots')

const VIEWPORT = { width: 1920, height: 1200 } as const

type Shot = {
  id: string
  app: 'admin' | 'pos' | 'kds'
  path: string
  wait?: (page: Page) => Promise<void>
}

const SHOTS: Shot[] = [
  { id: 'dashboard', app: 'admin', path: '/dashboard' },
  { id: 'stock', app: 'admin', path: '/inventory' },
  { id: 'caisse', app: 'admin', path: '/caisse' },
  { id: 'employees', app: 'admin', path: '/employees' },
  { id: 'pos', app: 'pos', path: '/' },
  { id: 'kds', app: 'kds', path: '/' },
]

function urlFor(app: Shot['app'], path: string): string {
  const sub = app === 'admin' ? `admin-${TENANT}` : `${app}-${TENANT}`
  return `https://${sub}.${BASE_DOMAIN}${path}`
}

async function login(page: Page, app: Shot['app']): Promise<void> {
  // POS et KDS sont des SPA single-page : le login est sur '/', pas '/login'
  const loginPath = app === 'admin' ? '/login' : '/'
  const loginUrl = urlFor(app, loginPath)
  console.log(`    goto ${loginUrl}`)
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  try {
    await page.waitForLoadState('networkidle', { timeout: 10_000 })
  } catch {}

  const emailInput = page.locator('input[type="email"], input[name="email"]').first()
  try {
    await emailInput.waitFor({ state: 'visible', timeout: 30_000 })
  } catch (err) {
    const debug = join(OUT_DIR, `_debug-login-${app}.png`)
    await page.screenshot({ path: debug, fullPage: true }).catch(() => {})
    console.error(`    Login form introuvable — debug screenshot: ${debug}`)
    console.error(`    Page URL au moment de l'erreur: ${page.url()}`)
    throw err
  }

  await emailInput.fill(EMAIL)
  await page.locator('input[type="password"]').first().fill(PASSWORD)
  await page.locator('button[type="submit"]').first().click()
  try {
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
  } catch {}
  await page.waitForTimeout(1500)
}

async function main(): Promise<void> {
  if (!PASSWORD) {
    console.error('SCREENSHOT_PASSWORD est requis.')
    process.exit(1)
  }

  await mkdir(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    locale: 'fr-FR',
    timezoneId: 'Indian/Antananarivo',
    ignoreHTTPSErrors: true,
  })
  context.setDefaultNavigationTimeout(60_000)
  context.setDefaultTimeout(30_000)

  try {
    const byApp = SHOTS.reduce<Record<Shot['app'], Shot[]>>(
      (acc, s) => {
        acc[s.app].push(s)
        return acc
      },
      { admin: [], pos: [], kds: [] },
    )

    for (const app of ['admin', 'pos', 'kds'] as const) {
      const shots = byApp[app]
      if (shots.length === 0) continue

      const page = await context.newPage()
      console.log(`→ Login ${app}…`)
      await login(page, app)

      for (const shot of shots) {
        const target = urlFor(shot.app, shot.path)
        console.log(`  · ${shot.id} (${target})`)
        await page.goto(target, { waitUntil: 'networkidle' })
        if (shot.wait) await shot.wait(page)
        await page.waitForTimeout(2500)
        const out = join(OUT_DIR, `${shot.id}.png`)
        await page.screenshot({ path: out, fullPage: false })
        console.log(`    ✓ ${out}`)
      }

      await page.close()
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

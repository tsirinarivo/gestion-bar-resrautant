import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

const DATA_DIR = process.env['IMPORT_DIR'] ?? '/import-data'
const ADMIN_EMAIL = process.env['ADMIN_EMAIL'] ?? ''
const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'] ?? ''
const ADMIN_FIRST_NAME = process.env['ADMIN_FIRST_NAME'] ?? 'Admin'
const ADMIN_LAST_NAME = process.env['ADMIN_LAST_NAME'] ?? 'Principal'

// ── Minimal CSV parser (handles quoted fields with commas) ──────────────────
function parseCSV(content: string): Record<string, string>[] {
  const lines: string[] = []
  let current = ''
  let inQuotes = false
  for (const ch of content) {
    if (ch === '"') { inQuotes = !inQuotes; current += ch }
    else if (ch === '\n' && !inQuotes) { lines.push(current); current = '' }
    else if (ch === '\r' && !inQuotes) { continue }
    else { current += ch }
  }
  if (current.length > 0) lines.push(current)

  const rows = lines.filter(l => l.trim().length > 0)
  if (rows.length === 0) return []

  function splitRow(row: string): string[] {
    const fields: string[] = []
    let field = ''
    let quoted = false
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]
      if (ch === '"') {
        if (quoted && row[i + 1] === '"') { field += '"'; i++ }
        else quoted = !quoted
      } else if (ch === ',' && !quoted) {
        fields.push(field); field = ''
      } else {
        field += ch
      }
    }
    fields.push(field)
    return fields.map(f => f.trim())
  }

  const headers = splitRow(rows[0]!)
  return rows.slice(1).map(line => {
    const values = splitRow(line)
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = values[i] ?? '' })
    return obj
  })
}

function readCSV(filename: string): Record<string, string>[] {
  const p = path.join(DATA_DIR, filename)
  if (!fs.existsSync(p)) {
    console.log(`⚠️  ${filename} introuvable — sauté`)
    return []
  }
  return parseCSV(fs.readFileSync(p, 'utf-8'))
}

function bool(v: string | undefined, defaultV = false): boolean {
  if (v === undefined || v === '') return defaultV
  return v.toLowerCase() === 'true' || v === '1'
}

function num(v: string | undefined, defaultV = 0): number {
  if (v === undefined || v === '') return defaultV
  const n = Number(v)
  return isNaN(n) ? defaultV : n
}

function nonEmpty(v: string | undefined): string | null {
  return v && v.trim().length > 0 ? v.trim() : null
}

async function main() {
  console.log('🚀 Import des données réelles')
  console.log(`📂 Dossier source : ${DATA_DIR}`)

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('❌ ADMIN_EMAIL et ADMIN_PASSWORD doivent être définis')
    process.exit(1)
  }

  // ── 1. Rôles système ────────────────────────────────────────────────────────
  const roleData = [
    { name: 'superadmin', displayName: 'Super Administrateur', isSystem: true },
    { name: 'manager',    displayName: 'Manager',              isSystem: true },
    { name: 'caissier',   displayName: 'Caissier',             isSystem: true },
    { name: 'serveur',    displayName: 'Serveur',              isSystem: true },
    { name: 'cuisinier',  displayName: 'Cuisinier',            isSystem: true },
    { name: 'client',     displayName: 'Client',               isSystem: true },
  ]
  const roles: Record<string, { id: string }> = {}
  for (const r of roleData) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: {},
      create: r,
    })
    roles[r.name] = role
  }
  console.log('✅ Rôles système créés')

  // ── 2. Restaurant ──────────────────────────────────────────────────────────
  const restaurantRows = readCSV('restaurant.csv')
  if (restaurantRows.length === 0) {
    console.error('❌ restaurant.csv vide ou manquant — impossible de continuer')
    process.exit(1)
  }
  const r = restaurantRows[0]!

  const openingHours = {
    monday:    { isOpen: !!nonEmpty(r['mon_open']),  open: r['mon_open']  ?? '', close: r['mon_close']  ?? '' },
    tuesday:   { isOpen: !!nonEmpty(r['tue_open']),  open: r['tue_open']  ?? '', close: r['tue_close']  ?? '' },
    wednesday: { isOpen: !!nonEmpty(r['wed_open']),  open: r['wed_open']  ?? '', close: r['wed_close']  ?? '' },
    thursday:  { isOpen: !!nonEmpty(r['thu_open']),  open: r['thu_open']  ?? '', close: r['thu_close']  ?? '' },
    friday:    { isOpen: !!nonEmpty(r['fri_open']),  open: r['fri_open']  ?? '', close: r['fri_close']  ?? '' },
    saturday:  { isOpen: !!nonEmpty(r['sat_open']),  open: r['sat_open']  ?? '', close: r['sat_close']  ?? '' },
    sunday:    { isOpen: !!nonEmpty(r['sun_open']),  open: r['sun_open']  ?? '', close: r['sun_close']  ?? '' },
  }

  const restaurant = await prisma.restaurant.create({
    data: {
      name: r['name']!,
      slug: r['slug']!,
      description: nonEmpty(r['description']),
      address: r['address']!,
      city: r['city']!,
      postalCode: r['postalCode'] ?? '',
      country: r['country'] ?? 'MG',
      phone: r['phone']!,
      email: r['email']!,
      website: nonEmpty(r['website']),
      currency: r['currency'] ?? 'MGA',
      timezone: r['timezone'] ?? 'Indian/Antananarivo',
      defaultTaxRate: num(r['defaultTaxRate'], 20),
      deliveryEnabled: bool(r['deliveryEnabled'], true),
      deliveryFee: num(r['deliveryFee'], 0),
      minOrderAmount: num(r['minOrderAmount'], 0),
      estimatedPrepTime: num(r['estimatedPrepTime'], 20),
      pickupEnabled: true,
      dineInEnabled: true,
      openingHours,
    },
  })
  console.log(`✅ Restaurant : ${restaurant.name} (slug=${restaurant.slug})`)

  // ── 3. Admin réel ──────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12)
  const admin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash: adminHash,
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
      isActive: true,
      isVerified: true,
      restaurantId: restaurant.id,
      roleId: roles['superadmin']!.id,
    },
  })
  console.log(`✅ Admin créé : ${admin.email} (superadmin)`)

  // ── 4. Catégories ──────────────────────────────────────────────────────────
  const categoryRows = readCSV('categories.csv')
  const categories: Record<string, { id: string }> = {}
  for (const c of categoryRows) {
    const cat = await prisma.category.create({
      data: {
        name: c['name']!,
        slug: c['slug']!,
        description: nonEmpty(c['description']),
        sortOrder: num(c['sortOrder'], 0),
        icon: nonEmpty(c['icon']),
        color: nonEmpty(c['color']),
        isActive: true,
        isAvailable: true,
        restaurantId: restaurant.id,
      },
    })
    categories[c['slug']!] = cat
  }
  console.log(`✅ Catégories : ${categoryRows.length}`)

  // ── 5. Produits ────────────────────────────────────────────────────────────
  const productRows = readCSV('products.csv')
  let productsCreated = 0
  for (const p of productRows) {
    const cat = categories[p['categorySlug']!]
    if (!cat) {
      console.log(`⚠️  Produit "${p['name']}" ignoré : catégorie "${p['categorySlug']}" inconnue`)
      continue
    }
    await prisma.product.create({
      data: {
        name: p['name']!,
        slug: p['slug']!,
        description: nonEmpty(p['description']),
        price: num(p['price'], 0),
        sku: nonEmpty(p['sku']),
        taxRate: num(p['taxRate'], 20),
        kdsStation: nonEmpty(p['kdsStation']) ?? 'hot',
        prepTime: num(p['prepTime'], 10),
        isActive: true,
        isAvailable: bool(p['isAvailable'], true),
        restaurantId: restaurant.id,
        categoryId: cat.id,
      },
    })
    productsCreated++
  }
  console.log(`✅ Produits : ${productsCreated}`)

  // ── 6. Tables ──────────────────────────────────────────────────────────────
  const tableRows = readCSV('tables.csv')
  for (const t of tableRows) {
    await prisma.diningTable.create({
      data: {
        number: num(t['number'], 0),
        name: nonEmpty(t['name']),
        capacity: num(t['capacity'], 2),
        section: nonEmpty(t['section']),
        shape: nonEmpty(t['shape']) ?? 'rectangle',
        status: 'AVAILABLE',
        isActive: true,
        restaurantId: restaurant.id,
      },
    })
  }
  console.log(`✅ Tables : ${tableRows.length}`)

  // ── 7. Employés / utilisateurs ─────────────────────────────────────────────
  const employeeRows = readCSV('employees.csv')
  let usersCreated = 0
  for (const e of employeeRows) {
    const roleName = (e['role'] ?? '').toLowerCase()
    if (!roles[roleName]) {
      console.log(`⚠️  Employé "${e['email']}" ignoré : rôle "${roleName}" inconnu`)
      continue
    }
    if (e['email'] === ADMIN_EMAIL) {
      console.log(`⚠️  Employé "${e['email']}" ignoré : déjà créé en tant qu'admin`)
      continue
    }
    const pwHash = await bcrypt.hash(e['password'] || 'ChangezMoi123!', 12)
    await prisma.user.create({
      data: {
        email: e['email']!,
        passwordHash: pwHash,
        firstName: e['firstName'] ?? '',
        lastName: e['lastName'] ?? '',
        phone: nonEmpty(e['phone']),
        isActive: true,
        isVerified: true,
        restaurantId: restaurant.id,
        roleId: roles[roleName]!.id,
      },
    })
    usersCreated++
  }
  console.log(`✅ Employés : ${usersCreated}`)

  console.log('')
  console.log('🎉 Import terminé !')
  console.log(`   Restaurant : ${restaurant.name}`)
  console.log(`   Slug       : ${restaurant.slug}`)
  console.log(`   Admin      : ${admin.email}`)
  console.log(`   Catégories : ${categoryRows.length}`)
  console.log(`   Produits   : ${productsCreated}`)
  console.log(`   Tables     : ${tableRows.length}`)
  console.log(`   Employés   : ${usersCreated}`)
}

main()
  .catch(e => { console.error('❌ Erreur import :', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { seedDemoData } from './demo-seed'

const prisma = new PrismaClient()
const SEED_DEMO = process.env['SEED_DEMO'] === 'true'
// SEED_ONLY : ne (re)crée pas l'admin — charge seulement les données démo dans
// un tenant existant (déclenché depuis la console master sur un tenant déjà créé).
const SEED_ONLY = process.env['SEED_ONLY'] === 'true'

const RESTO_NAME = process.env['RESTO_NAME'] ?? ''
const RESTO_SLUG = process.env['RESTO_SLUG'] ?? ''
const ADMIN_EMAIL = process.env['ADMIN_EMAIL'] ?? ''
const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'] ?? ''
const ADMIN_FIRST_NAME = process.env['ADMIN_FIRST_NAME'] ?? 'Admin'
const ADMIN_LAST_NAME = process.env['ADMIN_LAST_NAME'] ?? 'Principal'

async function main() {
  // Mode seed-only : charge les données démo dans un tenant existant, sans
  // toucher aux rôles/admin. Requiert seulement RESTO_SLUG.
  if (SEED_ONLY) {
    if (!RESTO_SLUG) {
      console.error('❌ RESTO_SLUG requis en mode SEED_ONLY')
      process.exit(1)
    }
    const restaurant = await prisma.restaurant.findUnique({ where: { slug: RESTO_SLUG } })
      ?? await prisma.restaurant.findFirst()
    if (!restaurant) {
      console.error('❌ Aucun restaurant trouvé pour le seed démo')
      process.exit(1)
    }
    await seedDemoData(prisma, restaurant.id)
    console.log('✅ Données démo chargées')
    return
  }

  if (!RESTO_NAME || !RESTO_SLUG || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('❌ Variables manquantes : RESTO_NAME, RESTO_SLUG, ADMIN_EMAIL, ADMIN_PASSWORD requises')
    process.exit(1)
  }

  console.log('🌱 Init fresh — rôles, restaurant, admin')

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

  const restaurant = await prisma.restaurant.upsert({
    where: { slug: RESTO_SLUG },
    update: { name: RESTO_NAME, email: ADMIN_EMAIL },
    create: {
      name: RESTO_NAME,
      slug: RESTO_SLUG,
      address: 'À configurer',
      city: 'À configurer',
      postalCode: '',
      country: 'MG',
      phone: '+261 0 00 00 00',
      email: ADMIN_EMAIL,
      currency: 'MGA',
      timezone: 'Indian/Antananarivo',
      defaultTaxRate: 20,
      deliveryEnabled: true,
      pickupEnabled: true,
      dineInEnabled: true,
    },
  })
  console.log(`✅ Restaurant : ${restaurant.name}`)

  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12)
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      passwordHash: hash,
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
      isActive: true,
      isVerified: true,
      restaurantId: restaurant.id,
      roleId: roles['superadmin']!.id,
    },
    create: {
      email: ADMIN_EMAIL,
      passwordHash: hash,
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
      isActive: true,
      isVerified: true,
      restaurantId: restaurant.id,
      roleId: roles['superadmin']!.id,
    },
  })
  console.log(`✅ Admin créé : ${admin.email}`)

  if (SEED_DEMO) {
    try {
      await seedDemoData(prisma, restaurant.id)
      console.log('✅ Données démo chargées')
    } catch (e) {
      console.error('⚠️  Seed démo échoué (non-bloquant) :', e)
    }
  }

  console.log('')
  console.log('🎉 Fresh start terminé !')
}

main()
  .catch(e => { console.error('❌ Erreur :', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

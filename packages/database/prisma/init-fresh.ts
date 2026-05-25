import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const RESTO_NAME = process.env['RESTO_NAME'] ?? ''
const RESTO_SLUG = process.env['RESTO_SLUG'] ?? ''
const ADMIN_EMAIL = process.env['ADMIN_EMAIL'] ?? ''
const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'] ?? ''
const ADMIN_FIRST_NAME = process.env['ADMIN_FIRST_NAME'] ?? 'Admin'
const ADMIN_LAST_NAME = process.env['ADMIN_LAST_NAME'] ?? 'Principal'

async function main() {
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

  console.log('')
  console.log('🎉 Fresh start terminé !')
}

main()
  .catch(e => { console.error('❌ Erreur :', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

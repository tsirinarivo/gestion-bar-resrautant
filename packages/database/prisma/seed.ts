import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create restaurant
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: 'le-bistrot-moderne' },
    update: {},
    create: {
      name: 'Le Bistrot Moderne',
      slug: 'le-bistrot-moderne',
      description: 'Un bistrot moderne alliant cuisine traditionnelle française et créations contemporaines.',
      address: '14 Rue du Commerce',
      city: 'Paris',
      postalCode: '75015',
      country: 'FR',
      phone: '+33 1 45 78 23 10',
      email: 'contact@bistrotmoderne.fr',
      siret: '12345678901234',
      website: 'https://bistrotmoderne.fr',
      timezone: 'Europe/Paris',
      currency: 'EUR',
      vatNumber: 'FR12345678901',
      defaultTaxRate: 10,
      deliveryEnabled: true,
      pickupEnabled: true,
      dineInEnabled: true,
      minOrderAmount: 15,
      deliveryRadius: 5,
      deliveryFee: 3.50,
      estimatedPrepTime: 20,
      openingHours: {
        monday: { isOpen: true, open: '11:30', close: '22:30' },
        tuesday: { isOpen: true, open: '11:30', close: '22:30' },
        wednesday: { isOpen: true, open: '11:30', close: '22:30' },
        thursday: { isOpen: true, open: '11:30', close: '22:30' },
        friday: { isOpen: true, open: '11:30', close: '23:30' },
        saturday: { isOpen: true, open: '10:00', close: '23:30' },
        sunday: { isOpen: true, open: '10:00', close: '22:00' },
      },
    },
  })
  console.log('✅ Restaurant created:', restaurant.name)

  // Create roles
  const roleData = [
    { name: 'superadmin', displayName: 'Super Administrateur', isSystem: true },
    { name: 'manager', displayName: 'Manager', isSystem: true },
    { name: 'caissier', displayName: 'Caissier', isSystem: true },
    { name: 'serveur', displayName: 'Serveur', isSystem: true },
    { name: 'cuisinier', displayName: 'Cuisinier', isSystem: true },
    { name: 'client', displayName: 'Client', isSystem: true },
  ]

  const roles: Record<string, any> = {}
  for (const role of roleData) {
    const r = await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    })
    roles[role.name] = r
  }
  console.log('✅ Roles created')

  // Create users
  const password = await bcrypt.hash('demo1234', 12)

  const users = [
    { email: 'admin@bistrotmoderne.fr', firstName: 'Alexandre', lastName: 'Martin', role: 'superadmin' },
    { email: 'manager@demo.com', firstName: 'Sophie', lastName: 'Dubois', role: 'manager' },
    { email: 'caissier@demo.com', firstName: 'Thomas', lastName: 'Leroy', role: 'caissier' },
    { email: 'serveur@demo.com', firstName: 'Julie', lastName: 'Bernard', role: 'serveur' },
    { email: 'cuisinier@demo.com', firstName: 'Pierre', lastName: 'Moreau', role: 'cuisinier' },
    { email: 'chef@demo.com', firstName: 'Antoine', lastName: 'Petit', role: 'cuisinier' },
  ]

  const createdUsers: Record<string, any> = {}
  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        email: userData.email,
        passwordHash: password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        isActive: true,
        isVerified: true,
        restaurantId: restaurant.id,
        roleId: roles[userData.role].id,
      },
    })
    createdUsers[userData.role] = user
  }
  console.log('✅ Users created')

  // Create employees
  for (const [role, user] of Object.entries(createdUsers)) {
    if (['caissier', 'serveur', 'cuisinier', 'manager'].includes(role)) {
      await prisma.employee.upsert({
        where: { userId: (user as any).id },
        update: {},
        create: {
          userId: (user as any).id,
          restaurantId: restaurant.id,
          position: role === 'caissier' ? 'Caissier' : role === 'serveur' ? 'Serveur' : role === 'cuisinier' ? 'Cuisinier' : 'Manager',
          department: role === 'cuisinier' ? 'Cuisine' : 'Salle',
          hireDate: new Date('2023-01-15'),
          salary: role === 'manager' ? 3200 : role === 'cuisinier' ? 2800 : 2200,
          salaryType: 'MONTHLY',
          pin: '1234',
          isActive: true,
        },
      })
    }
  }
  console.log('✅ Employees created')

  // Create categories
  const categoriesData = [
    { name: 'Entrées', slug: 'entrees', icon: '🥗', color: '#10B981', sortOrder: 1 },
    { name: 'Plats', slug: 'plats', icon: '🍽️', color: '#FF4D00', sortOrder: 2 },
    { name: 'Burgers', slug: 'burgers', icon: '🍔', color: '#F59E0B', sortOrder: 3 },
    { name: 'Pizzas', slug: 'pizzas', icon: '🍕', color: '#EF4444', sortOrder: 4 },
    { name: 'Pâtes', slug: 'pates', icon: '🍝', color: '#FFB800', sortOrder: 5 },
    { name: 'Sandwichs', slug: 'sandwichs', icon: '🥪', color: '#8B5CF6', sortOrder: 6 },
    { name: 'Boissons', slug: 'boissons', icon: '🍹', color: '#3B82F6', sortOrder: 7 },
    { name: 'Desserts', slug: 'desserts', icon: '🍰', color: '#EC4899', sortOrder: 8 },
  ]

  const categories: Record<string, any> = {}
  for (const cat of categoriesData) {
    const c = await prisma.category.upsert({
      where: { restaurantId_slug: { restaurantId: restaurant.id, slug: cat.slug } },
      update: {},
      create: { ...cat, restaurantId: restaurant.id, isActive: true, isAvailable: true },
    })
    categories[cat.slug] = c
  }
  console.log('✅ Categories created')

  // Create products
  const productsData = [
    // Entrées
    { name: 'Soupe à l\'oignon gratinée', slug: 'soupe-oignon-gratinee', categorySlug: 'entrees', price: 9.50, costPrice: 2.80, description: 'Soupe à l\'oignon traditionnelle, gratinée au gruyère', shortDesc: 'Traditionnelle, gratinée au fromage', prepTime: 15, tags: ['maison', 'chaud'], allergens: ['gluten', 'lait'] },
    { name: 'Foie Gras Maison', slug: 'foie-gras-maison', categorySlug: 'entrees', price: 18.00, costPrice: 8.50, description: 'Foie gras de canard fait maison, toast brioché, confiture de figues', shortDesc: 'Foie gras maison avec brioche', prepTime: 10, isFeatured: true, tags: ['maison', 'luxe'], allergens: ['gluten', 'oeufs', 'lait'] },
    { name: 'Salade César', slug: 'salade-cesar', categorySlug: 'entrees', price: 12.50, costPrice: 3.20, description: 'Salade romaine, parmesan, croutons, sauce César maison, anchois', shortDesc: 'Salade fraîche façon César', prepTime: 8, tags: ['salade', 'frais'], allergens: ['gluten', 'lait', 'poissons', 'oeufs'] },
    { name: 'Carpaccio de Bœuf', slug: 'carpaccio-boeuf', categorySlug: 'entrees', price: 14.50, costPrice: 5.50, description: 'Carpaccio de bœuf tranché fin, roquette, parmesan, câpres, huile d\'olive', shortDesc: 'Bœuf tranché fin, roquette, parmesan', prepTime: 10, tags: ['bœuf', 'frais'], allergens: ['lait'] },
    { name: 'Velouté de Champignons', slug: 'veloute-champignons', categorySlug: 'entrees', price: 8.50, costPrice: 2.20, description: 'Velouté de champignons des bois à la crème fraîche et persil', shortDesc: 'Velouté crémeux aux champignons', prepTime: 12, tags: ['végétarien', 'chaud'], allergens: ['lait'] },

    // Plats
    { name: 'Entrecôte Grillée 300g', slug: 'entrecote-grillee', categorySlug: 'plats', price: 28.00, costPrice: 12.00, description: 'Entrecôte de bœuf charolais grillée, pommes frites maison, sauce au poivre ou béarnaise', shortDesc: 'Entrecôte charolaise, frites maison', prepTime: 20, isFeatured: true, tags: ['bœuf', 'grillé'], allergens: ['lait', 'oeufs'] },
    { name: 'Saumon en Croûte d\'Herbes', slug: 'saumon-croute-herbes', categorySlug: 'plats', price: 22.00, costPrice: 9.00, description: 'Dos de saumon en croûte d\'herbes fraîches, risotto citronné, légumes de saison', shortDesc: 'Saumon frais, risotto citronné', prepTime: 25, tags: ['poisson', 'maison'], allergens: ['poissons', 'gluten', 'lait'] },
    { name: 'Magret de Canard', slug: 'magret-canard', categorySlug: 'plats', price: 24.50, costPrice: 10.50, description: 'Magret de canard rosé, sauce aux cerises, gratin dauphinois', shortDesc: 'Magret rosé, sauce cerises', prepTime: 30, isFeatured: true, tags: ['canard', 'maison'], allergens: ['lait'] },
    { name: 'Poulet Rôti Grand-Mère', slug: 'poulet-roti', categorySlug: 'plats', price: 17.50, costPrice: 6.50, description: 'Cuisse de poulet rôti, légumes racines confits, jus de rôti corsé', shortDesc: 'Poulet fermier rôti traditionnel', prepTime: 35, tags: ['volaille', 'maison'], allergens: [] },
    { name: 'Risotto aux Truffes', slug: 'risotto-truffes', categorySlug: 'plats', price: 26.00, costPrice: 11.00, description: 'Risotto crémeux à la truffe noire, parmesan affiné 24 mois, huile de truffe', shortDesc: 'Risotto truffé, parmesan affiné', prepTime: 25, isFeatured: true, tags: ['végétarien', 'luxe', 'maison'], allergens: ['lait'] },

    // Burgers
    { name: 'Le Bistrot Burger', slug: 'bistrot-burger', categorySlug: 'burgers', price: 16.50, costPrice: 5.80, description: 'Steak haché bœuf charolais 180g, cheddar affiné, bacon croustillant, oignons caramélisés, sauce maison, frites', shortDesc: 'Notre burger signature', prepTime: 15, isNew: true, isFeatured: true, tags: ['bœuf', 'populaire'], allergens: ['gluten', 'lait', 'oeufs'] },
    { name: 'Burger Végétarien', slug: 'burger-vegetarien', categorySlug: 'burgers', price: 14.50, costPrice: 4.50, description: 'Galette de légumes et pois chiches, fromage de chèvre, tomates confites, roquette, sauce yaourt', shortDesc: 'Galette végétale, chèvre, roquette', prepTime: 15, tags: ['végétarien', 'nouveau'], allergens: ['gluten', 'lait', 'soja'] },
    { name: 'Smash Burger Double', slug: 'smash-burger-double', categorySlug: 'burgers', price: 19.50, costPrice: 7.20, description: 'Double steak smashé 2×100g, double cheddar, cornichons, oignons, sauce burger, brioche', shortDesc: 'Double steak smashé, double cheddar', prepTime: 12, isNew: true, tags: ['bœuf', 'populaire', 'nouveau'], allergens: ['gluten', 'lait', 'oeufs'] },
    { name: 'Burger Poulet Crispy', slug: 'burger-poulet-crispy', categorySlug: 'burgers', price: 14.00, costPrice: 4.80, description: 'Filet de poulet pané croustillant, salade coleslaw, pickles, sauce moutarde-miel', shortDesc: 'Poulet croustillant, coleslaw', prepTime: 15, tags: ['volaille', 'crispy'], allergens: ['gluten', 'lait', 'oeufs', 'moutarde'] },

    // Pizzas
    { name: 'Margherita DOP', slug: 'margherita', categorySlug: 'pizzas', price: 14.00, costPrice: 4.00, description: 'Tomate San Marzano DOP, mozzarella di bufala, basilic frais, huile d\'olive', shortDesc: 'Classique italienne, bufala', prepTime: 20, tags: ['végétarien', 'classique'], allergens: ['gluten', 'lait'] },
    { name: 'Pizza 4 Fromages', slug: 'pizza-4-fromages', categorySlug: 'pizzas', price: 16.00, costPrice: 5.50, description: 'Mozzarella, gorgonzola, chèvre, parmesan, huile d\'olive, noix de muscade', shortDesc: 'Quatre fromages, noix de muscade', prepTime: 20, tags: ['végétarien', 'fromage'], allergens: ['gluten', 'lait', 'fruits_a_coque'] },
    { name: 'Pizza Napolitaine', slug: 'pizza-napolitaine', categorySlug: 'pizzas', price: 15.00, costPrice: 4.80, description: 'Tomate, mozzarella, anchois, câpres, olives noires, origan', shortDesc: 'Tomate, anchois, câpres, olives', prepTime: 20, tags: ['poisson', 'classique'], allergens: ['gluten', 'lait', 'poissons'] },
    { name: 'Pizza Truffe & Champignons', slug: 'pizza-truffe', categorySlug: 'pizzas', price: 22.00, costPrice: 8.50, description: 'Crème de truffe, champignons des bois, mozzarella, roquette, copeaux de parmesan', shortDesc: 'Crème truffe, champignons, roquette', prepTime: 22, isFeatured: true, tags: ['luxe', 'végétarien'], allergens: ['gluten', 'lait'] },

    // Pâtes
    { name: 'Tagliatelles Bolognaise', slug: 'tagliatelles-bolognaise', categorySlug: 'pates', price: 15.00, costPrice: 4.50, description: 'Tagliatelles fraîches maison, sauce bolognaise mijotée 4h, parmesan', shortDesc: 'Pâtes fraîches, bolognaise maison', prepTime: 20, tags: ['bœuf', 'maison', 'populaire'], allergens: ['gluten', 'lait', 'oeufs'] },
    { name: 'Spaghetti Carbonara', slug: 'spaghetti-carbonara', categorySlug: 'pates', price: 14.50, costPrice: 4.20, description: 'Spaghetti, guanciale, œuf, pecorino, poivre noir — recette romaine authentique', shortDesc: 'Carbonara authentique romaine', prepTime: 15, tags: ['porc', 'classique'], allergens: ['gluten', 'lait', 'oeufs'] },
    { name: 'Penne au Pesto Maison', slug: 'penne-pesto', categorySlug: 'pates', price: 13.00, costPrice: 3.80, description: 'Penne rigate, pesto au basilic frais, pignons de pin grillés, tomates cerises, parmesan', shortDesc: 'Pesto basilic maison, tomates cerises', prepTime: 12, tags: ['végétarien', 'maison'], allergens: ['gluten', 'lait', 'fruits_a_coque'] },

    // Boissons
    { name: 'Coca-Cola', slug: 'coca-cola', categorySlug: 'boissons', price: 3.50, costPrice: 0.80, description: 'Coca-Cola 33cl', prepTime: 1, tags: ['froid', 'soda'] },
    { name: 'Eau Minérale Evian 50cl', slug: 'eau-evian', categorySlug: 'boissons', price: 3.00, costPrice: 0.70, description: 'Eau minérale naturelle Evian 50cl', prepTime: 1, tags: ['eau', 'froid'] },
    { name: 'Jus d\'Orange Pressé', slug: 'jus-orange-presse', categorySlug: 'boissons', price: 5.50, costPrice: 1.50, description: 'Jus d\'orange fraîchement pressé', shortDesc: 'Pressé à la commande', prepTime: 3, tags: ['frais', 'maison', 'sans alcool'] },
    { name: 'Café Espresso', slug: 'cafe-espresso', categorySlug: 'boissons', price: 2.50, costPrice: 0.40, description: 'Espresso simple, café arabica 100%', prepTime: 2, tags: ['chaud', 'café'] },
    { name: 'Limonade Artisanale', slug: 'limonade-artisanale', categorySlug: 'boissons', price: 4.50, costPrice: 1.20, description: 'Limonade maison citron-gingembre, menthe fraîche', shortDesc: 'Limonade maison citron-gingembre', prepTime: 3, isNew: true, tags: ['maison', 'frais', 'sans alcool'] },
    { name: 'Verre de Vin Rouge', slug: 'vin-rouge', categorySlug: 'boissons', price: 6.50, costPrice: 2.00, description: 'Sélection du sommelier — vin rouge de la carte', prepTime: 1, tags: ['alcool', 'vin'] },
    { name: 'Bière Artisanale', slug: 'biere-artisanale', categorySlug: 'boissons', price: 6.00, costPrice: 1.80, description: 'Bière artisanale locale en fût 33cl', prepTime: 2, tags: ['alcool', 'bière'] },

    // Desserts
    { name: 'Crème Brûlée Vanille', slug: 'creme-brulee', categorySlug: 'desserts', price: 8.00, costPrice: 2.20, description: 'Crème brûlée à la vanille de Madagascar, caramel croustillant', shortDesc: 'Vanille Madagascar, caramel croustillant', prepTime: 10, isFeatured: true, tags: ['classique', 'maison'], allergens: ['lait', 'oeufs'] },
    { name: 'Fondant au Chocolat', slug: 'fondant-chocolat', categorySlug: 'desserts', price: 9.00, costPrice: 2.80, description: 'Fondant au chocolat Valrhona 70%, cœur coulant, glace vanille', shortDesc: 'Chocolat Valrhona, cœur coulant', prepTime: 12, isFeatured: true, tags: ['chocolat', 'chaud', 'populaire'], allergens: ['gluten', 'lait', 'oeufs'] },
    { name: 'Tiramisu Maison', slug: 'tiramisu', categorySlug: 'desserts', price: 8.50, costPrice: 2.50, description: 'Tiramisu classique au mascarpone, biscuits savoiards, café, amaretto', shortDesc: 'Tiramisu traditionnel maison', prepTime: 5, tags: ['maison', 'classique'], allergens: ['gluten', 'lait', 'oeufs'] },
    { name: 'Tarte Tatin Pommes', slug: 'tarte-tatin', categorySlug: 'desserts', price: 8.50, costPrice: 2.40, description: 'Tarte tatin aux pommes caramélisées, crème fraîche épaisse', shortDesc: 'Pommes caramélisées, crème fraîche', prepTime: 8, tags: ['maison', 'fruit', 'chaud'], allergens: ['gluten', 'lait', 'oeufs'] },
    { name: 'Assortiment de Fromages', slug: 'plateau-fromages', categorySlug: 'desserts', price: 14.00, costPrice: 6.00, description: '5 fromages sélectionnés, confiture de cerises, noix, pain aux céréales', shortDesc: '5 fromages, confiture maison', prepTime: 5, tags: ['fromage', 'français'], allergens: ['gluten', 'lait', 'fruits_a_coque'] },
  ]

  for (const productData of productsData) {
    const { categorySlug, ...data } = productData
    const cat = categories[categorySlug]
    if (!cat) continue

    await prisma.product.upsert({
      where: { restaurantId_slug: { restaurantId: restaurant.id, slug: data.slug } },
      update: {},
      create: {
        ...data,
        images: [],
        allergens: data.allergens || [],
        tags: data.tags || [],
        isActive: true,
        isAvailable: true,
        isFeatured: data.isFeatured || false,
        isNew: data.isNew || false,
        sortOrder: 0,
        taxRate: 10,
        restaurantId: restaurant.id,
        categoryId: cat.id,
      },
    })
  }
  console.log('✅ Products created:', productsData.length)

  // Create tables
  const tablesData = [
    { number: 1, capacity: 2, posX: 50, posY: 50, shape: 'circle', section: 'Terrasse' },
    { number: 2, capacity: 2, posX: 150, posY: 50, shape: 'circle', section: 'Terrasse' },
    { number: 3, capacity: 4, posX: 250, posY: 50, shape: 'rectangle', section: 'Terrasse' },
    { number: 4, capacity: 4, posX: 400, posY: 50, shape: 'rectangle', section: 'Terrasse' },
    { number: 5, capacity: 6, posX: 50, posY: 200, shape: 'rectangle', section: 'Salle Principale' },
    { number: 6, capacity: 4, posX: 200, posY: 200, shape: 'rectangle', section: 'Salle Principale' },
    { number: 7, capacity: 4, posX: 350, posY: 200, shape: 'rectangle', section: 'Salle Principale' },
    { number: 8, capacity: 6, posX: 500, posY: 200, shape: 'rectangle', section: 'Salle Principale' },
    { number: 9, capacity: 2, posX: 50, posY: 350, shape: 'circle', section: 'Salle Principale' },
    { number: 10, capacity: 2, posX: 150, posY: 350, shape: 'circle', section: 'Salle Principale' },
    { number: 11, capacity: 8, posX: 300, posY: 350, shape: 'rectangle', section: 'Salle Principale', width: 160 },
    { number: 12, capacity: 4, posX: 50, posY: 500, shape: 'rectangle', section: 'Bar' },
    { number: 13, capacity: 2, posX: 200, posY: 500, shape: 'circle', section: 'Bar' },
    { number: 14, capacity: 2, posX: 300, posY: 500, shape: 'circle', section: 'Bar' },
    { number: 15, capacity: 10, posX: 50, posY: 650, shape: 'rectangle', section: 'Salon Privatif', width: 200 },
  ]

  for (const tableData of tablesData) {
    await prisma.diningTable.upsert({
      where: { restaurantId_number: { restaurantId: restaurant.id, number: tableData.number } },
      update: {},
      create: {
        ...tableData,
        minCapacity: 1,
        height: 80,
        width: tableData.width || 100,
        rotation: 0,
        status: 'AVAILABLE',
        isActive: true,
        restaurantId: restaurant.id,
      },
    })
  }
  console.log('✅ Tables created:', tablesData.length)

  // Create customers
  const customersData = [
    { firstName: 'Marie', lastName: 'Dupont', email: 'marie.dupont@email.fr', phone: '0612345678', city: 'Paris', acceptsMarketing: true },
    { firstName: 'Jean', lastName: 'Michel', email: 'jean.michel@email.fr', phone: '0698765432', city: 'Paris', acceptsMarketing: false },
    { firstName: 'Emma', lastName: 'Lefevre', email: 'emma.l@email.fr', phone: '0655443322', city: 'Boulogne', acceptsMarketing: true },
    { firstName: 'Paul', lastName: 'Garcia', email: 'paul.garcia@email.fr', phone: '0677889900', city: 'Issy-les-Moulineaux', acceptsMarketing: true },
    { firstName: 'Claire', lastName: 'Roux', email: 'claire.roux@email.fr', phone: '0622334455', city: 'Paris', acceptsMarketing: true },
    { firstName: 'Lucas', lastName: 'Martin', email: 'lucas.m@email.fr', phone: '0633221100', city: 'Paris', acceptsMarketing: false },
    { firstName: 'Sarah', lastName: 'Blanc', email: 'sarah.blanc@email.fr', phone: '0644332211', city: 'Vanves', acceptsMarketing: true },
    { firstName: 'Antoine', lastName: 'Girard', email: 'antoine.g@email.fr', phone: '0611223344', city: 'Paris', acceptsMarketing: false },
  ]

  for (const customerData of customersData) {
    const existing = await prisma.customer.findFirst({
      where: { email: customerData.email, restaurantId: restaurant.id },
    })
    if (!existing) {
      await prisma.customer.create({
        data: {
          ...customerData,
          restaurantId: restaurant.id,
          source: 'ONLINE',
          isActive: true,
          loyaltyAccount: {
            create: {
              points: Math.floor(Math.random() * 2000),
              totalEarned: Math.floor(Math.random() * 3000),
              totalSpent: Math.floor(Math.random() * 1000),
              tier: ['BRONZE', 'SILVER', 'GOLD'][Math.floor(Math.random() * 3)] as any,
            },
          },
        },
      })
    }
  }
  console.log('✅ Customers created')

  // Create stock items
  const stockItemsData = [
    { name: 'Farine T55', unit: 'kg', currentQuantity: 25, minQuantity: 5, reorderQuantity: 10, costPerUnit: 0.90, location: 'Réserve' },
    { name: 'Bœuf Charolais (Steak)', unit: 'kg', currentQuantity: 8.5, minQuantity: 3, reorderQuantity: 5, costPerUnit: 32.00, location: 'Réfrigérateur', isPerishable: true },
    { name: 'Poulet Fermier', unit: 'kg', currentQuantity: 12, minQuantity: 4, reorderQuantity: 6, costPerUnit: 8.50, location: 'Réfrigérateur', isPerishable: true },
    { name: 'Saumon Atlantique', unit: 'kg', currentQuantity: 5.5, minQuantity: 2, reorderQuantity: 4, costPerUnit: 18.00, location: 'Réfrigérateur', isPerishable: true },
    { name: 'Mozzarella di Bufala', unit: 'kg', currentQuantity: 4, minQuantity: 1.5, reorderQuantity: 3, costPerUnit: 12.00, location: 'Réfrigérateur', isPerishable: true },
    { name: 'Tomates San Marzano', unit: 'kg', currentQuantity: 15, minQuantity: 5, reorderQuantity: 8, costPerUnit: 3.50, location: 'Réserve', isPerishable: true },
    { name: 'Pommes de Terre', unit: 'kg', currentQuantity: 30, minQuantity: 10, reorderQuantity: 15, costPerUnit: 0.80, location: 'Réserve' },
    { name: 'Huile d\'Olive Extra Vierge', unit: 'L', currentQuantity: 8, minQuantity: 2, reorderQuantity: 4, costPerUnit: 12.00, location: 'Réserve' },
    { name: 'Parmesan Reggiano 24m', unit: 'kg', currentQuantity: 3.5, minQuantity: 1, reorderQuantity: 2, costPerUnit: 28.00, location: 'Réfrigérateur', isPerishable: true },
    { name: 'Crème Fraîche', unit: 'L', currentQuantity: 6, minQuantity: 2, reorderQuantity: 4, costPerUnit: 4.50, location: 'Réfrigérateur', isPerishable: true },
    { name: 'Œufs Fermiers', unit: 'unité', currentQuantity: 120, minQuantity: 30, reorderQuantity: 60, costPerUnit: 0.30, location: 'Réfrigérateur', isPerishable: true },
    { name: 'Chocolat Valrhona 70%', unit: 'kg', currentQuantity: 4, minQuantity: 1, reorderQuantity: 2, costPerUnit: 22.00, location: 'Réserve' },
    { name: 'Champignons de Paris', unit: 'kg', currentQuantity: 3, minQuantity: 1, reorderQuantity: 2, costPerUnit: 5.50, location: 'Réfrigérateur', isPerishable: true },
    { name: 'Coca-Cola 33cl', unit: 'unité', currentQuantity: 144, minQuantity: 48, reorderQuantity: 96, costPerUnit: 0.80, location: 'Cave' },
    { name: 'Vin Rouge Sélection', unit: 'bouteille', currentQuantity: 48, minQuantity: 12, reorderQuantity: 24, costPerUnit: 8.50, location: 'Cave' },
    { name: 'Café Arabica', unit: 'kg', currentQuantity: 5, minQuantity: 1.5, reorderQuantity: 3, costPerUnit: 18.00, location: 'Bar' },
    { name: 'Magret de Canard', unit: 'kg', currentQuantity: 4.5, minQuantity: 2, reorderQuantity: 3, costPerUnit: 22.00, location: 'Réfrigérateur', isPerishable: true },
    { name: 'Truffe Noire', unit: 'g', currentQuantity: 200, minQuantity: 50, reorderQuantity: 100, costPerUnit: 0.80, location: 'Réfrigérateur', isPerishable: true },
    { name: 'Basilic Frais', unit: 'g', currentQuantity: 500, minQuantity: 100, reorderQuantity: 200, costPerUnit: 0.04, location: 'Cuisine', isPerishable: true },
    { name: 'Beurre AOP', unit: 'kg', currentQuantity: 6, minQuantity: 2, reorderQuantity: 4, costPerUnit: 8.00, location: 'Réfrigérateur', isPerishable: true },
  ]

  for (const stockData of stockItemsData) {
    const existing = await prisma.stockItem.findFirst({
      where: { name: stockData.name, restaurantId: restaurant.id },
    })
    if (!existing) {
      await prisma.stockItem.create({
        data: { ...stockData, restaurantId: restaurant.id, valuationMethod: 'FIFO' },
      })
    }
  }
  console.log('✅ Stock items created:', stockItemsData.length)

  // Create a supplier
  const supplier = await prisma.supplier.upsert({
    where: { id: 'supplier-metro' },
    update: {},
    create: {
      id: 'supplier-metro',
      name: 'Metro Cash & Carry',
      contactName: 'Jean-Pierre Bouchard',
      email: 'jp.bouchard@metro.fr',
      phone: '0156789012',
      address: '12 Rue des Grands Moulins',
      city: 'Paris',
      postalCode: '75013',
      deliveryDays: ['monday', 'wednesday', 'friday'],
      leadTimeDays: 1,
      restaurantId: restaurant.id,
      isActive: true,
    },
  })

  // Create some coupons
  const coupons = [
    { code: 'BIENVENUE10', type: 'PERCENTAGE', value: 10, description: '10% de réduction première commande', usagePerUser: 1 },
    { code: 'MIDI20', type: 'FIXED_AMOUNT', value: 5, description: '5€ de réduction sur les commandes du midi', minOrderAmount: 25 },
    { code: 'FIDELITE15', type: 'PERCENTAGE', value: 15, description: 'Réduction fidélité client Gold', maxDiscount: 30 },
  ]
  for (const couponData of coupons) {
    await prisma.coupon.upsert({
      where: { code: couponData.code },
      update: {},
      create: { ...couponData, restaurantId: restaurant.id, channels: ['ONLINE', 'POS'], isActive: true },
    })
  }
  console.log('✅ Coupons created')

  // Create some reservations
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(12, 30, 0, 0)

  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)
  nextWeek.setHours(19, 0, 0, 0)

  await prisma.reservation.upsert({
    where: { reservationRef: 'RES-SEED001' },
    update: {},
    create: {
      reservationRef: 'RES-SEED001',
      firstName: 'Marie',
      lastName: 'Dupont',
      email: 'marie.dupont@email.fr',
      phone: '0612345678',
      partySize: 2,
      date: tomorrow,
      duration: 90,
      status: 'CONFIRMED',
      notes: 'Anniversaire — prévoir une bougie sur le dessert',
      source: 'ONLINE',
      restaurantId: restaurant.id,
    },
  })

  await prisma.reservation.upsert({
    where: { reservationRef: 'RES-SEED002' },
    update: {},
    create: {
      reservationRef: 'RES-SEED002',
      firstName: 'Antoine',
      lastName: 'Girard',
      phone: '0611223344',
      partySize: 8,
      date: nextWeek,
      duration: 120,
      status: 'CONFIRMED',
      notes: 'Repas d\'équipe — menu spécial groupe',
      source: 'PHONE',
      restaurantId: restaurant.id,
    },
  })
  console.log('✅ Reservations created')

  console.log('\n🎉 Database seeded successfully!')
  console.log('\n📧 Credentials:')
  console.log('  Manager: manager@demo.com / demo1234')
  console.log('  Caissier: caissier@demo.com / demo1234')
  console.log('  Cuisinier: cuisinier@demo.com / demo1234')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

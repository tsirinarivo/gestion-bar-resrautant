import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create restaurant
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: 'restaurant-demo' },
    update: {},
    create: {
      name: 'Restaurant Demo',
      slug: 'restaurant-demo',
      description: 'Restaurant bar et fast-food, cuisine locale et internationale.',
      address: 'Rue du Commerce',
      city: 'Antananarivo',
      postalCode: '101',
      country: 'MG',
      phone: '+261 20 22 000 00',
      email: 'contact@restaurant-demo.mg',
      siret: '00000000000000',
      website: '',
      timezone: 'Indian/Antananarivo',
      currency: 'MGA',
      vatNumber: '',
      defaultTaxRate: 20,
      deliveryEnabled: true,
      pickupEnabled: true,
      dineInEnabled: true,
      minOrderAmount: 5000,
      deliveryRadius: 10,
      deliveryFee: 2000,
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
          salary: role === 'manager' ? 1200000 : role === 'cuisinier' ? 900000 : 700000,
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
    { name: 'Soupe de légumes', slug: 'soupe-legumes', categorySlug: 'entrees', price: 5000, costPrice: 1500, description: 'Soupe de légumes locaux, servie bien chaude', shortDesc: 'Légumes du marché', prepTime: 15, tags: ['maison', 'chaud'], allergens: [] },
    { name: 'Salade Malagasy', slug: 'salade-malagasy', categorySlug: 'entrees', price: 8000, costPrice: 2500, description: 'Salade fraîche, tomates, concombres, carottes râpées, vinaigrette maison', shortDesc: 'Salade fraîche maison', prepTime: 8, isFeatured: true, tags: ['maison', 'frais'], allergens: [] },
    { name: 'Nems au Poulet', slug: 'nems-poulet', categorySlug: 'entrees', price: 9000, costPrice: 3000, description: 'Nems croustillants au poulet et légumes, sauce nuoc-mâm', shortDesc: 'Nems croustillants poulet', prepTime: 10, tags: ['friture', 'populaire'], allergens: ['gluten'] },
    { name: 'Brochettes de Zébu', slug: 'brochettes-zebu', categorySlug: 'entrees', price: 12000, costPrice: 4500, description: 'Brochettes de zébu marinées aux épices locales, grillées au feu de bois', shortDesc: 'Zébu grillé, épices locales', prepTime: 15, isFeatured: true, tags: ['zébu', 'grillé'], allergens: [] },
    { name: 'Soupe de Crevettes', slug: 'soupe-crevettes', categorySlug: 'entrees', price: 14000, costPrice: 5000, description: 'Soupe aux crevettes de Madagascar, lait de coco, citronnelle', shortDesc: 'Crevettes locales, lait de coco', prepTime: 15, tags: ['fruits de mer', 'maison'], allergens: ['crustacés'] },

    // Plats
    { name: 'Romazava', slug: 'romazava', categorySlug: 'plats', price: 18000, costPrice: 6000, description: 'Plat national malgache : viande de zébu mijotée avec brèdes mafanes et légumes verts', shortDesc: 'Plat national malgache au zébu', prepTime: 40, isFeatured: true, tags: ['malgache', 'zébu', 'traditionnel'], allergens: [] },
    { name: 'Poisson Grillé du Jour', slug: 'poisson-grille', categorySlug: 'plats', price: 22000, costPrice: 8000, description: 'Poisson frais du jour grillé, riz blanc, sauce gingembre-citron', shortDesc: 'Poisson frais, riz, sauce gingembre', prepTime: 25, isFeatured: true, tags: ['poisson', 'grillé', 'maison'], allergens: ['poissons'] },
    { name: 'Poulet Sauce Coco', slug: 'poulet-sauce-coco', categorySlug: 'plats', price: 20000, costPrice: 7000, description: 'Poulet mijoté au lait de coco, curcuma, gingembre, servi avec riz blanc', shortDesc: 'Poulet mijoté lait de coco', prepTime: 35, tags: ['volaille', 'maison'], allergens: [] },
    { name: 'Entrecôte de Zébu', slug: 'entrecote-zebu', categorySlug: 'plats', price: 35000, costPrice: 14000, description: 'Entrecôte de zébu grillée 300g, frites maison, sauce poivre vert', shortDesc: 'Zébu grillé 300g, frites maison', prepTime: 20, isFeatured: true, tags: ['zébu', 'grillé', 'populaire'], allergens: ['lait'] },
    { name: 'Riz Sauté aux Légumes', slug: 'riz-saute-legumes', categorySlug: 'plats', price: 12000, costPrice: 3500, description: 'Riz cantonais sauté, légumes frais, œuf, sauce soja', shortDesc: 'Riz sauté maison', prepTime: 15, tags: ['végétarien', 'riz', 'rapide'], allergens: ['oeufs', 'soja'] },

    // Burgers
    { name: 'Burger Zébu', slug: 'burger-zebu', categorySlug: 'burgers', price: 18000, costPrice: 6500, description: 'Steak haché zébu 180g, cheddar, oignons caramélisés, sauce maison, frites', shortDesc: 'Notre burger signature au zébu', prepTime: 15, isNew: true, isFeatured: true, tags: ['zébu', 'populaire'], allergens: ['gluten', 'lait', 'oeufs'] },
    { name: 'Burger Poulet', slug: 'burger-poulet', categorySlug: 'burgers', price: 14000, costPrice: 4500, description: 'Filet de poulet grillé, salade, tomate, mayonnaise, pain brioche', shortDesc: 'Poulet grillé, légumes frais', prepTime: 15, tags: ['volaille', 'classique'], allergens: ['gluten', 'lait', 'oeufs'] },
    { name: 'Double Smash Burger', slug: 'smash-burger-double', categorySlug: 'burgers', price: 22000, costPrice: 8000, description: 'Double steak smashé 2×100g zébu, double cheddar, cornichons, sauce burger', shortDesc: 'Double steak, double cheddar', prepTime: 12, isNew: true, tags: ['zébu', 'populaire', 'nouveau'], allergens: ['gluten', 'lait', 'oeufs'] },
    { name: 'Burger Végétarien', slug: 'burger-vegetarien', categorySlug: 'burgers', price: 12000, costPrice: 3800, description: 'Galette légumes et lentilles, salade, tomate, sauce yaourt maison', shortDesc: 'Galette végétale, sauce yaourt', prepTime: 15, tags: ['végétarien', 'maison'], allergens: ['gluten', 'lait'] },

    // Pizzas
    { name: 'Margherita', slug: 'margherita', categorySlug: 'pizzas', price: 15000, costPrice: 4500, description: 'Sauce tomate maison, mozzarella, basilic frais, huile d\'olive', shortDesc: 'Classique italienne', prepTime: 20, tags: ['végétarien', 'classique'], allergens: ['gluten', 'lait'] },
    { name: 'Pizza 4 Fromages', slug: 'pizza-4-fromages', categorySlug: 'pizzas', price: 18000, costPrice: 6000, description: 'Mozzarella, gouda, fromage frais, parmesan, huile d\'olive', shortDesc: 'Quatre fromages', prepTime: 20, tags: ['végétarien', 'fromage'], allergens: ['gluten', 'lait'] },
    { name: 'Pizza Poulet-Champignons', slug: 'pizza-poulet-champignons', categorySlug: 'pizzas', price: 17000, costPrice: 5500, description: 'Poulet grillé, champignons, mozzarella, crème fraîche, herbes', shortDesc: 'Poulet, champignons, mozzarella', prepTime: 20, isFeatured: true, tags: ['volaille', 'populaire'], allergens: ['gluten', 'lait'] },
    { name: 'Pizza Crevettes', slug: 'pizza-crevettes', categorySlug: 'pizzas', price: 22000, costPrice: 8000, description: 'Crevettes de Madagascar, sauce tomate, mozzarella, ail, persil', shortDesc: 'Crevettes locales, ail, persil', prepTime: 22, isFeatured: true, tags: ['fruits de mer', 'maison'], allergens: ['gluten', 'lait', 'crustacés'] },

    // Pâtes
    { name: 'Spaghetti Bolognaise', slug: 'spaghetti-bolognaise', categorySlug: 'pates', price: 14000, costPrice: 4200, description: 'Spaghetti, sauce bolognaise au zébu mijotée, parmesan', shortDesc: 'Bolognaise au zébu, parmesan', prepTime: 20, tags: ['zébu', 'maison', 'populaire'], allergens: ['gluten', 'lait', 'oeufs'] },
    { name: 'Pâtes Carbonara', slug: 'pates-carbonara', categorySlug: 'pates', price: 13000, costPrice: 3800, description: 'Spaghetti, lardons, œuf, parmesan, poivre noir', shortDesc: 'Carbonara maison', prepTime: 15, tags: ['porc', 'classique'], allergens: ['gluten', 'lait', 'oeufs'] },
    { name: 'Pâtes au Pesto', slug: 'pates-pesto', categorySlug: 'pates', price: 12000, costPrice: 3500, description: 'Penne, pesto basilic maison, tomates cerises, parmesan', shortDesc: 'Pesto basilic, tomates cerises', prepTime: 12, tags: ['végétarien', 'maison'], allergens: ['gluten', 'lait', 'fruits_a_coque'] },

    // Boissons
    { name: 'Coca-Cola', slug: 'coca-cola', categorySlug: 'boissons', price: 3000, costPrice: 1000, description: 'Coca-Cola 33cl bien frais', prepTime: 1, tags: ['froid', 'soda'] },
    { name: 'Eau Minérale 50cl', slug: 'eau-minerale', categorySlug: 'boissons', price: 1500, costPrice: 500, description: 'Eau minérale naturelle 50cl', prepTime: 1, tags: ['eau', 'froid'] },
    { name: 'Jus de Fruits Frais', slug: 'jus-fruits-frais', categorySlug: 'boissons', price: 5000, costPrice: 1500, description: 'Jus de fruits de saison pressés à la commande : mangue, ananas, goyave', shortDesc: 'Pressé à la commande', prepTime: 3, isNew: true, tags: ['frais', 'maison', 'sans alcool'] },
    { name: 'Café Malgache', slug: 'cafe-malgache', categorySlug: 'boissons', price: 2000, costPrice: 500, description: 'Café arabica de Madagascar, servi chaud', prepTime: 2, tags: ['chaud', 'café', 'local'] },
    { name: 'Limonade Maison', slug: 'limonade-maison', categorySlug: 'boissons', price: 4000, costPrice: 1200, description: 'Limonade citronnelle-gingembre, menthe fraîche', shortDesc: 'Citron-gingembre, menthe', prepTime: 3, isNew: true, tags: ['maison', 'frais', 'sans alcool'] },
    { name: 'Bière THB', slug: 'biere-thb', categorySlug: 'boissons', price: 4000, costPrice: 1500, description: 'Three Horses Beer (THB), bière malgache 33cl bien fraîche', prepTime: 1, tags: ['alcool', 'bière', 'local'] },
    { name: 'Rhum Arrangé', slug: 'rhum-arrange', categorySlug: 'boissons', price: 6000, costPrice: 2000, description: 'Rhum arrangé maison aux fruits tropicaux de Madagascar', prepTime: 1, isFeatured: true, tags: ['alcool', 'rhum', 'maison', 'local'] },

    // Desserts
    { name: 'Crème Vanille Madagascar', slug: 'creme-vanille', categorySlug: 'desserts', price: 7000, costPrice: 2000, description: 'Crème brûlée à la vanille de Madagascar, caramel croustillant', shortDesc: 'Vanille de Madagascar', prepTime: 10, isFeatured: true, tags: ['classique', 'maison', 'local'], allergens: ['lait', 'oeufs'] },
    { name: 'Fondant Chocolat', slug: 'fondant-chocolat', categorySlug: 'desserts', price: 8000, costPrice: 2500, description: 'Fondant au chocolat de Madagascar 70%, cœur coulant, glace vanille', shortDesc: 'Chocolat local, cœur coulant', prepTime: 12, isFeatured: true, tags: ['chocolat', 'chaud', 'populaire'], allergens: ['gluten', 'lait', 'oeufs'] },
    { name: 'Salade de Fruits Tropicaux', slug: 'salade-fruits-tropicaux', categorySlug: 'desserts', price: 6000, costPrice: 2000, description: 'Mangue, ananas, litchi, papaye, noix de coco râpée, menthe fraîche', shortDesc: 'Fruits tropicaux de saison', prepTime: 8, tags: ['frais', 'fruits', 'local'], allergens: [] },
    { name: 'Mofo Baolina', slug: 'mofo-baolina', categorySlug: 'desserts', price: 4000, costPrice: 1200, description: 'Beignets malgaches sucrés, servis chauds avec confiture de goyave maison', shortDesc: 'Beignets malgaches traditionnels', prepTime: 10, isFeatured: true, tags: ['malgache', 'traditionnel', 'maison'], allergens: ['gluten', 'oeufs'] },
    { name: 'Glace Coco-Vanille', slug: 'glace-coco-vanille', categorySlug: 'desserts', price: 5000, costPrice: 1500, description: 'Glace artisanale noix de coco et vanille de Madagascar', shortDesc: 'Glace coco-vanille artisanale', prepTime: 5, tags: ['glacé', 'maison', 'local'], allergens: ['lait'] },
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
    { firstName: 'Hanta', lastName: 'Rakoto', email: 'hanta.rakoto@email.mg', phone: '+261 34 12 345 67', city: 'Antananarivo', acceptsMarketing: true },
    { firstName: 'Jean', lastName: 'Ratsima', email: 'jean.ratsima@email.mg', phone: '+261 33 98 765 43', city: 'Antananarivo', acceptsMarketing: false },
    { firstName: 'Soa', lastName: 'Randria', email: 'soa.r@email.mg', phone: '+261 34 55 443 32', city: 'Toamasina', acceptsMarketing: true },
    { firstName: 'Paul', lastName: 'Rajoana', email: 'paul.rajoana@email.mg', phone: '+261 32 77 889 90', city: 'Antsirabe', acceptsMarketing: true },
    { firstName: 'Miora', lastName: 'Andriantsoa', email: 'miora.a@email.mg', phone: '+261 34 22 334 45', city: 'Antananarivo', acceptsMarketing: true },
    { firstName: 'Lova', lastName: 'Raharisoa', email: 'lova.m@email.mg', phone: '+261 33 33 221 10', city: 'Fianarantsoa', acceptsMarketing: false },
    { firstName: 'Noro', lastName: 'Rabenarivo', email: 'noro.r@email.mg', phone: '+261 34 44 332 21', city: 'Mahajanga', acceptsMarketing: true },
    { firstName: 'Tina', lastName: 'Rakotoarison', email: 'tina.g@email.mg', phone: '+261 32 11 223 34', city: 'Antananarivo', acceptsMarketing: false },
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
    { name: 'Farine', unit: 'kg', currentQuantity: 25, minQuantity: 5, reorderQuantity: 10, costPerUnit: 3000, location: 'Réserve' },
    { name: 'Viande de Zébu', unit: 'kg', currentQuantity: 8.5, minQuantity: 3, reorderQuantity: 5, costPerUnit: 35000, location: 'Réfrigérateur', isPerishable: true },
    { name: 'Poulet Entier', unit: 'kg', currentQuantity: 12, minQuantity: 4, reorderQuantity: 6, costPerUnit: 12000, location: 'Réfrigérateur', isPerishable: true },
    { name: 'Crevettes Fraîches', unit: 'kg', currentQuantity: 5.5, minQuantity: 2, reorderQuantity: 4, costPerUnit: 40000, location: 'Réfrigérateur', isPerishable: true },
    { name: 'Poisson du Jour', unit: 'kg', currentQuantity: 8, minQuantity: 3, reorderQuantity: 5, costPerUnit: 20000, location: 'Réfrigérateur', isPerishable: true },
    { name: 'Tomates Fraîches', unit: 'kg', currentQuantity: 15, minQuantity: 5, reorderQuantity: 8, costPerUnit: 3000, location: 'Réserve', isPerishable: true },
    { name: 'Pommes de Terre', unit: 'kg', currentQuantity: 30, minQuantity: 10, reorderQuantity: 15, costPerUnit: 2000, location: 'Réserve' },
    { name: 'Huile de Cuisine', unit: 'L', currentQuantity: 8, minQuantity: 2, reorderQuantity: 4, costPerUnit: 8000, location: 'Réserve' },
    { name: 'Riz Local', unit: 'kg', currentQuantity: 50, minQuantity: 15, reorderQuantity: 25, costPerUnit: 2500, location: 'Réserve' },
    { name: 'Lait de Coco', unit: 'L', currentQuantity: 10, minQuantity: 3, reorderQuantity: 6, costPerUnit: 5000, location: 'Réserve', isPerishable: true },
    { name: 'Œufs', unit: 'unité', currentQuantity: 120, minQuantity: 30, reorderQuantity: 60, costPerUnit: 500, location: 'Réfrigérateur', isPerishable: true },
    { name: 'Chocolat Madagascar 70%', unit: 'kg', currentQuantity: 4, minQuantity: 1, reorderQuantity: 2, costPerUnit: 45000, location: 'Réserve' },
    { name: 'Champignons', unit: 'kg', currentQuantity: 3, minQuantity: 1, reorderQuantity: 2, costPerUnit: 10000, location: 'Réfrigérateur', isPerishable: true },
    { name: 'Coca-Cola 33cl', unit: 'unité', currentQuantity: 144, minQuantity: 48, reorderQuantity: 96, costPerUnit: 1000, location: 'Réserve' },
    { name: 'THB (Bière) 33cl', unit: 'unité', currentQuantity: 96, minQuantity: 24, reorderQuantity: 48, costPerUnit: 1500, location: 'Réserve' },
    { name: 'Café Arabica Madagascar', unit: 'kg', currentQuantity: 5, minQuantity: 1.5, reorderQuantity: 3, costPerUnit: 30000, location: 'Bar' },
    { name: 'Vanille Madagascar', unit: 'g', currentQuantity: 200, minQuantity: 50, reorderQuantity: 100, costPerUnit: 500, location: 'Réserve', isPerishable: true },
    { name: 'Basilic Frais', unit: 'g', currentQuantity: 500, minQuantity: 100, reorderQuantity: 200, costPerUnit: 200, location: 'Cuisine', isPerishable: true },
    { name: 'Beurre', unit: 'kg', currentQuantity: 6, minQuantity: 2, reorderQuantity: 4, costPerUnit: 15000, location: 'Réfrigérateur', isPerishable: true },
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
      name: 'Marché Central Tana',
      contactName: 'Rakoto Jean',
      email: 'contact@marche-tana.mg',
      phone: '+261 20 22 123 45',
      address: 'Avenue de l\'Indépendance',
      city: 'Antananarivo',
      postalCode: '101',
      deliveryDays: ['monday', 'wednesday', 'friday'],
      leadTimeDays: 1,
      restaurantId: restaurant.id,
      isActive: true,
    },
  })

  // Create some coupons
  const coupons = [
    { code: 'BIENVENUE10', type: 'PERCENTAGE', value: 10, description: '10% de réduction première commande', usagePerUser: 1 },
    { code: 'MIDI20', type: 'FIXED_AMOUNT', value: 2000, description: 'Ar 2 000 de réduction sur les commandes du midi', minOrderAmount: 15000 },
    { code: 'FIDELITE15', type: 'PERCENTAGE', value: 15, description: 'Réduction fidélité client Gold', maxDiscount: 10000 },
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

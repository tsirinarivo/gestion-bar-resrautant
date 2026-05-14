import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // ── Restaurant ──────────────────────────────────────────────────────────────
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: 'restaurant-demo' },
    update: {},
    create: {
      name: 'Ny Sakafa Malagasy',
      slug: 'restaurant-demo',
      description: 'Restaurant-bar, cuisine malgache et internationale au cœur d\'Antananarivo.',
      address: 'Lot II M 85 Ankadivato',
      city: 'Antananarivo',
      postalCode: '101',
      country: 'MG',
      phone: '+261 20 22 345 67',
      email: 'contact@nysakafa.mg',
      siret: '00000000000000',
      website: 'https://nysakafa.mg',
      timezone: 'Indian/Antananarivo',
      currency: 'MGA',
      vatNumber: '',
      defaultTaxRate: 20,
      deliveryEnabled: true,
      pickupEnabled: true,
      dineInEnabled: true,
      minOrderAmount: 8000,
      deliveryRadius: 10,
      deliveryFee: 3000,
      estimatedPrepTime: 20,
      openingHours: {
        monday:    { isOpen: true,  open: '11:00', close: '22:30' },
        tuesday:   { isOpen: true,  open: '11:00', close: '22:30' },
        wednesday: { isOpen: true,  open: '11:00', close: '22:30' },
        thursday:  { isOpen: true,  open: '11:00', close: '22:30' },
        friday:    { isOpen: true,  open: '11:00', close: '23:30' },
        saturday:  { isOpen: true,  open: '09:00', close: '23:30' },
        sunday:    { isOpen: true,  open: '09:00', close: '22:00' },
      },
    },
  })
  console.log('✅ Restaurant:', restaurant.name)

  // ── Roles ───────────────────────────────────────────────────────────────────
  const roleData = [
    { name: 'superadmin', displayName: 'Super Administrateur', isSystem: true },
    { name: 'manager',    displayName: 'Manager',              isSystem: true },
    { name: 'caissier',  displayName: 'Caissier',             isSystem: true },
    { name: 'serveur',   displayName: 'Serveur',              isSystem: true },
    { name: 'cuisinier', displayName: 'Cuisinier',            isSystem: true },
    { name: 'client',    displayName: 'Client',               isSystem: true },
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

  // ── Users ───────────────────────────────────────────────────────────────────
  const password = await bcrypt.hash('demo1234', 12)
  const usersData = [
    { email: 'admin@demo.com',     firstName: 'Rivo',     lastName: 'Rakotoarivelo', role: 'superadmin' },
    { email: 'manager@demo.com',   firstName: 'Soavina',  lastName: 'Randriamahefa', role: 'manager'    },
    { email: 'caissier@demo.com',  firstName: 'Toky',     lastName: 'Rabemananjara', role: 'caissier'   },
    { email: 'serveur@demo.com',   firstName: 'Malala',   lastName: 'Andriantsoa',   role: 'serveur'    },
    { email: 'serveur2@demo.com',  firstName: 'Henintsoa',lastName: 'Rasoa',          role: 'serveur'    },
    { email: 'cuisinier@demo.com', firstName: 'Hasina',   lastName: 'Rakotondrabe',  role: 'cuisinier'  },
    { email: 'chef@demo.com',      firstName: 'Fidy',     lastName: 'Andriambelona', role: 'cuisinier'  },
  ]
  const createdUsers: Record<string, any> = {}
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email, passwordHash: password,
        firstName: u.firstName, lastName: u.lastName,
        isActive: true, isVerified: true,
        restaurantId: restaurant.id, roleId: roles[u.role].id,
      },
    })
    createdUsers[u.role] = user
  }
  console.log('✅ Users created')

  // ── Employees ───────────────────────────────────────────────────────────────
  const employeeMap = [
    { role: 'manager',   position: 'Manager de salle',   dept: 'Direction', salary: 1_400_000 },
    { role: 'caissier',  position: 'Caissier principal',  dept: 'Salle',     salary: 650_000  },
    { role: 'serveur',   position: 'Serveur',             dept: 'Salle',     salary: 550_000  },
    { role: 'cuisinier', position: 'Chef de cuisine',     dept: 'Cuisine',   salary: 1_000_000},
  ]
  for (const em of employeeMap) {
    const user = createdUsers[em.role]
    if (!user) continue
    await prisma.employee.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id, restaurantId: restaurant.id,
        position: em.position, department: em.dept,
        hireDate: new Date('2023-03-01'),
        salary: em.salary, salaryType: 'MONTHLY',
        pin: '1234', isActive: true,
      },
    })
  }
  console.log('✅ Employees created')

  // ── Categories ──────────────────────────────────────────────────────────────
  const categoriesData = [
    { name: 'Entrées',       slug: 'entrees',    icon: '🥗', color: '#10B981', sortOrder: 1 },
    { name: 'Plats',         slug: 'plats',      icon: '🍽️', color: '#FF4D00', sortOrder: 2 },
    { name: 'Burgers',       slug: 'burgers',    icon: '🍔', color: '#F59E0B', sortOrder: 3 },
    { name: 'Pizzas',        slug: 'pizzas',     icon: '🍕', color: '#EF4444', sortOrder: 4 },
    { name: 'Pâtes',         slug: 'pates',      icon: '🍝', color: '#FFB800', sortOrder: 5 },
    { name: 'Sandwichs',     slug: 'sandwichs',  icon: '🥪', color: '#8B5CF6', sortOrder: 6 },
    { name: 'Boissons',      slug: 'boissons',   icon: '🍹', color: '#3B82F6', sortOrder: 7 },
    { name: 'Cocktails',     slug: 'cocktails',  icon: '🍸', color: '#EC4899', sortOrder: 8 },
    { name: 'Desserts',      slug: 'desserts',   icon: '🍰', color: '#A78BFA', sortOrder: 9 },
    { name: 'Petit-déjeuner',slug: 'pdej',       icon: '☕', color: '#78716C', sortOrder: 10 },
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

  // ── Products ─────────────────────────────────────────────────────────────────
  // Prix réalistes restaurant Antananarivo 2025 (Ariary)
  const productsData = [

    // ─ ENTRÉES ─────────────────────────────────────────────────────────────────
    { name: 'Lasopy Malagasy',        slug: 'lasopy',              cat: 'entrees',   price:  6_000, cost: 1_800, desc: 'Soupe de légumes malgache maison, bouillon de zébu, légumes du marché', prepTime: 15 },
    { name: 'Salade Fraîche',         slug: 'salade-fraiche',      cat: 'entrees',   price:  8_000, cost: 2_200, desc: 'Tomates, concombres, carottes râpées, laitue, vinaigrette citronnée', prepTime: 8 },
    { name: 'Nems au Poulet (4 pcs)', slug: 'nems-poulet',         cat: 'entrees',   price: 10_000, cost: 3_200, desc: 'Nems croustillants poulet et légumes, sauce nuoc-mâm maison', prepTime: 10, tags: ['friture', 'populaire'], allergens: ['gluten'] },
    { name: 'Brochettes Zébu (3 pcs)',slug: 'brochettes-zebu',     cat: 'entrees',   price: 15_000, cost: 5_500, desc: 'Brochettes de zébu marinées, épices locales, grillées au charbon', prepTime: 15, featured: true, tags: ['zébu', 'grillé'], allergens: [] },
    { name: 'Soupe Crevettes Coco',   slug: 'soupe-crevettes',     cat: 'entrees',   price: 16_000, cost: 6_000, desc: 'Crevettes de Madagascar, lait de coco, citronnelle, gingembre', prepTime: 15, tags: ['fruits de mer'], allergens: ['crustacés'] },
    { name: 'Samoussas (4 pcs)',      slug: 'samoussas',           cat: 'entrees',   price:  9_000, cost: 2_800, desc: 'Samoussas bœuf-légumes croustillants, sauce piment maison', prepTime: 10, tags: ['friture'], allergens: ['gluten'] },

    // ─ PLATS ───────────────────────────────────────────────────────────────────
    { name: 'Romazava',               slug: 'romazava',            cat: 'plats',     price: 22_000, cost: 7_000, desc: 'Plat national : zébu mijoté, brèdes mafanes, légumes verts, riz blanc', prepTime: 40, featured: true, tags: ['malgache', 'traditionnel', 'zébu'] },
    { name: 'Ravitoto sy Henakisoa',  slug: 'ravitoto',            cat: 'plats',     price: 20_000, cost: 6_500, desc: 'Feuilles de manioc pilées au porc, lait de coco, riz blanc', prepTime: 45, featured: true, tags: ['malgache', 'traditionnel', 'porc'] },
    { name: 'Akoho sy Voanio',        slug: 'akoho-voanio',        cat: 'plats',     price: 22_000, cost: 7_500, desc: 'Poulet mijoté au lait de coco, curcuma, gingembre, riz blanc', prepTime: 35, featured: true, tags: ['volaille', 'maison'] },
    { name: 'Vary amin\'Anana',        slug: 'vary-aminanana',      cat: 'plats',     price: 16_000, cost: 4_500, desc: 'Riz aux légumes verts malgaches, bouillon maison', prepTime: 20, tags: ['végétarien', 'malgache', 'traditionnel'] },
    { name: 'Entrecôte de Zébu 300g', slug: 'entrecote-zebu',      cat: 'plats',     price: 45_000, cost: 18_000, desc: 'Entrecôte de zébu grillée 300g, frites maison, sauce poivre vert ou sauce tomate', prepTime: 20, featured: true, tags: ['zébu', 'grillé', 'populaire'], allergens: ['lait'] },
    { name: 'Poisson Grillé du Jour', slug: 'poisson-grille',      cat: 'plats',     price: 28_000, cost: 10_000, desc: 'Poisson frais du marché, grillé, riz blanc, sauce citron-gingembre', prepTime: 25, featured: true, tags: ['poisson', 'grillé'], allergens: ['poissons'] },
    { name: 'Crevettes Sautées',      slug: 'crevettes-sautees',   cat: 'plats',     price: 38_000, cost: 15_000, desc: 'Crevettes de Madagascar sautées à l\'ail, beurre, persil, riz blanc', prepTime: 20, featured: true, tags: ['fruits de mer'], allergens: ['crustacés', 'lait'] },
    { name: 'Masikita (Brochettes mix)',slug: 'masikita',           cat: 'plats',     price: 25_000, cost: 8_500, desc: '4 brochettes mixtes : zébu, poulet, porc, légumes grillés, riz ou frites', prepTime: 25, tags: ['grillé', 'populaire'] },
    { name: 'Riz Cantonais Maison',   slug: 'riz-cantonais',       cat: 'plats',     price: 14_000, cost: 4_000, desc: 'Riz sauté, légumes, œufs, sauce soja', prepTime: 15, tags: ['rapide', 'riz'], allergens: ['oeufs', 'soja'] },
    { name: 'Poulet Rôti Entier',     slug: 'poulet-roti',         cat: 'plats',     price: 55_000, cost: 22_000, desc: 'Poulet fermier rôti entier, frites, salade — pour 2 personnes', prepTime: 60, tags: ['volaille', 'populaire'] },

    // ─ BURGERS ─────────────────────────────────────────────────────────────────
    { name: 'Burger Zébu Classic',    slug: 'burger-zebu',         cat: 'burgers',   price: 20_000, cost: 7_000, desc: 'Steak haché zébu 180g, cheddar, salade, tomate, oignons, sauce maison, frites', prepTime: 15, featured: true, tags: ['zébu', 'populaire'], allergens: ['gluten', 'lait', 'oeufs'] },
    { name: 'Burger Poulet Crispy',   slug: 'burger-poulet',       cat: 'burgers',   price: 17_000, cost: 5_500, desc: 'Filet de poulet croustillant, salade, tomate, mayo, pain brioché, frites', prepTime: 15, tags: ['volaille'], allergens: ['gluten', 'lait', 'oeufs'] },
    { name: 'Double Smash Zébu',      slug: 'smash-burger-double', cat: 'burgers',   price: 26_000, cost: 9_500, desc: 'Double steak smashé zébu 2×120g, double cheddar, cornichons, sauce spéciale, frites', prepTime: 12, isNew: true, tags: ['zébu', 'populaire'], allergens: ['gluten', 'lait', 'oeufs'] },
    { name: 'Burger Végétarien',      slug: 'burger-vege',         cat: 'burgers',   price: 15_000, cost: 4_500, desc: 'Galette légumes-lentilles, avocat, tomate, sauce yaourt maison, frites', prepTime: 15, tags: ['végétarien'], allergens: ['gluten', 'lait'] },
    { name: 'Burger Crevettes',       slug: 'burger-crevettes',    cat: 'burgers',   price: 24_000, cost: 9_000, desc: 'Crevettes de Madagascar panées, salade, tomate, sauce cocktail, frites', prepTime: 18, tags: ['fruits de mer'], allergens: ['gluten', 'lait', 'oeufs', 'crustacés'] },

    // ─ PIZZAS ──────────────────────────────────────────────────────────────────
    { name: 'Margherita',             slug: 'margherita',          cat: 'pizzas',    price: 18_000, cost: 5_500, desc: 'Sauce tomate maison, mozzarella, basilic frais', prepTime: 20, tags: ['végétarien'], allergens: ['gluten', 'lait'] },
    { name: 'Pizza Zébu-Oignon',      slug: 'pizza-zebu',          cat: 'pizzas',    price: 22_000, cost: 7_500, desc: 'Steak haché zébu, oignons rouges, mozzarella, sauce barbecue', prepTime: 22, featured: true, tags: ['zébu'], allergens: ['gluten', 'lait'] },
    { name: 'Pizza Crevettes-Ail',    slug: 'pizza-crevettes',     cat: 'pizzas',    price: 26_000, cost: 9_500, desc: 'Crevettes de Madagascar, ail, persil, mozzarella, huile d\'olive', prepTime: 22, tags: ['fruits de mer'], allergens: ['gluten', 'lait', 'crustacés'] },
    { name: 'Pizza 4 Fromages',       slug: 'pizza-4-fromages',    cat: 'pizzas',    price: 21_000, cost: 7_000, desc: 'Mozzarella, gouda, fromage frais, parmesan', prepTime: 20, tags: ['végétarien', 'fromage'], allergens: ['gluten', 'lait'] },
    { name: 'Pizza Poulet-Champignon',slug: 'pizza-poulet-champ',  cat: 'pizzas',    price: 20_000, cost: 6_500, desc: 'Poulet grillé, champignons, crème fraîche, mozzarella', prepTime: 20, featured: true, tags: ['volaille'], allergens: ['gluten', 'lait'] },
    { name: 'Pizza Complète',         slug: 'pizza-complete',      cat: 'pizzas',    price: 24_000, cost: 8_000, desc: 'Jambon, œuf, champignons, mozzarella, sauce tomate', prepTime: 22, tags: ['porc'], allergens: ['gluten', 'lait', 'oeufs'] },

    // ─ PÂTES ───────────────────────────────────────────────────────────────────
    { name: 'Spaghetti Bolognaise Zébu', slug: 'spaghetti-bolo',   cat: 'pates',     price: 18_000, cost: 5_500, desc: 'Spaghetti, sauce bolognaise zébu mijotée 3h, parmesan', prepTime: 20, tags: ['zébu', 'maison'], allergens: ['gluten', 'lait', 'oeufs'] },
    { name: 'Pâtes Carbonara',        slug: 'carbonara',           cat: 'pates',     price: 16_000, cost: 4_800, desc: 'Spaghetti, lardons fumés, œuf, parmesan, poivre noir', prepTime: 15, tags: ['porc', 'classique'], allergens: ['gluten', 'lait', 'oeufs'] },
    { name: 'Penne Arrabiata',        slug: 'arrabiata',           cat: 'pates',     price: 15_000, cost: 4_200, desc: 'Penne, sauce tomate pimentée, ail, basilic, parmesan', prepTime: 15, tags: ['végétarien', 'épicé'], allergens: ['gluten', 'lait'] },
    { name: 'Pâtes aux Crevettes',    slug: 'pates-crevettes',     cat: 'pates',     price: 24_000, cost: 9_000, desc: 'Spaghetti, crevettes sautées, ail, tomates cerises, persil', prepTime: 18, tags: ['fruits de mer'], allergens: ['gluten', 'crustacés'] },

    // ─ SANDWICHS ───────────────────────────────────────────────────────────────
    { name: 'Sandwich Zébu Grillé',   slug: 'sandwich-zebu',       cat: 'sandwichs', price: 14_000, cost: 4_500, desc: 'Pain baguette, steak zébu grillé, salade, tomate, oignons, sauce maison', prepTime: 10, tags: ['zébu', 'rapide'], allergens: ['gluten'] },
    { name: 'Sandwich Poulet Mayo',   slug: 'sandwich-poulet',     cat: 'sandwichs', price: 12_000, cost: 3_500, desc: 'Pain baguette, poulet grillé, mayo, cornichons, laitue', prepTime: 8, tags: ['volaille', 'rapide'], allergens: ['gluten', 'oeufs'] },
    { name: 'Croque Monsieur',        slug: 'croque-monsieur',     cat: 'sandwichs', price: 11_000, cost: 3_200, desc: 'Pain de mie grillé, jambon, fromage fondu, béchamel', prepTime: 8, tags: ['porc', 'chaud'], allergens: ['gluten', 'lait'] },
    { name: 'Club Sandwich',          slug: 'club-sandwich',       cat: 'sandwichs', price: 18_000, cost: 5_800, desc: 'Triple pain de mie grillé, poulet, bacon, œuf, tomate, laitue, mayo', prepTime: 12, tags: ['volaille', 'populaire'], allergens: ['gluten', 'lait', 'oeufs'] },

    // ─ BOISSONS ────────────────────────────────────────────────────────────────
    { name: 'Eau Minérale 50cl',      slug: 'eau-50cl',            cat: 'boissons',  price:  1_500, cost:   400, desc: 'Eau minérale naturelle, fraîche', prepTime: 1 },
    { name: 'Eau Minérale 1.5L',      slug: 'eau-15l',             cat: 'boissons',  price:  3_000, cost:   900, desc: 'Eau minérale naturelle 1.5L', prepTime: 1 },
    { name: 'Coca-Cola 33cl',         slug: 'coca-cola',           cat: 'boissons',  price:  3_500, cost: 1_000, desc: 'Coca-Cola bien frais 33cl', prepTime: 1 },
    { name: 'Fanta Orange 33cl',      slug: 'fanta',               cat: 'boissons',  price:  3_500, cost: 1_000, desc: 'Fanta orange frais 33cl', prepTime: 1 },
    { name: 'Sprite 33cl',            slug: 'sprite',              cat: 'boissons',  price:  3_500, cost: 1_000, desc: 'Sprite frais 33cl', prepTime: 1 },
    { name: 'Jus de Mangue Frais',    slug: 'jus-mangue',          cat: 'boissons',  price:  6_000, cost: 1_800, desc: 'Mangue fraîche pressée à la commande', prepTime: 3, isNew: true, tags: ['maison', 'sans alcool', 'local'] },
    { name: 'Jus d\'Ananas Frais',    slug: 'jus-ananas',          cat: 'boissons',  price:  6_000, cost: 1_800, desc: 'Ananas frais pressé à la commande', prepTime: 3, tags: ['maison', 'sans alcool', 'local'] },
    { name: 'Jus de Goyave',          slug: 'jus-goyave',          cat: 'boissons',  price:  5_500, cost: 1_500, desc: 'Jus de goyave maison, sucre de canne', prepTime: 3, tags: ['maison', 'sans alcool', 'local'] },
    { name: 'Jus de Litchi',          slug: 'jus-litchi',          cat: 'boissons',  price:  6_500, cost: 2_000, desc: 'Jus de litchi de Tamatave, pressé maison (saison)', prepTime: 3, tags: ['maison', 'sans alcool', 'local'] },
    { name: 'Limonade Citronnelle',   slug: 'limonade-maison',     cat: 'boissons',  price:  5_000, cost: 1_500, desc: 'Citronnelle, gingembre, citron vert, menthe fraîche', prepTime: 3, tags: ['maison', 'sans alcool'] },
    { name: 'Café Arabica Malgache',  slug: 'cafe',                cat: 'boissons',  price:  3_000, cost:   700, desc: 'Café arabica des Hautes Terres, servi chaud', prepTime: 2, tags: ['chaud', 'local'] },
    { name: 'Thé Vanille Madagascar', slug: 'the-vanille',         cat: 'boissons',  price:  3_500, cost:   800, desc: 'Thé noir infusé à la vanille de Madagascar', prepTime: 3, tags: ['chaud', 'local'] },
    { name: 'Bière THB 65cl',         slug: 'thb-65',              cat: 'boissons',  price:  6_000, cost: 2_200, desc: 'Three Horses Beer, bière malgache premium 65cl bien fraîche', prepTime: 1, tags: ['alcool', 'bière', 'local'] },
    { name: 'Bière THB 33cl',         slug: 'thb-33',              cat: 'boissons',  price:  4_000, cost: 1_500, desc: 'Three Horses Beer 33cl, fraîche', prepTime: 1, tags: ['alcool', 'bière', 'local'] },
    { name: 'Bière Gold 65cl',        slug: 'gold-65',             cat: 'boissons',  price:  6_500, cost: 2_500, desc: 'Gold beer 65cl, bière premium malgache', prepTime: 1, tags: ['alcool', 'bière', 'local'] },
    { name: 'Vin Rouge Verre',        slug: 'vin-rouge',           cat: 'boissons',  price:  8_000, cost: 3_000, desc: 'Verre de vin rouge importé 15cl', prepTime: 1, tags: ['alcool', 'vin'] },
    { name: 'Rhum Arrangé Maison',    slug: 'rhum-arrange',        cat: 'boissons',  price:  8_000, cost: 2_800, desc: 'Rhum arrangé aux fruits tropicaux de Madagascar (vanille, litchi, coco)', prepTime: 1, featured: true, tags: ['alcool', 'rhum', 'maison', 'local'] },

    // ─ COCKTAILS ───────────────────────────────────────────────────────────────
    { name: 'Cocktail Malagasy Sunset',slug: 'malagasy-sunset',    cat: 'cocktails', price: 14_000, cost: 5_000, desc: 'Rhum blanc, jus de mangue, grenadine, jus d\'orange, glace pilée', prepTime: 3, featured: true, tags: ['alcool', 'maison'] },
    { name: 'Mojito Coco-Vanille',    slug: 'mojito-coco',         cat: 'cocktails', price: 14_000, cost: 4_800, desc: 'Rhum blanc, coco, citron vert, vanille de Madagascar, menthe, eau gazeuse', prepTime: 3, tags: ['alcool', 'maison'] },
    { name: 'Caïpirinha Litchi',      slug: 'caipirinha-litchi',   cat: 'cocktails', price: 13_000, cost: 4_500, desc: 'Cachaça, litchi frais, citron vert, sucre de canne', prepTime: 3, tags: ['alcool', 'maison'] },
    { name: 'Piña Colada Malgache',   slug: 'pina-colada',         cat: 'cocktails', price: 13_000, cost: 4_500, desc: 'Rhum blanc, lait de coco, ananas frais mixé', prepTime: 3, tags: ['alcool', 'maison'] },
    { name: 'Virgin Mango Sunrise',   slug: 'virgin-mango',        cat: 'cocktails', price:  9_000, cost: 3_000, desc: 'Jus de mangue, grenadine, jus d\'orange — sans alcool', prepTime: 3, tags: ['sans alcool', 'maison'] },
    { name: 'Ti Punch Malgache',      slug: 'ti-punch',            cat: 'cocktails', price: 10_000, cost: 3_500, desc: 'Rhum arrangé maison, citron vert, sucre de canne', prepTime: 2, tags: ['alcool', 'local'] },

    // ─ DESSERTS ────────────────────────────────────────────────────────────────
    { name: 'Crème Vanille Madagascar',slug: 'creme-vanille',      cat: 'desserts',  price:  9_000, cost: 2_800, desc: 'Crème brûlée à la vanille de Madagascar, caramel doré au chalumeau', prepTime: 10, featured: true, allergens: ['lait', 'oeufs'] },
    { name: 'Fondant Chocolat Local', slug: 'fondant-chocolat',    cat: 'desserts',  price: 10_000, cost: 3_200, desc: 'Fondant chocolat 70% de Madagascar, cœur coulant, glace vanille', prepTime: 12, featured: true, allergens: ['gluten', 'lait', 'oeufs'] },
    { name: 'Mofo Baolina',           slug: 'mofo-baolina',        cat: 'desserts',  price:  5_000, cost: 1_500, desc: 'Beignets malgaches sucrés, confiture goyave maison, sucre glace', prepTime: 10, featured: true, tags: ['malgache', 'traditionnel'], allergens: ['gluten', 'oeufs'] },
    { name: 'Salade Fruits Tropicaux',slug: 'salade-fruits',       cat: 'desserts',  price:  8_000, cost: 2_500, desc: 'Mangue, ananas, litchi, papaye, coco râpée, menthe fraîche', prepTime: 8, tags: ['frais', 'local'] },
    { name: 'Glace Artisanale 2 boules',slug: 'glace-boules',      cat: 'desserts',  price:  6_000, cost: 1_800, desc: '2 boules au choix : vanille, coco, chocolat, mangue', prepTime: 3, tags: ['glacé', 'maison'], allergens: ['lait'] },
    { name: 'Tarte Coco Maison',      slug: 'tarte-coco',          cat: 'desserts',  price:  8_000, cost: 2_500, desc: 'Tarte noix de coco et vanille, pâte sablée maison', prepTime: 5, tags: ['maison', 'local'], allergens: ['gluten', 'lait', 'oeufs'] },

    // ─ PETIT-DÉJEUNER ──────────────────────────────────────────────────────────
    { name: 'Café + Mofo Gasy',       slug: 'cafe-mofo',           cat: 'pdej',      price:  5_000, cost: 1_500, desc: 'Café malgache + galettes de riz (mofo gasy) 3 pièces', prepTime: 5, tags: ['malgache', 'matin'] },
    { name: 'Petit-déj Complet',      slug: 'pdej-complet',        cat: 'pdej',      price: 15_000, cost: 5_000, desc: 'Œufs brouillés, pain beurré, jus de fruits frais, café ou thé', prepTime: 12, featured: true, allergens: ['gluten', 'lait', 'oeufs'] },
    { name: 'Pancakes Banane-Coco',   slug: 'pancakes',            cat: 'pdej',      price: 12_000, cost: 3_800, desc: 'Pancakes moelleux, banane fraîche, noix de coco, sirop de canne', prepTime: 15, tags: ['sucré', 'matin'], allergens: ['gluten', 'lait', 'oeufs'] },
    { name: 'Omelette Maison',        slug: 'omelette',            cat: 'pdej',      price: 10_000, cost: 3_000, desc: 'Omelette 3 œufs, fromage, herbes fraîches, pain toast', prepTime: 10, tags: ['matin'], allergens: ['oeufs', 'lait', 'gluten'] },
    { name: 'Yaourt Fruits Locaux',   slug: 'yaourt-fruits',       cat: 'pdej',      price:  6_000, cost: 1_800, desc: 'Yaourt nature maison, fruits tropicaux de saison, miel', prepTime: 3, tags: ['frais', 'local'], allergens: ['lait'] },
  ]

  for (const p of productsData) {
    const cat = categories[p.cat]
    if (!cat) continue
    await prisma.product.upsert({
      where: { restaurantId_slug: { restaurantId: restaurant.id, slug: p.slug } },
      update: { price: p.price, costPrice: p.cost },
      create: {
        name: p.name, slug: p.slug, description: p.desc,
        price: p.price, costPrice: p.cost,
        prepTime: p.prepTime ?? 15,
        allergens: (p as any).allergens ?? [],
        tags: (p as any).tags ?? [],
        images: [], isActive: true, isAvailable: true,
        isFeatured: (p as any).featured ?? false,
        isNew: (p as any).isNew ?? false,
        sortOrder: 0, taxRate: 10,
        restaurantId: restaurant.id, categoryId: cat.id,
      },
    })
  }
  console.log('✅ Products created:', productsData.length)

  // ── Tables ──────────────────────────────────────────────────────────────────
  const tablesData = [
    { number: 1,  capacity: 2,  section: 'Terrasse',       shape: 'circle',    posX: 50,  posY: 50  },
    { number: 2,  capacity: 2,  section: 'Terrasse',       shape: 'circle',    posX: 150, posY: 50  },
    { number: 3,  capacity: 4,  section: 'Terrasse',       shape: 'rectangle', posX: 280, posY: 50  },
    { number: 4,  capacity: 4,  section: 'Terrasse',       shape: 'rectangle', posX: 430, posY: 50  },
    { number: 5,  capacity: 6,  section: 'Salle',          shape: 'rectangle', posX: 50,  posY: 200 },
    { number: 6,  capacity: 4,  section: 'Salle',          shape: 'rectangle', posX: 220, posY: 200 },
    { number: 7,  capacity: 4,  section: 'Salle',          shape: 'rectangle', posX: 380, posY: 200 },
    { number: 8,  capacity: 6,  section: 'Salle',          shape: 'rectangle', posX: 540, posY: 200 },
    { number: 9,  capacity: 2,  section: 'Salle',          shape: 'circle',    posX: 50,  posY: 360 },
    { number: 10, capacity: 2,  section: 'Salle',          shape: 'circle',    posX: 160, posY: 360 },
    { number: 11, capacity: 8,  section: 'Salle',          shape: 'rectangle', posX: 300, posY: 360, width: 180 },
    { number: 12, capacity: 4,  section: 'Bar',            shape: 'rectangle', posX: 50,  posY: 520 },
    { number: 13, capacity: 2,  section: 'Bar',            shape: 'circle',    posX: 220, posY: 520 },
    { number: 14, capacity: 2,  section: 'Bar',            shape: 'circle',    posX: 330, posY: 520 },
    { number: 15, capacity: 12, section: 'Salon Privatif', shape: 'rectangle', posX: 50,  posY: 670, width: 240 },
  ]
  for (const t of tablesData) {
    await prisma.diningTable.upsert({
      where: { restaurantId_number: { restaurantId: restaurant.id, number: t.number } },
      update: {},
      create: {
        ...t, minCapacity: 1,
        height: 80, width: t.width ?? 100, rotation: 0,
        status: 'AVAILABLE', isActive: true,
        restaurantId: restaurant.id,
      },
    })
  }
  console.log('✅ Tables created:', tablesData.length)

  // ── Customers ───────────────────────────────────────────────────────────────
  const customersData = [
    { firstName: 'Hanta',      lastName: 'Rakoto',         email: 'hanta.rakoto@email.mg',       phone: '+261 34 12 345 67', city: 'Antananarivo', tier: 'GOLD',     points: 3500 },
    { firstName: 'Jean',       lastName: 'Ratsima',        email: 'jean.ratsima@email.mg',       phone: '+261 33 98 765 43', city: 'Antananarivo', tier: 'BRONZE',   points: 450  },
    { firstName: 'Soa',        lastName: 'Randria',        email: 'soa.randria@email.mg',        phone: '+261 34 55 443 32', city: 'Toamasina',    tier: 'SILVER',   points: 1200 },
    { firstName: 'Paul',       lastName: 'Rajoana',        email: 'paul.rajoana@email.mg',       phone: '+261 32 77 889 90', city: 'Antsirabe',    tier: 'BRONZE',   points: 200  },
    { firstName: 'Miora',      lastName: 'Andriantsoa',    email: 'miora.a@email.mg',            phone: '+261 34 22 334 45', city: 'Antananarivo', tier: 'PLATINUM', points: 8500 },
    { firstName: 'Lova',       lastName: 'Raharisoa',      email: 'lova.raharisoa@email.mg',     phone: '+261 33 33 221 10', city: 'Fianarantsoa', tier: 'BRONZE',   points: 150  },
    { firstName: 'Noro',       lastName: 'Rabenarivo',     email: 'noro.rabenarivo@email.mg',    phone: '+261 34 44 332 21', city: 'Mahajanga',    tier: 'SILVER',   points: 900  },
    { firstName: 'Tina',       lastName: 'Rakotoarison',   email: 'tina.rako@email.mg',          phone: '+261 32 11 223 34', city: 'Antananarivo', tier: 'GOLD',     points: 2800 },
    { firstName: 'Fara',       lastName: 'Andriamasy',     email: 'fara.andriamasy@email.mg',    phone: '+261 34 66 778 89', city: 'Antananarivo', tier: 'BRONZE',   points: 300  },
    { firstName: 'Rado',       lastName: 'Razafindrakoto', email: 'rado.razafin@email.mg',       phone: '+261 33 55 667 78', city: 'Antananarivo', tier: 'SILVER',   points: 1600 },
    { firstName: 'Voahangy',   lastName: 'Ralison',        email: 'voahangy.r@email.mg',         phone: '+261 32 44 556 67', city: 'Toliara',      tier: 'BRONZE',   points: 80   },
    { firstName: 'Christian',  lastName: 'Rakotomalala',   email: 'christian.rm@email.mg',       phone: '+261 34 99 100 11', city: 'Antananarivo', tier: 'GOLD',     points: 4200 },
  ]
  for (const c of customersData) {
    const existing = await prisma.customer.findFirst({ where: { email: c.email, restaurantId: restaurant.id } })
    if (!existing) {
      await prisma.customer.create({
        data: {
          firstName: c.firstName, lastName: c.lastName,
          email: c.email, phone: c.phone, city: c.city,
          restaurantId: restaurant.id, source: 'DIRECT',
          isActive: true, acceptsMarketing: true,
          loyaltyAccount: {
            create: {
              points: c.points,
              totalEarned: c.points + Math.floor(Math.random() * 500),
              totalSpent: Math.floor(c.points * 0.3),
              tier: c.tier as any,
            },
          },
        },
      })
    }
  }
  console.log('✅ Customers created')

  // ── Stock ───────────────────────────────────────────────────────────────────
  // Prix grossiste Antananarivo 2025
  const stockData = [
    { name: 'Riz Vary Gasy',             unit: 'kg',     qty: 80,  min: 20,  reorder: 40,  cost:  2_200, location: 'Réserve sèche' },
    { name: 'Viande de Zébu',            unit: 'kg',     qty: 12,  min: 4,   reorder: 8,   cost: 32_000, location: 'Chambre froide', perishable: true },
    { name: 'Poulet Fermier',            unit: 'kg',     qty: 15,  min: 5,   reorder: 10,  cost: 11_000, location: 'Chambre froide', perishable: true },
    { name: 'Crevettes Fraîches',        unit: 'kg',     qty: 6,   min: 2,   reorder: 4,   cost: 42_000, location: 'Chambre froide', perishable: true },
    { name: 'Poisson Frais',             unit: 'kg',     qty: 8,   min: 3,   reorder: 5,   cost: 18_000, location: 'Chambre froide', perishable: true },
    { name: 'Porc Haché',               unit: 'kg',     qty: 5,   min: 2,   reorder: 4,   cost: 16_000, location: 'Chambre froide', perishable: true },
    { name: 'Farine Blanche',           unit: 'kg',     qty: 30,  min: 8,   reorder: 15,  cost:  3_200, location: 'Réserve sèche' },
    { name: 'Huile de Cuisine',         unit: 'L',      qty: 15,  min: 4,   reorder: 8,   cost:  8_500, location: 'Réserve sèche' },
    { name: 'Tomates Fraîches',         unit: 'kg',     qty: 20,  min: 6,   reorder: 10,  cost:  3_500, location: 'Légumier', perishable: true },
    { name: 'Oignons',                  unit: 'kg',     qty: 15,  min: 4,   reorder: 8,   cost:  2_000, location: 'Légumier' },
    { name: 'Ail',                      unit: 'kg',     qty: 5,   min: 1,   reorder: 2,   cost:  8_000, location: 'Légumier' },
    { name: 'Pommes de Terre',          unit: 'kg',     qty: 40,  min: 12,  reorder: 20,  cost:  2_500, location: 'Légumier' },
    { name: 'Carottes',                 unit: 'kg',     qty: 10,  min: 3,   reorder: 6,   cost:  2_500, location: 'Légumier', perishable: true },
    { name: 'Lait de Coco',            unit: 'L',      qty: 12,  min: 3,   reorder: 6,   cost:  5_500, location: 'Réserve sèche', perishable: true },
    { name: 'Œufs',                    unit: 'unité',  qty: 200, min: 48,  reorder: 100, cost:    500, location: 'Réfrigérateur', perishable: true },
    { name: 'Beurre',                  unit: 'kg',     qty: 6,   min: 2,   reorder: 4,   cost: 15_000, location: 'Réfrigérateur', perishable: true },
    { name: 'Fromage (Gouda)',          unit: 'kg',     qty: 4,   min: 1,   reorder: 2,   cost: 28_000, location: 'Réfrigérateur', perishable: true },
    { name: 'Mozzarella',              unit: 'kg',     qty: 3,   min: 1,   reorder: 2,   cost: 35_000, location: 'Réfrigérateur', perishable: true },
    { name: 'Crème Fraîche',           unit: 'L',      qty: 5,   min: 1,   reorder: 3,   cost: 12_000, location: 'Réfrigérateur', perishable: true },
    { name: 'Mangue Fraîche',          unit: 'kg',     qty: 25,  min: 8,   reorder: 15,  cost:  2_500, location: 'Légumier', perishable: true },
    { name: 'Ananas',                  unit: 'unité',  qty: 20,  min: 6,   reorder: 12,  cost:  3_000, location: 'Légumier', perishable: true },
    { name: 'Banane',                  unit: 'kg',     qty: 15,  min: 4,   reorder: 8,   cost:  1_500, location: 'Légumier', perishable: true },
    { name: 'Citron Vert',             unit: 'kg',     qty: 8,   min: 2,   reorder: 4,   cost:  3_000, location: 'Légumier', perishable: true },
    { name: 'Vanille de Madagascar',   unit: 'g',      qty: 300, min: 50,  reorder: 100, cost:    450, location: 'Réserve sèche', perishable: true },
    { name: 'Chocolat 70% Malgache',   unit: 'kg',     qty: 5,   min: 1,   reorder: 2,   cost: 48_000, location: 'Réserve sèche' },
    { name: 'Café Arabica Malgache',   unit: 'kg',     qty: 6,   min: 1.5, reorder: 3,   cost: 32_000, location: 'Bar' },
    { name: 'Sucre Blanc',             unit: 'kg',     qty: 20,  min: 5,   reorder: 10,  cost:  3_000, location: 'Réserve sèche' },
    { name: 'Sel',                     unit: 'kg',     qty: 10,  min: 2,   reorder: 5,   cost:    800, location: 'Réserve sèche' },
    { name: 'Bière THB 65cl',          unit: 'bouteille', qty: 120, min: 30, reorder: 60, cost:  2_200, location: 'Cave' },
    { name: 'Bière Gold 65cl',         unit: 'bouteille', qty: 60, min: 18, reorder: 36,  cost:  2_500, location: 'Cave' },
    { name: 'Coca-Cola 33cl',          unit: 'unité',  qty: 200, min: 48,  reorder: 96,  cost:  1_000, location: 'Cave' },
    { name: 'Rhum Blanc 1L',           unit: 'bouteille', qty: 10, min: 2,  reorder: 5,   cost: 25_000, location: 'Bar' },
    { name: 'Pâtes Spaghetti',         unit: 'kg',     qty: 15,  min: 4,   reorder: 8,   cost:  6_000, location: 'Réserve sèche' },
    { name: 'Sauce Tomate (conserve)', unit: 'kg',     qty: 12,  min: 3,   reorder: 6,   cost:  4_500, location: 'Réserve sèche' },
    { name: 'Champignons',             unit: 'kg',     qty: 4,   min: 1,   reorder: 2,   cost: 12_000, location: 'Réfrigérateur', perishable: true },
    { name: 'Noix de Coco',            unit: 'unité',  qty: 30,  min: 8,   reorder: 15,  cost:  1_500, location: 'Légumier' },
    { name: 'Gingembre Frais',         unit: 'kg',     qty: 3,   min: 0.5, reorder: 1,   cost:  8_000, location: 'Légumier', perishable: true },
    { name: 'Basilic Frais',           unit: 'g',      qty: 600, min: 150, reorder: 300, cost:    200, location: 'Cuisine', perishable: true },
    { name: 'Menthe Fraîche',          unit: 'g',      qty: 400, min: 100, reorder: 200, cost:    150, location: 'Cuisine', perishable: true },
    { name: 'Brèdes Mafane',           unit: 'kg',     qty: 5,   min: 1.5, reorder: 3,   cost:  3_500, location: 'Légumier', perishable: true },
    { name: 'Feuilles de Manioc',      unit: 'kg',     qty: 8,   min: 2,   reorder: 4,   cost:  2_000, location: 'Légumier', perishable: true },
    { name: 'Pain de Mie (sachet)',    unit: 'sachet', qty: 20,  min: 5,   reorder: 10,  cost:  4_500, location: 'Réserve sèche', perishable: true },
    { name: 'Pain Baguette',           unit: 'unité',  qty: 30,  min: 10,  reorder: 20,  cost:  1_200, location: 'Réserve sèche', perishable: true },
  ]
  for (const s of stockData) {
    const existing = await prisma.stockItem.findFirst({ where: { name: s.name, restaurantId: restaurant.id } })
    if (!existing) {
      await prisma.stockItem.create({
        data: {
          name: s.name, unit: s.unit,
          currentQuantity: s.qty, minQuantity: s.min,
          reorderQuantity: s.reorder, maxQuantity: s.qty * 2,
          costPerUnit: s.cost, location: s.location,
          isPerishable: s.perishable ?? false,
          restaurantId: restaurant.id, valuationMethod: 'FIFO',
        },
      })
    }
  }
  console.log('✅ Stock created:', stockData.length, 'items')

  // ── Supplier ────────────────────────────────────────────────────────────────
  await prisma.supplier.upsert({
    where: { id: 'supplier-marche-tana' },
    update: {},
    create: {
      id: 'supplier-marche-tana',
      name: 'Marché d\'Analakely',
      contactName: 'Rakoto Andriantsoa',
      email: 'contact@marche-analakely.mg',
      phone: '+261 20 22 123 45',
      address: 'Analakely, Avenue de l\'Indépendance',
      city: 'Antananarivo', postalCode: '101',
      deliveryDays: ['monday', 'wednesday', 'friday', 'saturday'],
      leadTimeDays: 1, restaurantId: restaurant.id, isActive: true,
    },
  })
  await prisma.supplier.upsert({
    where: { id: 'supplier-grossiste' },
    update: {},
    create: {
      id: 'supplier-grossiste',
      name: 'Grossiste Boissons Tana',
      contactName: 'Rivo Ramanantoanina',
      email: 'grossiste.boissons@email.mg',
      phone: '+261 33 77 889 90',
      address: 'Zone industrielle Forello, Tanjombato',
      city: 'Antananarivo', postalCode: '101',
      deliveryDays: ['tuesday', 'friday'],
      leadTimeDays: 2, restaurantId: restaurant.id, isActive: true,
    },
  })
  console.log('✅ Suppliers created')

  // ── Coupons ─────────────────────────────────────────────────────────────────
  const coupons = [
    { code: 'BIENVENUE10', type: 'PERCENTAGE',  value: 10,    description: '10% de réduction première commande',      usagePerUser: 1 },
    { code: 'MIDI5000',    type: 'FIXED_AMOUNT', value: 5_000, description: 'Ar 5 000 de réduction commandes du midi', minOrderAmount: 25_000 },
    { code: 'FIDELITE15',  type: 'PERCENTAGE',  value: 15,    description: 'Réduction fidélité client Gold',          maxDiscount: 15_000 },
    { code: 'WEEKEND20',   type: 'PERCENTAGE',  value: 20,    description: '20% le week-end sur les plats malgaches', maxDiscount: 20_000 },
    { code: 'GROUPE10K',   type: 'FIXED_AMOUNT', value: 10_000,description: 'Ar 10 000 pour les groupes +8 personnes',minOrderAmount: 80_000 },
  ]
  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: {},
      create: { ...c, restaurantId: restaurant.id, channels: ['ONLINE', 'POS'], isActive: true },
    })
  }
  console.log('✅ Coupons created')

  // ── Reservations ────────────────────────────────────────────────────────────
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(12, 30, 0, 0)
  const soir     = new Date(); soir.setDate(soir.getDate() + 2);         soir.setHours(19, 0, 0, 0)
  const weekend  = new Date(); weekend.setDate(weekend.getDate() + 5);   weekend.setHours(20, 0, 0, 0)

  const reservations = [
    { ref: 'RES-SEED001', firstName: 'Hanta',   lastName: 'Rakoto',       phone: '+261 34 12 345 67', size: 2,  date: tomorrow, notes: 'Anniversaire — prévoir une bougie',    source: 'ONLINE' },
    { ref: 'RES-SEED002', firstName: 'Jean',    lastName: 'Ratsima',      phone: '+261 33 98 765 43', size: 4,  date: soir,    notes: 'Repas d\'affaires',                    source: 'PHONE'  },
    { ref: 'RES-SEED003', firstName: 'Miora',   lastName: 'Andriantsoa',  phone: '+261 34 22 334 45', size: 10, date: weekend, notes: 'Fête de famille — menu groupe',         source: 'ONLINE' },
  ]
  for (const r of reservations) {
    await prisma.reservation.upsert({
      where: { reservationRef: r.ref },
      update: {},
      create: {
        reservationRef: r.ref,
        firstName: r.firstName, lastName: r.lastName, phone: r.phone,
        partySize: r.size, date: r.date, duration: 90,
        status: 'CONFIRMED', notes: r.notes, source: r.source as any,
        restaurantId: restaurant.id,
      },
    })
  }
  console.log('✅ Reservations created')

  console.log('\n🎉 Base de données initialisée avec succès !')
  console.log('\n📧 Identifiants de connexion :')
  console.log('  Admin:     admin@demo.com     / demo1234')
  console.log('  Manager:   manager@demo.com   / demo1234')
  console.log('  Caissier:  caissier@demo.com  / demo1234')
  console.log('  Serveur:   serveur@demo.com   / demo1234')
  console.log('  Cuisinier: cuisinier@demo.com / demo1234')
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

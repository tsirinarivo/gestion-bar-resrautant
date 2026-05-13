# 🍽️ RestaurantOS — Système de Gestion Restaurant & FastFood

Application web complète de gestion de restaurant et fast-food, production-ready, avec architecture monorepo Turborepo.

## 🏗️ Architecture

```
restaurant-app/
├── apps/
│   ├── web/       → Back-office Manager (port 3000)
│   ├── pos/       → Interface Caisse POS (port 3001)
│   ├── kds/       → Affichage Cuisine KDS (port 3002)
│   ├── client/    → Commande en ligne clients (port 3003)
│   └── api/       → API REST + WebSocket (port 4000)
├── packages/
│   ├── ui/        → Design System partagé
│   ├── database/  → Prisma schema + migrations
│   ├── types/     → Types TypeScript partagés
│   └── utils/     → Utilitaires partagés
├── docker-compose.yml
└── turbo.json
```

## 🚀 Démarrage rapide

### Prérequis
- Node.js 18+
- Docker & Docker Compose
- npm 9+

### 1. Cloner et installer
```bash
git clone <repo-url>
cd restaurant-app
npm install
```

### 2. Variables d'environnement
```bash
# Copier les fichiers .env
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# Éditer apps/api/.env avec vos valeurs
```

### 3. Lancer l'infrastructure Docker
```bash
docker compose up -d
# PostgreSQL: localhost:5432
# Redis: localhost:6379
```

### 4. Initialiser la base de données
```bash
cd packages/database
npm run db:generate   # Générer le client Prisma
npm run db:migrate    # Créer les tables
npm run db:seed       # Insérer les données de démonstration
```

### 5. Lancer en développement
```bash
# Depuis la racine du projet
npm run dev
# ou pour lancer seulement l'API + web:
npx turbo dev --filter=@restaurant/api --filter=@restaurant/web
```

## 📱 Applications

| Application | URL | Description |
|-------------|-----|-------------|
| Back-office | http://localhost:3000 | Dashboard manager, analytics, configuration |
| POS | http://localhost:3001 | Interface caisse tactile |
| KDS | http://localhost:3002 | Affichage cuisine en temps réel |
| Client | http://localhost:3003 | Commande en ligne |
| API | http://localhost:4000 | REST API + WebSocket |

## 🔐 Comptes de démonstration

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Manager | manager@demo.com | demo1234 |
| Caissier | caissier@demo.com | demo1234 |
| Cuisinier | cuisinier@demo.com | demo1234 |
| Serveur | serveur@demo.com | demo1234 |

## 📦 Modules

### 1. 🖥️ POS (Point of Sale)
- Interface tactile optimisée
- Catalogue produits avec catégories et recherche
- Panier dynamique avec modificateurs
- Modes : sur place / emporté / livraison
- Paiement en espèces ou carte
- Sélection de table

### 2. 📊 Dashboard & Analytics
- KPIs en temps réel (CA, commandes, couverts, ticket moyen)
- Graphiques interactifs (Recharts)
- Analyse par catégorie
- Heures de pointe
- Top produits

### 3. 🍕 Gestion du Menu
- CRUD produits avec images
- Catégories personnalisables (icônes, couleurs)
- Gestion de la disponibilité
- Variantes et modificateurs
- Allergènes (14 officiciels UE)
- Calcul de marges

### 4. 🥬 Gestion des Stocks
- Inventaire temps réel
- Mouvements (entrées/sorties/pertes/ajustements)
- Alertes de stock faible
- Suivi par emplacement
- Valorisation FIFO/CMUP

### 5. 👨‍🍳 KDS (Kitchen Display System)
- Affichage temps réel des commandes
- Timer par commande (alertes couleur)
- Validation article par article
- Filtrage par station

### 6. 🪑 Tables & Réservations
- Plan de salle visuel
- Statuts en temps réel (libre/occupée/réservée/nettoyage)
- Gestion des réservations par date
- Confirmation/annulation

### 7. 👥 Clients & Fidélité
- Fiche client complète
- Programme de fidélité (Bronze/Argent/Or/Platine)
- Historique des commandes

### 8. 💳 Coupons & Promotions
- Codes promo (%, montant fixe, livraison gratuite)
- Gestion des limites d'utilisation
- Multi-canaux (POS + en ligne)

### 9. 👤 Employés & RH
- Fiches employés
- Pointage (clock-in/clock-out)
- Planning

### 10. ⚙️ Paramètres
- Informations restaurant
- Modes de service
- Configuration livraison

## 🛠️ Stack Technique

### Frontend (Next.js 14)
- TypeScript + React 18
- Tailwind CSS (dark theme)
- Framer Motion (animations)
- Zustand (state management)
- TanStack Query (data fetching)
- Recharts (graphiques)
- Lucide React (icônes)
- Sonner (notifications toast)

### Backend (Express.js)
- TypeScript
- Prisma ORM + PostgreSQL
- JWT + Refresh Tokens (httpOnly cookies)
- Socket.io (temps réel)
- Zod (validation)
- bcryptjs (hachage)
- Rate limiting

### Infrastructure
- Docker Compose (PostgreSQL 15 + Redis 7)
- Turborepo (monorepo)

## 🔌 API Endpoints

### Auth
- `POST /api/auth/login` — Connexion
- `POST /api/auth/refresh` — Rafraîchir le token
- `POST /api/auth/logout` — Déconnexion
- `GET /api/auth/me` — Profil utilisateur

### Dashboard
- `GET /api/dashboard/kpis` — KPIs temps réel
- `GET /api/dashboard/revenue-chart` — Données CA
- `GET /api/dashboard/hourly-stats` — Heures de pointe
- `GET /api/dashboard/category-stats` — Stats par catégorie
- `GET /api/dashboard/live` — Statut en direct

### Commandes
- `GET /api/orders` — Liste commandes
- `POST /api/orders` — Créer une commande
- `PATCH /api/orders/:id/status` — Changer le statut

### Produits/Menu
- `GET /api/products` — Liste produits
- `POST /api/products` — Créer un produit
- `PUT /api/products/:id` — Modifier
- `PATCH /api/products/:id/availability` — Disponibilité

### Tables
- `GET /api/tables` — Plan de salle
- `PATCH /api/tables/:id/status` — Statut table
- `PUT /api/tables/positions/bulk` — Positions floor plan

## 🏷️ Schéma de données (50 modèles Prisma)

Restaurant, User, Role, Permission, RefreshToken, Category, Product, ProductVariant, ModifierGroup, Modifier, ProductModifierGroup, Ingredient, RecipeItem, StockItem, StockBatch, StockMovement, StockAlert, Supplier, PurchaseOrder, PurchaseOrderItem, DiningTable, Reservation, ReservationReminder, WaitingList, Order, OrderItem, OrderItemModifier, OrderStatusHistory, Payment, Refund, Invoice, InvoiceItem, Customer, CustomerAddress, LoyaltyAccount, LoyaltyTransaction, Employee, ScheduleShift, TimeEntry, Leave, Promotion, PromotionProduct, PromotionCategory, Coupon, CouponUsage, Campaign, Review, Notification, AuditLog

## 🚢 Déploiement Production

```bash
# Build toutes les apps
npm run build

# Variables d'environnement production (apps/api/.env)
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=<clé-secrète-forte>
JWT_REFRESH_SECRET=<clé-secrète-forte>
STRIPE_SECRET_KEY=sk_live_...

# Migrations production
cd packages/database && npm run db:migrate:prod

# Start API
cd apps/api && npm start
```

## 📊 Données de démonstration

Le seed inclut :
- 1 restaurant "Le Bistrot Moderne" (Paris)
- 6 rôles (superadmin, manager, caissier, serveur, cuisinier, client)
- 6 utilisateurs avec comptes démo
- 8 catégories (Entrées, Plats, Burgers, Pizzas, Pâtes, Sandwichs, Boissons, Desserts)
- 32 produits avec prix, descriptions, allergènes en français
- 15 tables avec positions sur le plan
- 8 clients avec comptes fidélité
- 20 articles de stock
- 3 coupons de réduction
- 2 réservations à venir

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/ma-feature`)
3. Commit (`git commit -m 'feat: ajouter X'`)
4. Push (`git push origin feature/ma-feature`)
5. Ouvrir une Pull Request

## 📄 Licence

MIT — Voir fichier LICENSE

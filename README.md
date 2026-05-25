# Sakafio — Logiciel de gestion bar & restaurant

> Nom de code interne : *RestaurantOS*

Système de gestion complet pour bar et restaurant, conçu pour Madagascar.
Interface en français, prix en Ariary (Ar), données de démonstration réalistes.

---

## Modules disponibles

| Module | URL | Rôles autorisés |
|---|---|---|
| Dashboard | `/dashboard` | Tous |
| Commandes | `/orders` | Tous |
| Caisse (POS) | `/pos` | Tous |
| Cuisine (KDS) | `/kds` | Cuisinier, Manager, Admin |
| Menu | `/menu` | Manager, Admin |
| Plan de salle | `/tables` | Tous |
| Réservations | `/reservations` | Serveur, Manager, Admin |
| Stock | `/stock` | Manager, Admin |
| Fournisseurs | `/suppliers` | Manager, Admin |
| Clients & Fidélité | `/customers` | Caissier, Manager, Admin |
| Employés | `/employees` | Manager, Admin |
| Promotions & Coupons | `/coupons` | Manager, Admin |
| Analytics | `/analytics` | Manager, Admin |
| Paramètres | `/settings` | Manager, Admin |

---

## Fonctionnalités détaillées

### Commandes (`/orders`) — optimisé mobile
- Prise de commande par les serveurs sur téléphone
- Grille produits tactile avec filtre par catégorie
- Sélecteur de table visuel (boutons scrollables)
- Notes par article (ex : "sans piment", "bien cuit")
- Workflow : En attente → En cuisine → Prête → Servie
- Auto-refresh toutes les 20 secondes

### Caisse POS (`/pos`)
- Sélection de table inline (bandeau horizontal)
- **"Envoyer en cuisine"** : crée la commande sans encaisser
- **"L'addition"** : encaisse toutes les commandes ouvertes de la table
- Plusieurs tournées par table possible (boissons, entrées, plats...)
- Mode Emporté disponible

### Affichage Cuisine KDS (`/kds`)
- Affichage en temps réel des commandes CONFIRMED et PREPARING
- Minuteur par commande (alerte jaune >10min, rouge >15min)
- Marquer chaque article comme prêt
- Filtre par station (chaud, froid, boissons, desserts)

### Menu (`/menu`)
- Créer / modifier / supprimer des produits et catégories
- **Recettes** : lier des ingrédients du stock à chaque plat
  - Quantités, unités, taux de rendement (perte à la cuisson)
  - Calcul automatique du coût de revient et de la marge
  - Création d'ingrédient directement depuis la recette
- Toggle **"Vendu tel quel"** pour les boissons (masque le bouton recette)
- Gestion des allergènes (14 allergènes standards)
- Activation / désactivation de la disponibilité en un clic

### Stock (`/stock`)
- Articles avec seuils d'alerte et de réapprovisionnement
- 6 emplacements prédéfinis : Cuisine, Bar, Cave, Chambre froide, Réserve, Bureau
- Mouvements : Entrée, Sortie, Ajustement, Perte, Transfert
- **Inventaire** : comptage physique avec calcul des écarts
- **Transfert** entre emplacements avec traçabilité complète
- Alertes stock faible / rupture

### Fournisseurs (`/suppliers`)
- Fiche fournisseur : contact, téléphone, email, adresse, délai et jours de livraison
- **Bons de commande** : créer, envoyer, confirmer, réceptionner
- Réception automatique : incrémente le stock + met à jour le coût unitaire
- Historique complet des commandes par fournisseur

### Clients & Fidélité (`/customers`)
- Profils clients avec historique de commandes
- Programme de fidélité : Bronze / Argent / Or / Platine
- Ajout/retrait de points manuel avec motif
- Coupons de réduction

### Employés (`/employees`)
- Fiches employés avec rôle, contact, salaire
- Chaque rôle accède uniquement aux pages qui le concernent

### Analytics (`/analytics`)
- KPI : chiffre d'affaires, commandes, ticket moyen, taux d'occupation
- Graphique CA sur 7j / 30j / 1 an
- Top produits par revenus
- Répartition par type de commande

---

## Rôles et accès

| Rôle | Redirection après login | Accès |
|---|---|---|
| `superadmin` | `/dashboard` | Tout |
| `manager` | `/dashboard` | Tout sauf superadmin |
| `caissier` | `/pos` | POS, commandes, clients |
| `serveur` | `/orders` | Commandes, tables, réservations |
| `cuisinier` | `/kds` | KDS uniquement |

---

## Stack technique

### Architecture
```
Monorepo Turborepo
├── apps/
│   ├── web/     → Next.js 14 (App Router) — interface principale
│   ├── api/     → Express.js + Prisma — backend REST
│   ├── pos/     → Next.js (app caisse dédiée)
│   ├── kds/     → Next.js (affichage cuisine dédié)
│   └── client/  → Next.js (menu client QR code)
└── packages/
    ├── database/  → Prisma schema + seed
    ├── utils/     → Fonctions partagées (devises, dates, fidélité...)
    ├── types/     → Types TypeScript partagés
    └── ui/        → Composants UI partagés
```

### Technologies
- **Frontend** : Next.js 14, TailwindCSS, Framer Motion, React Query, Zustand
- **Backend** : Express.js, Prisma ORM, Zod, JWT
- **Base de données** : PostgreSQL 15
- **Cache / temps réel** : Redis 7, Socket.io
- **Infrastructure** : Docker Compose, Nginx, Let's Encrypt

---

## Installation locale (développement)

### Prérequis
- Node.js >= 18
- npm >= 9
- Docker + Docker Compose

### Étapes

```bash
# 1. Cloner le projet
git clone https://github.com/tsirinarivo/gestion-bar-resrautant.git
cd gestion-bar-resrautant
git checkout claude/restaurant-management-app-cFnVm

# 2. Installer les dépendances
npm install

# 3. Copier les variables d'environnement
cp .env.example .env

# 4. Démarrer PostgreSQL et Redis
docker compose up -d postgres redis

# 5. Initialiser la base de données
npm run db:generate
npm run db:migrate
npm run db:seed

# 6. Lancer le projet
npm run dev
```

URLs en local :
- Admin : http://localhost:3000
- API : http://localhost:4000
- POS : http://localhost:3001
- KDS : http://localhost:3002

---

## Déploiement sur VPS

Voir le guide complet : [`deploy/DEPLOYMENT.md`](deploy/DEPLOYMENT.md)

### Mise à jour

```bash
cd /opt/restaurant && ./deploy/update.sh
```

### URLs de production

| Service | URL |
|---|---|
| Interface admin | https://admin.sakafio.mg |
| Caisse (redirect) | https://pos.sakafio.mg |
| Cuisine (redirect) | https://kds.sakafio.mg |

---

## Comptes de démonstration

Le restaurant de démo s'appelle **Ny Sakafa Malagasy** (Ankadivato, Antananarivo).

| Nom | Email | Rôle | Mot de passe |
|---|---|---|---|
| Rivo Rakotoarivelo | admin@restaurant.mg | superadmin | `Admin123!` |
| Soavina Randriamahefa | manager@restaurant.mg | manager | `Manager123!` |
| Toky Rabemananjara | caissier@restaurant.mg | caissier | `Caissier123!` |
| Malala Andriantsoa | serveur@restaurant.mg | serveur | `Serveur123!` |
| Hasina Rakotondrabe | cuisine@restaurant.mg | cuisinier | `Cuisine123!` |

**Catalogue** : 60+ produits avec prix réels 2025 :
- Romazava : 22 000 Ar
- Entrecôte zébu : 45 000 Ar
- Burger Zébu : 20 000 Ar
- Bière THB 33cl : 4 000 Ar
- Café : 3 000 Ar

**Stock** : 44 articles avec prix grossiste Madagascar
(Viande zébu 32 000 Ar/kg, Crevettes 42 000 Ar/kg, Riz 2 200 Ar/kg)

### Re-seeder la base (remet à zéro toutes les données)

```bash
docker exec restaurant_api npx prisma db push --force-reset
docker exec restaurant_api node dist/seed.js
```

---

## Workflow commande

```
Commande créée (PENDING)
    |
    v  "Envoyer en cuisine"
CONFIRMED --> apparait sur le KDS
    |
    v  Cuisine prend en charge
PREPARING
    |
    v  Plat terminé
READY --> serveur notifié
    |
    v  Plat servi
COMPLETED
    |
    v  "L'addition"
Paiement enregistré --> Table libérée
```

---

## Variables d'environnement

```env
DATABASE_URL=postgresql://user:password@localhost:5432/restaurant
JWT_SECRET=votre_secret_jwt
API_URL=https://admin.sakafio.mg/api
NEXT_PUBLIC_API_URL=https://admin.sakafio.mg/api
REDIS_URL=redis://:password@localhost:6379
```

---

## Commandes utiles

```bash
npm run type-check    # Vérification TypeScript
npm run lint          # Linting ESLint
npm run build         # Build complet
npm run db:studio     # Interface Prisma Studio
npm run db:seed       # Remplir la base avec les données de démo
```

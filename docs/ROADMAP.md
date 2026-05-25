# RestaurantOS — Roadmap

> **Usage** : À chaque nouvelle session Claude, lire ce fichier pour savoir où on en est.
> Déplacer les sprints de "File d'attente" vers "Livrés" après chaque implémentation.

---

## ✅ Livrés

### Infrastructure & Base
- [x] Application SaaS restaurant complète (monorepo Turborepo, API, dashboard, POS, KDS, Client)
- [x] Déploiement VPS Ubuntu (Docker Compose + Nginx Proxy Manager + SSL)
- [x] Script de déploiement automatisé `deploy/update.sh`
- [x] Pages 404 et erreur personnalisées

### Dashboard Admin
- [x] Dashboard KPIs (CA, commandes, ticket moyen, graphiques)
- [x] Gestion commandes (liste, filtres, timeline, badge en attente)
- [x] Filtres commandes persistants entre sessions (localStorage)
- [x] Transfert de table pour une commande en cours
- [x] Édition quantité d'article dans une commande
- [x] Suppression d'article dans une commande
- [x] Confirmation avant annulation de commande
- [x] Plan de salle (tables, QR code par table, statuts)
- [x] Menu + catégories (CRUD complet, badges popularité, upload image produit)
- [x] Modificateurs et groupes de modificateurs
- [x] Variantes produit (CRUD, isDefault enforcement)
- [x] Stock — liste avec alertes, filtre, mouvement
- [x] Stock — page détail par article `/stock/:id`
- [x] Stock — comptage inventaire par lots (batch inventory count)
- [x] Stock — visualiseur FIFO (lots par article)
- [x] Entrepôts + transferts inter-entrepôts
- [x] Fournisseurs + bons de commande (BDC) avec auto-reorder
- [x] Filtre historique commandes par fournisseur
- [x] Clients — liste, segmentation, notes internes
- [x] Clients — page détail avec fidélité, historique, insights
- [x] Dettes clients (création, remboursement)
- [x] Employés — CRUD, clock-in/out
- [x] Planning des shifts — calendrier hebdomadaire
- [x] Widget "Planning du jour" dans le dashboard
- [x] Réservations — CRUD complet
- [x] Réservations — rappels automatiques (24h et 2h avant)
- [x] Réservations — panneau rappels à envoyer (7 jours)
- [x] Liste d'attente (WaitingList) — timer, notifier, asseoir
- [x] KDS multi-station (filtrage chaud/froid/boissons/desserts)
- [x] Caisse — sessions, transactions
- [x] Banque — comptes et transactions
- [x] Finances — revenus, dépenses, graphiques
- [x] Rapport journalier (CA, commandes, tips, méthodes de paiement)
- [x] Analytics — graphiques avancés + performance cuisine (temps par station)
- [x] Coupons — CRUD + génération en masse (`/bulk`)
- [x] Promotions — CRUD, confirmation avant suppression
- [x] Factures — génération depuis paiement, statuts, export CSV
- [x] Terminaux POS — CRUD
- [x] Avis clients — liste, confirmation avant suppression
- [x] Campagnes marketing — création, statistiques
- [x] Journal d'audit — historique des actions
- [x] Imprimante — config XPyun cloud + impression navigateur
- [x] Sidebar — persistance état collapse, favicons emoji par app
- [x] Recherche récente (historique)

### POS
- [x] Sélection table + envoi en cuisine
- [x] Paiements mixtes multi-méthodes
- [x] Reçu cloud XPyun + impression navigateur
- [x] Saisie pourboire (% préréglés + montant libre)
- [x] Rachat points fidélité WALLET (POINTS_RATE = 10 Ar/point)

### KDS
- [x] Filtrage multi-station (All / Chaud / Froid / Boissons / Desserts)
- [x] Son de notification nouvelle commande
- [x] État vide célébratoire quand la file est vide

### Client App
- [x] Menu public + panier + checkout
- [x] Page `/table/:id` — menu + appel serveur (socket)
- [x] Page `/orders` — historique commandes
- [x] Page `/orders/:id` — suivi commande temps réel (socket)
- [x] Page `/account` — profil + fidélité
- [x] PWA manifest
- [x] Page publique `/review/:orderNumber` (post-meal feedback)
- [x] Filtres allergènes + badges sur le menu

### Productivité Admin
- [x] Centre de notifications temps réel (Header bell)
- [x] Cmd+K / Ctrl+K — palette de recherche globale
- [x] Export Excel (xlsx) sur Clients, Stock, Commandes, TVA, Audit, Factures
- [x] Objectif CA mensuel — barre de progression dashboard
- [x] Historique d'impression + bouton "Réimprimer" pour les tickets en erreur
- [x] Alertes dates d'expiration (badges stock + widget dashboard)
- [x] Page `/superadmin` — vue multi-restaurant avec KPIs jour
- [x] Bottom bar mobile + manifest PWA pour le dashboard

### Multi-tenant SaaS (sprint MT-1)
- [x] App `apps/master` (Next.js, port 3010 / 4010 prod)
- [x] DB master séparée (`packages/master-database`) — Tenant, MasterUser, Subscription, Invoice, TenantEvent
- [x] Login master + cookie HttpOnly JWT
- [x] Dashboard master : KPIs (total/actifs/suspendus/erreur) + liste 5 derniers clients
- [x] Page liste des clients + détail (URLs, ports, contact, historique d'événements)
- [x] UI de création de client (formulaire complet : identité, contact, admin initial, notes)
- [x] Script `deploy/new-tenant.sh` — provisionne stack Docker isolée + DB tenant + nginx config
- [x] Script `deploy/master-init.sh` — initialise DB master + crée premier OWNER
- [x] Templates `deploy/templates/` : docker-compose + nginx + .env tenant
- [x] Dockerfile master (image `restaurant_master:latest`) + service dans `docker-compose.prod.yml`
- [x] Nginx config `master.sakafio.mg`
- [x] Architecture : 1 Postgres partagé / 1 DB par tenant / 1 stack Docker isolée par tenant
- [x] Allocation auto de ports (4100 + idx*10) et de DB Redis numérique

---

## 🗂️ File d'attente

> Sprints regroupés par thème, dans l'ordre de priorité recommandé.

### 🔴 Priorité haute — Multi-tenant SaaS

#### Sprint MT-2 — Abonnements + suspension auto
- CRUD plans (basic / pro / enterprise) avec prix MGA mensuel
- Génération mensuelle automatique des factures (cron node-cron ou via Redis)
- Page facturation dans la master (liste + filtre + marquer payée)
- Suspension automatique d'un tenant si facture impayée depuis X jours (config)
- Quand suspendu : stack Docker stoppée + Nginx renvoie page "Abonnement échu, contactez votre admin"
- Bouton "Réactiver" dans la console master

#### Sprint MT-3 — Login as client + audit
- Endpoint master : `POST /api/tenants/:id/impersonate` génère un JWT cross-instance signé avec `apiCrossSecret`
- Middleware côté API tenant : valide les JWT cross signés par la master + crée session SUPER_ADMIN
- Rôle `SUPER_ADMIN` dans le schema tenant (au-dessus de ADMIN, immuable)
- Bouton "Se connecter en tant que" dans la page détail tenant
- Audit obligatoire : event `LOGIN_AS` dans TenantEvent + AuditLog tenant

#### Sprint MT-4 — Updates centralisées + monitoring
- Script `deploy/update-all-tenants.sh` — pull + build images + restart stacks tenants
- Page "Santé des instances" dans la master : healthcheck de chaque tenant (curl /api/health par tenant)
- Bouton "Mettre à jour ce tenant" + log de déploiement
- Possibilité de figer un tenant sur une version (variable CLIENT_VERSION)

#### Sprint MT-5 — Branding + feature flags par tenant
- Table `TenantConfig` dans le schema tenant (logo, couleur primaire, modules activés)
- UI dans master pour modifier branding + activer/désactiver modules par client
- Theme dynamique côté admin/POS/client en lisant TenantConfig

#### Sprint MT-6 — Custom domains
- Support d'un domaine custom par tenant (ex: `restaurant-de-pierre.com`)
- Génération nginx config supplémentaire + instructions DNS pour le client
- Renouvellement certbot automatique

### 🟡 Priorité basse — Améliorations UX

#### Sprint C1 — QR code par table (appel serveur)
- Génération QR code dans la page Tables (déjà prévu mais à compléter)
- Notification temps réel dans le dashboard quand table appelle (socket `table:call_waiter`)
- Badge sur la carte de table concernée
- *Note : `tables/page.tsx` a une erreur qrcode.react pré-existante à ne pas toucher*

#### Sprint C2 — Mode sombre / clair
- Toggle theme dans les Paramètres utilisateur
- Stocker la préférence dans localStorage
- Classes Tailwind `dark:` déjà présentes dans l'app

#### Sprint C4 — Impression plan de salle
- Bouton "Imprimer le plan" dans la page Tables
- Vue optimisée pour impression (pas de sidebar, couleurs adaptées)

#### Sprint C5 — Notifications SMS réservations
- Envoyer SMS de confirmation quand une réservation est créée
- SMS de rappel déjà prévu (ReservationReminder) — brancher l'envoi réel
- Intégration avec un provider SMS malgache (ex : Telma, Orange)

#### Sprint C6 — API publique documentée (Swagger)
- Générer documentation Swagger/OpenAPI sur `GET /api/docs`
- Utile pour intégration avec des outils tiers

#### Sprint C9 — Livraison : suivi chauffeur temps réel
- Assigner un employé comme chauffeur pour une commande DELIVERY
- Position chauffeur transmise via socket depuis app mobile chauffeur
- Suivi en temps réel dans la page commande client

#### Sprint C10 — Intégration comptable externe
- Export au format compatible avec les logiciels comptables malgaches
- Mappage TVA, comptes comptables
- Automatisation mensuelle (bouton "Exporter mois")

---

### 🔵 Évolutions futures (post-V1)

#### Sprint D1 — Multi-langue (i18n)
- Passer le dashboard en `next-intl` ou `i18next`
- Langues : français (défaut), malgache, anglais

#### Sprint D2 — Application mobile native (React Native)
- App employé pour clock-in/out, voir ses shifts, ses tips
- App manager pour KPIs live depuis le téléphone

#### Sprint D3 — Marketplace de plugins
- Système de plugins pour extensions tierces (livraison, paiement, fidélité custom)
- Webhook sortants pour intégrations (Zapier, Make)

#### Sprint D4 — IA : suggestions de menu
- Analyser les commandes pour suggérer quels plats mettre en avant
- Suggestion automatique de prix selon l'heure (happy hour)

---

## Notes de sprint

> _(Section à remplir après chaque sprint pour garder une trace des décisions prises)_

| Date | Sprint | Décision notable |
|------|--------|-----------------|
| 2026-05 | Batches 1-5 | 22 features implémentées en mode autonome sur la branche claude/restaurant-management-app-cFnVm |
| 2026-05 | Resume #1 | Sprints A4, A5, B4, B6, B7, C3, C8 + fix latent `/stock/expiring` (déclaré après `/:id`). Skip C1 car `tables/page.tsx` non touchable. |
| 2026-05 | Sprint MT-1 | Architecture multi-tenant SaaS : app `apps/master` + DB master séparée + provisioning auto via UI. Stack Docker isolée par client, Postgres partagé. Allocation ports auto à partir de 4100. |

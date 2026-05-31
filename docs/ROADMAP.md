# Sakafio — Roadmap

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

### Branding Sakafio (mai 2026)
- [x] Renommage complet "RestaurantOS" → "Sakafio" (code, scripts, README, doc, JSX)
- [x] Création de 3 propositions de logo SVG (moderne, gourmand, Madagascar) dans `docs/branding/logo-options/`
- [x] Logo final retenu : bowl orange chaud + verre cocktail martini + olive + glaçons + tranche d'orange (option finale)
- [x] Intégration logo dans les 5 apps : `apps/*/public/{logo,favicon,logo-horizontal}.svg`
- [x] Mise à jour des pages login (master + admin) avec logo + tagline "Logiciel pour votre restaurant et bar"
- [x] Mise à jour des sidebars (master + admin) avec logo + sous-tagline "Restaurant & Bar"
- [x] Open Graph meta tags (image + url sakafio.mg + description) pour preview WhatsApp/Facebook
- [x] Manifest PWA : icônes pointent vers `/logo.svg`, theme color orange `#EA580C`
- [x] README en tête : bandeau horizontal du logo
- [x] Fix Dockerfile master : copy `public/` (sinon 404 sur favicons)

### Infrastructure post-MT-1
- [x] `deploy/nginx/pos.sakafio.mg.conf` et `kds.sakafio.mg.conf` : passage de redirections 301 vers `admin.sakafio.mg/pos` à de vrais `proxy_pass` vers les containers `restaurant_pos:3001` et `restaurant_kds:3002`
- [x] Script `deploy/sync-nginx.sh` (sudo) : sync configs nginx du repo vers `/etc/nginx/sites-{available,enabled}/`, nettoie les doublons `domain.conf` historiques, reload nginx + certbot --reinstall pour restaurer SSL
- [x] Sidebar admin : bouton "Ouvrir le POS" calcule l'URL dynamiquement depuis `window.location.hostname` (multi-tenant safe : admin-bistrot → pos-bistrot)

### Auth POS (mai 2026)
- [x] Module `apps/pos/src/lib/auth-fetch.ts` : token au module-level + subscribe pattern + refresh auto
- [x] Sur 401, l'app POS tente automatiquement un `POST /api/auth/refresh` avec `credentials:'include'`
- [x] Single-flight pour éviter les refresh concurrents (`_refreshInFlight` promise)
- [x] Tous les fetch directs et useQuery du POS passent par `authFetch` ou `apiFetch` qui font le refresh transparent
- [x] Résultat : le POS reste connecté 7 jours (durée du refresh token) avec rotation de l'access token toutes les 15 min

### Sprint UX Critiques Frontend (mai 2026) — Audit round 4 (suite)
7 fixes UX :
- [x] **POS double-création sous StrictMode** (`apps/pos/src/app/page.tsx:465`) : `useRef(creating)` synchrone, check-and-set avant le `await apiPost('/orders')`. Plus de 2 commandes créées en dev (et protège aussi des remount avec key changeante).
- [x] **POS backdrop ferme pendant paiement** (`pos/page.tsx:583`) : `onClick={busy ? undefined : handleClose}` + `disabled={busy}` sur la croix. Plus de payment comptabilisé + ordre CANCELLED.
- [x] **Layout admin frame leak** (`web/(dashboard)/layout.tsx:53`) : check synchrone `allowed && !ok` retourne un spinner au lieu des `children`. Un caissier ne voit plus `/employees` une frame avant le redirect.
- [x] **Modal create order n'invalidait pas ['orders']** (`web/orders/page.tsx:292`) : ajout `qcModal.invalidateQueries({ queryKey: ['orders'] })` dans `onSuccess`.
- [x] **saveNotes envoyait l'objet customer entier** (`web/customers/page.tsx:284`) : PUT envoie seulement `{ notes }`. Plus de réécriture de relations Prisma non voulues.
- [x] **POS Ctrl+Enter race sendToKitchen** (`pos/page.tsx:1302`) : `if (sending) return` au début de la fonction (idempotent guard).
- [x] **innerHTML dans menu (pattern dangereux)** (`web/menu/page.tsx:242,262`) : extrait `<ImgWithFallback>` avec `useState(err)`, plus de manip DOM out-of-React.

### Sprint Race Conditions API (mai 2026) — Audit round 4 (suite)
5 HIGH race conditions corrigées (analogues au Sprint API-1) :
- [x] **bank.ts** : `autoPostPaymentToBank` + adjust manuel utilisent `balance: { increment/decrement }` atomique avec relecture dans la transaction pour `balanceAfter` exact (plus de solde corrompu sur 2 paiements simultanés).
- [x] **customers.ts loyalty/adjust** : `updateMany` conditionnel sur `points: { gte: -points }` pour les déductions (double-spend), `increment` pour les ajouts, tier recalculé depuis valeurs fresh.
- [x] **debts.ts pay** : `updateMany` conditionnel sur `paidAmount === debt.paidAmount` (optimistic locking). Si paiement concurrent → 409 + retry attendu.
- [x] **warehouses.ts transfers/:id/complete** : claim atomique du transfert via `updateMany({ status: in [PENDING, IN_TRANSIT] })` au début de la transaction → impossible de compléter 2 fois.
- [x] **orders.ts items READY → order READY** : `updateMany({ status: 'PREPARING' })` au lieu de read-then-update → pas de double-transition ni double-statusHistory.

### Sprint Sécurité (mai 2026) — Audit round 4
8 critiques fix sur 9 :
- [x] **Public order accepte unitPrice client** (`public.ts:78-186`) : suppression de `unitPrice` du body Zod, prix rechargés depuis la DB (`product.findMany` avec filtre `isActive isAvailable`). Si produit indisponible → 400.
- [x] **TVA incohérente public/POS** (`public.ts:107`) : `taxAmount = 0` partout (cohérent avec orders.ts, prix produits TTC).
- [x] **Rate-limit /api/public/*** : nouveau `publicLimiter` (50/15min/IP) sur tout le router public — protège orders, coupons, reviews du spam.
- [x] **Reviews proof-of-order** (`public.ts:332`) : `orderNumber` obligatoire + vérif `status === 'COMPLETED'` + 1 review max par commande.
- [x] **certbot --reinstall systématique** (`sync-nginx.sh:101`) : remplacé par check `certbot certificates | grep` pour ne renouveler que les certs manquants/expirés (évite rate-limit Let's Encrypt 5/sem).
- [x] **update.sh ne migrait pas les tenants** : itère sur `pg_database WHERE datname LIKE 'tenant_%'` et fait `prisma db push` sur chaque DB tenant.
- [x] **JWT `algorithms: ['HS256']` explicite** dans `auth.ts` (sign + verify refresh) + `middleware/auth.ts` (verify access).

**Critiques reportées (refactor architectural)** :
- Master container exposé à docker.sock + bind /opt + nginx RW (RCE → root host) — nécessite refonte du flow new-tenant (queue de jobs hôte au lieu de child_process depuis master)
- Master container run en root — couplé au point précédent (docker-cli nécessite groupe docker)
- Rôle Postgres unique partagé master+tenants — nécessite refactor du provisioning : un rôle par tenant + GRANTs
- Rôle "superadmin" comparé par nom string — nécessite migration schema (boolean isSuperAdmin sur Role) + refactor des authorize() partout

### Sprint API-1 — Refactor transactions critiques (mai 2026)
- [x] **Stock race cross-order** : vérif stock + create order wrappés dans `prisma.$transaction({ isolationLevel: 'Serializable' })`. Postgres rollback en cas de conflit → plus de stock négatif sur commandes simultanées. Quantités agrégées par produit (un même productId peut apparaître plusieurs fois).
- [x] **Coupon usage atomique** : `coupon.updateMany` conditionnel (`where: usageCount < usageLimit`) à la place du `findFirst` + `update` non-atomique. Le `updateMany` retourne `count === 0` si déjà épuisé → AppError. Appliqué dans `orders.ts` ET `public.ts`. La création de `couponUsage` est maintenant dans la même transaction.
- [x] **Table occupancy multi-update** : les 3 updates (release old, update order, occupy new) du transfer table wrappés dans `prisma.$transaction`.
- [x] **POS refresh single-flight race** : suppression du `setTimeout(0)` qui laissait une micro-fenêtre. Reset synchrone via `.finally()` chained sur la promesse stockée dans `_refreshInFlight`.

### Audit + 12 bugs corrigés (mai 2026, commits 536f39c / 2f75f0d / b987174)
- [x] CLIENT checkout : math du tip corrigée (`Math.round(s * 0.05 / 100) * 100` qui arrondissait à 100 MGA près → 5% de 200 MGA = 0)
- [x] MASTER nouveau tenant : champ "Mot de passe initial" `type="text"` → `type="password"` (visible à l'écran)
- [x] KDS : `new QueryClient()` au module level → déplacé dans `useState(() => new QueryClient())` (pollution cache cross-user)
- [x] API payments WALLET : loyalty deduction + payment.create wrappés dans `prisma.$transaction` (rollback atomique si payment fail)
- [x] Sidebar admin : POS_URL multi-tenant safe (hostname-based)
- [x] POS : staleTime products 0 → 30s (perf re-fetch agressif)
- [x] POS RefundModal : validation côté client `amount > payment.amount`
- [x] Web orders page : localStorage en initializer → useEffect (hydration mismatch SSR/client)
- [x] Web login page : pareil pour `remembered-email`
- [x] API public.ts : `coupon.update().catch(()=>{})` fire-and-forget → await + log d'erreur
- [x] API orders.ts : `deductStockForOrder().catch(()=>{})` silencieux → log d'erreur
- [x] API payments.ts : pareil pour stock + loyalty après paiement

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
| 2026-05 | Branding Sakafio | Rebrand complet "RestaurantOS" → "Sakafio". 3 propositions logo SVG → option finale (bowl + cocktail martini) retenue. Intégrée dans les 5 apps (favicons, login, sidebar, OG meta). Fix Dockerfile master pour copy public/. |
| 2026-05 | Infra fixes | Découverte que `deploy/nginx/pos.sakafio.mg.conf` et `kds.sakafio.mg.conf` faisaient des redirections 301 vers admin (héritage design unifié), remplacés par vrais proxy_pass vers containers. Nouveau script `sync-nginx.sh` qui nettoie aussi les doublons `domain.conf` vs `domain`. Décision : modèle B (apps POS/KDS séparées) plutôt que modèle unifié dans admin. |
| 2026-05 | POS refresh auto | Refonte du flow d'auth POS pour supporter un refresh automatique via `/api/auth/refresh` + cookie. Module `auth-fetch.ts` avec subscribe pattern + single-flight. Évite la déconnexion toutes les 15 min. |
| 2026-05 | Audit profond | 3 rounds, 12 bugs corrigés (CLIENT tip math, MASTER password type, KDS QueryClient module-level, payments WALLET transaction, hydration SSR/client, error logging silent, etc.). 4 bugs structurels documentés en Sprint API-1 pour refactor futur. |
| 2026-05 | Sprint API-1 | 4 race conditions corrigées : stock cross-order (transaction Serializable), coupon usage (updateMany conditionnel atomique dans orders.ts + public.ts), table occupancy (transaction sur transfer), POS refresh single-flight (suppression setTimeout, finally chained). |

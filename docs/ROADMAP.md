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

---

## 🗂️ File d'attente

> Sprints regroupés par thème, dans l'ordre de priorité recommandé.

### 🔴 Priorité haute — Opérationnel quotidien

#### Sprint A1 — Centre de notifications temps réel
- Cloche dans le Header avec badge compteur (non lus)
- Dropdown 10 dernières notifications (commandes, stock, réservations)
- Socket listener `notification:new` côté frontend
- `GET /api/notifications`, `PATCH /:id/read`, `PATCH /read-all`
- *Modèle Prisma `Notification` déjà prêt, route `notifications.ts` existe*

#### Sprint A2 — Scan code-barres au POS
- Input de recherche barcode dans le POS (focus automatique)
- Ajout direct au panier si produit trouvé (`Product.barcode` existe)
- Support scanner USB HID (clavier simulé — pas d'API spéciale nécessaire)

#### Sprint A3 — Remboursement depuis le POS
- Mode "Retour" dans le POS : recherche par numéro de commande
- Sélection articles à rembourser + montant partiel ou total
- Appel `POST /api/payments/:id/refund` (route déjà existante)

#### Sprint A4 — Alertes dates d'expiration (Stock)
- Badge "Expire bientôt" / "Expiré" sur les articles périssables dans la page Stock
- `GET /api/stock/expiring?days=7` → articles qui expirent dans N jours
- Widget dans le Dashboard
- UI pour saisir `expiryDate` lors d'une réception

#### Sprint A5 — Historique d'impression (PrintLog)
- Tableau des dernières impressions dans la page Imprimante (statut, heure, contenu tronqué)
- Bouton "Réimprimer" pour les tickets en erreur
- `GET /api/printer/logs` (modèle `PrintLog` déjà alimenté)

---

### 🟠 Priorité moyenne — Gestion & Reporting

#### Sprint B1 — Congés employés
- `GET/POST /api/employees/:id/leaves`, `PATCH /:leaveId/status`
- Section "Congés" dans la page employés (tableau demandes + formulaire)
- Badge dans la liste employés si congé en cours
- *Modèle `Leave` (VACATION/SICK/PERSONAL/UNPAID, PENDING/APPROVED/REJECTED) déjà prêt*

#### Sprint B2 — Rapport TVA / Export comptable
- `GET /api/finances/tax-report?from=&to=` → TVA collectée par taux et par période
- Export CSV des lignes pour le comptable
- Section dans la page Finances

#### Sprint B3 — Performance du personnel
- `GET /api/dashboard/staff-performance?from=&to=` → nb commandes, CA, panier moyen par serveur
- Tableau dans Analytics (section Employés)
- *`Order.createdBy` déjà tracké*

#### Sprint B4 — Sondage de satisfaction post-repas (SMS/email)
- Déclencher un envoi de SMS/email après clôture de commande (status COMPLETED)
- Lien vers page publique `/review/:orderId` — formulaire simple (1-5 étoiles + commentaire)
- Résultats dans la page Avis clients

#### Sprint B5 — Dashboard multi-restaurant (vue superadmin)
- Page `/superadmin` accessible uniquement au rôle `superadmin`
- Liste tous les restaurants avec KPIs (CA du jour, nb commandes, alertes)
- Switcher de restaurant dans le header

#### Sprint B6 — Export Excel des rapports
- Bouton "Exporter XLS" sur les pages : Commandes, Clients, Stock, Finances
- Utiliser la librairie `xlsx` (à installer)
- Format : colonnes propres avec en-têtes, filtres Excel activés

#### Sprint B7 — Objectifs de vente (targets)
- Définir un objectif CA mensuel dans les Paramètres restaurant
- Barre de progression dans le Dashboard (CA actuel vs objectif)
- Alerte si on dépasse 80% puis 100%

---

### 🟡 Priorité basse — Améliorations UX

#### Sprint C1 — QR code par table (appel serveur)
- Génération QR code dans la page Tables (déjà prévu mais à compléter)
- Notification temps réel dans le dashboard quand table appelle (socket `table:call_waiter`)
- Badge sur la carte de table concernée

#### Sprint C2 — Mode sombre / clair
- Toggle theme dans les Paramètres utilisateur
- Stocker la préférence dans localStorage
- Classes Tailwind `dark:` déjà présentes dans l'app

#### Sprint C3 — Recherche globale (Cmd+K)
- Palette de commande accessible via `Cmd+K` / `Ctrl+K`
- Recherche : commandes, clients, produits, tables
- Navigation rapide vers la ressource trouvée

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

#### Sprint C7 — Tableau de bord mobile (PWA dashboard)
- Rendre le dashboard admin utilisable sur mobile (responsive amélioré)
- Navigation bottom bar sur mobile
- PWA manifest pour le dashboard (actuellement seulement sur client)

#### Sprint C8 — Gestion des allergènes
- Champ `allergens: String[]` sur `Product` (migration Prisma nécessaire)
- Badges allergènes sur les cartes produit (menu + POS + client app)
- Filtre "sans gluten", "sans lactose" dans le menu client

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

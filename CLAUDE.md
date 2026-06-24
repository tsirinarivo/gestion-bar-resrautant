# Sakafio — Mémoire projet Claude

> Nom de code interne : *Sakafio* (utilisé dans les commits/docs historiques)
> Marque publique : **Sakafio** — domaine principal `sakafio.mg`

## Le projet en une phrase

SaaS de gestion de restaurant complet (commandes, caisse, stock, fidélité, KDS, réservations, marketing) ciblant Madagascar, déployé en production sur VPS, **self-service via `sakafio.mg/signup`** avec essai gratuit 3 jours.

---

## Stack technique

| Couche | Technologie | Port dev / prod |
|---|---|---|
| Monorepo | Turborepo | — |
| API | Express.js + Prisma ORM + PostgreSQL | 4000 / 4001 |
| Dashboard admin (tenant) | Next.js 14 App Router | 3000 / 4002 → `admin-<slug>.sakafio.mg` |
| POS (tenant) | Next.js standalone | 3001 / 4003 → `pos-<slug>.sakafio.mg` |
| KDS (tenant) | Next.js kitchen display | 3002 / 4004 → `kds-<slug>.sakafio.mg` |
| Client public (tenant) | Next.js app client | 3003 / 4005 → `<slug>.sakafio.mg` |
| **Master SaaS** | Next.js | 3010 / 4010 → `master.sakafio.mg` |
| **Landing vitrine** | Next.js | 4008 → `sakafio.mg` |
| Auth tenant | JWT HS256 (accessToken localStorage + refreshToken cookie) | — |
| Auth master | JWT HS256 (cookie session) | — |
| Temps réel | Socket.io | — |
| Schéma DB tenant | `packages/database/prisma/schema.prisma` | — |
| Schéma DB master | `packages/master-database/prisma/schema.prisma` | — |
| Styles | Tailwind CSS | — |
| Data fetching | TanStack Query (`useQuery` / `useMutation`) | — |
| Notifications | Sonner toasts | — |
| Animations | Framer Motion (pas de GSAP — voir note) | — |
| Icons | lucide-react | — |
| Upload fichiers | multer (dans apps/api uniquement) | — |
| Screenshots vitrine | Playwright + Tailwind CLI standalone | — |
| Email | nodemailer + SMTP externe (Brevo recommandé) | — |

> **Note GSAP** : la refonte UI/UX a été faite avec Framer Motion (déjà installé). GSAP n'a PAS été ajouté car +80 KB de bundle pour zéro bénéfice en React/Next (Framer couvre layoutId, spring, AnimatePresence, gestures). Si demande ciblée future (drawSVG, MorphSVG…), à ajouter en local seulement.

## Architecture multi-tenant (SaaS)

- **1 Postgres partagé** + **1 DB par tenant** (`tenant_<slug>`, slug normalisé `-` → `_`) + 1 DB master (`master_db`)
- **1 stack Docker isolée par tenant** : générée à la volée par `deploy/new-tenant.sh` dans `tenants/<slug>/docker-compose.yml`
- **Allocation auto de ports** : tenant N → api=4100+N*10, web=+1, pos=+2, kds=+3, client=+4
- **URLs par tenant** : `<slug>.sakafio.mg` (client public), `admin-<slug>...`, `pos-<slug>...`, `kds-<slug>...`, `api-<slug>...`
- **Création tenant** (2 chemins) :
  1. **UI Master** → POST `/api/tenants` (auth requise) → exécute `deploy/new-tenant.sh` via `child_process`
  2. **Public self-service** : `sakafio.mg/signup` → POST `/api/signup` landing (proxy) → POST `master:3010/api/signup` → idem
- **Init master** : `bash deploy/master-init.sh` (création DB master + premier OWNER)

---

## Branche Git de travail

```
claude/restaurant-management-app-cFnVm
```

Toujours développer et pousser sur cette branche. Jamais sur `main`.

---

## Déploiement

Après chaque commit/push :

```bash
cd /opt/restaurant && bash deploy/update.sh
```

**Règle absolue** : ne jamais demander à l'utilisateur de copier-coller une commande — toujours terminer avec le script ci-dessus directement dans le chat.

`update.sh` fait : `git pull` → ssh-agent auto-detect `github_nettunnel` key → `docker compose build --no-cache` (toutes les images globales `restaurant_*:latest` + landing) → `restart` services master + recreate tenants → `prisma db push --accept-data-loss` pour les DB tenants ET master.

**Scripts deploy complémentaires** :
- `deploy/sync-nginx.sh` (sudo requis) : pousse `deploy/nginx/*.conf` dans `/etc/nginx/sites-available/`, nettoie les doublons `domain.conf` vs `domain` (sans extension), reload nginx, certbot --reinstall pour restaurer SSL. À lancer seulement quand on modifie des configs nginx.
- `deploy/new-tenant.sh` : provisionne un tenant (DB + stack Docker + nginx config + premier admin).
- `deploy/master-init.sh` : init DB master + premier OWNER (one-shot).
- `deploy/smoke-test.sh` : tests de santé (19 checks).
- `deploy/restore-postgres.sh` : restore depuis backup.
- `deploy/normalize-emails.sh` : migration one-shot pour lowercase tous les emails existants (à lancer une fois après le déploiement du fix Zod).

---

## Moyens de paiement (Madagascar)

`CASH | MVOLA | ORANGE_MONEY | AIRTEL_MONEY | CARD | BNI_MOBILE | BOA_MOBILE | VIREMENT | CHEQUE | VOUCHER | WALLET`

**WALLET** = rachat de points fidélité (1 point = 10 MGA, constante `POINTS_RATE = 10`)

---

## Conventions de code strictes

### API (Express + Prisma)
- **Routes statiques AVANT dynamiques** : `/bulk`, `/stats`, `/upload-image`, `/import`, `/import-prices`, `/users-without-employee`, `/from-user`, `/presets`, `/import-presets` doivent être déclarées AVANT `/:id` — sinon Express les capture comme ID.
- **Side-effects non-bloquants** : toujours `.catch(() => {})` sur les créations de notifications, reminders, events, etc.
- **Migrations Prisma** : toujours `--accept-data-loss` pour éviter les prompts interactifs.
- **Champ inventory** : utiliser `createdBy` (pas `performedBy`) sur `StockMovement`.
- **Authentification** : middleware `authenticate` + `authorize('role1', 'role2')` sur chaque route protégée. Routes publiques exception : `POST /api/auth/login`, `POST /api/signup` (master).
- **Audit** : `AuditLog` est alimenté automatiquement — ne pas doublon-logger manuellement.
- **Emails toujours lowercased** côté serveur via Zod transform : `z.string().email().transform(s => s.trim().toLowerCase())`.

### Frontend (Next.js)
- **Axios instance** : `import { api } from '@/lib/api'` — base URL déjà configurée, token injecté automatiquement.
- **TypeScript strict** : `noUncheckedIndexedAccess` — toujours typer les tableaux (`arr[0]` peut être undefined).
- **Pattern page** : `useQuery` pour GET, `useMutation` + `qc.invalidateQueries` pour mutations.
- **Modals** : `AnimatePresence` + `motion.div` avec overlay backdrop `bg-black/60 backdrop-blur-sm`.
- **Toasts** : `toast.success()` / `toast.error()` de Sonner.
- **Currency** : `formatCurrency(amount)` depuis `@restaurant/utils` (formate en Ar).
- **Pas de commentaires** sauf si la raison est non-évidente.
- **Permissions UI** : helper `usePermission()` depuis `@/lib/permissions` (apps/web) — `const can = usePermission(); {can('orders:manage') && <button>...</button>}`. Le superadmin retourne `true` partout.

### Erreurs connues à ignorer
- `apps/web/src/app/(dashboard)/tables/page.tsx` : erreur TypeScript `qrcode.react` (types manquants) — pré-existante.
- Plusieurs `Parameter 'X' implicitly has an 'any' type` côté API : dûs au Prisma client non généré en dev local. Le `prisma generate` au build Docker corrige.
- `master-database` : `TenantStatus`, `Tenant` types absents en dev local (même cause).

---

## Mode de fonctionnement attendu

**Mode autonome** : implémenter les features en boucle sans demander permission à chaque étape.

**Format de rapport après chaque sprint** (court) :
```
✅ Sprint N — [Titre]
- [Feature 1] : [description 1 ligne]
- [Feature 2] : [description 1 ligne]
Commit : [hash court]
→ Déploiement disponible : cd /opt/restaurant && bash deploy/update.sh
```

**Workflow à chaque nouvelle session** :
1. `git log --oneline -20` → voir où on en est
2. Lire la section "État récent (juin 2026)" ci-dessous + `docs/ROADMAP.md` si présent
3. Explorer les fichiers concernés avant de coder (éviter les doublons)
4. Implémenter, vérifier TypeScript (`cd apps/api && npx tsc --noEmit` et `cd apps/web && npx tsc --noEmit`)
5. Commit + push
6. Déployer
7. Reprendre

---

## État actuel du projet (juin 2026)

### Pages dashboard admin tenant (35+ routes)
Dashboard KPIs, Commandes, Tables/plan de salle, Menu + Modificateurs + **Catégories suggérées (presets Bar/Resto/Malgache)**, Stock + détail article + recettes/ingrédients, Entrepôts, Fournisseurs + **Imports CSV Dolibarr** (fournisseurs + prix d'achat), Bons de commande, Clients + détail + segmentation, Dettes clients, Employés + **Promouvoir user existant** + **Rôles & Permissions matrice**, Planning des shifts, Réservations + rappels, Liste d'attente, KDS multi-station, Caisse, Banque, Finances, Rapport journalier, Analytics + performance cuisine, Coupons + génération en masse, Promotions, Factures, Terminaux POS, Avis clients, Campagnes marketing, Journal d'audit, Imprimante, Paramètres.

### Pages master.sakafio.mg (UI/UX refondue en sprints 1 + 2)
Login premium 2 colonnes avec ambient blobs, dashboard overview (5 KPIs animés + table responsive), Clients (search + filtres pill, table desktop / cards mobile), Nouveau client (form 3 cols + sidebar timeline, live log terminal sombre), Détail client (3-col grid avec URLs / Contact / Infra / Dates / Sub), Déploiements (live log + history), Plans (cards CRUD avec gradient halo), Facturation (filtres + actions inline), Paramètres (cards config), SMTP (form + test).

Composants partagés : `<PageHeader>` (back link + title + subtitle + actions), `<StatusBadge>` (dot pulsé contextuel).

### Apps tenant
- **POS** : sélection table, envoi cuisine, paiements mixtes multi-méthodes, reçu cloud XPyun + navigateur, rachat points WALLET, saisie pourboire
- **KDS** : filtrage multi-station (chaud/froid/boissons/desserts), login, son, état vide célébratoire
- **Client** : menu public, panier, checkout, historique commandes, suivi commande temps réel, appel serveur QR

### Landing publique (sakafio.mg)
- Hero animé + Features (12 modules) + ScreenshotsShowcase (6 captures Playwright des mockups) + Stats + **Pricing 4 plans** + Testimonials + Faq + Cta
- Pages : `/`, `/signup` (formulaire avec POST self-service), `/login` (4 cartes admin/POS/KDS/master), `/contact`
- Couleurs : brand orange (Inter + Plus Jakarta Sans)
- **Pas de mentions techniques publiques** (multi-tenant, XPyun, Postgres, VPS retirés — voir "Concurrentiel")

### Infrastructure
- Déployé sur VPS Ubuntu (158.220.82.114) avec Docker Compose + **nginx natif Ubuntu + Certbot** (PAS Nginx Proxy Manager)
- Configs nginx versionnées dans `deploy/nginx/*.conf` → script `deploy/sync-nginx.sh` (sudo) pour les pousser dans `/etc/nginx/sites-available/` + reload + certbot --reinstall
- Imprimante thermique cloud via XPyun (package `imprimantcloud`)
- Socket.io pour temps réel (commandes, KDS, notifications)
- SMTP externe : **Brevo recommandé** (`smtp-relay.brevo.com:587` STARTTLS, 300 emails/j gratuits)

### Branding
- Logo Sakafio en SVG : `apps/*/public/logo.svg` + `favicon.svg` + `logo-horizontal.svg`
- Source du logo : `docs/branding/logo-options/option-final-*.svg`
- Composition : bowl orange chaud (restaurant) + verre cocktail martini (bar) — palette ambre/orange/cyan
- Tagline : "Logiciel pour votre restaurant et bar"

---

## Signup self-service public (sakafio.mg/signup)

**Flow** :
1. User remplit le form (restaurant name, contact name, email, phone, password, seedDemo, plan)
2. POST `https://sakafio.mg/api/signup` → route Next.js du landing (proxy)
3. Landing forwarde à `http://master:3010/api/signup` (DNS interne Docker, env var `MASTER_API_URL`)
4. Master :
   - Lowercase email + validate Zod
   - Slugify nom du resto (`Le Bistrot` → `le-bistrot`) + suffixe `-N` si collision
   - `dbName = tenant_${slug.replace(/-/g, '_')}` ← important : Postgres CREATE DATABASE n'accepte pas les tirets unquoted
   - Création tenant avec `signupSource='self-service'`, `seededWithDemo`, `subscriptionPlan` (`?plan=...`), `subscriptionStatus='TRIAL'`, `trialEndsAt = +3 jours`
   - Fire-and-forget `runProvisioningScriptAsync()`
   - Réponse 202 immédiate : `{ ok: true, slug, subdomain, adminUrl, trialEndsAt }`
5. Provisioning script en background (~5-10 min) : container build, schema push, admin créé, nginx generated, cert flag créé
6. Cron `finalize-tenants.sh` détecte le flag `.needs-ssl` → reload nginx + certbot 5 sous-domaines
7. Email de bienvenue envoyé via `sendTenantWelcomeEmail` (SMTP requis)

**Plans acceptés par le signup endpoint** : `'trial' | 'starter' | 'pro' | 'pro-plus' | 'groupe' | 'enterprise'` (les 2 derniers archivés côté UI mais l'endpoint reste tolérant).

**Seed automatique des plans publics** au boot du master via `apps/master/src/lib/seed-plans.ts` → `createMany skipDuplicates` :
- `trial` 0 Ar
- `starter` 49 000 Ar
- `pro` 99 000 Ar
- `pro-plus` 149 000 Ar

Les modifications admin via `/dashboard/plans` ne sont jamais écrasées par le seed.

---

## RBAC / Permissions (sprint juin 2026)

Schéma Prisma `Permission` + `RolePermission` join (déjà au schéma, vides avant le sprint).

**Seed automatique au boot de l'API** (`apps/api/src/lib/permissions-seed.ts`) :
- **13 resources** × 2 actions (view, manage) = 26 permissions
- Resources : `orders`, `menu`, `inventory`, `customers`, `tables`, `employees`, `caisse`, `finances`, `analytics`, `marketing`, `terminaux`, `reviews`, `settings`
- Actions : `view`, `manage`
- **Défauts** attachés aux 6 rôles système (superadmin/manager/caissier/serveur/cuisinier/client) **uniquement au premier seed** (si le rôle n'a aucune permission). Si l'admin a déjà configuré, on respecte.

**API** (`apps/api/src/routes/roles.ts`) :
- `GET /api/roles/catalog` → resources + actions disponibles
- `GET /api/roles` → liste avec `permissions` (flat keys `"orders:manage"`) + `usersCount`
- `POST /api/roles` → créer un rôle custom (`isSystem: false`)
- `PATCH /api/roles/:id` → renommer
- `PUT /api/roles/:id/permissions` → remplacer toutes les permissions
- `DELETE /api/roles/:id` → interdit si `isSystem` ou si users actifs

**Superadmin verrouillé** : ne peut PAS être restreint (anti lock-out). Retourne 400 sur tentative.

**UI** : `admin-<slug>.sakafio.mg/employees/roles`
- Liste des rôles avec badge Système/Custom + compteur users
- Matrice resources × actions, cellules toggle, raccourci "Tout/Aucun" par ligne
- Modal création rôle custom avec sélecteur de permissions
- Modal renommage (description optionnelle)
- Bouton "Rôles & permissions" dans la page Employés

**Helper React** : `apps/web/src/lib/permissions.ts`
```ts
const can = usePermission()
{can('orders:manage') && <button>...</button>}
```

**Enforcement** : pour l'instant les routes Express utilisent toujours `authorize('manager')` (rôle). La matrice sert pour l'UI gating + future migration vers `requirePermission('module:action')` granular.

---

## Imports CSV Dolibarr (juin 2026)

### Lib partagée `apps/api/src/lib/csv-import.ts`
- `csvUpload` (multer 10MB en mémoire, accepte `.csv`)
- `normalizeHeader` : strip accents + split CamelCase + lowercase + `_` séparateur
- `parseCsv` : auto-detect `,` vs `;`, tolère `""` quotes
- `pick(row, keys)` : 1) exact match, 2) substring fallback
- `toFloat`, `toInt`, `prismaReason`

### Endpoints
- **`POST /api/products/import`** (existant, refacto possible) — produits depuis Dolibarr ou générique
- **`POST /api/suppliers/import`** — fournisseurs (nom, contact, email, telephone, adresse, ville, code_postal, pays, siret, conditions_paiement, notes, delai_livraison) — upsert par `name.lowercase`, idempotent
- **`POST /api/suppliers/import-prices`** — table `StockItemSupplier` : lie produit (ref/nom) ↔ fournisseur (nom) avec `unitCost` + `referenceCode` + `isPreferred`. Liste les refs introuvables dans `missing.stockItems` / `missing.suppliers`.
- **`POST /api/categories/import-presets`** — import depuis le catalogue 51 catégories (`apps/api/src/lib/category-presets.ts` : Bar 18 / Restaurant 21 / Malgache 12). `slug` unique par tenant, idempotent.

### UX d'import (modal commune)
- Upload zone drag-friendly
- Hints contextuels selon le kind
- **"Tester (dry-run)"** d'abord : compteurs created/updated/skipped + échantillon 10 premiers + erreurs ligne par ligne + refs introuvables
- **"Importer pour de vrai"** ensuite
- Stat cards colorées + toast final

---

## Recettes / Ingrédients (déjà au schéma)

Schéma : `Ingredient` (nom, unit, costPerUnit, lien optionnel `StockItem`) + `RecipeItem` (Product ↔ Ingredient avec quantity, yieldRate).

**Workflow type pour brochette de bœuf** :
1. Crée ingrédients au stock (Bœuf zébu kg, Tomate kg, Oignon kg, Pic en bambou unit)
2. Crée produit "Brochette de bœuf" 4000 Ar dans catégorie Brochettes & Grillades
3. Édite-le → toggle "🍳 A une recette" → ajoute ingrédients avec qty + yieldRate
4. À chaque vente, le stock est auto-décrémenté via la route `POST /api/orders` (logique dans `apps/api/src/routes/orders.ts:180+`)

**Vendu tel quel** (THB 33cl, Coca…) : désactive le toggle "A une recette" et lie le produit directement à un `StockItem` (champ `stockItemId`). Décrément `-1 par vente`.

---

## Caisse

- Chaque `POST /api/payments` crée automatiquement une `CaisseTransaction SALE`
- Chaque remboursement crée une `CaisseTransaction REFUND`
- Pas de session ouverte → paiement passe quand même (non-bloquant)

## Imprimante cloud

- XPyun via package `imprimantcloud`
- URLs dans Dockerfile : `sg.open.xpyun.net`, `gm.open.xpyun.net`
- Format reçu : balises `<C>` (centre), `<L>` (gauche), `<B>` (gras), `<BR>` (saut) — 48 chars/ligne (80mm)

## SMTP (master)

Configuré dans `master.sakafio.mg/dashboard/settings/smtp` — priorité **DB > env**.

**Recommandation** : **Brevo** (ex-Sendinblue)
- Host `smtp-relay.brevo.com`, port `587`, secure `false` (STARTTLS)
- 300 emails/j gratuits sans CB
- Valider le domaine `sakafio.mg` pour utiliser `from: noreply@sakafio.mg`

Alternative testée et CASSÉE : `mail.dago-it.com` → `158.220.82.114:465` ECONNREFUSED car cette IP est le VPS lui-même qui n'a aucun mail server. Toujours utiliser un SMTP externe.

---

## Runbook : Création d'un nouveau client (tenant)

1. **Une fois pour toutes sur le serveur** (idempotent) :
   - `sudo bash deploy/install-finalize-cron.sh` (cron qui reload nginx + certbot, toutes les minutes)

2. **Avant chaque nouvelle création** :
   - Le `update.sh` doit avoir été lancé après tout fix code, pour rebuild les images globales (`restaurant_web:latest` etc.) avec le placeholder `__SAKAFIO_API_URL__` dans les chunks JS.

3. **Création** :
   - **Voie A — UI Master** `master.sakafio.mg` → "Nouveau client" (auth requise)
   - **Voie B — Public self-service** `sakafio.mg/signup` (anonyme, plan trial par défaut)

   Le live log montre les étapes :
   - Pré-checks : 5 images Sakafio présentes + placeholder `__SAKAFIO_API_URL__` détecté dans les 4 images Next + network `restaurant_shared` créé
   - DB tenant créée + schema poussé
   - Admin initial créé
   - 5 containers démarrés + vérification `docker inspect` que chacun est `running`
   - Config nginx générée
   - Health check API via `docker exec`
   - Flag `.needs-ssl` créé → le cron prendra le relais (~1 min)

4. **Après création**, le cron `finalize-tenants.sh` (toutes les min) :
   - Reload nginx (active la conf du tenant)
   - Certbot pour 5 sous-domaines : `<slug>.sakafio.mg, admin-<slug>, pos-<slug>, kds-<slug>, api-<slug>`

5. **Identifiant de connexion** = email + password saisis dans le formulaire (UI master ou signup public). Le password n'est jamais réaffiché.

   **Reset password manuel** :
   ```bash
   HASH=$(docker exec -i restaurant_api node -e "console.log(require('bcryptjs').hashSync('NEW_PASS', 10))")
   docker exec -i restaurant_postgres psql -U restaurant_user -d tenant_<slug> \
     -c "UPDATE users SET \"passwordHash\"='$HASH' WHERE LOWER(email)=LOWER('user@example.com');"
   ```

6. **Si erreur de connexion** sur `admin-<slug>.sakafio.mg/login` :
   - **Email casse différente** : depuis le sprint email-lowercase, tous les nouveaux comptes sont lowercased. Les anciens peuvent encore avoir une casse mixte → lancer `bash deploy/normalize-emails.sh` une fois.
   - **URL API hardcodée** : `docker exec tenant_<slug>_web sh -c "grep -rho 'https://api[a-z.-]*sakafio\.mg' /app/.next/static/chunks 2>/dev/null | sort -u"` doit montrer **uniquement** `https://api-<slug>.sakafio.mg`. Si on voit aussi `https://api.sakafio.mg`, l'image globale a été buildée avec une URL hardcodée → `bash deploy/update.sh` puis `cd tenants/<slug> && docker compose up -d --force-recreate web pos kds client`.
   - **Spinner infini sur mauvais mdp** : interceptor axios cassé sur 401 — fix dans `apps/web/src/lib/api.ts` (skip refresh sur `/auth/login` + reject explicite).

---

## Pièges connus

- **Express route ordering** : toujours mettre `/bulk`, `/stats`, `/upload-image`, `/inventory-count`, `/reminders`, `/import`, `/import-prices`, `/import-presets`, `/presets`, `/users-without-employee`, `/from-user` AVANT `/:id` dans le même router (uniquement si même méthode HTTP — POST `/bulk` cohabite avec PUT `/:id` sans conflit).
- **`performedBy` n'existe pas** sur `StockMovement` — utiliser `createdBy`.
- **`noUncheckedIndexedAccess`** : `arr[0]` peut être `undefined` même si le tableau est non-vide — toujours utiliser optional chaining ou vérification explicite.
- **Multer déjà installé** dans `apps/api/package.json` — ne pas réinstaller.
- **`date-fns` déjà installé** dans `apps/api` — utiliser `subDays`, `startOfDay`, `endOfDay` directement.
- **Ne pas toucher** `tables/page.tsx` (erreur qrcode.react pré-existante).
- **Nginx natif (pas NPM)** : les configs sont versionnées dans `deploy/nginx/`. Pour modifier une config nginx, éditer le fichier dans le repo puis lancer `sudo bash deploy/sync-nginx.sh`. Le script gère les doublons `domain.conf` vs `domain` qui peuvent apparaître à cause de setups historiques différents.
- **Dockerfile master** doit copier `apps/master/public` vers `./apps/master/public` ET `./public` (à cause du standalone Next.js qui cherche public/ relatif au cwd).
- **Refresh token** : table `RefreshToken` en DB. Lookup par valeur token (pas par userId). Rotation à chaque refresh (delete + create). `prisma db push --accept-data-loss` peut vider cette table → tous les users perdent leur session.
- **Hydration mismatch SSR/client** : ne JAMAIS lire `localStorage` dans `useState(() => ...)` initializer. Utiliser `useState('') + useEffect` qui charge après mount.
- **CORS** : `ALLOWED_ORIGINS` dans `.env.prod` doit lister TOUS les sous-domaines (admin, pos, kds, master, sakafio.mg, shop.sakafio.mg). Sinon les apps non-listées ont leurs requêtes API bloquées silencieusement.
- **Slug avec tirets → DB invalide** : `slug=le-bistrot` → `dbName=tenant_le_bistrot` (replace `-` par `_`). Le `CREATE DATABASE` est quoté en SQL dans `deploy/new-tenant.sh` par sécurité.
- **Emails case-sensitive en Prisma** : `findUnique({ where: { email }})` est case-sensitive. Tous les schemas Zod doivent `.transform(s => s.trim().toLowerCase())`. Pour migrer l'existant : `bash deploy/normalize-emails.sh`.
- **Date picker invisible sur thème sombre** : ajouté dans `apps/web/src/app/globals.css` : `color-scheme: dark` + `filter: invert(0.8)` sur `::-webkit-calendar-picker-indicator`.
- **SMTP `mail.dago-it.com` ne marche pas** : l'IP résout sur le VPS lui-même qui n'a pas de serveur SMTP. Utiliser Brevo ou autre provider externe.
- **Landing screenshots** : `scripts/generate-screenshots.ts` utilise Tailwind CLI compilé localement (PAS le CDN — bloqué dans certains contextes). Tourne un serveur HTTP éphémère, sert chaque mockup, screenshot via Playwright. CSS pré-compilé inline dans le HTML.
- **Master plans seed** : `createMany skipDuplicates` ne ré-écrit JAMAIS un plan existant. Pour rebooter avec les valeurs par défaut, supprimer la row puis restart master.
- **Permissions superadmin** : verrouillé — l'API refuse les PUT permissions sur le rôle superadmin (anti lock-out).
- **CSV Dolibarr** : auto-detect `,` vs `;`, tolère quotes `""`, `pick()` essaie 1) match exact 2) substring fallback. Pour étendre : ajouter une clé synonyme dans le tableau du `pick(row, ['nom', 'name', 'societe', ...])`.
- **Recettes brochettes** : utiliser `Ingredient.stockItemId` pour lier au stock, `RecipeItem.yieldRate` (ex: 0.95 pour 5% de perte cuisson). Le décrément stock se fait à `POST /api/orders`.
- **4 bugs structurels documentés (race conditions)** non corrigés — voir Sprint API-1 dans ROADMAP : stock cross-order, coupon usage atomique, table occupancy multi-step, POS refresh single-flight (`setTimeout` au lieu de flag synchrone).

---

## Concurrentiel (pas afficher publiquement)

Les sections suivantes ont été **retirées de sakafio.mg** pour éviter de donner des idées à copier :
- ~~"Multi-tenant SaaS"~~ → reformulé en "Vos données, à vous" (sauvegardes + export)
- ~~"Imprimante cloud XPyun"~~ → reformulé en "Tickets imprimés, sans installation réseau locale"
- ~~"Postgres + JWT + VPS dédié Madagascar"~~ → reformulé en "Sauvegardes chiffrées + HTTPS partout + infrastructure à Madagascar"
- ~~"Enterprise sur devis"~~ → archivé dans `_ARCHIVED_PLANS`, remplacé par Pro+ 149k fixe

Numéro WhatsApp public : **`+261 34 00 000 00`** (placeholder fictif). Le vrai numéro `+261 34 17 767 77` n'apparaît nulle part dans le repo.

---

## État récent (juin 2026) — sprints chronologiques

1. **Race conditions API** (`Sprint API-1`) — 4 bugs documentés non corrigés (stock cross-order, coupon, table occupancy, POS refresh).
2. **Master UI** : suspend/resume, delete 2FA, SMTP UI, deployment UI avec live log, billing scheduler.
3. **Refonte master UI/UX sprint 1** : login premium 2 cols + sidebar collapsible + topbar sticky + overview animé (commit `5c236b3`).
4. **Refonte master UI/UX sprint 2** : tenants list/detail/new, updates, plans (cards), billing, settings, smtp (commit `497de2c`).
5. **Landing sakafio.mg** : Hero, Features, ScreenshotsShowcase Playwright, Pricing 4 plans, Footer, Header drawer mobile.
6. **Captures Playwright** : mockups HTML avec Tailwind compilé localement + serveur HTTP éphémère (commit `24cde55`).
7. **Concurrentiel cleanup** : retrait des fuites techniques (commit `79363ca`).
8. **Signup self-service public** : POST /api/signup landing → master, slug auto, trial 3j, fix `-` → `_` dans dbName (commits `0520479`, `baedd39`).
9. **Pricing iterations** : Enterprise → Groupe → Pro+ (commits `119e19b`, `a2d6b34`, `f21b4be`, `253ee1b`, `4117157`).
10. **Plans master seed automatique** au boot (commit `e197962`).
11. **RBAC complet** : 26 permissions + matrice UI + API CRUD (commit `a924c7c`).
12. **Categories presets** : 51 catégories Bar/Resto/Malgache importables (commit `22f851e`).
13. **Email lowercase** : Zod transform partout + script migration `deploy/normalize-emails.sh` (commit `3b8e7bd`).
14. **Employees: promouvoir user existant** : GET /users-without-employee + POST /from-user + modal (commit `bf9c889`).
15. **Date picker dark theme** fix globals.css (commit `e037948`).
16. **Imports CSV Dolibarr** : fournisseurs + prix d'achat avec dry-run UI (commit `bb4007d`).

---

## Pending / Idées (à débloquer sur demande)

- **reCAPTCHA v3** sur `sakafio.mg/signup` (anti-bot)
- **Cron expiration trial** → `SUSPENDED` + email J-1
- **Bandeau countdown trial** dans admin tenant
- **Master trials filtres** + métriques + bouton "Convertir en abonné"
- **Plausible self-hosted analytics**
- **4 critiques architecturales** :
  - Float → Decimal migration on monetary fields
  - Master `docker.sock` RCE refactor (host daemon queue)
  - `restaurantId` denormalization on Payment/Refund/Invoice
  - Postgres role per tenant + `isSuperAdmin` flag
- **Migration `authorize(role)` → `requirePermission(key)`** dans toutes les routes Express
- **CRUD MasterUser** depuis l'UI master (actuellement via `deploy/master-add-user.sh`)
- **Seed démo MG** (mofo gasy, ravitoto, romazava, brochettes, THB recipe)
- **Page food cost** par catégorie dans le rapport
- **Variantes brochettes** (poulet / bœuf / mixte) en 1 produit + recettes différentes
- **2FA** pour les comptes tenant
- **Audit log filtré par user** dans une UI dédiée

---

## Ce qu'il ne faut PAS faire

- Ne pas pousser sur `main` ou une autre branche.
- Ne pas demander permission pour chaque feature en mode autonome.
- Ne pas utiliser `prisma migrate` — toujours `prisma db push --accept-data-loss`.
- Ne pas ajouter de commentaires "ce code fait X" — seulement les WHY non-évidents.
- Ne pas créer de fichiers README ou documentation sauf si explicitement demandé.
- Ne pas implémenter des abstractions inutiles pour une feature one-shot.
- Ne pas ajouter de gestion d'erreur pour des cas impossibles (trust Prisma/Express).
- Ne pas réinstaller des packages déjà présents (vérifier `package.json` d'abord).
- Ne pas `git push --force` ni amender des commits déjà poussés.
- Ne pas ajouter GSAP, daisyUI, shadcn/ui ou autres bibliothèques UI lourdes — Framer Motion + Tailwind + lucide-react suffisent.
- Ne pas exposer publiquement les détails d'architecture (multi-tenant, XPyun, Postgres) sur sakafio.mg — déjà retiré.
- Ne pas modifier le numéro WhatsApp `+261 34 00 000 00` qui est le placeholder fictif.

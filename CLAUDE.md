# Sakafio — Mémoire projet Claude

> Nom de code interne : *RestaurantOS* (utilisé dans les commits/docs historiques)
> Marque publique : **Sakafio** — domaine principal `sakafio.mg`

## Le projet en une phrase

SaaS de gestion de restaurant complet (commandes, caisse, stock, fidélité, KDS, réservations) ciblant Madagascar, déployé en production sur VPS.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Monorepo | Turborepo |
| API | Express.js + Prisma ORM + PostgreSQL (port 4000) |
| Dashboard admin | Next.js 14 App Router (port 3000) → `admin.sakafio.mg` |
| POS | Next.js standalone (port 3001) → `pos.sakafio.mg` |
| KDS | Next.js kitchen display (port 3002) |
| Client | Next.js app client (port 3003) |
| **Master SaaS** | **Next.js (port 3010 / 4010 prod) → `master.sakafio.mg`** |
| Auth | JWT (accessToken localStorage + refreshToken cookie) |
| Temps réel | Socket.io |
| Schéma DB tenant | `packages/database/prisma/schema.prisma` |
| Schéma DB master | `packages/master-database/prisma/schema.prisma` |
| Styles | Tailwind CSS |
| Data fetching | TanStack Query (`useQuery` / `useMutation`) |
| Notifications | Sonner toasts |
| Animations | Framer Motion (`AnimatePresence` + `motion.div`) |
| Icons | lucide-react |
| Upload fichiers | multer (installé dans apps/api) |

## Architecture multi-tenant (SaaS)

- **1 Postgres partagé** + **1 DB par tenant** (`tenant_<slug>`) + 1 DB master (`master_db`)
- **1 stack Docker isolée par tenant** : générée à la volée par `deploy/new-tenant.sh` dans `tenants/<slug>/docker-compose.yml`
- **Allocation auto de ports** : tenant N → api=4100+N*10, web=+1, pos=+2, kds=+3, client=+4
- **URLs par tenant** : `<slug>.sakafio.mg` (client public), `admin-<slug>...`, `pos-<slug>...`, `kds-<slug>...`, `api-<slug>...`
- **Création tenant** : UI Master → POST `/api/tenants` → exécute `deploy/new-tenant.sh` via `child_process`
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

Le script fait : `git pull` → `docker compose build` → `restart` → `prisma db push --accept-data-loss`

---

## Moyens de paiement (Madagascar)

`CASH | MVOLA | ORANGE_MONEY | AIRTEL_MONEY | CARD | BNI_MOBILE | BOA_MOBILE | VIREMENT | CHEQUE | VOUCHER | WALLET`

**WALLET** = rachat de points fidélité (1 point = 10 MGA, constante `POINTS_RATE = 10`)

---

## Conventions de code strictes

### API (Express + Prisma)
- **Routes statiques AVANT dynamiques** : `/bulk`, `/stats`, `/upload-image` doivent être déclarées AVANT `/:id` — sinon Express les capture comme ID.
- **Side-effects non-bloquants** : toujours `.catch(() => {})` sur les créations de notifications, reminders, etc.
- **Migrations Prisma** : toujours `--accept-data-loss` pour éviter les prompts interactifs.
- **Champ inventory** : utiliser `createdBy` (pas `performedBy`) sur `StockMovement`.
- **Authentification** : middleware `authenticate` + `authorize('role1', 'role2')` sur chaque route protégée.
- **Audit** : `AuditLog` est alimenté automatiquement — ne pas doublon-logger manuellement.

### Frontend (Next.js)
- **Axios instance** : `import { api } from '@/lib/api'` — base URL déjà configurée, token injecté automatiquement.
- **TypeScript strict** : `noUncheckedIndexedAccess` — toujours typer les tableaux (`arr[0]` peut être undefined).
- **Pattern page** : `useQuery` pour GET, `useMutation` + `queryClient.invalidateQueries` pour mutations.
- **Modals** : `AnimatePresence` + `motion.div` avec overlay backdrop `bg-black/50`.
- **Toasts** : `toast.success()` / `toast.error()` de Sonner.
- **Currency** : `formatCurrency(amount)` depuis `@restaurant/utils` (formate en Ar).
- **Pas de commentaires** sauf si la raison est non-évidente.

### Erreurs connues à ignorer
- `apps/web/src/app/(dashboard)/tables/page.tsx` : erreur TypeScript `qrcode.react` (types manquants) — pré-existante, ne pas toucher.

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
1. `git log --oneline -10` → voir où on en est
2. Lire `docs/ROADMAP.md` → File d'attente → prendre le prochain sprint
3. Explorer les fichiers concernés avant de coder (éviter les doublons)
4. Implémenter, vérifier TypeScript (`cd apps/api && npx tsc --noEmit` et `cd apps/web && npx tsc --noEmit`)
5. Commit + push
6. Mettre à jour `docs/ROADMAP.md` (déplacer de "File d'attente" vers "Livrés")
7. Déployer
8. Reprendre au point 2

---

## État actuel du projet (mai 2026)

### Pages dashboard admin (30+ routes)
Dashboard KPIs, Commandes, Tables/plan de salle, Menu + Modificateurs, Stock + détail article, Entrepôts, Fournisseurs/BDC, Clients + détail + segmentation, Dettes clients, Employés, Planning des shifts, Réservations + rappels, Liste d'attente, KDS multi-station, Caisse, Banque, Finances, Rapport journalier, Analytics + performance cuisine, Coupons + génération en masse, Promotions, Factures, Terminaux POS, Avis clients, Campagnes marketing, Journal d'audit, Imprimante, Paramètres.

### Apps
- **POS** : sélection table, envoi cuisine, paiements mixtes multi-méthodes, reçu cloud XPyun + navigateur, rachat points WALLET, saisie pourboire
- **KDS** : filtrage multi-station (chaud/froid/boissons/desserts), login, son, état vide célébratoire
- **Client** : menu public, panier, checkout, historique commandes, suivi commande temps réel, appel serveur QR

### Infrastructure
- Déployé sur VPS Ubuntu avec Docker Compose + Nginx Proxy Manager
- Imprimante thermique cloud via XPyun (package `imprimantcloud`)
- Socket.io pour temps réel (commandes, KDS, notifications)

---

## Caisse

- Chaque `POST /api/payments` crée automatiquement une `CaisseTransaction SALE`
- Chaque remboursement crée une `CaisseTransaction REFUND`
- Pas de session ouverte → paiement passe quand même (non-bloquant)

## Imprimante cloud

- XPyun via package `imprimantcloud`
- URLs dans Dockerfile : `sg.open.xpyun.net`, `gm.open.xpyun.net`
- Format reçu : balises `<C>` (centre), `<L>` (gauche), `<B>` (gras), `<BR>` (saut) — 48 chars/ligne (80mm)

---

## Pièges connus

- **Express route ordering** : toujours mettre `/bulk`, `/stats`, `/upload-image`, `/inventory-count`, `/reminders` AVANT `/:id` dans le même router.
- **`performedBy` n'existe pas** sur `StockMovement` — utiliser `createdBy`.
- **`noUncheckedIndexedAccess`** : `arr[0]` peut être `undefined` même si le tableau est non-vide — toujours utiliser optional chaining ou vérification explicite.
- **Multer déjà installé** dans `apps/api/package.json` — ne pas réinstaller.
- **`date-fns` déjà installé** dans `apps/api` — utiliser `subDays`, `startOfDay`, `endOfDay` directement.
- **Ne pas toucher** `tables/page.tsx` (erreur qrcode.react pré-existante).
- _(Section à compléter au fil du temps)_

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

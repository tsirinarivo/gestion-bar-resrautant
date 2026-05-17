# RestaurantOS — Notes Claude

## Déploiement

Après chaque commit/push, déployer avec :

```bash
cd /opt/restaurant && bash deploy/update.sh
```

> **Règle** : ne jamais demander à l'utilisateur de copier-coller une commande — toujours terminer avec le script ci-dessus directement cliquable.

## Stack

- **Monorepo** Turborepo
- **apps/api** — Express + Prisma (port 4000)
- **apps/web** — Next.js 14 dashboard admin (port 3000) → `admin.restaurant.dago-it.com`
- **apps/pos** — Next.js POS standalone (port 3001) → `pos.restaurant.dago-it.com`
- **apps/kds** — Kitchen Display (port 3002)
- **apps/client** — Client app (port 3003)
- **Branch** : `claude/restaurant-management-app-cFnVm`

## Moyens de paiement (Madagascar)

`CASH | MVOLA | ORANGE_MONEY | AIRTEL_MONEY | CARD | BNI_MOBILE | BOA_MOBILE | VIREMENT | CHEQUE | VOUCHER | WALLET`

## Règles de développement

- Toujours commit + push avant de proposer le déploiement
- Le script deploy fait : `git pull` → `docker compose build` → `restart` → `prisma db push --accept-data-loss`
- Migrations Prisma : toujours avec `--accept-data-loss` pour éviter les prompts interactifs
- Imprimante cloud : XPyun via package `imprimantcloud` — URLs corrigées dans Dockerfile (`sg.open.xpyun.net`, `gm.open.xpyun.net`)
- Format reçu : balises XPyun `<C>`, `<L>`, `<B>`, `<BR>` — 48 chars/ligne (80mm)

## Caisse

- Chaque paiement (`POST /api/payments`) crée automatiquement une `CaisseTransaction SALE` dans la session ouverte
- Chaque remboursement crée une `CaisseTransaction REFUND`
- Pas de session ouverte → paiement passe quand même (non-bloquant)

## POS (`pos.restaurant.dago-it.com`)

- Sélection de table + envoi en cuisine + paiements mixtes multi-méthodes
- Modal reçu : bouton ☁️ (cloud XPyun) + 🖨️ (navigateur)
- Paiements mixtes : on ajoute des tranches jusqu'à solder (ex: Ar 10 000 Espèces + Ar 16 000 MVola)

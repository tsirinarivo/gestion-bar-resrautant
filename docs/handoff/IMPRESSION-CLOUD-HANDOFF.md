# À coller dans l'autre conversation Claude — Intégration impression cloud (XPyun)

> Objectif : ajouter l'impression de tickets via imprimante cloud XPyun (package
> `imprimantcloud`) dans ce projet, comme dans le projet de référence Sakafio.
> Claude : implémente les étapes ci-dessous. Demande-moi les 3 fichiers source
> (`lib/printer.ts`, `routes/printer.ts`, `settings/printer/page.tsx`) si tu ne
> les as pas — je te les colle depuis le projet de référence.

## 0. Comprendre
L'impression n'est pas du code maison : c'est un package npm installé depuis Git
qui parle à l'API XPyun. Il stocke sa config dans 2 tables Prisma (`printer_configs`,
`print_logs`), chiffre la clé API imprimante avec `APP_ENCRYPTION_KEY`, et expose
des fonctions (`formatSaleReceipt`, `updateConfig`, `sendPrintAndLog`, etc.).
Un guide officiel est livré avec : `node_modules/imprimantcloud/INTEGRATION.md`.

## 1. Dépendance (package.json de l'API)
```json
"imprimantcloud": "git+ssh://git@github.com/tsirinarivo/ImprimantCloud.git#e38c8bd41f33503be7f29e663a1754d31f03fa96"
```
⚠️ Installé en **git+SSH** → le build doit avoir un accès SSH à ce repo GitHub
(dans le Dockerfile : `ssh: - default`, et `docker build --ssh default`).

## 2. Modèles Prisma — à ajouter au schema.prisma puis `prisma db push`
```prisma
enum PrintLogStatus {
  pending
  printed
  failed
}

model PrinterConfig {
  id        String  @id @default(cuid())
  ownerId   String  @unique
  enabled   Boolean @default(false)
  user      String?
  key       String?
  region    String  @default("cn")
  sn        String?
  voice     Int?
  header    String?
  footer    String?
  copies    Int     @default(1)
  autoOnSaleConfirm      Boolean @default(true)
  autoOnPaymentConfirm   Boolean @default(true)
  autoOnDeliveryRegister Boolean @default(false)
  updatedAt DateTime @updatedAt

  @@map("printer_configs")
}

model PrintLog {
  id        String         @id @default(cuid())
  ownerId   String
  sn        String
  kind      String
  relatedId String?
  content   String
  copies    Int            @default(1)
  status    PrintLogStatus @default(pending)
  orderId   String?
  error     String?
  failedAt  DateTime?
  createdAt DateTime       @default(now())

  @@index([ownerId, createdAt])
  @@index([status])
  @@map("print_logs")
}
```
> `ownerId` = l'identifiant du tenant/restaurant (1 config par restaurant).
> Le package a son PROPRE client Prisma pointé sur `DATABASE_URL` → ces tables
> doivent exister dans la même base.

## 3. Variables d'environnement (conteneur API)
```
APP_ENCRYPTION_KEY=<64 caractères hex>   # openssl rand -hex 32  — CONSTANTE À VIE
XPYUN_DEBUG=0
DATABASE_URL=postgresql://...            # déjà présent
```
- `APP_ENCRYPTION_KEY` chiffre la UserKEY XPyun en base. La regex du package est
  STRICTE : `^[0-9a-fA-F]{64}$`. Pas d'espace ni de retour chariot final.
- ⚠️ Si l'app est **multi-tenant** (1 conteneur API par client) : la clé doit
  être injectée dans CHAQUE conteneur tenant (env_file/.env du tenant), pas
  seulement le conteneur global — sinon « Chiffrement impossible » à l'enregistrement.
- Après ajout dans .env : **recréer** le conteneur (`up -d --force-recreate api`),
  un simple `restart` ne relit pas l'env.

## 4. Patch d'URL XPyun (gotcha — sinon les impressions partent dans le vide)
Le package pointe par défaut sur de mauvaises bases. Dans le Dockerfile de l'API,
après installation des node_modules :
```dockerfile
RUN sed -i \
    -e 's|platform.xpyun.net/api/openapi/xprinter|open.xpyun.net/api/openapi/xprinter|g' \
    -e 's|sg.xpyun.net/api/openapi/xprinter|sg.open.xpyun.net/api/openapi/xprinter|g' \
    -e 's|gm.xpyun.net/api/openapi/xprinter|gm.open.xpyun.net/api/openapi/xprinter|g' \
    node_modules/imprimantcloud/dist/lib/xprint.js && \
    grep -q "gm.open.xpyun.net" node_modules/imprimantcloud/dist/lib/xprint.js \
    && echo "OK" || (echo "patch URL echoue" && exit 1)
```

## 5. Backend — copier 2 fichiers du projet de référence
- `apps/api/src/lib/printer.ts` : ré-exporte le package + wrapper
  `autoPrintReceiptWithTable(restaurantId, sale)` (impression auto du ticket de
  caisse, en-tête/pied depuis la config). ~100 lignes.
- `apps/api/src/routes/printer.ts` : routes Express
  - `GET /api/printer/config`, `PUT /api/printer/config` (manager+)
  - `POST /api/printer/receipt` (tous rôles) — impression manuelle
  - status / logs / test
  + helper `buildPOSReceipt()` (format ticket 48 colonnes, balises `<C><B><L><BR>`).
- Monter le routeur : `app.use('/api/printer', printerRouter)`.
- Brancher l'impression auto : appeler `autoPrintReceiptWithTable(...)` après
  paiement (payments.ts) et au passage COMPLETED (orders.ts), en fire-and-forget
  (`.catch(() => {})`).

## 6. Frontend — copier la page de réglages
- `apps/web/src/app/(dashboard)/settings/printer/page.tsx` : formulaire SN /
  région / User / UserKEY + en-tête/pied + toggles d'impression auto + test +
  logs. Appelle GET/PUT `/api/printer/config` et POST `/api/printer/receipt`.

## 7. Vérif finale
```bash
# la clé est bien vue par le process API :
docker exec <api_container> node -e "console.log(/^[0-9a-fA-F]{64}$/.test(process.env.APP_ENCRYPTION_KEY||''))"  # true
# le chiffrement marche :
docker exec <api_container> node -e "console.log(require('imprimantcloud/dist/lib/encrypt').encrypt('test').slice(0,12))"
```
Puis Paramètres → Imprimante → saisir SN/User/UserKEY XPyun → Enregistrer → Tester.

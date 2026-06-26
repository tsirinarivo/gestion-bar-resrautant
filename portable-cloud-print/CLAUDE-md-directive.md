<!-- ════════════════════════════════════════════════════════════════════════
  À COLLER dans le CLAUDE.md de l'autre projet.
  Ensuite, dans ce projet, demander : « implémente l'impression cloud ».
═══════════════════════════════════════════════════════════════════════════ -->

## Impression cloud (imprimante thermique XPyun)

Impression de tickets via le package **`imprimantcloud`** (XPyun / xpyun.net). La
quasi-totalité de la logique est dans le package ; le projet ne fait que de la
colle. Quand on me demande d'« implémenter / ajouter l'impression cloud », faire
exactement ceci :

### 1. Dépendance (API)
```json
"imprimantcloud": "git+ssh://git@github.com/tsirinarivo/ImprimantCloud.git#e38c8bd41f33503be7f29e663a1754d31f03fa96"
```
Installé en **git+SSH** → le build doit avoir un accès SSH (Docker : `--ssh default`).

### 2. Patch d'URL XPyun — OBLIGATOIRE (sinon ça n'imprime jamais)
Au build, après `npm install` :
```dockerfile
RUN sed -i \
  -e 's|platform.xpyun.net/api/openapi/xprinter|open.xpyun.net/api/openapi/xprinter|g' \
  -e 's|sg.xpyun.net/api/openapi/xprinter|sg.open.xpyun.net/api/openapi/xprinter|g' \
  -e 's|gm.xpyun.net/api/openapi/xprinter|gm.open.xpyun.net/api/openapi/xprinter|g' \
  node_modules/imprimantcloud/dist/lib/xprint.js
```

### 3. Modèles Prisma (puis `prisma db push --accept-data-loss`)
```prisma
enum PrintLogStatus { pending printed failed }

model PrinterConfig {
  id String @id @default(cuid())
  ownerId String @unique          // ID du commerce (tenant/restaurant/shop)
  enabled Boolean @default(false)
  user String?   key String?   region String @default("cn")   sn String?
  voice Int?   header String?   footer String?   copies Int @default(1)
  autoOnSaleConfirm Boolean @default(true)
  autoOnPaymentConfirm Boolean @default(true)
  autoOnDeliveryRegister Boolean @default(false)
  updatedAt DateTime @updatedAt
  @@map("printer_configs")
}

model PrintLog {
  id String @id @default(cuid())
  ownerId String   sn String   kind String   relatedId String?
  content String   copies Int @default(1)   status PrintLogStatus @default(pending)
  orderId String?   error String?   failedAt DateTime?   createdAt DateTime @default(now())
  @@index([ownerId, createdAt])   @@index([status])   @@map("print_logs")
}
```

### 4. Variables d'environnement (conteneur API)
- `APP_ENCRYPTION_KEY` = **64 caractères hex** (`openssl rand -hex 32`). Chiffre la
  UserKEY xpyun (AES-256-GCM). Le package valide STRICTEMENT `^[0-9a-fA-F]{64}$`
  (pas d'espace ni `\r` final). **Constante à vie** (sinon clés chiffrées illisibles).
- `XPYUN_DEBUG=0`
- `DATABASE_URL` (le package a son propre client Prisma).

### 4-bis. MULTI-TENANT (crucial — sinon « Chiffrement impossible »)
Si chaque client a SON propre conteneur API (1 stack par tenant) :
- `APP_ENCRYPTION_KEY` doit être **la même pour tous** (master + tous les tenants)
  et présente DANS CHAQUE conteneur API tenant — pas seulement le global. Sinon
  l'enregistrement imprimante échoue côté tenant alors que le global marche.
- L'ajouter au **template de provisioning tenant** (le `.env` / `docker-compose`
  généré par tenant) pour que les NOUVEAUX tenants l'aient automatiquement, en
  héritant de la clé du master.
- Pour les tenants **déjà créés** : ajouter la clé à leur `.env` puis
  `docker compose up -d --force-recreate <service_api_tenant>` (un `restart` ne
  suffit pas).
- `ownerId` = l'ID du commerce DANS la base du tenant (souvent l'unique
  restaurant/shop de cette base).

### 5. Backend (Express)
Fonctions du package : `getConfig, updateConfig, printTest, printerStatus,
getLogs, refreshLogs, sendPrintAndLog, formatSaleReceipt, loadPrinterCfg`.
Créer un routeur monté sur `/api/printer` avec :
- `POST /receipt` (authentifié) — impression manuelle ; construit le contenu 48
  colonnes (balises `<C> <L> <B> <BR>`) et appelle `sendPrintAndLog`.
- `GET/PUT /config` (admin) — `updateConfig(ownerId, body)` ; renvoyer
  `{ ok:false, errors }` en 422 si `!result.ok`. Strip les champs vides du body.
- `POST /test`, `GET /status`, `GET /logs`, `POST /refresh-logs` (admin).
- `ownerId` = identifiant du commerce (selon le projet : `req.user.restaurantId`/
  `shopId`/`tenantId`).
Impression auto : appeler `formatSaleReceipt(...)` puis `sendPrintAndLog(...)`
après confirmation/paiement, en **fire-and-forget** (`.catch(()=>{})`).

### 6. Frontend
Page de réglages : SN, région (cn/sg/de), User, UserKEY (masquée, `••••••••`
= déjà enregistrée), en-tête/pied, toggles d'impression auto, bouton test,
historique des `print_logs`. Appelle `GET/PUT /api/printer/config`, `/test`,
`/status`, `/logs`.

### Pièges connus (vécus — à éviter d'emblée)
- **« Chiffrement impossible — vérifier APP_ENCRYPTION_KEY »** = la clé manque/est
  mal formée DANS LE PROCESS API. Causes : (a) variable absente du conteneur ;
  (b) **multi-tenant** → la clé doit être dans CHAQUE conteneur API tenant, pas
  seulement le global ; (c) `\r`/espace en fin de valeur (regex stricte 64 hex) ;
  (d) conteneur démarré avant l'ajout → un `restart` ne relit pas l'env, faire
  `docker compose up -d --force-recreate api`.
- **Rien ne s'imprime** mais pas d'erreur = patch d'URL XPyun (étape 2) oublié.
- **`updateConfig` renvoie un objet `{ ok, errors }`**, il ne throw pas → gérer
  `result.ok` et renvoyer les `errors` au front.
- Vérif rapide :
  `node -e "console.log(/^[0-9a-fA-F]{64}$/.test(process.env.APP_ENCRYPTION_KEY||''))"` → `true`.

# portable-cloud-print

Module **portable** d'impression de tickets via imprimante cloud **XPyun**.
Branchable sur n'importe quel projet (Express + Prisma + React) **par injection
de dépendances** — aucune dépendance au modèle métier de l'hôte.

```
portable-cloud-print/
├── server/
│   ├── receipt.ts          # buildReceipt() — fonction PURE (0 dépendance)
│   └── printer-router.ts   # createPrinterRouter() + printSaleReceipt()
├── web/
│   └── PrinterSettings.tsx # composant React (prop `api`, sans react-query/lucide)
├── prisma/models.prisma    # 2 modèles à coller dans le schema hôte
└── .env.example            # APP_ENCRYPTION_KEY, XPYUN_DEBUG, DATABASE_URL
```

## Pré-requis (les seules choses spécifiques à XPyun)

1. **Dépendance npm** (dans l'API) :
   ```json
   "imprimantcloud": "git+ssh://git@github.com/tsirinarivo/ImprimantCloud.git#e38c8bd41f33503be7f29e663a1754d31f03fa96"
   ```
   Installé en git+SSH → le build doit avoir un accès SSH au repo.

2. **Patch d'URL XPyun** (gotcha — sinon ça n'imprime pas). Après `npm install`,
   au build (Dockerfile) :
   ```dockerfile
   RUN sed -i \
     -e 's|platform.xpyun.net/api/openapi/xprinter|open.xpyun.net/api/openapi/xprinter|g' \
     -e 's|sg.xpyun.net/api/openapi/xprinter|sg.open.xpyun.net/api/openapi/xprinter|g' \
     -e 's|gm.xpyun.net/api/openapi/xprinter|gm.open.xpyun.net/api/openapi/xprinter|g' \
     node_modules/imprimantcloud/dist/lib/xprint.js
   ```

3. **Modèles Prisma** : copier `prisma/models.prisma` dans le schema hôte → `prisma db push`.

4. **Env** : voir `.env.example`. `APP_ENCRYPTION_KEY` = 64 hex, **constante à vie**.
   ⚠️ Multi-tenant : injecter la clé dans CHAQUE conteneur API tenant. Après ajout,
   **recréer** le conteneur (un `restart` ne relit pas l'env).

## Branchement backend (Express)

```ts
import { createPrinterRouter, printSaleReceipt } from './portable-cloud-print/server/printer-router'

app.use('/api/printer', createPrinterRouter({
  authenticate,                              // ton middleware (remplit req.user)
  authorizeAdmin,                            // ton middleware admin/manager
  getOwnerId: (req) => req.user.shopId,      // l'ID du commerce, à toi de l'extraire
  resolveShop: async (ownerId) => {          // optionnel : en-tête du ticket
    const s = await db.shop.findUnique({ where: { id: ownerId } })
    return s && { name: s.name, address: s.address, phone: s.phone, header: s.invoiceHeader, footer: s.invoiceFooter }
  },
}))

// Impression auto après paiement (fire-and-forget, ne bloque pas la réponse) :
printSaleReceipt(shopId, {
  shop: { name, address, phone, header, footer },
  code: orderNumber, label: `Table ${n}`,
  items: cart.map(i => ({ name: i.name, qty: i.qty, total: i.total })),
  grandTotal,
}).catch(() => {})
```

`getOwnerId` et `resolveShop` sont les **seuls** points d'adaptation : le module
ne sait rien de ton modèle métier, tu lui donnes juste un identifiant + des infos
boutique.

## Branchement frontend (React)

```tsx
import { PrinterSettings } from './portable-cloud-print/web/PrinterSettings'
import { api } from '@/lib/api' // n'importe quel client get/put/post → { data }

export default function Page() {
  return <PrinterSettings api={api} basePath="/printer" />
}
```

## Routes exposées

| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| POST | `/receipt` | authentifié | impression manuelle d'un ticket |
| GET/PUT | `/config` | admin | lire / écrire la config (SN, User, UserKEY…) |
| POST | `/test` | admin | ticket de test |
| GET | `/status` | admin | état imprimante (online/offline/busy) |
| GET | `/logs` | admin | historique |
| POST | `/refresh-logs` | admin | rafraîchir les statuts en attente |

## Vérifs

```bash
# la clé est bien vue par le process API
node -e "console.log(/^[0-9a-fA-F]{64}$/.test(process.env.APP_ENCRYPTION_KEY||''))"  # true
# le chiffrement marche
node -e "console.log(require('imprimantcloud/dist/lib/encrypt').encrypt('x').slice(0,8))"
```

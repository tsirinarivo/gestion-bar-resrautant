# Guide de Déploiement VPS — Sakafio

## Architecture réelle du VPS

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  Nginx système (ports 80/443) + Certbot/Let's Encrypt│
│  /etc/nginx/sites-enabled/                           │
└──┬──────┬──────┬──────┬──────┬───────────────────────┘
   │      │      │      │      │
   ▼      ▼      ▼      ▼      ▼
:4005  :4002  :4003  :4004  :4001
client  web    pos    kds    api
   │      │      │      │      │
   └──────┴──────┴──────┴──────┘
              │ réseau: restaurant_internal
              │
        ┌─────┴──────┐
        │            │
     postgres      redis
     (interne)   (interne)
```

**Ports Docker (loopback uniquement) :**

| Service | Container | Port hôte | Port container |
|---------|-----------|-----------|----------------|
| API     | restaurant_api    | 127.0.0.1:4001 | 4000 |
| Web     | restaurant_web    | 127.0.0.1:4002 | 3000 |
| POS     | restaurant_pos    | 127.0.0.1:4003 | 3001 |
| KDS     | restaurant_kds    | 127.0.0.1:4004 | 3002 |
| Client  | restaurant_client | 127.0.0.1:4005 | 3003 |

---

## Installation rapide

### Étape 1 — Cloner le projet

```bash
cd /opt
git clone https://github.com/tsirinarivo/gestion-bar-resrautant.git restaurant
cd restaurant
git checkout claude/restaurant-management-app-cFnVm
```

### Étape 2 — Configurer les variables

```bash
cp .env.prod.example .env.prod
nano .env.prod
```

**Valeurs obligatoires :**
```env
POSTGRES_PASSWORD=UnMotDePasseTrèsFort123!
REDIS_PASSWORD=AutreMotDePasse456!
JWT_SECRET=$(openssl rand -base64 64)
JWT_REFRESH_SECRET=$(openssl rand -base64 64)
NEXT_PUBLIC_API_URL=https://api.sakafio.mg
NEXT_PUBLIC_SOCKET_URL=https://api.sakafio.mg
ALLOWED_ORIGINS=https://sakafio.mg,https://admin.sakafio.mg,https://pos.sakafio.mg,https://kds.sakafio.mg
CERTBOT_EMAIL=votre@email.com
```

> Générez les secrets : `openssl rand -base64 64`

### Étape 3 — DNS chez nic.mg (AVANT de lancer le script)

Le domaine `sakafio.mg` se gère via **[nic.mg](https://www.nic.mg)** (registrar officiel `.mg`).
Allez dans **Mes domaines → sakafio.mg → Gestion DNS** et créez :

**Sous-domaines principaux (vitrine + apps internes)** — pointent vers l'IP du VPS :

| Type | Nom | Valeur | TTL |
|------|-----|--------|-----|
| A | `@` (root sakafio.mg) | `158.220.82.114` | 300 |
| A | `admin` | `158.220.82.114` | 300 |
| A | `pos` | `158.220.82.114` | 300 |
| A | `kds` | `158.220.82.114` | 300 |
| A | `api` | `158.220.82.114` | 300 |
| A | `master` | `158.220.82.114` | 300 |
| CNAME | `www` | `sakafio.mg` | 300 |

**Wildcards pour les sous-domaines de tenants** (1 enregistrement = N tenants) :

| Type | Nom | Valeur | TTL |
|------|-----|--------|-----|
| A | `*` (catch-all `<slug>.sakafio.mg`) | `158.220.82.114` | 300 |
| A | `*.admin` ❌ *(non supporté par nic.mg en 2026)* | — | — |

> ⚠️ **nic.mg ne gère qu'un seul niveau de wildcard.** Pour les apps tenants
> (`admin-<slug>`, `pos-<slug>`, etc.), vous avez 2 options :
>
> **Option A — Wildcard simple `*.sakafio.mg`** : route toutes les sous-formes
> (`<slug>.sakafio.mg`, `admin-<slug>.sakafio.mg`, `pos-<slug>.sakafio.mg`, etc.)
> vers la même IP. Nginx fait ensuite le routage par `server_name` regex.
> ✅ **Recommandé** — un seul enregistrement DNS suffit.
>
> **Option B — A explicite par tenant** : à chaque création de tenant, ajouter
> manuellement `admin-<slug>`, `pos-<slug>`, `kds-<slug>`, `api-<slug>` chez nic.mg.
> ❌ Non scalable au-delà de quelques tenants.

Vérifiez la propagation (peut prendre 1-24h sur `.mg`) :
```bash
dig +short sakafio.mg
dig +short admin.sakafio.mg
dig +short master.sakafio.mg
dig +short demo.sakafio.mg              # test wildcard
dig +short admin-demo.sakafio.mg        # test wildcard
```

**Email pro `@sakafio.mg`** (optionnel, peut attendre) — voir section MX plus bas.

### Étape 4 — Lancer l'installation

```bash
bash deploy/setup.sh
```

Le script fait automatiquement :
1. Vérification Docker + Nginx + Certbot
2. Vérification ports 4001-4005 libres
3. Vérification DNS propagés
4. Build des 5 images Docker
5. Démarrage services (postgres → redis → api → frontends)
6. Migrations + seed optionnel
7. Config Nginx HTTP provisoire (pour certbot)
8. Certificats Let's Encrypt (certbot)
9. Config Nginx HTTPS finale
10. Rechargement Nginx

---

## Commandes utiles

```bash
# État des services
docker compose -f docker-compose.prod.yml ps

# Logs
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web

# Redémarrer un service
docker compose -f docker-compose.prod.yml restart api

# Mise à jour
bash deploy/update.sh

# Test API en local
curl http://127.0.0.1:4001/api/health

# Accès PostgreSQL
docker exec -it restaurant_postgres psql -U restaurant_user -d restaurant_db

# Backup BDD
docker exec restaurant_postgres pg_dump -U restaurant_user restaurant_db > backup_$(date +%Y%m%d).sql
```

---

## Dépannage

### Nginx refuse de recharger

```bash
nginx -t                         # teste la config
journalctl -u nginx --tail 20   # voir les erreurs
```

### Certbot échoue

```bash
# Vérifier que le DNS pointe bien vers ce serveur
dig +short api.sakafio.mg

# Tester manuellement
certbot certonly --nginx -d api.sakafio.mg --email vous@email.com --agree-tos
```

### API ne démarre pas

```bash
docker logs restaurant_api --tail 50
# Vérifiez DATABASE_URL dans .env.prod
```

### Conflit de port

```bash
ss -tlnp | grep '400[1-5]'
```

### Regénérer les images

```bash
docker compose -f docker-compose.prod.yml build --no-cache
```

### Voir les configs Nginx actives

```bash
ls /etc/nginx/sites-enabled/
cat /etc/nginx/sites-enabled/api.sakafio.mg
```

---

## Renouvellement SSL

Certbot gère le renouvellement automatique. Vérifiez avec :

```bash
certbot renew --dry-run
systemctl status certbot.timer
```

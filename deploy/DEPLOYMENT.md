# Guide de Déploiement VPS — RestaurantOS

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
NEXT_PUBLIC_API_URL=https://api.restaurant.dago-it.com
NEXT_PUBLIC_SOCKET_URL=https://api.restaurant.dago-it.com
ALLOWED_ORIGINS=https://restaurant.dago-it.com,https://admin.restaurant.dago-it.com,https://pos.restaurant.dago-it.com,https://kds.restaurant.dago-it.com
CERTBOT_EMAIL=votre@email.com
```

> Générez les secrets : `openssl rand -base64 64`

### Étape 3 — DNS (AVANT de lancer le script)

Dans votre gestionnaire DNS :

| Type | Nom | Valeur | TTL |
|------|-----|--------|-----|
| A | `restaurant.dago-it.com` | `158.220.82.114` | 300 |
| A | `admin.restaurant.dago-it.com` | `158.220.82.114` | 300 |
| A | `pos.restaurant.dago-it.com` | `158.220.82.114` | 300 |
| A | `kds.restaurant.dago-it.com` | `158.220.82.114` | 300 |
| A | `api.restaurant.dago-it.com` | `158.220.82.114` | 300 |

Vérifiez la propagation : `dig +short restaurant.dago-it.com`

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
dig +short api.restaurant.dago-it.com

# Tester manuellement
certbot certonly --nginx -d api.restaurant.dago-it.com --email vous@email.com --agree-tos
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
cat /etc/nginx/sites-enabled/api.restaurant.dago-it.com
```

---

## Renouvellement SSL

Certbot gère le renouvellement automatique. Vérifiez avec :

```bash
certbot renew --dry-run
systemctl status certbot.timer
```

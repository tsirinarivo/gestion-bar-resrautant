# 🚀 Guide de Déploiement VPS — RestaurantOS

## Architecture cible sur votre VPS

```
Internet
    │
    ▼
┌─────────────────────────────────────────────┐
│  Nginx Proxy Manager (ports 80/443/81)      │
│  Interface admin : http://VPS_IP:81          │
└──────────────┬──────────────────────────────┘
               │ réseau Docker: npm_proxy
               │
       ┌───────┼───────────────────────────┐
       │       │                           │
       ▼       ▼                           ▼
   restaurant  admin/pos/kds         api
   .dago-it.com .dago-it.com     .dago-it.com
   (client:3003) (web:3000 etc)    (api:4000)
       │
       └── PostgreSQL + Redis (réseau interne)
```

---

## ⚡ Installation rapide (15 minutes)

### Étape 1 — Connectez-vous à votre VPS

```bash
ssh root@votre-vps-ip
# ou
ssh user@votre-vps-ip
```

### Étape 2 — Clonez le projet

```bash
cd /opt
git clone https://github.com/tsirinarivo/gestion-bar-resrautant.git restaurant
cd restaurant
git checkout claude/restaurant-management-app-cFnVm
```

### Étape 3 — Configurez les variables d'environnement

```bash
cp .env.prod.example .env.prod
nano .env.prod
```

**Valeurs obligatoires à changer :**
```env
POSTGRES_PASSWORD=UnMotDePasseTrèsFort123!
REDIS_PASSWORD=AutreMotDePasse456!
JWT_SECRET=$(openssl rand -base64 64)
JWT_REFRESH_SECRET=$(openssl rand -base64 64)
NEXT_PUBLIC_API_URL=https://api.restaurant.dago-it.com
NEXT_PUBLIC_SOCKET_URL=https://api.restaurant.dago-it.com
ALLOWED_ORIGINS=https://restaurant.dago-it.com,https://admin.restaurant.dago-it.com,https://pos.restaurant.dago-it.com,https://kds.restaurant.dago-it.com
```

> 💡 **Astuce** : Générez des clés sécurisées avec `openssl rand -base64 64`

### Étape 4 — Lancez le script d'installation

```bash
bash deploy/setup.sh
```

Le script va automatiquement :
- ✅ Vérifier Docker
- ✅ Créer le réseau `npm_proxy`
- ✅ Installer Nginx Proxy Manager (si absent)
- ✅ Builder toutes les images Docker
- ✅ Démarrer tous les services
- ✅ Migrer la base de données

---

## 🌐 Configuration Nginx Proxy Manager

### Accès à l'interface

```
http://VOTRE_IP_VPS:81
Email     : admin@example.com
Password  : changeme
```

> ⚠️ **Changez le mot de passe admin immédiatement !**

### Créer les 5 Proxy Hosts

Pour chaque domaine, allez dans **"Proxy Hosts" → "Add Proxy Host"** :

---

#### 1️⃣ Site client (commande en ligne)

| Champ | Valeur |
|-------|--------|
| Domain Names | `restaurant.dago-it.com` |
| Forward Hostname | `restaurant_client` |
| Forward Port | `3003` |
| Websockets Support | ✅ Activé |

**Onglet SSL :**
- SSL Certificate → Let's Encrypt
- Email → votre@email.com
- Force SSL → ✅
- HTTP/2 → ✅

---

#### 2️⃣ Back-office manager

| Champ | Valeur |
|-------|--------|
| Domain Names | `admin.restaurant.dago-it.com` |
| Forward Hostname | `restaurant_web` |
| Forward Port | `3000` |
| Websockets Support | ✅ Activé |

**SSL :** idem (Let's Encrypt + Force SSL)

---

#### 3️⃣ Caisse POS

| Champ | Valeur |
|-------|--------|
| Domain Names | `pos.restaurant.dago-it.com` |
| Forward Hostname | `restaurant_pos` |
| Forward Port | `3001` |

**SSL :** idem

---

#### 4️⃣ Cuisine KDS

| Champ | Valeur |
|-------|--------|
| Domain Names | `kds.restaurant.dago-it.com` |
| Forward Hostname | `restaurant_kds` |
| Forward Port | `3002` |

**SSL :** idem

---

#### 5️⃣ API REST + WebSocket

| Champ | Valeur |
|-------|--------|
| Domain Names | `api.restaurant.dago-it.com` |
| Forward Hostname | `restaurant_api` |
| Forward Port | `4000` |
| Websockets Support | ✅ **OBLIGATOIRE** pour Socket.io |

**Onglet Advanced — Custom Nginx Configuration :**
```nginx
proxy_read_timeout 300;
proxy_connect_timeout 300;
proxy_send_timeout 300;

# Socket.io
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_cache_bypass $http_upgrade;
```

**SSL :** idem (Let's Encrypt + Force SSL)

---

## 🔌 Connecter NPM au réseau restaurant

Après avoir créé NPM, il faut le connecter au réseau `npm_proxy` :

```bash
# Trouver le nom du container NPM
docker ps | grep nginx-proxy-manager

# Connecter au réseau (si ce n'est pas déjà fait)
docker network connect npm_proxy nginx-proxy-manager
```

---

## 🔧 Commandes utiles

```bash
# Voir l'état des services
docker compose -f docker-compose.prod.yml ps

# Logs en temps réel
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web

# Redémarrer un service
docker compose -f docker-compose.prod.yml restart api

# Mettre à jour l'application
bash deploy/update.sh

# Accéder à PostgreSQL
docker exec -it restaurant_postgres psql -U restaurant_user -d restaurant_db

# Backups manuels
docker exec restaurant_postgres pg_dump -U restaurant_user restaurant_db > backup_$(date +%Y%m%d).sql
```

---

## 🔒 DNS — Enregistrements à créer

Dans votre gestionnaire DNS (OVH, Cloudflare, etc.) :

| Type | Nom | Valeur | TTL |
|------|-----|--------|-----|
| A | `restaurant` | `VOTRE_IP_VPS` | 3600 |
| A | `admin.restaurant` | `VOTRE_IP_VPS` | 3600 |
| A | `pos.restaurant` | `VOTRE_IP_VPS` | 3600 |
| A | `kds.restaurant` | `VOTRE_IP_VPS` | 3600 |
| A | `api.restaurant` | `VOTRE_IP_VPS` | 3600 |

> ⏱️ La propagation DNS prend 5 à 30 minutes.

---

## 🔥 Firewall VPS

Assurez-vous que ces ports sont ouverts :

```bash
# UFW (Ubuntu)
ufw allow 80/tcp    # HTTP (NPM)
ufw allow 443/tcp   # HTTPS (NPM)
ufw allow 81/tcp    # Interface NPM admin (restreignez à votre IP !)
ufw allow 22/tcp    # SSH

# Fermer les ports directs des apps (NPM s'en charge)
# Ne PAS exposer 3000, 3001, 3002, 3003, 4000 publiquement !
```

---

## 📊 Vérification après déploiement

```bash
# Test API
curl https://api.restaurant.dago-it.com/api/health

# Réponse attendue :
# {"status":"ok","timestamp":"...","version":"1.0.0"}
```

---

## 🔄 Mises à jour futures

```bash
cd /opt/restaurant
bash deploy/update.sh
```

---

## 🆘 Résolution des problèmes

### "Cannot reach host"
```bash
# Vérifier que le container est dans le réseau npm_proxy
docker network inspect npm_proxy | grep restaurant
```

### API ne démarre pas
```bash
docker logs restaurant_api --tail 50
# Vérifiez DATABASE_URL dans .env.prod
```

### Erreur de migration Prisma
```bash
docker compose -f docker-compose.prod.yml run --rm migrate sh
# Dans le container :
npx prisma migrate status
npx prisma migrate deploy
```

### Regénérer les images de zéro
```bash
docker compose -f docker-compose.prod.yml build --no-cache
```

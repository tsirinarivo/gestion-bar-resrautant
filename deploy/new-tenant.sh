#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/new-tenant.sh — Provisionne une nouvelle instance pour un client
#
# Appelé par la master console (apps/master) ou en CLI :
#   TENANT_SLUG=pierre TENANT_NAME="Pierre" ... bash deploy/new-tenant.sh
#
# Effectue :
#   1. Génère le compose + nginx config + .env du tenant
#   2. Démarre la stack (utilise les images déjà buildées)
#   3. Crée la DB tenant + push schema Prisma
#   4. Seed le compte admin initial
#   5. Recharge nginx (sans certbot — fait manuellement après création)
# ═══════════════════════════════════════════════════════════════════════════

set -e

# ── Variables d'env requises (passées par le caller) ───────────────────────
: "${TENANT_SLUG:?manquant}"
: "${TENANT_NAME:?manquant}"
: "${TENANT_DB_NAME:?manquant}"
: "${TENANT_DB_PASSWORD:?manquant}"
: "${TENANT_API_PORT:?manquant}"
: "${TENANT_WEB_PORT:?manquant}"
: "${TENANT_POS_PORT:?manquant}"
: "${TENANT_KDS_PORT:?manquant}"
: "${TENANT_CLIENT_PORT:?manquant}"
: "${TENANT_SUBDOMAIN:?manquant}"
: "${TENANT_JWT_SECRET:?manquant}"
: "${TENANT_JWT_REFRESH_SECRET:?manquant}"
: "${TENANT_CROSS_SECRET:?manquant}"
: "${ADMIN_EMAIL:?manquant}"
: "${ADMIN_PASSWORD:?manquant}"
: "${ADMIN_FIRST_NAME:=Admin}"
: "${ADMIN_LAST_NAME:=Principal}"

BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

log()    { echo -e "${GREEN}✅ $1${RESET}"; }
warn()   { echo -e "${YELLOW}⚠️  $1${RESET}"; }
error()  { echo -e "${RED}❌ $1${RESET}" >&2; exit 1; }
header() { echo -e "\n${BOLD}${CYAN}═══ $1 ═══${RESET}\n"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

# Charger .env.prod pour récupérer les passwords postgres/redis master
[ -f .env.prod ] || error "fichier .env.prod manquant à la racine du projet"
set -a; source .env.prod; set +a

MASTER_POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD manquant dans .env.prod}"
MASTER_REDIS_PASSWORD="${REDIS_PASSWORD:?REDIS_PASSWORD manquant dans .env.prod}"
export MASTER_POSTGRES_PASSWORD MASTER_REDIS_PASSWORD

# Allouer un DB Redis numéro (entre 0-15) à partir du port API pour éviter les collisions
TENANT_REDIS_DB=$(( (TENANT_API_PORT / 10) % 16 ))
export TENANT_REDIS_DB

TENANT_DIR="$ROOT_DIR/tenants/$TENANT_SLUG"
TEMPLATES_DIR="$ROOT_DIR/deploy/templates"

header "Provisioning tenant '$TENANT_SLUG' ($TENANT_NAME)"

# ── 1. Network Docker partagé ──────────────────────────────────────────────
if ! docker network inspect restaurant_shared >/dev/null 2>&1; then
  docker network create restaurant_shared
  log "Network Docker 'restaurant_shared' créé"
fi

# ── 2. Création du dossier du tenant ───────────────────────────────────────
mkdir -p "$TENANT_DIR/uploads"
chmod 777 "$TENANT_DIR/uploads"
log "Dossier $TENANT_DIR créé"

# ── 3. Render des templates ────────────────────────────────────────────────
export TENANT_SLUG TENANT_NAME TENANT_DB_NAME TENANT_API_PORT TENANT_WEB_PORT \
       TENANT_POS_PORT TENANT_KDS_PORT TENANT_CLIENT_PORT TENANT_SUBDOMAIN \
       TENANT_JWT_SECRET TENANT_JWT_REFRESH_SECRET TENANT_CROSS_SECRET \
       TENANT_REDIS_DB MASTER_POSTGRES_PASSWORD MASTER_REDIS_PASSWORD

# Liste explicite des vars : sinon envsubst écrase aussi des vars du compose
# (ex: ${MASTER_POSTGRES_PASSWORD} sera lu par docker-compose depuis .env du tenant).
TENANT_VARS='${TENANT_SLUG} ${TENANT_NAME} ${TENANT_DB_NAME} ${TENANT_REDIS_DB} ${TENANT_API_PORT} ${TENANT_WEB_PORT} ${TENANT_POS_PORT} ${TENANT_KDS_PORT} ${TENANT_CLIENT_PORT} ${TENANT_SUBDOMAIN} ${TENANT_JWT_SECRET} ${TENANT_JWT_REFRESH_SECRET} ${TENANT_CROSS_SECRET}'
ENV_VARS="$TENANT_VARS"' ${MASTER_POSTGRES_PASSWORD} ${MASTER_REDIS_PASSWORD}'

envsubst "$TENANT_VARS" < "$TEMPLATES_DIR/docker-compose.tenant.yml.tmpl" > "$TENANT_DIR/docker-compose.yml"
envsubst "$ENV_VARS" < "$TEMPLATES_DIR/tenant.env.tmpl" > "$TENANT_DIR/.env"
chmod 600 "$TENANT_DIR/.env"
log "Compose + .env générés"

# ── 4. Création de la DB tenant ────────────────────────────────────────────
header "Création de la DB '$TENANT_DB_NAME'"

DC_MASTER="docker compose -f $ROOT_DIR/docker-compose.prod.yml --env-file $ROOT_DIR/.env.prod"
PG_USER="${POSTGRES_USER:-restaurant_user}"

# Crée la DB si elle n'existe pas (idempotent)
$DC_MASTER exec -T postgres psql -U "$PG_USER" -d postgres -tc \
  "SELECT 1 FROM pg_database WHERE datname='$TENANT_DB_NAME'" \
  | grep -q 1 \
  || $DC_MASTER exec -T postgres psql -U "$PG_USER" -d postgres -c "CREATE DATABASE $TENANT_DB_NAME"

log "DB $TENANT_DB_NAME prête"

# ── 5. Push schema Prisma sur la DB tenant ─────────────────────────────────
header "Push schema Prisma"

# IMPORTANT : export, sinon le service `migrate` du compose utilise son
# default (restaurant_db) au lieu de la DB tenant. Le `-e` du `docker compose
# run` ne suffit pas car l'`environment:` du compose le ré-écrase.
export DATABASE_URL="postgresql://$PG_USER:$MASTER_POSTGRES_PASSWORD@postgres:5432/$TENANT_DB_NAME"

if ! $DC_MASTER run --rm migrate sh -c "npx prisma db push --accept-data-loss"; then
  error "❌ prisma db push a échoué sur $TENANT_DB_NAME — provisioning interrompu"
fi

# Sanity check : la table User doit exister après le push
if ! $DC_MASTER exec -T postgres psql -U "$PG_USER" -d "$TENANT_DB_NAME" -tAc \
     "SELECT to_regclass('\"User\"')" | grep -q "User"; then
  error "❌ La table \"User\" n'existe pas dans $TENANT_DB_NAME malgré le push — état incohérent"
fi

log "Schéma poussé sur $TENANT_DB_NAME"

# ── 6. Seed admin du tenant ────────────────────────────────────────────────
header "Création de l'admin initial du tenant"

# DATABASE_URL toujours exporté depuis l'étape 5 → utilisé par le service migrate.
if ! $DC_MASTER run --rm \
  -e RESTO_NAME="$TENANT_NAME" \
  -e RESTO_SLUG="$TENANT_SLUG" \
  -e ADMIN_EMAIL="$ADMIN_EMAIL" \
  -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  -e ADMIN_FIRST_NAME="$ADMIN_FIRST_NAME" \
  -e ADMIN_LAST_NAME="$ADMIN_LAST_NAME" \
  migrate sh -c "node dist/init-fresh.js"; then
  error "❌ Le seed de l'admin a échoué sur $TENANT_DB_NAME — provisioning interrompu"
fi

# Sanity check : au moins un User OWNER doit exister
USER_COUNT=$($DC_MASTER exec -T postgres psql -U "$PG_USER" -d "$TENANT_DB_NAME" -tAc \
  "SELECT COUNT(*) FROM \"User\" WHERE role='OWNER'" || echo 0)
if [ "$USER_COUNT" -lt 1 ]; then
  error "❌ Aucun OWNER créé dans $TENANT_DB_NAME — état incohérent"
fi

log "Admin $ADMIN_EMAIL créé"

# ── 7. Démarrage de la stack tenant ────────────────────────────────────────
header "Démarrage des containers"

cd "$TENANT_DIR"
docker compose up -d
cd "$ROOT_DIR"

log "Containers démarrés"

# ── 8. Config Nginx + reload ───────────────────────────────────────────────
header "Configuration Nginx"

NGINX_AVAILABLE="/etc/nginx/sites-available/tenant-${TENANT_SLUG}.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/tenant-${TENANT_SLUG}.conf"

if [ -d /etc/nginx/sites-available ] && [ -w /etc/nginx/sites-available ]; then
  # Liste explicite des vars : sinon envsubst écrase $http_upgrade, $host, $scheme
  # (variables nginx) en les remplaçant par du vide → "proxy_set_header" invalide.
  NGINX_VARS='${TENANT_SUBDOMAIN} ${TENANT_CLIENT_PORT} ${TENANT_WEB_PORT} ${TENANT_POS_PORT} ${TENANT_KDS_PORT} ${TENANT_API_PORT}'
  envsubst "$NGINX_VARS" < "$TEMPLATES_DIR/nginx-tenant.conf.tmpl" > "$NGINX_AVAILABLE"
  ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"
  log "Config Nginx écrite : $NGINX_AVAILABLE"
  if command -v nginx >/dev/null 2>&1 && nginx -t 2>/dev/null; then
    nginx -s reload 2>/dev/null || systemctl reload nginx 2>/dev/null || warn "Reload Nginx manuel requis : sudo systemctl reload nginx"
  else
    warn "Reload Nginx manuel requis (binaire nginx non dispo dans ce contexte)"
    warn "→ sudo systemctl reload nginx"
  fi
else
  warn "Nginx sites-available indisponible — config nginx ignorée (dev local ?)"
fi

# ── 9. Healthcheck ─────────────────────────────────────────────────────────
header "Vérification API"

sleep 5
if curl -sf "http://127.0.0.1:${TENANT_API_PORT}/api/health" > /dev/null; then
  log "API tenant répond sur :$TENANT_API_PORT"
else
  warn "API health check échoué — vérifier: docker logs tenant_${TENANT_SLUG}_api"
fi

# ── 10. Flag SSL pour le finalize daemon sur l'hôte ────────────────────────
header "Demande de SSL au finalize daemon"

cat > "$TENANT_DIR/.tenant-info" <<EOF
TENANT_SLUG=$TENANT_SLUG
TENANT_SUBDOMAIN=$TENANT_SUBDOMAIN
TENANT_API_PORT=$TENANT_API_PORT
EOF

touch "$TENANT_DIR/.needs-ssl"
log "Flag .needs-ssl créé — finalize-tenants.sh (cron sur hôte) prendra le relais"

# ── 10. Récap ──────────────────────────────────────────────────────────────
header "Provisioning terminé"

cat <<EOF
Tenant       : $TENANT_NAME ($TENANT_SLUG)
DB           : $TENANT_DB_NAME
Ports        : api=$TENANT_API_PORT web=$TENANT_WEB_PORT pos=$TENANT_POS_PORT kds=$TENANT_KDS_PORT client=$TENANT_CLIENT_PORT

URLs publiques (après SSL via certbot):
  Client : https://${TENANT_SUBDOMAIN}.sakafio.mg
  Admin  : https://admin-${TENANT_SUBDOMAIN}.sakafio.mg
  POS    : https://pos-${TENANT_SUBDOMAIN}.sakafio.mg
  KDS    : https://kds-${TENANT_SUBDOMAIN}.sakafio.mg
  API    : https://api-${TENANT_SUBDOMAIN}.sakafio.mg

Compte admin :
  Email    : $ADMIN_EMAIL
  Password : (celui passé en argument)

Prochaine étape (automatique, via finalize-tenants.sh sur l'hôte) :
  - nginx -t && systemctl reload nginx
  - certbot --nginx -d <5 sous-domaines>
  Latence : ~1 min (cron toutes les minutes).
  Vérifier : tail -f /var/log/sakafio-finalize.log
EOF

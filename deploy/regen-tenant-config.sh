#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/regen-tenant-config.sh <slug>
#
# Régénère les fichiers de config d'un tenant existant (.env, docker-compose,
# nginx) à partir de ses données stockées en DB master. Utile après un
# changement de template ou pour réparer un tenant corrompu.
#
# Ne touche PAS à la DB tenant ni au compte admin.
#
# Usage :
#   bash deploy/regen-tenant-config.sh bar20
# ═══════════════════════════════════════════════════════════════════════════

set -e

SLUG="${1:?Usage: $0 <slug>}"
ROOT_DIR="/opt/restaurant"
TENANT_DIR="$ROOT_DIR/tenants/$SLUG"
TEMPLATES_DIR="$ROOT_DIR/deploy/templates"

[ ! -d "$TENANT_DIR" ] && { echo "❌ Tenant dir introuvable : $TENANT_DIR"; exit 1; }
[ ! -f "$ROOT_DIR/.env.prod" ] && { echo "❌ .env.prod manquant"; exit 1; }

set -a; source "$ROOT_DIR/.env.prod"; set +a

DC="docker compose -f $ROOT_DIR/docker-compose.prod.yml --env-file $ROOT_DIR/.env.prod"
PG_USER="${POSTGRES_USER:-restaurant_user}"

echo "→ Lecture des données de '$SLUG' depuis DB master…"

# Récupère les champs (un par ligne, format key=value, tolère espaces dans value)
declare -A T
while IFS='=' read -r k v; do
  [ -n "$k" ] && T["$k"]="$v"
done < <(
  $DC exec -T postgres psql -U "$PG_USER" -d master_db -t -A -F= -c "
    SELECT 'name=' || name FROM \"Tenant\" WHERE slug='$SLUG' UNION ALL
    SELECT 'dbName=' || \"dbName\" FROM \"Tenant\" WHERE slug='$SLUG' UNION ALL
    SELECT 'subdomain=' || subdomain FROM \"Tenant\" WHERE slug='$SLUG' UNION ALL
    SELECT 'apiPort=' || \"apiPort\" FROM \"Tenant\" WHERE slug='$SLUG' UNION ALL
    SELECT 'webPort=' || \"webPort\" FROM \"Tenant\" WHERE slug='$SLUG' UNION ALL
    SELECT 'posPort=' || \"posPort\" FROM \"Tenant\" WHERE slug='$SLUG' UNION ALL
    SELECT 'kdsPort=' || \"kdsPort\" FROM \"Tenant\" WHERE slug='$SLUG' UNION ALL
    SELECT 'clientPort=' || \"clientPort\" FROM \"Tenant\" WHERE slug='$SLUG' UNION ALL
    SELECT 'jwtSecret=' || \"jwtSecret\" FROM \"Tenant\" WHERE slug='$SLUG' UNION ALL
    SELECT 'jwtRefreshSecret=' || \"jwtRefreshSecret\" FROM \"Tenant\" WHERE slug='$SLUG' UNION ALL
    SELECT 'apiCrossSecret=' || \"apiCrossSecret\" FROM \"Tenant\" WHERE slug='$SLUG'
  " 2>/dev/null
)

[ -z "${T[jwtSecret]:-}" ] && { echo "❌ Tenant '$SLUG' introuvable en DB master"; exit 1; }

# Exports pour envsubst
export TENANT_SLUG="$SLUG"
export TENANT_NAME="${T[name]}"
export TENANT_DB_NAME="${T[dbName]}"
export TENANT_SUBDOMAIN="${T[subdomain]}"
export TENANT_API_PORT="${T[apiPort]}"
export TENANT_WEB_PORT="${T[webPort]}"
export TENANT_POS_PORT="${T[posPort]}"
export TENANT_KDS_PORT="${T[kdsPort]}"
export TENANT_CLIENT_PORT="${T[clientPort]}"
export TENANT_JWT_SECRET="${T[jwtSecret]}"
export TENANT_JWT_REFRESH_SECRET="${T[jwtRefreshSecret]}"
export TENANT_CROSS_SECRET="${T[apiCrossSecret]}"
export TENANT_REDIS_DB=$(( (TENANT_API_PORT / 10) % 16 ))
export MASTER_POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
export MASTER_REDIS_PASSWORD="${REDIS_PASSWORD}"

# Listes envsubst : substitue UNIQUEMENT ces vars (laisse $http_upgrade etc.
# pour nginx, et les $${MASTER_*} pour docker-compose runtime).
TENANT_VARS='${TENANT_SLUG} ${TENANT_NAME} ${TENANT_DB_NAME} ${TENANT_REDIS_DB} ${TENANT_API_PORT} ${TENANT_WEB_PORT} ${TENANT_POS_PORT} ${TENANT_KDS_PORT} ${TENANT_CLIENT_PORT} ${TENANT_SUBDOMAIN} ${TENANT_JWT_SECRET} ${TENANT_JWT_REFRESH_SECRET} ${TENANT_CROSS_SECRET}'
ENV_VARS="$TENANT_VARS"' ${MASTER_POSTGRES_PASSWORD} ${MASTER_REDIS_PASSWORD}'
NGINX_VARS='${TENANT_SUBDOMAIN} ${TENANT_CLIENT_PORT} ${TENANT_WEB_PORT} ${TENANT_POS_PORT} ${TENANT_KDS_PORT} ${TENANT_API_PORT}'

echo "→ Régénération .env + docker-compose.yml…"
envsubst "$ENV_VARS"    < "$TEMPLATES_DIR/tenant.env.tmpl"           > "$TENANT_DIR/.env"
envsubst "$TENANT_VARS" < "$TEMPLATES_DIR/docker-compose.tenant.yml.tmpl" > "$TENANT_DIR/docker-compose.yml"
chmod 600 "$TENANT_DIR/.env"

echo "→ Régénération config nginx…"
NGINX_AVAILABLE="/etc/nginx/sites-available/tenant-${SLUG}.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/tenant-${SLUG}.conf"
if [ -d /etc/nginx/sites-available ] && [ -w /etc/nginx/sites-available ]; then
  envsubst "$NGINX_VARS" < "$TEMPLATES_DIR/nginx-tenant.conf.tmpl" > "$NGINX_AVAILABLE"
  ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"
fi

echo ""
echo "✅ Régénéré pour '$SLUG' :"
echo "   $TENANT_DIR/.env"
echo "   $TENANT_DIR/docker-compose.yml"
echo "   $NGINX_AVAILABLE"
echo ""
echo "Étapes suivantes :"
echo "   1. cd $TENANT_DIR && docker compose down && docker compose up -d"
echo "   2. nginx -t && systemctl reload nginx"
echo "   3. curl -sk https://api-${T[subdomain]}.sakafio.mg/api/health"

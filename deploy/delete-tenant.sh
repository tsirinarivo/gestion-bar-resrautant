#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/delete-tenant.sh — Supprime un tenant existant
#
# Appelé par la master console (apps/master) ou en CLI :
#   TENANT_SLUG=pierre bash deploy/delete-tenant.sh
#
# Effectue :
#   1. Stop + remove containers (docker compose down)
#   2. Drop DB tenant
#   3. Supprime le dossier tenants/<slug>
#   4. Supprime la config nginx
#   5. Touche un flag global pour que finalize-tenants.sh reload nginx
#
# NE TOUCHE PAS aux certificats Let's Encrypt (les laisse expirer naturellement).
# ═══════════════════════════════════════════════════════════════════════════

set -e

: "${TENANT_SLUG:?manquant}"

GREEN="\033[0;32m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; CYAN="\033[0;36m"; BOLD="\033[1m"; RESET="\033[0m"
log()    { echo -e "${GREEN}✅ $1${RESET}"; }
warn()   { echo -e "${YELLOW}⚠️  $1${RESET}"; }
error()  { echo -e "${RED}❌ $1${RESET}" >&2; exit 1; }
header() { echo -e "\n${BOLD}${CYAN}═══ $1 ═══${RESET}\n"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

[ -f .env.prod ] || error ".env.prod manquant"
set -a; source .env.prod; set +a

TENANT_DIR="$ROOT_DIR/tenants/$TENANT_SLUG"
TENANT_DB_NAME="${TENANT_DB_NAME:-tenant_${TENANT_SLUG}}"
DC_MASTER="docker compose -f $ROOT_DIR/docker-compose.prod.yml --env-file $ROOT_DIR/.env.prod"
PG_USER="${POSTGRES_USER:-restaurant_user}"

header "Suppression tenant '$TENANT_SLUG'"

# ── 1. Stop + remove containers tenant ─────────────────────────────────────
if [ -d "$TENANT_DIR" ] && [ -f "$TENANT_DIR/docker-compose.yml" ]; then
  cd "$TENANT_DIR"
  docker compose down -v --remove-orphans 2>&1 || warn "docker compose down a échoué (containers déjà arrêtés ?)"
  cd "$ROOT_DIR"
  log "Containers tenant arrêtés et supprimés"
else
  warn "Pas de docker-compose.yml dans $TENANT_DIR (rien à arrêter)"
fi

# ── 2. Drop la DB tenant ───────────────────────────────────────────────────
if $DC_MASTER exec -T postgres psql -U "$PG_USER" -d postgres -tAc \
     "SELECT 1 FROM pg_database WHERE datname='$TENANT_DB_NAME'" | grep -q 1; then
  # Terminer les connexions actives sur la DB tenant
  $DC_MASTER exec -T postgres psql -U "$PG_USER" -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$TENANT_DB_NAME' AND pid <> pg_backend_pid()" >/dev/null
  $DC_MASTER exec -T postgres psql -U "$PG_USER" -d postgres -c "DROP DATABASE $TENANT_DB_NAME"
  log "DB $TENANT_DB_NAME supprimée"
else
  warn "DB $TENANT_DB_NAME n'existait pas"
fi

# ── 3. Supprime le dossier tenant ──────────────────────────────────────────
if [ -d "$TENANT_DIR" ]; then
  rm -rf "$TENANT_DIR"
  log "Dossier $TENANT_DIR supprimé"
fi

# ── 4. Supprime la config nginx ────────────────────────────────────────────
NGINX_AVAILABLE="/etc/nginx/sites-available/tenant-${TENANT_SLUG}.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/tenant-${TENANT_SLUG}.conf"
REMOVED_NGINX=false
if [ -e "$NGINX_AVAILABLE" ] || [ -L "$NGINX_ENABLED" ]; then
  rm -f "$NGINX_AVAILABLE" "$NGINX_ENABLED"
  REMOVED_NGINX=true
  log "Config Nginx tenant-${TENANT_SLUG} supprimée"
fi

# ── 5. Flag pour finalize-tenants.sh (reload nginx sur l'hôte) ─────────────
if [ "$REMOVED_NGINX" = true ]; then
  mkdir -p "$ROOT_DIR/tenants"
  touch "$ROOT_DIR/tenants/.needs-nginx-reload"
  log "Flag .needs-nginx-reload créé — finalize-tenants.sh reload nginx au prochain run"
fi

header "Tenant '$TENANT_SLUG' supprimé"

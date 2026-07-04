#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/seed-demo.sh — Charge les données démo dans un tenant EXISTANT.
#
# Appelé par la console master (bouton « Charger données démo »).
#   TENANT_SLUG=pierre TENANT_DB_NAME=tenant_pierre bash deploy/seed-demo.sh
#
# Exécute init-fresh en mode SEED_ONLY contre la DB du tenant (via le service
# `migrate` = image restaurant_api). Idempotent (upsert par slug).
# ═══════════════════════════════════════════════════════════════════════════

set -e

: "${TENANT_SLUG:?manquant}"
: "${TENANT_DB_NAME:?manquant}"

GREEN="\033[0;32m"; RED="\033[0;31m"; CYAN="\033[0;36m"; BOLD="\033[1m"; RESET="\033[0m"
log()    { echo -e "${GREEN}✅ $1${RESET}"; }
error()  { echo -e "${RED}❌ $1${RESET}" >&2; exit 1; }
header() { echo -e "\n${BOLD}${CYAN}═══ $1 ═══${RESET}\n"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

[ -f .env.prod ] || error "fichier .env.prod manquant à la racine du projet"
set -a; source .env.prod; set +a

MASTER_POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD manquant dans .env.prod}"
export MASTER_POSTGRES_PASSWORD

DC_MASTER="docker compose -f $ROOT_DIR/docker-compose.prod.yml --env-file $ROOT_DIR/.env.prod"
PG_USER="${POSTGRES_USER:-restaurant_user}"

header "Chargement des données démo — $TENANT_SLUG"

# export : sinon le service migrate garde son DATABASE_URL par défaut.
export DATABASE_URL="postgresql://$PG_USER:$MASTER_POSTGRES_PASSWORD@postgres:5432/$TENANT_DB_NAME"

if ! $DC_MASTER run --rm \
  -e SEED_ONLY=true \
  -e RESTO_SLUG="$TENANT_SLUG" \
  migrate sh -c "node dist/init-fresh.js"; then
  error "Le seed démo a échoué sur $TENANT_DB_NAME"
fi

log "Données démo chargées dans $TENANT_DB_NAME"

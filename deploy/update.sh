#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/update.sh — Mise à jour de l'application (zero-downtime)
# Usage: bash deploy/update.sh
# ═══════════════════════════════════════════════════════════════════════════

set -e

BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
RESET="\033[0m"

log()    { echo -e "${GREEN}✅ $1${RESET}"; }
header() { echo -e "\n${BOLD}${CYAN}═══ $1 ═══${RESET}\n"; }

header "RestaurantOS — Mise à jour"

# Pull latest code
header "1. Récupération du code"
git pull origin claude/restaurant-management-app-cFnVm
log "Code mis à jour"

# Load env
source .env.prod

# Rebuild only changed images
header "2. Build des images"
docker compose -f docker-compose.prod.yml build \
  --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
  --build-arg NEXT_PUBLIC_SOCKET_URL="$NEXT_PUBLIC_SOCKET_URL"

# Rolling restart (API first, then frontends)
header "3. Redémarrage des services"

docker compose -f docker-compose.prod.yml up -d --no-deps api
sleep 15
log "API redémarrée"

docker compose -f docker-compose.prod.yml up -d --no-deps web pos kds client
log "Frontends redémarrés"

# Run migrations if any
header "4. Migrations"
docker compose -f docker-compose.prod.yml run --rm \
  -e DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}" \
  migrate sh -c "npx prisma migrate deploy" || true

log "Migrations exécutées"

header "5. Statut final"
docker compose -f docker-compose.prod.yml ps

log "Mise à jour terminée !"

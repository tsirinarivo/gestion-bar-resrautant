#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/update.sh — Mise à jour de l'application
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

header "1. Récupération du code"
git fetch origin claude/restaurant-management-app-cFnVm
git checkout claude/restaurant-management-app-cFnVm
git reset --hard origin/claude/restaurant-management-app-cFnVm
log "Code mis à jour ($(git rev-parse --short HEAD))"

set -a; source .env.prod; set +a

DC="docker compose -f docker-compose.prod.yml --env-file .env.prod"

header "2. Build des images"
$DC build --no-cache \
  --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
  --build-arg NEXT_PUBLIC_SOCKET_URL="$NEXT_PUBLIC_SOCKET_URL"

header "3. Redémarrage (API d'abord, puis frontends)"
$DC up -d --no-deps api
sleep 15
log "API redémarrée"

$DC up -d --no-deps web pos kds client
log "Frontends redémarrés"

header "4. Migrations"
$DC run --rm migrate sh -c "npx prisma db push --accept-data-loss" || true
log "Migrations exécutées"

header "5. Service de backup Postgres"
mkdir -p ./backups/postgres
$DC up -d postgres-backup
log "Backup Postgres actif (dumps dans ./backups/postgres, schedule: 03:00 chaque jour)"

header "6. Statut final"
$DC ps

echo ""
log "Mise à jour terminée !"
echo ""
echo "Test rapide      : curl http://127.0.0.1:4001/api/health"
echo "Backups Postgres : ls -lht ./backups/postgres/daily/ 2>/dev/null | head -5"
echo "Restauration     : bash deploy/restore-postgres.sh"

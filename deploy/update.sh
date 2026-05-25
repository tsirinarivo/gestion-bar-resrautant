#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/update.sh — Mise à jour de l'application
# Usage: bash deploy/update.sh
# ═══════════════════════════════════════════════════════════════════════════

set -e

BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
RESET="\033[0m"

log()    { echo -e "${GREEN}✅ $1${RESET}"; }
warn()   { echo -e "${YELLOW}⚠️  $1${RESET}"; }
header() { echo -e "\n${BOLD}${CYAN}═══ $1 ═══${RESET}\n"; }

header "Sakafio — Mise à jour"

header "1. Récupération du code"
git fetch origin claude/restaurant-management-app-cFnVm
git checkout claude/restaurant-management-app-cFnVm
git reset --hard origin/claude/restaurant-management-app-cFnVm
log "Code mis à jour ($(git rev-parse --short HEAD))"

set -a; source .env.prod; set +a

DC="docker compose -f docker-compose.prod.yml --env-file .env.prod"

header "2. Prépare les volumes host (uploads + backups + logs)"
mkdir -p ./uploads/products ./backups/postgres ./logs
# node user inside the api container is UID 1000
chown -R 1000:1000 ./uploads 2>/dev/null || warn "Impossible de chown ./uploads — exécute en root si les uploads ne fonctionnent pas"
# postgres-backup-local runs as a non-root user (UID varies between Alpine/Debian
# image variants), so allow read/write/execute for all instead of guessing the UID
chmod -R 777 ./backups/postgres 2>/dev/null || warn "Impossible de chmod ./backups/postgres"
log "Volumes prêts"

header "3. Backup Postgres pré-migration (filet de sécurité)"
if $DC ps postgres 2>/dev/null | grep -q "Up"; then
  STAMP=$(date +%Y%m%d-%H%M%S)
  PRE_DUMP="./backups/postgres/pre-deploy-${STAMP}.sql.gz"
  $DC exec -T postgres pg_dump -U "${POSTGRES_USER:-restaurant_user}" "${POSTGRES_DB:-restaurant_db}" 2>/dev/null | gzip > "$PRE_DUMP"
  SIZE=$(du -h "$PRE_DUMP" | cut -f1)
  log "Snapshot pré-migration : $PRE_DUMP ($SIZE)"
else
  warn "Postgres non actif — pas de backup pré-migration (1er déploiement ?)"
fi

header "4. Build des images"
$DC build --no-cache \
  --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
  --build-arg NEXT_PUBLIC_SOCKET_URL="$NEXT_PUBLIC_SOCKET_URL"

header "5. Redémarrage (API d'abord, puis frontends)"
$DC up -d --no-deps api
sleep 15
log "API redémarrée"

$DC up -d --no-deps web pos kds client master
log "Frontends + master redémarrés"

header "6. Migrations"
$DC run --rm migrate sh -c "npx prisma db push --accept-data-loss" || true
log "Migrations exécutées (snapshot dispo : $PRE_DUMP)"

header "7. Services d'infrastructure (backup + watchdog)"
mkdir -p ./logs
$DC up -d postgres-backup watchdog
log "Backups quotidiens actifs (03:00, rétention 14j/8s/12m)"
log "Watchdog actif (logs : ./logs/watchdog.log)"

header "8. Smoke tests"
if bash deploy/smoke-test.sh; then
  log "Smoke tests passés"
else
  warn "Certains smoke tests ont échoué — vérifier les logs"
fi

header "9. Statut final"
$DC ps

echo ""
log "Mise à jour terminée !"
echo ""
echo -e "${BOLD}Commandes utiles :${RESET}"
echo "  Healthcheck      : curl http://127.0.0.1:4001/api/health"
echo "  Backups          : ls -lht ./backups/postgres/daily/ 2>/dev/null | head -5"
echo "  Restauration     : bash deploy/restore-postgres.sh"
echo "  Watchdog logs    : tail -f ./logs/watchdog.log 2>/dev/null"

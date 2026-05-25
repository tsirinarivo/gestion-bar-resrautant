#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/reset-db.sh — Reset complet de la base + import des données démo
#
# ⚠️  DESTRUCTIF : supprime TOUTES les données (commandes, paiements, clients,
#     stock, employés, etc.) puis re-seed avec les données démo standards.
#
# Filet de sécurité : un dump pg_dump est fait AVANT le reset.
# Restauration possible avec : bash deploy/restore-postgres.sh
#
# Usage: bash deploy/reset-db.sh
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
error()  { echo -e "${RED}❌ $1${RESET}"; }
header() { echo -e "\n${BOLD}${CYAN}═══ $1 ═══${RESET}\n"; }

header "Sakafio — Reset base + re-seed démo"

if [ ! -f .env.prod ]; then
  error "Fichier .env.prod introuvable — exécuter depuis /opt/restaurant"
  exit 1
fi

set -a; source .env.prod; set +a
DC="docker compose -f docker-compose.prod.yml --env-file .env.prod"

echo -e "${RED}${BOLD}⚠️  ATTENTION : cette opération va SUPPRIMER toutes les données.${RESET}"
echo -e "Base : ${BOLD}${POSTGRES_DB:-restaurant_db}${RESET} sur ${BOLD}$(hostname)${RESET}"
echo ""
read -p "Tape 'RESET' en majuscules pour confirmer : " CONFIRM
if [ "$CONFIRM" != "RESET" ]; then
  warn "Annulé — aucune modification effectuée"
  exit 0
fi

header "1. Backup pré-reset (filet de sécurité)"
mkdir -p ./backups/postgres
chmod -R 777 ./backups/postgres 2>/dev/null || true
STAMP=$(date +%Y%m%d-%H%M%S)
PRE_DUMP="./backups/postgres/pre-reset-${STAMP}.sql.gz"

if $DC ps postgres 2>/dev/null | grep -q "Up"; then
  $DC exec -T postgres pg_dump -U "${POSTGRES_USER:-restaurant_user}" "${POSTGRES_DB:-restaurant_db}" 2>/dev/null | gzip > "$PRE_DUMP"
  SIZE=$(du -h "$PRE_DUMP" | cut -f1)
  log "Snapshot créé : $PRE_DUMP ($SIZE)"
else
  error "Postgres n'est pas démarré — exécute d'abord 'bash deploy/update.sh'"
  exit 1
fi

header "2. Drop + recreate du schéma (force-reset Prisma)"
$DC run --rm \
  -e DATABASE_URL="postgresql://${POSTGRES_USER:-restaurant_user}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-restaurant_db}" \
  migrate sh -c "npx prisma db push --force-reset --accept-data-loss"
log "Schéma recréé (toutes les données supprimées)"

header "3. Import des données démo (seed)"
$DC run --rm \
  -e DATABASE_URL="postgresql://${POSTGRES_USER:-restaurant_user}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-restaurant_db}" \
  migrate sh -c "node dist/seed.js"
log "Données démo importées"

header "4. Redémarrage de l'API (purge cache)"
$DC restart api
sleep 10
log "API redémarrée"

header "5. Vérification"
if curl -sf http://127.0.0.1:4001/api/health > /dev/null; then
  log "API health OK"
else
  warn "API health check échoué — vérifier les logs : $DC logs api"
fi

USERS_COUNT=$($DC exec -T postgres psql -U "${POSTGRES_USER:-restaurant_user}" "${POSTGRES_DB:-restaurant_db}" -tAc "SELECT COUNT(*) FROM users")
PRODUCTS_COUNT=$($DC exec -T postgres psql -U "${POSTGRES_USER:-restaurant_user}" "${POSTGRES_DB:-restaurant_db}" -tAc "SELECT COUNT(*) FROM products")
TABLES_COUNT=$($DC exec -T postgres psql -U "${POSTGRES_USER:-restaurant_user}" "${POSTGRES_DB:-restaurant_db}" -tAc "SELECT COUNT(*) FROM dining_tables")

echo ""
echo -e "${BOLD}Récap base après seed :${RESET}"
echo "  Utilisateurs : $USERS_COUNT"
echo "  Produits     : $PRODUCTS_COUNT"
echo "  Tables       : $TABLES_COUNT"
echo ""
log "Reset + import terminés !"
echo ""
echo -e "${BOLD}Comptes démo (mot de passe : demo1234) :${RESET}"
echo "  admin@demo.com      → superadmin"
echo "  manager@demo.com    → manager"
echo "  caissier@demo.com   → caissier"
echo "  serveur@demo.com    → serveur"
echo "  cuisinier@demo.com  → cuisinier"
echo ""
echo -e "${BOLD}En cas de regret :${RESET}"
echo "  bash deploy/restore-postgres.sh    # puis sélectionner $PRE_DUMP"

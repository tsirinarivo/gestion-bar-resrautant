#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/import-real-data.sh — Passage en production réelle
#
# ⚠️  DESTRUCTIF : supprime TOUTES les données démo, puis importe :
#     - Restaurant (depuis ./import-data/restaurant.csv)
#     - Catégories  (depuis ./import-data/categories.csv)
#     - Produits   (depuis ./import-data/products.csv)
#     - Tables     (depuis ./import-data/tables.csv)
#     - Employés   (depuis ./import-data/employees.csv)
#     - 1 compte admin réel (email/mot de passe demandés interactivement)
#
# Backup pré-import automatique (./backups/postgres/pre-import-*.sql.gz)
#
# Usage:
#   1. cp -r deploy/import-templates/*.csv ./import-data/
#   2. Éditer chaque CSV avec tes données réelles
#   3. bash deploy/import-real-data.sh
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

header "Sakafio — Passage en production réelle"

if [ ! -f .env.prod ]; then
  error "Fichier .env.prod introuvable — exécuter depuis /opt/restaurant"
  exit 1
fi

set -a; source .env.prod; set +a
DC="docker compose -f docker-compose.prod.yml --env-file .env.prod"

# ── 1. Vérification des CSV ──────────────────────────────────────────────────
header "1. Vérification des fichiers CSV"

IMPORT_DIR="$(pwd)/import-data"
if [ ! -d "$IMPORT_DIR" ]; then
  error "Dossier ./import-data introuvable."
  echo "Crée-le et copie les templates :"
  echo "  mkdir ./import-data && cp deploy/import-templates/*.csv ./import-data/"
  echo "Puis édite chaque CSV avec tes données réelles."
  exit 1
fi

MISSING=0
for f in restaurant.csv categories.csv products.csv tables.csv employees.csv; do
  if [ ! -f "$IMPORT_DIR/$f" ]; then
    warn "$f manquant dans ./import-data/"
    MISSING=$((MISSING + 1))
  else
    LINES=$(wc -l < "$IMPORT_DIR/$f")
    log "$f trouvé ($LINES lignes)"
  fi
done

if [ "$MISSING" -gt 0 ]; then
  error "$MISSING fichier(s) CSV manquant(s) — copie les templates depuis deploy/import-templates/"
  exit 1
fi

# ── 2. Compte admin réel ─────────────────────────────────────────────────────
header "2. Création du compte admin réel"

read -p "Email admin (ex: admin@monresto.mg) : " ADMIN_EMAIL
if [ -z "$ADMIN_EMAIL" ]; then error "Email obligatoire"; exit 1; fi

read -p "Prénom admin : " ADMIN_FIRST
read -p "Nom admin : " ADMIN_LAST
ADMIN_FIRST="${ADMIN_FIRST:-Admin}"
ADMIN_LAST="${ADMIN_LAST:-Principal}"

read -s -p "Mot de passe (min 8 caractères) : " ADMIN_PASSWORD; echo ""
read -s -p "Confirmer : " ADMIN_PASSWORD_2; echo ""

if [ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD_2" ]; then
  error "Les mots de passe ne correspondent pas"
  exit 1
fi
if [ ${#ADMIN_PASSWORD} -lt 8 ]; then
  error "Le mot de passe doit faire au moins 8 caractères"
  exit 1
fi

# ── 3. Dernière confirmation ─────────────────────────────────────────────────
header "3. Confirmation finale"
echo -e "${RED}${BOLD}⚠️  Cette opération va SUPPRIMER toutes les données actuelles (démo).${RESET}"
echo "  Base       : ${POSTGRES_DB:-restaurant_db}"
echo "  Admin créé : $ADMIN_EMAIL ($ADMIN_FIRST $ADMIN_LAST)"
echo "  Source CSV : $IMPORT_DIR"
echo ""
read -p "Tape 'IMPORT' en majuscules pour confirmer : " CONFIRM
if [ "$CONFIRM" != "IMPORT" ]; then
  warn "Annulé — aucune modification effectuée"
  exit 0
fi

# ── 4. Backup pré-import ─────────────────────────────────────────────────────
header "4. Backup pré-import (filet de sécurité)"

mkdir -p ./backups/postgres
chmod -R 777 ./backups/postgres 2>/dev/null || true
STAMP=$(date +%Y%m%d-%H%M%S)
PRE_DUMP="./backups/postgres/pre-import-${STAMP}.sql.gz"

if $DC ps postgres 2>/dev/null | grep -q "Up"; then
  $DC exec -T postgres pg_dump -U "${POSTGRES_USER:-restaurant_user}" "${POSTGRES_DB:-restaurant_db}" 2>/dev/null | gzip > "$PRE_DUMP"
  SIZE=$(du -h "$PRE_DUMP" | cut -f1)
  log "Snapshot créé : $PRE_DUMP ($SIZE)"
else
  error "Postgres n'est pas démarré — exécute d'abord 'bash deploy/update.sh'"
  exit 1
fi

# ── 5. Force-reset du schéma ─────────────────────────────────────────────────
header "5. Drop + recreate du schéma (Prisma --force-reset)"

$DC run --rm \
  -e DATABASE_URL="postgresql://${POSTGRES_USER:-restaurant_user}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-restaurant_db}" \
  migrate sh -c "npx prisma db push --force-reset --accept-data-loss"
log "Schéma recréé — base vide"

# ── 6. Import depuis les CSV ─────────────────────────────────────────────────
header "6. Import depuis ./import-data/"

$DC run --rm \
  -v "$IMPORT_DIR:/import-data:ro" \
  -e DATABASE_URL="postgresql://${POSTGRES_USER:-restaurant_user}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-restaurant_db}" \
  -e IMPORT_DIR="/import-data" \
  -e ADMIN_EMAIL="$ADMIN_EMAIL" \
  -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  -e ADMIN_FIRST_NAME="$ADMIN_FIRST" \
  -e ADMIN_LAST_NAME="$ADMIN_LAST" \
  migrate sh -c "node dist/import.js"
log "Import terminé"

# ── 7. Redémarrage API + smoke test ──────────────────────────────────────────
header "7. Redémarrage API"
$DC restart api
sleep 10

if curl -sf http://127.0.0.1:4001/api/health > /dev/null; then
  log "API health OK"
else
  warn "API health check échoué — vérifier : $DC logs api"
fi

# ── 8. Récap ─────────────────────────────────────────────────────────────────
header "8. Récap"

USERS_COUNT=$($DC exec -T postgres psql -U "${POSTGRES_USER:-restaurant_user}" "${POSTGRES_DB:-restaurant_db}" -tAc "SELECT COUNT(*) FROM users" | tr -d '[:space:]')
PRODUCTS_COUNT=$($DC exec -T postgres psql -U "${POSTGRES_USER:-restaurant_user}" "${POSTGRES_DB:-restaurant_db}" -tAc "SELECT COUNT(*) FROM products" | tr -d '[:space:]')
TABLES_COUNT=$($DC exec -T postgres psql -U "${POSTGRES_USER:-restaurant_user}" "${POSTGRES_DB:-restaurant_db}" -tAc "SELECT COUNT(*) FROM dining_tables" | tr -d '[:space:]')
RESTO_NAME=$($DC exec -T postgres psql -U "${POSTGRES_USER:-restaurant_user}" "${POSTGRES_DB:-restaurant_db}" -tAc "SELECT name FROM restaurants LIMIT 1" | tr -d '[:space:]')

echo ""
echo -e "${BOLD}État final :${RESTAURANT}${RESET}"
echo "  Restaurant   : $RESTO_NAME"
echo "  Utilisateurs : $USERS_COUNT"
echo "  Produits     : $PRODUCTS_COUNT"
echo "  Tables       : $TABLES_COUNT"
echo ""
log "Passage en production terminé !"
echo ""
echo -e "${BOLD}Connexion admin :${RESET}"
echo "  URL      : https://admin.sakafio.mg/login"
echo "  Email    : $ADMIN_EMAIL"
echo "  Password : (celui que tu viens de saisir)"
echo ""
echo -e "${BOLD}En cas de regret :${RESET}"
echo "  bash deploy/restore-postgres.sh   # sélectionner $PRE_DUMP"

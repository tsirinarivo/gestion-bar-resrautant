#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/restore-postgres.sh — Restauration d'un dump Postgres
#
# Usage:
#   bash deploy/restore-postgres.sh                 # liste les dumps dispo
#   bash deploy/restore-postgres.sh <fichier.sql.gz> # restaure depuis le fichier
# ═══════════════════════════════════════════════════════════════════════════

set -e

BOLD="\033[1m"
RED="\033[0;31m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
YELLOW="\033[0;33m"
RESET="\033[0m"

BACKUP_DIR="./backups/postgres"

if [ ! -d "$BACKUP_DIR" ]; then
  echo -e "${RED}✗ Dossier $BACKUP_DIR introuvable${RESET}"
  exit 1
fi

# Sans argument → liste des dumps
if [ -z "$1" ]; then
  echo -e "${BOLD}${CYAN}Dumps Postgres disponibles${RESET}\n"
  find "$BACKUP_DIR" -name "*.sql.gz" -type f -printf "%T@ %p\n" 2>/dev/null \
    | sort -rn | head -30 | while read ts path; do
    date_str=$(date -d "@${ts%.*}" '+%Y-%m-%d %H:%M')
    size=$(du -h "$path" | cut -f1)
    echo "  $date_str  $size  $path"
  done
  echo ""
  echo -e "Pour restaurer : ${BOLD}bash deploy/restore-postgres.sh <chemin>${RESET}"
  exit 0
fi

DUMP_FILE="$1"

if [ ! -f "$DUMP_FILE" ]; then
  echo -e "${RED}✗ Fichier $DUMP_FILE introuvable${RESET}"
  exit 1
fi

set -a; source .env.prod; set +a
DC="docker compose -f docker-compose.prod.yml --env-file .env.prod"

echo -e "${BOLD}${YELLOW}⚠️  RESTAURATION POSTGRES${RESET}"
echo -e "Fichier source     : ${BOLD}$DUMP_FILE${RESET}"
echo -e "Base de destination: ${BOLD}${POSTGRES_DB:-restaurant_db}${RESET}"
echo ""
echo -e "${RED}⚠️  Cette opération va ÉCRASER la base actuelle.${RESET}"
echo -en "${YELLOW}Confirmer en tapant 'OUI' : ${RESET}"
read CONFIRM
if [ "$CONFIRM" != "OUI" ]; then
  echo -e "${YELLOW}Annulé${RESET}"
  exit 0
fi

echo -e "\n${CYAN}═══ Arrêt des services applicatifs (la DB reste)${RESET}\n"
$DC stop api web pos kds client

echo -e "\n${CYAN}═══ Snapshot de sécurité de la DB actuelle${RESET}\n"
SAFETY_DUMP="$BACKUP_DIR/pre-restore-$(date +%Y%m%d-%H%M%S).sql.gz"
$DC exec -T postgres pg_dump -U "${POSTGRES_USER:-restaurant_user}" "${POSTGRES_DB:-restaurant_db}" | gzip > "$SAFETY_DUMP"
echo -e "${GREEN}✓ Sauvegarde de sécurité : $SAFETY_DUMP${RESET}"

echo -e "\n${CYAN}═══ Restauration${RESET}\n"
if [[ "$DUMP_FILE" == *.gz ]]; then
  gunzip -c "$DUMP_FILE" | $DC exec -T postgres psql -U "${POSTGRES_USER:-restaurant_user}" -d "${POSTGRES_DB:-restaurant_db}"
else
  cat "$DUMP_FILE" | $DC exec -T postgres psql -U "${POSTGRES_USER:-restaurant_user}" -d "${POSTGRES_DB:-restaurant_db}"
fi
echo -e "${GREEN}✓ Restauration terminée${RESET}"

echo -e "\n${CYAN}═══ Redémarrage des services${RESET}\n"
$DC up -d api web pos kds client

echo -e "\n${GREEN}✓ Restauration complète${RESET}"
echo -e "Snapshot de sécurité (avant restauration) : ${BOLD}$SAFETY_DUMP${RESET}"

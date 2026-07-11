#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/restore-tenant-backup.sh — Restaure la base d'un tenant depuis un dump
# créé par reset-tenant-sales.sh (backups/<db>-before-reset-*.sql.gz).
#
# ⚠️  ÉCRASE la base actuelle du tenant par le contenu du backup.
#
# Usage :
#   bash deploy/restore-tenant-backup.sh bar                # dernier backup
#   bash deploy/restore-tenant-backup.sh bar /chemin.sql.gz # backup précis
#
#   CONFIRM=bar  → saute la confirmation interactive.
# ═══════════════════════════════════════════════════════════════════════════

set -e

TENANT_SLUG="${1:-}"
BACKUP_FILE="${2:-}"
[ -n "$TENANT_SLUG" ] || { echo "Usage: bash deploy/restore-tenant-backup.sh <slug> [fichier.sql.gz]"; exit 1; }

BOLD="\033[1m"; GREEN="\033[0;32m"; CYAN="\033[0;36m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; RESET="\033[0m"
log()   { echo -e "${GREEN}✅ $1${RESET}"; }
warn()  { echo -e "${YELLOW}⚠️  $1${RESET}"; }
error() { echo -e "${RED}❌ $1${RESET}" >&2; exit 1; }
head()  { echo -e "\n${BOLD}${CYAN}═══ $1 ═══${RESET}\n"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"
[ -f .env.prod ] || error "fichier .env.prod manquant à la racine"
set -a; source .env.prod; set +a

PG_USER="${POSTGRES_USER:-restaurant_user}"
DC="docker compose -f $ROOT_DIR/docker-compose.prod.yml --env-file $ROOT_DIR/.env.prod"
DB="tenant_$(echo "$TENANT_SLUG" | tr '-' '_')"

# Backup le plus récent si non précisé.
if [ -z "$BACKUP_FILE" ]; then
  BACKUP_FILE="$(ls -t "$ROOT_DIR/backups/${DB}-before-reset-"*.sql.gz 2>/dev/null | head -1)"
  [ -n "$BACKUP_FILE" ] || error "Aucun backup trouvé dans $ROOT_DIR/backups/ pour $DB"
fi
[ -f "$BACKUP_FILE" ] || error "Fichier introuvable : $BACKUP_FILE"

head "Restauration — tenant $TENANT_SLUG ($DB)"
echo "  Backup : $BACKUP_FILE"
echo "  Taille : $(du -h "$BACKUP_FILE" | cut -f1)"
warn "La base actuelle de $DB sera ÉCRASÉE par ce backup."

if [ "$CONFIRM" != "$TENANT_SLUG" ]; then
  echo ""
  warn "Pour confirmer, tape le slug du tenant :"
  read -r ANSWER
  [ "$ANSWER" = "$TENANT_SLUG" ] || error "Confirmation invalide — abandon."
fi

# ── Recréation de la base (coupe les connexions actives via WITH FORCE) ──────
head "Recréation de la base"
$DC exec -T postgres psql -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB' AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true
$DC exec -T postgres psql -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 -c \
  "DROP DATABASE IF EXISTS \"$DB\" WITH (FORCE);" \
  || error "DROP DATABASE a échoué (connexions actives ?)"
$DC exec -T postgres psql -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 -c \
  "CREATE DATABASE \"$DB\";" || error "CREATE DATABASE a échoué"
log "Base recréée (vide)"

# ── Injection du dump ────────────────────────────────────────────────────────
head "Injection du dump"
gunzip -c "$BACKUP_FILE" | $DC exec -T postgres psql -U "$PG_USER" -d "$DB" -v ON_ERROR_STOP=1 >/dev/null \
  || error "La restauration a échoué"
log "Dump restauré"

# ── Redémarrage de l'API du tenant pour reconnexion propre ───────────────────
docker restart "tenant_${TENANT_SLUG}_api" >/dev/null 2>&1 && log "API tenant redémarrée" \
  || warn "Conteneur tenant_${TENANT_SLUG}_api non redémarré (à faire manuellement si besoin)"

head "Terminé"
log "Commandes   : $($DC exec -T postgres psql -U "$PG_USER" -d "$DB" -tAc 'SELECT COUNT(*) FROM orders' 2>/dev/null || echo '?')"
log "Paiements   : $($DC exec -T postgres psql -U "$PG_USER" -d "$DB" -tAc 'SELECT COUNT(*) FROM payments' 2>/dev/null || echo '?')"
log "Base $DB restaurée depuis $BACKUP_FILE"

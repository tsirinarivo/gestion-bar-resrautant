#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/purge-stock-range.sh — Supprime les données de STOCK d'une période :
# mouvements de stock, bons de commande (+ lignes), transferts (+ lignes),
# alertes de stock — dont la date de création est dans l'intervalle donné.
#
# NE touche PAS aux articles, ni aux ventes/paiements. NE recalcule PAS les
# quantités en stock (les quantités actuelles restent telles quelles).
#
# ⚠️  DESTRUCTEUR ET IRRÉVERSIBLE (sauf backup auto).
#
# Usage :
#   bash deploy/purge-stock-range.sh bar                       # 2026-06-24 → 2026-07-09
#   bash deploy/purge-stock-range.sh bar 2026-06-24 2026-07-09 # bornes explicites
#   CONFIRM=bar bash deploy/purge-stock-range.sh bar           # sans prompt
# ═══════════════════════════════════════════════════════════════════════════

set -e

TENANT_SLUG="${1:-}"
FROM="${2:-2026-06-24}"
TO="${3:-2026-07-09}"
[ -n "$TENANT_SLUG" ] || { echo "Usage: bash deploy/purge-stock-range.sh <slug> [from AAAA-MM-JJ] [to AAAA-MM-JJ]"; exit 1; }

BOLD="\033[1m"; GREEN="\033[0;32m"; CYAN="\033[0;36m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; RESET="\033[0m"
log()   { echo -e "${GREEN}✅ $1${RESET}"; }
warn()  { echo -e "${YELLOW}⚠️  $1${RESET}"; }
error() { echo -e "${RED}❌ $1${RESET}" >&2; exit 1; }
section() { echo -e "\n${BOLD}${CYAN}═══ $1 ═══${RESET}\n"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"
[ -f .env.prod ] || error "fichier .env.prod manquant à la racine"
set -a; source .env.prod; set +a

PG_USER="${POSTGRES_USER:-restaurant_user}"
DC="docker compose -f $ROOT_DIR/docker-compose.prod.yml --env-file $ROOT_DIR/.env.prod"
DB="tenant_$(echo "$TENANT_SLUG" | tr '-' '_')"

# Borne haute exclusive = jour suivant (inclut toute la journée $TO).
TO_EXCL="$(date -d "$TO + 1 day" +%Y-%m-%d 2>/dev/null)" || error "Date 'to' invalide : $TO"
RANGE="\"createdAt\" >= '$FROM' AND \"createdAt\" < '$TO_EXCL'"

psql_t() { $DC exec -T postgres psql -U "$PG_USER" -d "$DB" -tAc "$1"; }

$DC exec -T postgres psql -U "$PG_USER" -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='$DB'" | grep -q 1 || error "Base '$DB' introuvable"

section "Purge stock — $TENANT_SLUG ($DB) · du $FROM au $TO inclus"
echo "  Mouvements de stock : $(psql_t "SELECT COUNT(*) FROM stock_movements WHERE $RANGE")"
echo "  Bons de commande    : $(psql_t "SELECT COUNT(*) FROM purchase_orders WHERE $RANGE")"
echo "  Transferts          : $(psql_t "SELECT COUNT(*) FROM stock_transfers WHERE $RANGE")"
echo "  Alertes de stock    : $(psql_t "SELECT COUNT(*) FROM stock_alerts WHERE $RANGE")"

if [ "$CONFIRM" != "$TENANT_SLUG" ]; then
  echo ""
  warn "IRRÉVERSIBLE. Pour confirmer, tape le slug du tenant :"
  read -r ANSWER
  [ "$ANSWER" = "$TENANT_SLUG" ] || error "Confirmation invalide — abandon."
fi

# ── Backup ──────────────────────────────────────────────────────────────────
section "Sauvegarde de la base"
mkdir -p "$ROOT_DIR/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
DUMP="$ROOT_DIR/backups/${DB}-before-purge-${STAMP}.sql.gz"
$DC exec -T postgres pg_dump -U "$PG_USER" "$DB" | gzip > "$DUMP"
log "Backup : $DUMP"

# ── Suppression (les lignes de BDC/transfert partent en cascade) ─────────────
section "Suppression"
SQL="BEGIN;
DELETE FROM purchase_orders WHERE $RANGE;
DELETE FROM stock_transfers WHERE $RANGE;
DELETE FROM stock_alerts    WHERE $RANGE;
DELETE FROM stock_movements WHERE $RANGE;
COMMIT;"
echo "$SQL" | $DC exec -T postgres psql -U "$PG_USER" -d "$DB" -v ON_ERROR_STOP=1 \
  || error "Suppression échouée (transaction annulée)"

section "Terminé"
log "Mouvements restants (période) : $(psql_t "SELECT COUNT(*) FROM stock_movements WHERE $RANGE")"
log "Bons de commande restants (période) : $(psql_t "SELECT COUNT(*) FROM purchase_orders WHERE $RANGE")"
warn "Les quantités en stock n'ont PAS été recalculées — vérifie/réajuste les quantités des articles si besoin."

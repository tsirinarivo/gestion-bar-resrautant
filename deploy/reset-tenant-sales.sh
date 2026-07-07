#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/reset-tenant-sales.sh — Remet à zéro les VENTES / PAIEMENTS / STOCK
# d'un tenant, en conservant menu, produits, clients, employés, réglages.
#
# ⚠️  DESTRUCTEUR ET IRRÉVERSIBLE (sauf backup). À lancer sur le serveur.
#
# Usage :
#   bash deploy/reset-tenant-sales.sh bar
#
# Options (variables d'env) :
#   RESET_STOCK=history   → efface l'historique des mouvements (défaut),
#                           garde les quantités actuelles.
#   RESET_STOCK=quantities→ efface l'historique ET remet toutes les quantités à 0.
#   RESET_STOCK=none      → ne touche pas au stock.
#   RESET_RELATED=yes     → efface aussi caisse, dettes clients, points fidélité,
#                           factures (défaut). RESET_RELATED=no pour les garder.
#   BACKUP=yes            → dump la base AVANT (défaut). BACKUP=no pour sauter.
#   CONFIRM=<slug>        → saute la confirmation interactive (ex: CONFIRM=bar).
# ═══════════════════════════════════════════════════════════════════════════

set -e

TENANT_SLUG="${1:-${TENANT_SLUG:-}}"
[ -n "$TENANT_SLUG" ] || { echo "Usage: bash deploy/reset-tenant-sales.sh <slug>"; exit 1; }

RESET_STOCK="${RESET_STOCK:-history}"      # history | quantities | none
RESET_RELATED="${RESET_RELATED:-yes}"      # yes | no
BACKUP="${BACKUP:-yes}"                     # yes | no

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

psql_t() { $DC exec -T postgres psql -U "$PG_USER" -d "$DB" -tAc "$1"; }

$DC exec -T postgres psql -U "$PG_USER" -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='$DB'" | grep -q 1 \
  || error "Base '$DB' introuvable"

head "Remise à zéro — tenant $TENANT_SLUG ($DB)"
echo "  RESET_STOCK   = $RESET_STOCK"
echo "  RESET_RELATED = $RESET_RELATED"
echo "  BACKUP        = $BACKUP"
echo ""
echo "  Commandes    : $(psql_t 'SELECT COUNT(*) FROM orders')"
echo "  Paiements    : $(psql_t 'SELECT COUNT(*) FROM payments')"
echo "  Mouvements stock : $(psql_t 'SELECT COUNT(*) FROM stock_movements')"

if [ "$CONFIRM" != "$TENANT_SLUG" ]; then
  echo ""
  warn "Cette opération est IRRÉVERSIBLE. Pour confirmer, tape le slug du tenant :"
  read -r ANSWER
  [ "$ANSWER" = "$TENANT_SLUG" ] || error "Confirmation invalide — abandon."
fi

# ── Backup ──────────────────────────────────────────────────────────────────
if [ "$BACKUP" = "yes" ]; then
  head "Sauvegarde de la base"
  mkdir -p "$ROOT_DIR/backups"
  STAMP="$(date +%Y%m%d-%H%M%S)"
  DUMP="$ROOT_DIR/backups/${DB}-before-reset-${STAMP}.sql.gz"
  $DC exec -T postgres pg_dump -U "$PG_USER" "$DB" | gzip > "$DUMP"
  log "Backup : $DUMP"
fi

# ── Construction du SQL ─────────────────────────────────────────────────────
SQL="BEGIN;"

# Ventes + paiements (toujours). Ordre FK : enfants d'abord.
SQL="$SQL
DELETE FROM invoice_items;
DELETE FROM invoices;
DELETE FROM refunds;
DELETE FROM payments;
DELETE FROM order_item_modifiers;
DELETE FROM order_items;
DELETE FROM order_status_history;
DELETE FROM orders;"

# Données liées (optionnel).
if [ "$RESET_RELATED" = "yes" ]; then
  SQL="$SQL
DELETE FROM caisse_transactions;
DELETE FROM caisse_sessions;
DELETE FROM debt_payments;
DELETE FROM customer_debts;
DELETE FROM loyalty_transactions;
UPDATE loyalty_accounts SET points = 0, \"totalEarned\" = 0, \"totalSpent\" = 0;"
fi

# Stock.
if [ "$RESET_STOCK" = "history" ] || [ "$RESET_STOCK" = "quantities" ]; then
  SQL="$SQL
DELETE FROM stock_transfer_items;
DELETE FROM stock_transfers;
DELETE FROM stock_alerts;
DELETE FROM stock_movements;"
fi
if [ "$RESET_STOCK" = "quantities" ]; then
  SQL="$SQL
DELETE FROM stock_batches;
UPDATE stock_levels SET quantity = 0;
UPDATE stock_items SET \"currentQuantity\" = 0;"
fi

SQL="$SQL
COMMIT;"

# ── Exécution ───────────────────────────────────────────────────────────────
head "Effacement"
echo "$SQL" | $DC exec -T postgres psql -U "$PG_USER" -d "$DB" -v ON_ERROR_STOP=1 \
  || error "L'effacement a échoué (transaction annulée)"

# Libère les tables (statut AVAILABLE) et affiche l'état final.
$DC exec -T postgres psql -U "$PG_USER" -d "$DB" -c \
  "UPDATE dining_tables SET status='AVAILABLE' WHERE status <> 'AVAILABLE';" >/dev/null 2>&1 || true

head "Terminé"
log "Commandes restantes : $(psql_t 'SELECT COUNT(*) FROM orders')"
log "Paiements restants  : $(psql_t 'SELECT COUNT(*) FROM payments')"
log "Mouvements stock    : $(psql_t 'SELECT COUNT(*) FROM stock_movements')"
[ "$RESET_STOCK" = "quantities" ] && log "Quantités de stock remises à 0"
echo ""
log "Menu, produits, clients, employés et réglages CONSERVÉS."

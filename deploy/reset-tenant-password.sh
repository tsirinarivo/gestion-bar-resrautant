#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/reset-tenant-password.sh — Réinitialise le mot de passe d'un compte
# d'un tenant (utile si le mot de passe admin est oublié).
#
# Usage :
#   bash deploy/reset-tenant-password.sh bar                          # liste les comptes
#   bash deploy/reset-tenant-password.sh bar admin@bar.mg MonNouveau1 # réinitialise
# ═══════════════════════════════════════════════════════════════════════════

set -e

TENANT_SLUG="${1:-}"
EMAIL="${2:-}"
NEWPASS="${3:-}"
[ -n "$TENANT_SLUG" ] || { echo "Usage: bash deploy/reset-tenant-password.sh <slug> [email] [nouveau_mdp]"; exit 1; }

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

# ── Sans email : liste les comptes ───────────────────────────────────────────
if [ -z "$EMAIL" ]; then
  section "Comptes du tenant $TENANT_SLUG ($DB)"
  $DC exec -T postgres psql -U "$PG_USER" -d "$DB" -c \
    "SELECT u.email, r.name AS role, u.\"isActive\" FROM users u JOIN roles r ON r.id = u.\"roleId\" ORDER BY r.name;"
  echo ""
  warn "Pour réinitialiser : bash deploy/reset-tenant-password.sh $TENANT_SLUG <email> <nouveau_mdp>"
  exit 0
fi

[ -n "$NEWPASS" ] || error "Nouveau mot de passe manquant. Ex: bash deploy/reset-tenant-password.sh $TENANT_SLUG $EMAIL MonNouveau1"

# ── Conteneur API disposant de bcryptjs pour le hash ─────────────────────────
API_CTN="$(docker ps --format '{{.Names}}' | grep -E "^(restaurant_api|tenant_${TENANT_SLUG}_api)$" | head -1)"
[ -n "$API_CTN" ] || error "Aucun conteneur API en cours (restaurant_api / tenant_${TENANT_SLUG}_api)"

HASH="$(docker exec -i "$API_CTN" node -e 'console.log(require("bcryptjs").hashSync(process.argv[1], 10))' "$NEWPASS")"
[ -n "$HASH" ] || error "Échec du hash bcrypt"

section "Réinitialisation du mot de passe"
RESULT="$($DC exec -T postgres psql -U "$PG_USER" -d "$DB" -tAc \
  "UPDATE users SET \"passwordHash\"='$HASH', \"isActive\"=true WHERE LOWER(email)=LOWER('$EMAIL');")"

if echo "$RESULT" | grep -q "UPDATE 1"; then
  log "Mot de passe réinitialisé pour $EMAIL"
  log "Le compte est activé. Connecte-toi puis change le mot de passe dans les réglages."
elif echo "$RESULT" | grep -q "UPDATE 0"; then
  error "Aucun compte avec l'email '$EMAIL' dans $DB (lance sans email pour voir la liste)"
else
  echo "$RESULT"
fi

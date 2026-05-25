#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/master-init.sh — Initialise la DB master + crée le premier OWNER
#
# Usage: bash deploy/master-init.sh
# ═══════════════════════════════════════════════════════════════════════════

set -e

BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
RED="\033[0;31m"
YELLOW="\033[1;33m"
RESET="\033[0m"

log()    { echo -e "${GREEN}✅ $1${RESET}"; }
warn()   { echo -e "${YELLOW}⚠️  $1${RESET}"; }
error()  { echo -e "${RED}❌ $1${RESET}" >&2; exit 1; }
header() { echo -e "\n${BOLD}${CYAN}═══ $1 ═══${RESET}\n"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

[ -f .env.prod ] || error ".env.prod manquant"
set -a; source .env.prod; set +a

DC_MASTER="docker compose -f docker-compose.prod.yml --env-file .env.prod"
PG_USER="${POSTGRES_USER:-restaurant_user}"
MASTER_DB="${MASTER_DB_NAME:-master_db}"

header "Initialisation de la DB master"

# Créer la DB master si elle n'existe pas
$DC_MASTER exec -T postgres psql -U "$PG_USER" -d postgres -tc \
  "SELECT 1 FROM pg_database WHERE datname='$MASTER_DB'" \
  | grep -q 1 \
  || $DC_MASTER exec -T postgres psql -U "$PG_USER" -d postgres -c "CREATE DATABASE $MASTER_DB"

log "DB $MASTER_DB prête"

# Push schema Prisma master via image API (qui contient prisma)
MASTER_URL="postgresql://$PG_USER:$POSTGRES_PASSWORD@postgres:5432/$MASTER_DB"

docker run --rm \
  --network restaurant_internal \
  -v "$ROOT_DIR/packages/master-database/prisma:/schema" \
  -e MASTER_DATABASE_URL="$MASTER_URL" \
  restaurant_api:latest \
  sh -c "cp /schema/schema.prisma /tmp/schema.prisma && npx prisma db push --schema=/tmp/schema.prisma --accept-data-loss --skip-generate"

log "Schema master poussé"

header "Création du premier OWNER"

echo "Saisis les infos du compte super-admin (le tien)."
read -p "Email : " EMAIL
[ -z "$EMAIL" ] && error "Email obligatoire"
read -p "Nom : " NAME
[ -z "$NAME" ] && NAME="Owner"
read -s -p "Mot de passe (min 8 chars) : " PW; echo
[ ${#PW} -lt 8 ] && error "Mot de passe trop court"

# Hash bcrypt via node + insert via psql
HASH=$(docker run --rm restaurant_api:latest node -e "
const bcrypt = require('bcryptjs');
console.log(bcrypt.hashSync(process.argv[1], 10));
" "$PW")

ID=$(docker run --rm restaurant_api:latest node -e "
const { randomBytes } = require('crypto');
console.log('c' + randomBytes(12).toString('hex'));
")

$DC_MASTER exec -T postgres psql -U "$PG_USER" -d "$MASTER_DB" -c "
  INSERT INTO \"MasterUser\" (id, email, password, name, role, active, \"createdAt\", \"updatedAt\")
  VALUES ('$ID', '$EMAIL', '$HASH', '$NAME', 'OWNER', true, NOW(), NOW())
  ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, role = 'OWNER', active = true, \"updatedAt\" = NOW();
"

log "OWNER $EMAIL créé/mis à jour"

header "Master initialisée"

cat <<EOF

Connexion : https://master.sakafio.mg (à configurer dans Nginx)
Email     : $EMAIL
Password  : (celui que tu viens de saisir)

EOF

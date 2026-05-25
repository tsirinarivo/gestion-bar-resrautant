#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/fresh-start.sh — Démarrage fresh pour un nouveau client
#
# Wipe complet de la base puis création de :
#   - Les rôles système (superadmin/manager/caissier/serveur/cuisinier/client)
#   - 1 restaurant minimal (nom + slug)
#   - 1 compte superadmin
#
# Le client se connecte ensuite et configure TOUT via l'interface admin :
# menu, tables, employés, infos restaurant, etc.
#
# Backup pré-wipe automatique : ./backups/postgres/pre-fresh-*.sql.gz
#
# Usage: bash deploy/fresh-start.sh
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

header "RestaurantOS — Fresh start pour nouveau client"

if [ ! -f .env.prod ]; then
  error "Fichier .env.prod introuvable — exécuter depuis /opt/restaurant"
  exit 1
fi

set -a; source .env.prod; set +a
DC="docker compose -f docker-compose.prod.yml --env-file .env.prod"

# ── 1. Infos restaurant + admin ──────────────────────────────────────────────
header "Configuration"
echo "Saisis les infos de base (le client complétera le reste via l'interface)."
echo ""

read -p "Nom du restaurant : " RESTO_NAME
[ -z "$RESTO_NAME" ] && { error "Nom obligatoire"; exit 1; }

read -p "Slug (URL-friendly, ex: 'mon-resto') : " RESTO_SLUG
[ -z "$RESTO_SLUG" ] && { error "Slug obligatoire"; exit 1; }
if ! echo "$RESTO_SLUG" | grep -qE '^[a-z0-9-]+$'; then
  error "Slug invalide — utiliser uniquement minuscules, chiffres, tirets"
  exit 1
fi

echo ""
read -p "Email admin : " ADMIN_EMAIL
[ -z "$ADMIN_EMAIL" ] && { error "Email obligatoire"; exit 1; }

read -p "Prénom admin : " ADMIN_FIRST
read -p "Nom admin : " ADMIN_LAST
ADMIN_FIRST="${ADMIN_FIRST:-Admin}"
ADMIN_LAST="${ADMIN_LAST:-Principal}"

read -s -p "Mot de passe (min 8 caractères) : " ADMIN_PASSWORD; echo ""
read -s -p "Confirmer le mot de passe : " ADMIN_PASSWORD_2; echo ""

if [ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD_2" ]; then
  error "Les mots de passe ne correspondent pas"
  exit 1
fi
if [ ${#ADMIN_PASSWORD} -lt 8 ]; then
  error "Mot de passe trop court (min 8 caractères)"
  exit 1
fi

# ── 2. Dernière confirmation ─────────────────────────────────────────────────
header "Confirmation"
echo -e "${RED}${BOLD}⚠️  Toutes les données actuelles vont être SUPPRIMÉES.${RESET}"
echo ""
echo "  Base de données  : ${POSTGRES_DB:-restaurant_db}"
echo "  Nouveau resto    : $RESTO_NAME (slug: $RESTO_SLUG)"
echo "  Nouvel admin     : $ADMIN_EMAIL"
echo ""
read -p "Tape 'FRESH' en majuscules pour confirmer : " CONFIRM
if [ "$CONFIRM" != "FRESH" ]; then
  warn "Annulé — aucune modification effectuée"
  exit 0
fi

# ── 3. Backup pré-wipe ───────────────────────────────────────────────────────
header "1. Backup pré-wipe (filet de sécurité)"

mkdir -p ./backups/postgres
chmod -R 777 ./backups/postgres 2>/dev/null || true
STAMP=$(date +%Y%m%d-%H%M%S)
PRE_DUMP="./backups/postgres/pre-fresh-${STAMP}.sql.gz"

if $DC ps postgres 2>/dev/null | grep -q "Up"; then
  $DC exec -T postgres pg_dump -U "${POSTGRES_USER:-restaurant_user}" "${POSTGRES_DB:-restaurant_db}" 2>/dev/null | gzip > "$PRE_DUMP"
  SIZE=$(du -h "$PRE_DUMP" | cut -f1)
  log "Snapshot créé : $PRE_DUMP ($SIZE)"
else
  warn "Postgres non démarré — pas de backup possible (première installation ?)"
fi

# ── 4. Force-reset Prisma ────────────────────────────────────────────────────
header "2. Drop + recreate du schéma"
$DC run --rm \
  -e DATABASE_URL="postgresql://${POSTGRES_USER:-restaurant_user}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-restaurant_db}" \
  migrate sh -c "npx prisma db push --force-reset --accept-data-loss"
log "Schéma recréé — base vide"

# ── 5. Création des rôles + restaurant + admin via Prisma ───────────────────
header "3. Création des rôles, restaurant et admin"
$DC run --rm \
  -e DATABASE_URL="postgresql://${POSTGRES_USER:-restaurant_user}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-restaurant_db}" \
  -e RESTO_NAME="$RESTO_NAME" \
  -e RESTO_SLUG="$RESTO_SLUG" \
  -e ADMIN_EMAIL="$ADMIN_EMAIL" \
  -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  -e ADMIN_FIRST_NAME="$ADMIN_FIRST" \
  -e ADMIN_LAST_NAME="$ADMIN_LAST" \
  migrate sh -c "node dist/init-fresh.js"
log "Rôles, restaurant et admin créés"

# ── 6. Redémarrage + healthcheck ─────────────────────────────────────────────
header "4. Redémarrage API"
$DC restart api
sleep 10

if curl -sf http://127.0.0.1:4001/api/health > /dev/null; then
  log "API health OK"
else
  warn "API health check échoué — vérifier : $DC logs api"
fi

# ── 7. Récap ─────────────────────────────────────────────────────────────────
header "✨ Fresh start terminé !"

echo ""
echo -e "${BOLD}Restaurant :${RESET}"
echo "  Nom   : $RESTO_NAME"
echo "  Slug  : $RESTO_SLUG"
echo ""
echo -e "${BOLD}Connexion admin :${RESET}"
echo "  URL      : https://admin.sakafio.mg/login"
echo "  Email    : $ADMIN_EMAIL"
echo "  Password : (celui que tu as saisi)"
echo ""
echo -e "${BOLD}Prochaines étapes (côté client, via l'interface admin) :${RESET}"
echo "  1. Se connecter avec les identifiants ci-dessus"
echo "  2. Aller dans Paramètres → compléter les infos du restaurant (adresse, téléphone, horaires...)"
echo "  3. Créer les catégories du menu (Paramètres → Menu)"
echo "  4. Ajouter les produits"
echo "  5. Configurer les tables (Tables → Plan de salle)"
echo "  6. Créer les comptes employés (Employés)"
echo ""
if [ -f "$PRE_DUMP" ]; then
  echo -e "${BOLD}En cas de regret :${RESET}"
  echo "  bash deploy/restore-postgres.sh   # sélectionner $PRE_DUMP"
fi

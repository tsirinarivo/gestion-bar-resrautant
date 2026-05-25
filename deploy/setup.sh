#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/setup.sh — Installation automatique (zéro interaction)
# Usage: bash deploy/setup.sh
# ═══════════════════════════════════════════════════════════════════════════

set -e

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
RESET="\033[0m"

log()    { echo -e "${GREEN}✅ $1${RESET}"; }
warn()   { echo -e "${YELLOW}⚠️  $1${RESET}"; }
info()   { echo -e "${CYAN}ℹ️  $1${RESET}"; }
error()  { echo -e "${RED}❌ $1${RESET}"; exit 1; }
header() { echo -e "\n${BOLD}${CYAN}═══ $1 ═══${RESET}\n"; }

header "RestaurantOS — Déploiement automatique"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

DC="docker compose -f docker-compose.prod.yml --env-file .env.prod"

# ── 1. Vérifications ────────────────────────────────────────────────────────
header "1. Vérifications"

command -v docker  >/dev/null 2>&1 || error "Docker non installé"
docker compose version >/dev/null 2>&1 || error "Docker Compose plugin manquant"
command -v nginx   >/dev/null 2>&1 || error "Nginx non installé"
command -v certbot >/dev/null 2>&1 || error "Certbot non installé"

log "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
log "Nginx $(nginx -v 2>&1 | awk -F/ '{print $2}')"
log "Certbot $(certbot --version 2>&1 | awk '{print $2}')"

# ── 2. Fichier .env.prod ────────────────────────────────────────────────────
header "2. Variables d'environnement"

[ ! -f ".env.prod" ] && [ -f ".env.prod.example" ] && cp .env.prod.example .env.prod
[ ! -f ".env.prod" ] && error ".env.prod introuvable"
grep -q "CHANGEZ_CE_MOT_DE_PASSE" .env.prod && error ".env.prod contient encore les valeurs d'exemple !"

set -a; source .env.prod; set +a

[ -z "$POSTGRES_PASSWORD" ] && error "POSTGRES_PASSWORD manquant dans .env.prod"
[ -z "$REDIS_PASSWORD" ]    && error "REDIS_PASSWORD manquant dans .env.prod"
[ -z "$JWT_SECRET" ]        && error "JWT_SECRET manquant dans .env.prod"

log ".env.prod valide"

# ── 3. Build images ──────────────────────────────────────────────────────────
header "3. Build des images Docker (~10 min)"

$DC build \
  --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
  --build-arg NEXT_PUBLIC_SOCKET_URL="$NEXT_PUBLIC_SOCKET_URL"

log "Images buildées"

# ── 4. Démarrage services ────────────────────────────────────────────────────
header "4. Démarrage des services"

$DC up -d postgres redis
info "Attente PostgreSQL (15s)..."
sleep 15

$DC up -d api
info "Attente API (20s)..."
sleep 20

$DC up -d web pos kds client master
log "Tous les services démarrés"

# ── 5. Migrations ────────────────────────────────────────────────────────────
header "5. Migrations + Seed"

$DC run --rm migrate || warn "Seed ignoré (déjà fait ?)"
log "Base de données initialisée"

# ── 6. Nginx — configs (HTTP) ────────────────────────────────────────────────
header "6. Nginx — configs proxy"

DOMAINS=(
  "sakafio.mg"
  "admin.sakafio.mg"
  "pos.sakafio.mg"
  "kds.sakafio.mg"
  "api.sakafio.mg"
)

for DOMAIN in "${DOMAINS[@]}"; do
  cp "$SCRIPT_DIR/nginx/${DOMAIN}.conf" "/etc/nginx/sites-available/${DOMAIN}"
  ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}" 2>/dev/null || true
  log "Nginx : $DOMAIN"
done

nginx -t && nginx -s reload
log "Nginx rechargé"

# ── 7. Certbot — un seul certificat pour tous les domaines ──────────────────
header "7. Certificat SSL (Let's Encrypt)"

if certbot --nginx \
  -d sakafio.mg \
  -d admin.sakafio.mg \
  -d pos.sakafio.mg \
  -d kds.sakafio.mg \
  -d api.sakafio.mg \
  --non-interactive \
  --redirect; then
  log "Certificat SSL obtenu et Nginx mis à jour automatiquement"
else
  warn "Certbot échoué — les DNS ne sont pas encore propagés."
  warn "Une fois vos DNS créés, relancez : certbot --nginx -d sakafio.mg -d admin.sakafio.mg -d pos.sakafio.mg -d kds.sakafio.mg -d api.sakafio.mg --non-interactive --redirect"
fi

# ── 8. Vérification ──────────────────────────────────────────────────────────
header "8. Statut final"

$DC ps

echo ""
if curl -sk "https://api.sakafio.mg/api/health" 2>/dev/null | grep -q '"status":"ok"'; then
  log "API opérationnelle !"
else
  info "Test local : $(curl -s http://127.0.0.1:4001/api/health 2>/dev/null || echo 'API pas encore prête')"
  warn "Vérifiez les logs : docker logs restaurant_api --tail 30"
fi

echo ""
echo -e "${BOLD}${GREEN}🎉 Déploiement terminé !${RESET}"
echo ""
echo "  https://sakafio.mg        — Commandes client"
echo "  https://admin.sakafio.mg  — Back-office"
echo "  https://pos.sakafio.mg    — Caisse POS"
echo "  https://kds.sakafio.mg    — Cuisine KDS"
echo "  https://api.sakafio.mg    — API"
echo ""
echo "  manager@demo.com  / demo1234"
echo "  caissier@demo.com / demo1234"

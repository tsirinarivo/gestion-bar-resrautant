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
[ ! -f ".env.prod" ] && error ".env.prod introuvable — créez-le depuis .env.prod.example"
grep -q "CHANGEZ_CE_MOT_DE_PASSE" .env.prod && error ".env.prod contient encore les valeurs d'exemple !"

source .env.prod

[ -z "$POSTGRES_PASSWORD" ] && error "POSTGRES_PASSWORD manquant dans .env.prod"
[ -z "$REDIS_PASSWORD" ]    && error "REDIS_PASSWORD manquant dans .env.prod"
[ -z "$JWT_SECRET" ]        && error "JWT_SECRET manquant dans .env.prod"
[ -z "$CERTBOT_EMAIL" ]     && error "CERTBOT_EMAIL manquant dans .env.prod"

log ".env.prod valide"

# ── 3. Build images ──────────────────────────────────────────────────────────
header "3. Build des images Docker (~10 min)"

docker compose -f docker-compose.prod.yml build \
  --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
  --build-arg NEXT_PUBLIC_SOCKET_URL="$NEXT_PUBLIC_SOCKET_URL"

log "Images buildées"

# ── 4. Démarrage services ────────────────────────────────────────────────────
header "4. Démarrage des services"

docker compose -f docker-compose.prod.yml up -d postgres redis
info "Attente PostgreSQL (15s)..."
sleep 15

docker compose -f docker-compose.prod.yml up -d api
info "Attente API (20s)..."
sleep 20

docker compose -f docker-compose.prod.yml up -d web pos kds client
log "Tous les services démarrés"

# ── 5. Migrations ────────────────────────────────────────────────────────────
header "5. Migrations + Seed"

docker compose -f docker-compose.prod.yml run --rm migrate || warn "Seed ignoré (déjà fait ?)"
log "Base de données initialisée"

# ── 6. Nginx — configs HTTP provisoires pour certbot ────────────────────────
header "6. Nginx — configuration HTTP"

DOMAINS=(
  "restaurant.dago-it.com"
  "admin.restaurant.dago-it.com"
  "pos.restaurant.dago-it.com"
  "kds.restaurant.dago-it.com"
  "api.restaurant.dago-it.com"
)

for DOMAIN in "${DOMAINS[@]}"; do
  cat > "/etc/nginx/sites-available/${DOMAIN}" << NGINXEOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    root /var/www/html;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://\$host\$request_uri; }
}
NGINXEOF
  ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}" 2>/dev/null || true
  log "Nginx HTTP : $DOMAIN"
done

nginx -t && nginx -s reload

# ── 7. Certbot SSL ──────────────────────────────────────────────────────────
header "7. Certificats SSL (Let's Encrypt)"

for DOMAIN in "${DOMAINS[@]}"; do
  if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    log "Certificat déjà existant : $DOMAIN"
  else
    certbot certonly --nginx \
      -d "$DOMAIN" \
      --email "$CERTBOT_EMAIL" \
      --agree-tos \
      --non-interactive \
      --redirect && log "Certificat obtenu : $DOMAIN" || warn "Échec certbot : $DOMAIN (DNS propagé ?)"
  fi
done

# ── 8. Nginx — configs HTTPS finales ────────────────────────────────────────
header "8. Nginx — configuration HTTPS"

for DOMAIN in "${DOMAINS[@]}"; do
  CONF="$SCRIPT_DIR/nginx/${DOMAIN}.conf"
  [ ! -f "$CONF" ] && warn "Config manquante : $CONF" && continue
  cp "$CONF" "/etc/nginx/sites-available/${DOMAIN}"
  ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}" 2>/dev/null || true
  log "HTTPS activé : $DOMAIN"
done

nginx -t && nginx -s reload
log "Nginx rechargé"

# ── 9. Vérification ──────────────────────────────────────────────────────────
header "9. Statut final"

docker compose -f docker-compose.prod.yml ps

echo ""
if curl -sk "https://api.restaurant.dago-it.com/api/health" 2>/dev/null | grep -q '"status":"ok"'; then
  log "API opérationnelle !"
else
  info "API pas encore accessible via HTTPS (normal si DNS en propagation)"
  curl -s "http://127.0.0.1:4001/api/health" 2>/dev/null | grep -q '"status":"ok"' \
    && log "API opérationnelle en local (127.0.0.1:4001)" \
    || warn "API ne répond pas encore — vérifiez : docker logs restaurant_api"
fi

echo ""
echo -e "${BOLD}${GREEN}🎉 Déploiement terminé !${RESET}"
echo ""
echo "  https://restaurant.dago-it.com        — Commandes client"
echo "  https://admin.restaurant.dago-it.com  — Back-office"
echo "  https://pos.restaurant.dago-it.com    — Caisse POS"
echo "  https://kds.restaurant.dago-it.com    — Cuisine KDS"
echo "  https://api.restaurant.dago-it.com    — API"
echo ""
echo "  manager@demo.com  / demo1234"
echo "  caissier@demo.com / demo1234"

#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/setup.sh — Installation complète sur VPS (Nginx système + Certbot)
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

header "RestaurantOS — Installation VPS (Nginx système)"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ── 1. Vérifications ────────────────────────────────────────────────────────
header "1. Vérifications système"

command -v docker >/dev/null 2>&1 || error "Docker n'est pas installé."
docker compose version >/dev/null 2>&1 || error "Docker Compose plugin non disponible."
command -v nginx >/dev/null 2>&1   || error "Nginx système non installé (requis sur ce VPS)."
command -v certbot >/dev/null 2>&1 || error "Certbot non installé. Installez-le : apt install certbot python3-certbot-nginx"

log "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
log "Nginx $(nginx -v 2>&1 | awk -F/ '{print $2}')"
log "Certbot $(certbot --version 2>&1 | awk '{print $2}')"

# ── 2. Fichier .env.prod ────────────────────────────────────────────────────
header "2. Configuration des variables d'environnement"

cd "$PROJECT_DIR"

if [ ! -f ".env.prod" ]; then
  if [ -f ".env.prod.example" ]; then
    cp .env.prod.example .env.prod
    warn ".env.prod créé depuis l'exemple. ÉDITEZ LE MAINTENANT !"
    warn "Commande : nano .env.prod"
    echo ""
    read -p "Appuyez sur Entrée après avoir édité .env.prod..." _
  else
    error ".env.prod.example introuvable. Lancez ce script depuis la racine du projet."
  fi
else
  log ".env.prod existe déjà"
fi

if grep -q "CHANGEZ_CE_MOT_DE_PASSE" .env.prod; then
  error ".env.prod contient encore des valeurs d'exemple ! Éditez le fichier d'abord."
fi

source .env.prod

# ── 3. Vérification des ports ───────────────────────────────────────────────
header "3. Vérification des ports"

PORTS=(4001 4002 4003 4004 4005)
CONFLICT=0
for PORT in "${PORTS[@]}"; do
  if ss -tlnp 2>/dev/null | grep -q ":${PORT}"; then
    warn "Port ${PORT} déjà occupé !"
    CONFLICT=1
  fi
done

if [ "$CONFLICT" -eq 1 ]; then
  error "Des ports sont occupés. Vérifiez avec : ss -tlnp | grep '400[1-5]'"
fi
log "Ports 4001-4005 disponibles"

# ── 4. DNS — vérification avant certbot ────────────────────────────────────
header "4. Vérification DNS"

DOMAINS=(
  "restaurant.dago-it.com"
  "admin.restaurant.dago-it.com"
  "pos.restaurant.dago-it.com"
  "kds.restaurant.dago-it.com"
  "api.restaurant.dago-it.com"
)

SERVER_IP=$(curl -s --max-time 5 ifconfig.me || hostname -I | awk '{print $1}')
DNS_OK=1

for DOMAIN in "${DOMAINS[@]}"; do
  RESOLVED=$(dig +short "$DOMAIN" 2>/dev/null | tail -1)
  if [ "$RESOLVED" = "$SERVER_IP" ]; then
    log "DNS OK : $DOMAIN → $RESOLVED"
  else
    warn "DNS non résolu : $DOMAIN → '$RESOLVED' (attendu: $SERVER_IP)"
    DNS_OK=0
  fi
done

if [ "$DNS_OK" -eq 0 ]; then
  echo ""
  warn "Certains DNS ne pointent pas encore vers ce serveur ($SERVER_IP)."
  warn "Certbot va échouer si les DNS ne sont pas propagés."
  echo ""
  read -p "Continuer quand même ? (DNS peut prendre 5-30 min) [o/N] " force_dns
  [[ "$force_dns" =~ ^[Oo]$ ]] || error "Annulé. Configurez les DNS d'abord."
fi

# ── 5. Build des images Docker ──────────────────────────────────────────────
header "5. Build des images Docker (~10 min)"

docker compose -f docker-compose.prod.yml build \
  --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
  --build-arg NEXT_PUBLIC_SOCKET_URL="$NEXT_PUBLIC_SOCKET_URL"

log "Toutes les images buildées"

# ── 6. Lancement des services ───────────────────────────────────────────────
header "6. Lancement des services"

docker compose -f docker-compose.prod.yml up -d postgres redis
info "Attente PostgreSQL..."
sleep 15

docker compose -f docker-compose.prod.yml up -d api
info "Attente API..."
sleep 20

docker compose -f docker-compose.prod.yml up -d web pos kds client
log "Tous les services démarrés"

# ── 7. Migrations & Seed ────────────────────────────────────────────────────
header "7. Migrations base de données"

read -p "Exécuter les migrations + seed (données démo) ? [o/N] " run_seed
if [[ "$run_seed" =~ ^[Oo]$ ]]; then
  docker compose -f docker-compose.prod.yml run --rm migrate
  log "Base de données initialisée"
fi

# ── 8. Configuration Nginx ──────────────────────────────────────────────────
header "8. Configuration Nginx (sans SSL — avant certbot)"

NGINX_AVAILABLE="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"
NGINX_DIR="$SCRIPT_DIR/nginx"

for DOMAIN in "${DOMAINS[@]}"; do
  CONF_FILE="$NGINX_DIR/${DOMAIN}.conf"
  if [ ! -f "$CONF_FILE" ]; then
    warn "Fichier manquant : $CONF_FILE — ignoré"
    continue
  fi

  # Copie temporaire HTTP-only pour permettre à certbot de valider
  cat > "$NGINX_AVAILABLE/${DOMAIN}" << NGINXEOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    root /var/www/html;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://\$host\$request_uri; }
}
NGINXEOF

  ln -sf "$NGINX_AVAILABLE/${DOMAIN}" "$NGINX_ENABLED/${DOMAIN}" 2>/dev/null || true
  log "Nginx HTTP provisoire : $DOMAIN"
done

nginx -t && nginx -s reload
log "Nginx rechargé"

# ── 9. Certbot SSL ──────────────────────────────────────────────────────────
header "9. Certificats SSL (Let's Encrypt)"

EMAIL="${CERTBOT_EMAIL:-}"
if [ -z "$EMAIL" ]; then
  read -p "Email pour Let's Encrypt (notifications expiration) : " EMAIL
fi

for DOMAIN in "${DOMAINS[@]}"; do
  if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    log "Certificat déjà existant : $DOMAIN"
  else
    info "Génération certificat : $DOMAIN"
    certbot certonly --nginx \
      -d "$DOMAIN" \
      --email "$EMAIL" \
      --agree-tos \
      --non-interactive \
      --redirect || warn "Échec certbot pour $DOMAIN — continuez manuellement"
    log "Certificat obtenu : $DOMAIN"
  fi
done

# ── 10. Activation des configs Nginx finales (HTTPS) ───────────────────────
header "10. Activation Nginx HTTPS"

for DOMAIN in "${DOMAINS[@]}"; do
  CONF_FILE="$NGINX_DIR/${DOMAIN}.conf"
  if [ ! -f "$CONF_FILE" ]; then
    continue
  fi
  cp "$CONF_FILE" "$NGINX_AVAILABLE/${DOMAIN}"
  ln -sf "$NGINX_AVAILABLE/${DOMAIN}" "$NGINX_ENABLED/${DOMAIN}" 2>/dev/null || true
  log "Config HTTPS activée : $DOMAIN"
done

nginx -t && nginx -s reload
log "Nginx rechargé avec SSL"

# ── 11. Vérification finale ─────────────────────────────────────────────────
header "11. Vérification"

sleep 5
docker compose -f docker-compose.prod.yml ps

echo ""
log "Test API..."
if curl -sk "https://api.restaurant.dago-it.com/api/health" 2>/dev/null | grep -q '"status":"ok"'; then
  log "API répond correctement !"
else
  warn "L'API ne répond pas encore (normal si les DNS/migrations sont en cours)"
  info "Testez manuellement : curl http://127.0.0.1:4001/api/health"
fi

echo ""
echo -e "${BOLD}${GREEN}🎉 Installation terminée !${RESET}"
echo ""
echo -e "${CYAN}URLs de l'application :${RESET}"
echo "  Client     : https://restaurant.dago-it.com"
echo "  Back-office: https://admin.restaurant.dago-it.com"
echo "  POS        : https://pos.restaurant.dago-it.com"
echo "  KDS        : https://kds.restaurant.dago-it.com"
echo "  API        : https://api.restaurant.dago-it.com/api/health"
echo ""
echo "Comptes de démonstration :"
echo "  Manager   : manager@demo.com  / demo1234"
echo "  Caissier  : caissier@demo.com / demo1234"
echo "  Cuisinier : cuisinier@demo.com/ demo1234"

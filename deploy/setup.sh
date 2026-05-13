#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/setup.sh — Script d'installation complète sur VPS
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

header "RestaurantOS — Installation VPS"

# ── 1. Vérifications ────────────────────────────────────────────────────────
header "1. Vérifications système"

command -v docker >/dev/null 2>&1 || error "Docker n'est pas installé. Installez-le d'abord."
command -v docker-compose >/dev/null 2>&1 || command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 || error "Docker Compose n'est pas disponible."

log "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
log "Docker Compose disponible"

# ── 2. Fichier .env.prod ────────────────────────────────────────────────────
header "2. Configuration des variables d'environnement"

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

# Vérifier que les mots de passe ont été changés
if grep -q "CHANGEZ_CE_MOT_DE_PASSE" .env.prod; then
  error ".env.prod contient encore des valeurs d'exemple ! Éditez le fichier d'abord."
fi

# ── 3. Réseau Docker pour NPM ───────────────────────────────────────────────
header "3. Réseau Docker (Nginx Proxy Manager)"

if docker network ls | grep -q "npm_proxy"; then
  log "Réseau npm_proxy déjà existant"
else
  docker network create npm_proxy
  log "Réseau npm_proxy créé"
fi

# ── 4. Nginx Proxy Manager ──────────────────────────────────────────────────
header "4. Nginx Proxy Manager"

if docker ps | grep -q "nginx-proxy-manager\|npm_app\|nginxproxymanager"; then
  log "Nginx Proxy Manager est déjà en cours d'exécution"
  info "Interface admin : http://$(curl -s ifconfig.me):81"
else
  warn "Nginx Proxy Manager non détecté. Installation..."

  mkdir -p /opt/nginx-proxy-manager/data /opt/nginx-proxy-manager/letsencrypt
  cat > /opt/nginx-proxy-manager/docker-compose.yml << 'NPMEOF'
version: '3.8'
services:
  npm:
    image: jc21/nginx-proxy-manager:latest
    container_name: nginx-proxy-manager
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "81:81"
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
    networks:
      - npm_proxy

networks:
  npm_proxy:
    external: true
NPMEOF

  cd /opt/nginx-proxy-manager
  docker compose up -d
  cd - > /dev/null

  log "Nginx Proxy Manager installé !"
  info "Interface admin : http://$(curl -s ifconfig.me):81"
  info "Email par défaut : admin@example.com"
  info "Mot de passe par défaut : changeme"
  echo ""
  warn "IMPORTANT: Changez le mot de passe admin NPM dès la première connexion !"
  echo ""
  read -p "NPM démarré. Appuyez sur Entrée pour continuer..." _
fi

# ── 5. Build des images Docker ──────────────────────────────────────────────
header "5. Build des images Docker (patientez ~5-10 min)"

source .env.prod

docker compose -f docker-compose.prod.yml build \
  --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
  --build-arg NEXT_PUBLIC_SOCKET_URL="$NEXT_PUBLIC_SOCKET_URL"

log "Toutes les images buildées avec succès"

# ── 6. Lancement des services ───────────────────────────────────────────────
header "6. Lancement des services"

docker compose -f docker-compose.prod.yml up -d postgres redis
info "Attente que PostgreSQL soit prêt..."
sleep 15

docker compose -f docker-compose.prod.yml up -d api
info "Attente que l'API soit prête..."
sleep 20

docker compose -f docker-compose.prod.yml up -d web pos kds client

log "Tous les services démarrés !"

# ── 7. Migrations & Seed ────────────────────────────────────────────────────
header "7. Migrations base de données"

echo ""
read -p "Exécuter les migrations et le seed (données de démo) ? [o/N] " run_seed

if [[ "$run_seed" =~ ^[Oo]$ ]]; then
  docker compose -f docker-compose.prod.yml run --rm migrate
  log "Base de données initialisée avec les données de démonstration"
fi

# ── 8. Vérification ─────────────────────────────────────────────────────────
header "8. Vérification des services"

sleep 10
docker compose -f docker-compose.prod.yml ps

echo ""
log "Vérification de l'API..."
if docker exec restaurant_api wget -qO- http://localhost:4000/api/health 2>/dev/null | grep -q '"status":"ok"'; then
  log "API répond correctement !"
else
  warn "L'API ne répond pas encore (normal si les migrations sont en cours)"
fi

# ── 9. Instructions NPM ─────────────────────────────────────────────────────
header "9. Configuration Nginx Proxy Manager"

SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo -e "${BOLD}Connectez-vous à NPM : http://${SERVER_IP}:81${RESET}"
echo ""
echo "Créez ces 4 Proxy Hosts dans NPM :"
echo ""
echo -e "${CYAN}┌─────────────────────────────────────────────────────────────────┐${RESET}"
echo -e "${CYAN}│ Domaine                          → Forward  Host    Port        │${RESET}"
echo -e "${CYAN}├─────────────────────────────────────────────────────────────────┤${RESET}"
echo -e "${CYAN}│ restaurant.dago-it.com           → restaurant_client  3003      │${RESET}"
echo -e "${CYAN}│ admin.restaurant.dago-it.com     → restaurant_web     3000      │${RESET}"
echo -e "${CYAN}│ pos.restaurant.dago-it.com       → restaurant_pos     3001      │${RESET}"
echo -e "${CYAN}│ kds.restaurant.dago-it.com       → restaurant_kds     3002      │${RESET}"
echo -e "${CYAN}│ api.restaurant.dago-it.com       → restaurant_api     4000      │${RESET}"
echo -e "${CYAN}└─────────────────────────────────────────────────────────────────┘${RESET}"
echo ""
echo "Pour chaque entrée :"
echo "  ✓ Activer 'SSL' → Let's Encrypt → Email → Force SSL"
echo "  ✓ Activer 'Websockets Support' (surtout pour l'API)"
echo ""
echo -e "${GREEN}${BOLD}🎉 Installation terminée !${RESET}"
echo ""
echo "Comptes de démonstration :"
echo "  Manager  : manager@demo.com  / demo1234"
echo "  Caissier : caissier@demo.com / demo1234"
echo "  Cuisinier: cuisinier@demo.com/ demo1234"

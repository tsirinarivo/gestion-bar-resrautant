#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/migrate-to-sakafio.sh — Migration restaurant.dago-it.com → sakafio.mg
#
# Ce script gère la transition en 2 phases :
#
#   Phase A (par défaut, sans argument) :
#     - Restaure le service sur l'ancien domaine (restaurant.dago-it.com)
#     - Configure nginx en dual-domain (les 2 noms répondent)
#     - À lancer MAINTENANT pour réparer la prod
#
#   Phase B (avec argument "switch") :
#     - Bascule l'API/frontends sur sakafio.mg
#     - Émet les certs Let's Encrypt pour sakafio.mg
#     - À lancer QUAND sakafio.mg est acheté + DNS propagés
#
# Usage:
#   bash deploy/migrate-to-sakafio.sh          # Phase A — restaure dago-it.com
#   bash deploy/migrate-to-sakafio.sh switch   # Phase B — bascule sur sakafio.mg
# ═══════════════════════════════════════════════════════════════════════════

set -e

BOLD="\033[1m"; GREEN="\033[0;32m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; CYAN="\033[0;36m"; RESET="\033[0m"
log()    { echo -e "${GREEN}✅ $1${RESET}"; }
warn()   { echo -e "${YELLOW}⚠️  $1${RESET}"; }
error()  { echo -e "${RED}❌ $1${RESET}"; exit 1; }
header() { echo -e "\n${BOLD}${CYAN}═══ $1 ═══${RESET}\n"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

PHASE="${1:-restore}"

# ── Vérifs ─────────────────────────────────────────────────────────────────
[ ! -f ".env.prod" ] && error ".env.prod introuvable"
command -v nginx >/dev/null || error "Nginx non installé"
command -v certbot >/dev/null || error "Certbot non installé"

# ────────────────────────────────────────────────────────────────────────────
# PHASE A — Restauration sur l'ancien domaine + dual-domain nginx
# ────────────────────────────────────────────────────────────────────────────
if [ "$PHASE" = "restore" ]; then
  header "PHASE A — Restauration prod sur restaurant.dago-it.com"

  # ── 1. Nettoyer les anciennes configs nginx cassées ──────────────────────
  header "1. Nettoyage configs nginx cassées"
  for f in /etc/nginx/sites-enabled/*restaurant.dago-it.com* /etc/nginx/sites-available/*restaurant.dago-it.com*; do
    [ -e "$f" ] || [ -L "$f" ] || continue
    rm -f "$f"
    log "Supprimé : $f"
  done

  # ── 2. Installer les nouvelles configs nginx (dual-domain) ───────────────
  header "2. Installation configs nginx dual-domain (sakafio.mg + dago-it.com)"
  for DOMAIN in sakafio.mg admin.sakafio.mg pos.sakafio.mg kds.sakafio.mg api.sakafio.mg master.sakafio.mg; do
    SRC="$SCRIPT_DIR/nginx/${DOMAIN}.conf"
    DST="/etc/nginx/sites-available/${DOMAIN}.conf"
    LNK="/etc/nginx/sites-enabled/${DOMAIN}.conf"
    [ ! -f "$SRC" ] && error "Fichier source manquant : $SRC"
    cp "$SRC" "$DST"
    ln -sf "$DST" "$LNK"
    log "Installé : $DOMAIN.conf"
  done

  # ── 3. Restaurer .env.prod sur l'ancien domaine ──────────────────────────
  header "3. Restauration .env.prod sur restaurant.dago-it.com"
  cp .env.prod .env.prod.bak-$(date +%Y%m%d-%H%M%S)
  log "Backup .env.prod créé"
  sed -i \
    -e 's|https://api\.sakafio\.mg|https://api.restaurant.dago-it.com|g' \
    -e 's|https://master\.sakafio\.mg|https://master.restaurant.dago-it.com|g' \
    -e 's|https://admin\.sakafio\.mg|https://admin.restaurant.dago-it.com|g' \
    -e 's|https://pos\.sakafio\.mg|https://pos.restaurant.dago-it.com|g' \
    -e 's|https://kds\.sakafio\.mg|https://kds.restaurant.dago-it.com|g' \
    -e 's|https://sakafio\.mg|https://restaurant.dago-it.com|g' \
    -e 's|@sakafio\.mg|@restaurant.dago-it.com|g' \
    .env.prod
  log ".env.prod restauré sur dago-it.com"

  # ── 4. Test nginx ────────────────────────────────────────────────────────
  header "4. Test config nginx"
  if ! nginx -t 2>&1; then
    error "nginx -t a échoué — voir messages ci-dessus"
  fi
  log "nginx -t OK"

  # ── 5. Reload nginx (HTTP plain pour l'instant, certbot va réémettre) ───
  header "5. Reload nginx"
  systemctl reload nginx
  log "Nginx rechargé"

  # ── 6. Réémettre certbot pour restaurant.dago-it.com ─────────────────────
  # (les certs existent encore dans /etc/letsencrypt, mais les nouveaux fichiers
  #  nginx sont en HTTP plain — certbot va injecter SSL automatiquement)
  header "6. Réémission SSL pour dago-it.com (les certs existants seront réutilisés)"
  if certbot --nginx \
    -d restaurant.dago-it.com \
    -d admin.restaurant.dago-it.com \
    -d pos.restaurant.dago-it.com \
    -d kds.restaurant.dago-it.com \
    -d api.restaurant.dago-it.com \
    -d master.restaurant.dago-it.com \
    --non-interactive --agree-tos --redirect --keep-until-expiring; then
    log "SSL OK sur dago-it.com"
  else
    warn "Certbot a échoué — vérifier manuellement"
  fi

  # ── 7. Rebuild des frontends Docker avec les URLs dago-it.com ────────────
  header "7. Rebuild frontends avec dago-it.com dans le bundle JS"
  DC="docker compose -f docker-compose.prod.yml --env-file .env.prod"
  $DC build web pos kds client master
  $DC up -d web pos kds client master
  log "Frontends rebuildés et redémarrés"

  # ── 8. Test final ────────────────────────────────────────────────────────
  header "8. Test final"
  sleep 5
  if curl -sk "https://api.restaurant.dago-it.com/api/health" 2>/dev/null | grep -q '"status":"ok"'; then
    log "API opérationnelle sur https://api.restaurant.dago-it.com"
  else
    warn "API ne répond pas via le domaine — fallback test local..."
    curl -s http://127.0.0.1:4001/api/health || warn "API locale aussi KO"
  fi

  echo ""
  echo -e "${BOLD}${GREEN}🎉 Phase A terminée — la prod tourne à nouveau sur dago-it.com${RESET}"
  echo ""
  echo "Quand sakafio.mg sera prêt (domaine acheté + DNS propagés), lancer :"
  echo "  bash deploy/migrate-to-sakafio.sh switch"
  exit 0
fi

# ────────────────────────────────────────────────────────────────────────────
# PHASE B — Bascule sur sakafio.mg
# ────────────────────────────────────────────────────────────────────────────
if [ "$PHASE" = "switch" ]; then
  header "PHASE B — Bascule vers sakafio.mg"

  # ── 1. Vérifier que les DNS sakafio.mg pointent bien vers ce serveur ────
  header "1. Vérification DNS sakafio.mg"
  SERVER_IP=$(curl -s ifconfig.me)
  log "IP serveur : $SERVER_IP"
  for d in sakafio.mg admin.sakafio.mg pos.sakafio.mg kds.sakafio.mg api.sakafio.mg master.sakafio.mg; do
    RESOLVED=$(dig +short "$d" | tail -1)
    if [ "$RESOLVED" = "$SERVER_IP" ]; then
      log "$d → $RESOLVED ✓"
    else
      warn "$d → $RESOLVED (attendu $SERVER_IP) — DNS pas encore propagé ?"
    fi
  done
  read -p "Continuer la bascule ? (y/N) " -n 1 -r; echo
  [[ ! $REPLY =~ ^[Yy]$ ]] && exit 0

  # ── 2. Basculer .env.prod sur sakafio.mg ─────────────────────────────────
  header "2. Bascule .env.prod sur sakafio.mg"
  cp .env.prod .env.prod.bak-$(date +%Y%m%d-%H%M%S)
  sed -i \
    -e 's|https://api\.restaurant\.dago-it\.com|https://api.sakafio.mg|g' \
    -e 's|https://master\.restaurant\.dago-it\.com|https://master.sakafio.mg|g' \
    -e 's|https://admin\.restaurant\.dago-it\.com|https://admin.sakafio.mg|g' \
    -e 's|https://pos\.restaurant\.dago-it\.com|https://pos.sakafio.mg|g' \
    -e 's|https://kds\.restaurant\.dago-it\.com|https://kds.sakafio.mg|g' \
    -e 's|https://restaurant\.dago-it\.com|https://sakafio.mg|g' \
    -e 's|@restaurant\.dago-it\.com|@sakafio.mg|g' \
    .env.prod
  log ".env.prod basculé sur sakafio.mg"

  # ── 3. Émettre les certs Let's Encrypt pour sakafio.mg ──────────────────
  header "3. Émission SSL pour sakafio.mg"
  certbot --nginx --expand \
    -d sakafio.mg \
    -d admin.sakafio.mg \
    -d pos.sakafio.mg \
    -d kds.sakafio.mg \
    -d api.sakafio.mg \
    -d master.sakafio.mg \
    -d restaurant.dago-it.com \
    -d admin.restaurant.dago-it.com \
    -d pos.restaurant.dago-it.com \
    -d kds.restaurant.dago-it.com \
    -d api.restaurant.dago-it.com \
    -d master.restaurant.dago-it.com \
    --non-interactive --agree-tos --redirect --keep-until-expiring
  log "SSL OK sur sakafio.mg (et dago-it.com toujours actif en parallèle)"

  # ── 4. Rebuild frontends avec les nouvelles URLs ────────────────────────
  header "4. Rebuild frontends avec sakafio.mg"
  DC="docker compose -f docker-compose.prod.yml --env-file .env.prod"
  $DC build web pos kds client master
  $DC up -d web pos kds client master
  log "Frontends rebuildés"

  # ── 5. Test ─────────────────────────────────────────────────────────────
  header "5. Tests"
  sleep 5
  curl -sk "https://api.sakafio.mg/api/health" | grep -q '"status":"ok"' && log "API OK sur sakafio.mg" || warn "API KO"
  curl -sk "https://api.restaurant.dago-it.com/api/health" | grep -q '"status":"ok"' && log "API OK sur dago-it.com (dual-domain)" || warn "API KO sur dago-it.com"

  echo ""
  echo -e "${BOLD}${GREEN}🎉 Phase B terminée — sakafio.mg est le domaine principal${RESET}"
  echo ""
  echo "L'ancien domaine restaurant.dago-it.com reste actif (dual-domain)."
  echo "Pour retirer dago-it.com plus tard :"
  echo "  - Éditer manuellement les fichiers /etc/nginx/sites-available/*.sakafio.mg.conf"
  echo "  - Retirer les server_name *.restaurant.dago-it.com"
  echo "  - nginx -t && systemctl reload nginx"
  exit 0
fi

error "Phase inconnue : $PHASE — utiliser 'restore' (défaut) ou 'switch'"

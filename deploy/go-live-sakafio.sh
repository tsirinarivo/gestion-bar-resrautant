#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/go-live-sakafio.sh — Bascule directe vers sakafio.mg
#
# Prérequis :
#   - Domaine sakafio.mg acheté chez nic.mg
#   - DNS configurés et propagés :
#       A   @ admin pos kds api master   → IP du VPS
#       A   *                            → IP du VPS (wildcard tenants)
#
# Vérification rapide avant de lancer :
#   dig +short sakafio.mg admin.sakafio.mg api.sakafio.mg
#
# Usage :
#   bash deploy/go-live-sakafio.sh
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

DOMAINS=(sakafio.mg admin.sakafio.mg pos.sakafio.mg kds.sakafio.mg api.sakafio.mg master.sakafio.mg)

# ── Vérifs préalables ───────────────────────────────────────────────────────
header "0. Vérifications"
[ ! -f ".env.prod" ] && error ".env.prod introuvable"
command -v nginx >/dev/null || error "Nginx non installé"
command -v certbot >/dev/null || error "Certbot non installé"
command -v docker >/dev/null || error "Docker non installé"
command -v dig >/dev/null || error "dnsutils manquant (apt install dnsutils)"

SERVER_IP=$(curl -s ifconfig.me)
log "IP serveur : $SERVER_IP"

# ── 1. Vérification DNS ─────────────────────────────────────────────────────
header "1. Vérification DNS sakafio.mg"
DNS_OK=true
for d in "${DOMAINS[@]}"; do
  RESOLVED=$(dig +short "$d" | tail -1)
  if [ "$RESOLVED" = "$SERVER_IP" ]; then
    log "$d → $RESOLVED ✓"
  else
    warn "$d → ${RESOLVED:-(rien)} (attendu $SERVER_IP)"
    DNS_OK=false
  fi
done

if [ "$DNS_OK" = false ]; then
  warn "Certains DNS ne pointent pas vers ce serveur."
  warn "Sur nic.mg : créer enregistrements A pour @, admin, pos, kds, api, master → $SERVER_IP"
  warn "Et un A '*' (wildcard) pour les sous-domaines tenants."
  read -p "Continuer quand même ? (y/N) " -n 1 -r; echo
  [[ ! $REPLY =~ ^[Yy]$ ]] && exit 0
fi

# ── 2. Nettoyage anciennes configs nginx (dago-it.com cassées) ─────────────
header "2. Nettoyage anciennes configs nginx"
CLEANED=0
for f in /etc/nginx/sites-enabled/*restaurant.dago-it.com* /etc/nginx/sites-available/*restaurant.dago-it.com*; do
  [ -e "$f" ] || [ -L "$f" ] || continue
  rm -f "$f"
  log "Supprimé : $f"
  CLEANED=$((CLEANED+1))
done
[ "$CLEANED" -eq 0 ] && log "Rien à nettoyer"

# ── 3. Installation des configs sakafio.mg ──────────────────────────────────
header "3. Installation configs nginx sakafio.mg"
for DOMAIN in "${DOMAINS[@]}"; do
  SRC="$SCRIPT_DIR/nginx/${DOMAIN}.conf"
  DST="/etc/nginx/sites-available/${DOMAIN}.conf"
  LNK="/etc/nginx/sites-enabled/${DOMAIN}.conf"
  [ ! -f "$SRC" ] && error "Fichier source manquant : $SRC"
  cp "$SRC" "$DST"
  ln -sf "$DST" "$LNK"
  log "Installé : $DOMAIN.conf"
done

# ── 4. Bascule .env.prod vers sakafio.mg ────────────────────────────────────
header "4. Bascule .env.prod vers sakafio.mg"
cp .env.prod ".env.prod.bak-$(date +%Y%m%d-%H%M%S)"
log "Backup .env.prod créé"
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
grep -E "URL|ORIGIN|EMAIL_FROM" .env.prod | head -10

# ── 5. Test nginx config ────────────────────────────────────────────────────
header "5. Test config nginx"
nginx -t 2>&1 || error "nginx -t a échoué — voir messages ci-dessus"
log "nginx -t OK"

# ── 6. Reload nginx (HTTP plain, prêt pour certbot) ─────────────────────────
header "6. Reload nginx"
systemctl reload nginx
log "Nginx rechargé"

# ── 7. Émettre certs Let's Encrypt ──────────────────────────────────────────
header "7. Certificats SSL Let's Encrypt"
CERTBOT_EMAIL=$(grep -E '^CERTBOT_EMAIL=' .env.prod | cut -d= -f2)
[ -z "$CERTBOT_EMAIL" ] && CERTBOT_EMAIL=$(grep -E '^SMTP_USER=' .env.prod | cut -d= -f2)
[ -z "$CERTBOT_EMAIL" ] && error "CERTBOT_EMAIL ou SMTP_USER manquant dans .env.prod"

certbot --nginx \
  -d sakafio.mg \
  -d admin.sakafio.mg \
  -d pos.sakafio.mg \
  -d kds.sakafio.mg \
  -d api.sakafio.mg \
  -d master.sakafio.mg \
  --email "$CERTBOT_EMAIL" \
  --non-interactive --agree-tos --redirect --keep-until-expiring
log "SSL émis pour les 6 sous-domaines"

# ── 8. Rebuild frontends avec sakafio.mg ────────────────────────────────────
header "8. Rebuild frontends Docker avec sakafio.mg"
DC="docker compose -f docker-compose.prod.yml --env-file .env.prod"
$DC build web pos kds client master
$DC up -d api web pos kds client master
log "Frontends rebuildés et redémarrés"

# ── 9. Tests ────────────────────────────────────────────────────────────────
header "9. Tests"
sleep 8
echo ""
echo "Test API :"
if curl -sk "https://api.sakafio.mg/api/health" | grep -q '"status":"ok"'; then
  log "https://api.sakafio.mg/api/health → OK"
else
  warn "API ne répond pas (peut prendre 30s, retester : curl -sk https://api.sakafio.mg/api/health)"
fi
echo ""
echo "Test frontends (HTTP code 200 attendu) :"
for d in sakafio.mg admin.sakafio.mg master.sakafio.mg; do
  CODE=$(curl -sk -o /dev/null -w "%{http_code}" "https://$d/")
  if [ "$CODE" = "200" ] || [ "$CODE" = "307" ] || [ "$CODE" = "308" ]; then
    log "https://$d → HTTP $CODE"
  else
    warn "https://$d → HTTP $CODE"
  fi
done

echo ""
echo -e "${BOLD}${GREEN}🎉 sakafio.mg est en ligne !${RESET}"
echo ""
echo "URLs publiques :"
echo "  https://sakafio.mg          — App client (commandes)"
echo "  https://admin.sakafio.mg    — Back-office"
echo "  https://pos.sakafio.mg      — Caisse"
echo "  https://kds.sakafio.mg      — Cuisine"
echo "  https://api.sakafio.mg      — API REST"
echo "  https://master.sakafio.mg   — Master Console SaaS"
echo ""
echo "Sous-domaines tenants (auto via wildcard *.sakafio.mg) :"
echo "  https://<slug>.sakafio.mg          — App client tenant"
echo "  https://admin-<slug>.sakafio.mg    — Admin tenant"
echo "  https://pos-<slug>.sakafio.mg      — POS tenant"
echo "  https://kds-<slug>.sakafio.mg      — KDS tenant"
echo "  https://api-<slug>.sakafio.mg      — API tenant"

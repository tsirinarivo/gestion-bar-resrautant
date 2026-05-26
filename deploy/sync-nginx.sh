#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/sync-nginx.sh — Synchronise les configs Nginx du repo avec /etc/nginx
#
# Pour chaque fichier dans deploy/nginx/ :
#   - Le copie dans /etc/nginx/sites-available/ s'il a changé
#   - Crée/met à jour le symlink dans /etc/nginx/sites-enabled/
#   - Sauvegarde l'ancienne version en .bak.<timestamp>
#
# Puis :
#   - nginx -t (validation)
#   - systemctl reload nginx
#   - certbot --nginx --reinstall pour restaurer le bloc SSL sur les domaines
#     dont la config a été écrasée
#
# Usage : sudo bash deploy/sync-nginx.sh
# ═══════════════════════════════════════════════════════════════════════════

set -e

BOLD="\033[1m"; GREEN="\033[0;32m"; CYAN="\033[0;36m"
YELLOW="\033[0;33m"; RED="\033[0;31m"; RESET="\033[0m"

log()    { echo -e "${GREEN}✅ $1${RESET}"; }
warn()   { echo -e "${YELLOW}⚠️  $1${RESET}"; }
error()  { echo -e "${RED}❌ $1${RESET}"; exit 1; }
header() { echo -e "\n${BOLD}${CYAN}═══ $1 ═══${RESET}\n"; }

[ "$EUID" -ne 0 ] && error "Ce script doit être lancé en root (sudo bash deploy/sync-nginx.sh)"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGINX_DIR="${SCRIPT_DIR}/nginx"

[ -d "$NGINX_DIR" ] || error "Dossier introuvable : $NGINX_DIR"

header "Sakafio — Synchronisation Nginx"

CHANGED_DOMAINS=()
TIMESTAMP=$(date +%s)

for conf in "$NGINX_DIR"/*.conf; do
  [ -f "$conf" ] || continue
  domain=$(basename "$conf" .conf)
  target="/etc/nginx/sites-available/${domain}"

  if [ ! -f "$target" ] || ! diff -q "$conf" "$target" > /dev/null 2>&1; then
    # Backup l'ancien
    [ -f "$target" ] && cp "$target" "${target}.bak.${TIMESTAMP}"
    cp "$conf" "$target"
    ln -sf "$target" "/etc/nginx/sites-enabled/${domain}"
    CHANGED_DOMAINS+=("$domain")
    log "Mis à jour : ${domain}"
  fi
done

if [ ${#CHANGED_DOMAINS[@]} -eq 0 ]; then
  log "Toutes les configs sont déjà à jour"
  exit 0
fi

header "Validation Nginx"
nginx -t || error "Configuration nginx invalide — restaure les .bak.${TIMESTAMP} si besoin"
log "Configuration nginx valide"

header "Reload Nginx"
systemctl reload nginx
log "Nginx rechargé"

header "Restauration SSL (certbot --reinstall)"
DOMAIN_ARGS=""
for d in "${CHANGED_DOMAINS[@]}"; do
  DOMAIN_ARGS="${DOMAIN_ARGS} -d ${d}"
done

if certbot --nginx --reinstall --non-interactive --redirect ${DOMAIN_ARGS} 2>&1 | tail -8; then
  log "SSL réinstallé pour : ${CHANGED_DOMAINS[*]}"
else
  warn "certbot --reinstall a échoué — vérifie manuellement les blocs SSL"
fi

systemctl reload nginx 2>/dev/null || true
log "Synchronisation terminée (${#CHANGED_DOMAINS[@]} domaine(s) mis à jour)"
echo ""
echo "Backups : /etc/nginx/sites-available/*.bak.${TIMESTAMP}"

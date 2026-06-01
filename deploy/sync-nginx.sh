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

# ─── Nettoyage des doublons : domain.conf coexistant avec domain ──────────
# Convention Debian/Ubuntu : pas d'extension dans sites-{available,enabled}.
# Si un fichier "domain.conf" existe en plus du fichier "domain", nginx les
# charge tous les deux → conflits (server_name dupliqué, configs contradictoires).
header "Nettoyage des doublons .conf"
DUPLICATES_REMOVED=0
for conf in "$NGINX_DIR"/*.conf; do
  [ -f "$conf" ] || continue
  domain=$(basename "$conf" .conf)

  if [ -f "/etc/nginx/sites-available/${domain}.conf" ]; then
    warn "Doublon détecté : ${domain}.conf coexiste avec ${domain}"
    # Backup avant suppression
    cp "/etc/nginx/sites-available/${domain}.conf" \
       "/etc/nginx/sites-available/${domain}.conf.bak.${TIMESTAMP}" 2>/dev/null || true
    rm -f "/etc/nginx/sites-enabled/${domain}.conf"
    rm -f "/etc/nginx/sites-available/${domain}.conf"
    log "Supprimé : ${domain}.conf (backup en ${domain}.conf.bak.${TIMESTAMP})"
    DUPLICATES_REMOVED=$((DUPLICATES_REMOVED+1))
    # On force le re-sync + reinstall SSL pour ce domaine
    CHANGED_DOMAINS+=("$domain")
  fi
done

[ "$DUPLICATES_REMOVED" -gt 0 ] && log "${DUPLICATES_REMOVED} doublon(s) nettoyé(s)"

# ─── Sync des fichiers conf.d/ (zones rate-limit globales) ─────────────────
if [ -d "$NGINX_DIR/conf.d" ]; then
  header "Sync conf.d (zones globales)"
  for conf in "$NGINX_DIR/conf.d"/*.conf; do
    [ -f "$conf" ] || continue
    fname=$(basename "$conf")
    target="/etc/nginx/conf.d/${fname}"
    if [ ! -f "$target" ] || ! diff -q "$conf" "$target" > /dev/null 2>&1; then
      [ -f "$target" ] && cp "$target" "${target}.bak.${TIMESTAMP}"
      cp "$conf" "$target"
      log "Mis à jour : conf.d/${fname}"
    fi
  done
fi

# ─── Sync des configs du repo ─────────────────────────────────────────────
header "Sync des configs depuis le repo"

for conf in "$NGINX_DIR"/*.conf; do
  [ -f "$conf" ] || continue
  domain=$(basename "$conf" .conf)
  target="/etc/nginx/sites-available/${domain}"

  if [ ! -f "$target" ] || ! diff -q "$conf" "$target" > /dev/null 2>&1; then
    # Backup l'ancien
    [ -f "$target" ] && cp "$target" "${target}.bak.${TIMESTAMP}"
    cp "$conf" "$target"
    ln -sf "$target" "/etc/nginx/sites-enabled/${domain}"
    # Évite les doublons dans le tableau
    if [[ ! " ${CHANGED_DOMAINS[*]} " =~ " ${domain} " ]]; then
      CHANGED_DOMAINS+=("$domain")
    fi
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

header "Réattacher SSL (certbot install — réinjecte listen 443 ssl + cert paths)"
# Quand on écrase une config dans sites-available, on perd les directives
# 'listen 443 ssl; ssl_certificate ...;' que certbot avait ajoutées. Si on ne
# les remet pas, nginx ne servira plus le HTTPS pour ce domaine et il tombera
# dans le default_server (typiquement 404).
#
# `certbot install` ne refait PAS le challenge ACME (pas de rate-limit) — il
# attache juste un cert EXISTANT à la conf nginx. Si le cert n'existe pas, il
# faut le créer une fois manuellement (cf README).
for d in "${CHANGED_DOMAINS[@]}"; do
  # Cherche un cert qui couvre ce domaine (matching exact dans la liste Domains)
  CERT_NAME=$(certbot certificates 2>/dev/null \
    | awk -v dom="$d" '
        /Certificate Name:/ { name=$3 }
        /Domains:/ { for (i=2; i<=NF; i++) if ($i==dom) { print name; exit } }
      ')
  if [ -n "$CERT_NAME" ]; then
    if certbot install --nginx --cert-name "$CERT_NAME" --non-interactive --redirect > /dev/null 2>&1; then
      log "  → ${d} : SSL réattaché depuis cert '${CERT_NAME}'"
    else
      warn "  → ${d} : certbot install a échoué"
    fi
  else
    warn "  → ${d} : aucun cert Let's Encrypt couvrant ce domaine. Lance :"
    warn "      sudo certbot --nginx -d ${d} --redirect"
  fi
done

echo ""
echo "Backups : /etc/nginx/sites-available/*.bak.${TIMESTAMP}"

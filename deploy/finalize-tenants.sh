#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/finalize-tenants.sh — Finalise le provisioning SSL des tenants
#
# Tourne sur l'HÔTE (pas dans un container). Installé en cron (1 min).
# Scanne /opt/restaurant/tenants/*/.needs-ssl et pour chacun :
#   1. nginx -t puis systemctl reload nginx (active la config tenant-X.conf)
#   2. certbot --nginx pour les 5 sous-domaines du tenant
#   3. mv .needs-ssl → .ssl-done
#
# Installation :
#   bash deploy/install-finalize-cron.sh
#
# Debug :
#   tail -f /var/log/sakafio-finalize.log
#   bash deploy/finalize-tenants.sh   # run manuellement
# ═══════════════════════════════════════════════════════════════════════════

set -e

ROOT_DIR="/opt/restaurant"
TENANTS_DIR="$ROOT_DIR/tenants"
LOG="/var/log/sakafio-finalize.log"

# Charger .env.prod pour CERTBOT_EMAIL
if [ -f "$ROOT_DIR/.env.prod" ]; then
  set -a; source "$ROOT_DIR/.env.prod"; set +a
fi

EMAIL="${CERTBOT_EMAIL:-${SMTP_USER:-admin@sakafio.mg}}"

ts() { date '+%Y-%m-%d %H:%M:%S'; }
say() { echo "[$(ts)] $*" >> "$LOG"; }

# Lock pour éviter exécutions concurrentes (cron + manuel)
LOCK="/var/lock/sakafio-finalize.lock"
exec 9>"$LOCK"
flock -n 9 || { say "déjà en cours, skip"; exit 0; }

[ ! -d "$TENANTS_DIR" ] && exit 0

shopt -s nullglob
FLAGS=("$TENANTS_DIR"/*/.needs-ssl)
[ ${#FLAGS[@]} -eq 0 ] && exit 0

say "─── finalize: ${#FLAGS[@]} tenant(s) à traiter ───"

# Reload nginx UNE SEULE FOIS pour tous les tenants détectés
if nginx -t >> "$LOG" 2>&1; then
  systemctl reload nginx
  say "✓ nginx rechargé"
else
  say "✗ nginx -t a échoué — abandon"
  exit 1
fi

for flag in "${FLAGS[@]}"; do
  tenant_dir="${flag%/.needs-ssl}"
  slug="$(basename "$tenant_dir")"

  info="$tenant_dir/.tenant-info"
  if [ ! -f "$info" ]; then
    say "✗ $slug : .tenant-info manquant — skip"
    continue
  fi

  subdomain="$(grep '^TENANT_SUBDOMAIN=' "$info" | cut -d= -f2)"
  [ -z "$subdomain" ] && subdomain="$slug"

  say "→ $slug : certbot pour ${subdomain}.sakafio.mg + 4 sous-domaines"

  if certbot --nginx \
       -d "${subdomain}.sakafio.mg" \
       -d "admin-${subdomain}.sakafio.mg" \
       -d "pos-${subdomain}.sakafio.mg" \
       -d "kds-${subdomain}.sakafio.mg" \
       -d "api-${subdomain}.sakafio.mg" \
       --email "$EMAIL" \
       --non-interactive --agree-tos --redirect --keep-until-expiring \
       >> "$LOG" 2>&1; then
    mv "$flag" "$tenant_dir/.ssl-done"
    date '+%Y-%m-%d %H:%M:%S' > "$tenant_dir/.ssl-done"
    say "✅ $slug : SSL OK"
  else
    say "❌ $slug : certbot a échoué (voir détails ci-dessus)"
    # On NE supprime PAS .needs-ssl → ré-essai au prochain cron
  fi
done

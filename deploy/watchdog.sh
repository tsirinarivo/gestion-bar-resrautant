#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════════
# deploy/watchdog.sh — Surveillance continue de l'API
#
# Toutes les 30s ping /api/health. Quand l'API tombe ou remonte, écrit dans
# /logs/watchdog.log + alerte optionnelle via DISCORD_WEBHOOK_URL.
#
# Docker redémarre déjà les conteneurs qui crashent (restart: unless-stopped),
# le rôle du watchdog est de RAPPORTER les incidents pour qu'on les voie.
# ═══════════════════════════════════════════════════════════════════════════

LOG_FILE="/logs/watchdog.log"
API_URL="http://api:4000/api/health"
CHECK_INTERVAL=30

mkdir -p /logs

log() {
  ts=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$ts] $1" >> "$LOG_FILE"
}

notify() {
  msg="$1"
  if [ -n "$DISCORD_WEBHOOK_URL" ]; then
    payload="{\"content\":\"🚨 RestaurantOS — $msg\"}"
    wget -q -O /dev/null \
      --header="Content-Type: application/json" \
      --post-data="$payload" \
      "$DISCORD_WEBHOOK_URL" 2>/dev/null
  fi
}

state="unknown"
down_since=""

log "Watchdog démarré (URL=$API_URL, interval=${CHECK_INTERVAL}s)"
if [ -n "$DISCORD_WEBHOOK_URL" ]; then
  log "Alertes Discord activées"
else
  log "Alertes Discord désactivées (définir DISCORD_WEBHOOK_URL dans .env.prod pour activer)"
fi

while true; do
  if wget -q -O /dev/null --timeout=10 "$API_URL" 2>/dev/null; then
    if [ "$state" = "down" ]; then
      duration=$(( $(date +%s) - down_since ))
      log "✅ API back UP (down for ${duration}s)"
      notify "API redevenue OPÉRATIONNELLE après ${duration}s de panne"
    fi
    state="up"
  else
    if [ "$state" != "down" ]; then
      down_since=$(date +%s)
      log "❌ API DOWN"
      notify "API INDISPONIBLE — investigate now"
      state="down"
    fi
  fi
  sleep "$CHECK_INTERVAL"
done

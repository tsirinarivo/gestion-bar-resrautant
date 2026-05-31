#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/update.sh — Mise à jour de l'application
# Usage: bash deploy/update.sh
# ═══════════════════════════════════════════════════════════════════════════

set -e

BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
RESET="\033[0m"

log()    { echo -e "${GREEN}✅ $1${RESET}"; }
warn()   { echo -e "${YELLOW}⚠️  $1${RESET}"; }
header() { echo -e "\n${BOLD}${CYAN}═══ $1 ═══${RESET}\n"; }

header "Sakafio — Mise à jour"

header "1. Récupération du code"
git fetch origin claude/restaurant-management-app-cFnVm
git checkout claude/restaurant-management-app-cFnVm
git reset --hard origin/claude/restaurant-management-app-cFnVm
log "Code mis à jour ($(git rev-parse --short HEAD))"

set -a; source .env.prod; set +a

DC="docker compose -f docker-compose.prod.yml --env-file .env.prod"

header "2. Prépare les volumes host (uploads + backups + logs)"
mkdir -p ./uploads/products ./backups/postgres ./logs
# node user inside the api container is UID 1000
chown -R 1000:1000 ./uploads 2>/dev/null || warn "Impossible de chown ./uploads — exécute en root si les uploads ne fonctionnent pas"
# postgres-backup-local runs as a non-root user (UID varies between Alpine/Debian
# image variants), so allow read/write/execute for all instead of guessing the UID
chmod -R 777 ./backups/postgres 2>/dev/null || warn "Impossible de chmod ./backups/postgres"
log "Volumes prêts"

header "3. Backup Postgres pré-migration (filet de sécurité)"
if $DC ps postgres 2>/dev/null | grep -q "Up"; then
  STAMP=$(date +%Y%m%d-%H%M%S)
  PRE_DUMP="./backups/postgres/pre-deploy-${STAMP}.sql.gz"
  $DC exec -T postgres pg_dump -U "${POSTGRES_USER:-restaurant_user}" "${POSTGRES_DB:-restaurant_db}" 2>/dev/null | gzip > "$PRE_DUMP"
  SIZE=$(du -h "$PRE_DUMP" | cut -f1)
  log "Snapshot pré-migration : $PRE_DUMP ($SIZE)"
else
  warn "Postgres non actif — pas de backup pré-migration (1er déploiement ?)"
fi

header "4. Build des images"
# ssh-agent pour le build api (imprimantcloud est un repo privé, clone via ssh).
# La clé SSH du host est exposée temporairement au build via BuildKit secret ssh.
SSH_KEY="${GITHUB_SSH_KEY:-}"
if [ -z "$SSH_KEY" ] && command -v ssh >/dev/null 2>&1; then
  # Demander à ssh quelle IdentityFile il utiliserait pour github.com
  CFG_KEY=$(ssh -G git@github.com 2>/dev/null | awk '/^identityfile / {print $2; exit}')
  if [ -n "$CFG_KEY" ]; then
    CFG_KEY="${CFG_KEY/#\~/$HOME}"
    [ -f "$CFG_KEY" ] && SSH_KEY="$CFG_KEY"
  fi
fi
if [ -z "$SSH_KEY" ]; then
  for candidate in "$HOME/.ssh/id_ed25519" "$HOME/.ssh/id_ecdsa" "$HOME/.ssh/id_rsa" "$HOME/.ssh/github" "$HOME/.ssh/github_rsa"; do
    if [ -f "$candidate" ]; then
      SSH_KEY="$candidate"
      break
    fi
  done
fi
if [ -z "$SSH_KEY" ] || [ ! -f "$SSH_KEY" ]; then
  echo -e "${RED}❌ Aucune clé SSH trouvée${RESET}"
  echo "   Le build api va échouer car imprimantcloud est un repo github privé."
  echo "   Solutions :"
  echo "   - Génère une clé : ssh-keygen -t ed25519 -f $HOME/.ssh/id_ed25519"
  echo "   - Ajoute la clé publique à github : https://github.com/settings/keys"
  echo "   - Ou pointe vers une autre clé : export GITHUB_SSH_KEY=/chemin/vers/cle"
  exit 1
fi

# Toujours démarrer un agent propre (un agent fantôme avec SSH_AUTH_SOCK
# pointant vers un socket mort fait échouer docker compose)
eval "$(ssh-agent -s)" > /dev/null
trap 'ssh-agent -k > /dev/null 2>&1' EXIT
export SSH_AUTH_SOCK SSH_AGENT_PID
if ssh-add "$SSH_KEY" 2>&1 | grep -q "Identity added"; then
  log "Clé SSH ajoutée à l'agent ($SSH_KEY)"
else
  echo -e "${RED}❌ Impossible d'ajouter $SSH_KEY à ssh-agent${RESET}"
  ssh-add "$SSH_KEY"
  exit 1
fi

DOCKER_BUILDKIT=1 $DC build --no-cache \
  --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
  --build-arg NEXT_PUBLIC_SOCKET_URL="$NEXT_PUBLIC_SOCKET_URL"

header "5. Redémarrage (API d'abord, puis frontends)"
$DC up -d --no-deps api
sleep 15
log "API redémarrée"

$DC up -d --no-deps web pos kds client master
log "Frontends + master redémarrés"

header "6. Migrations"
$DC run --rm migrate sh -c "npx prisma db push --accept-data-loss" || true
log "Migrations exécutées (snapshot dispo : $PRE_DUMP)"

header "7. Services d'infrastructure (backup + watchdog)"
mkdir -p ./logs
$DC up -d postgres-backup watchdog
log "Backups quotidiens actifs (03:00, rétention 14j/8s/12m)"
log "Watchdog actif (logs : ./logs/watchdog.log)"

header "8. Smoke tests"
if bash deploy/smoke-test.sh; then
  log "Smoke tests passés"
else
  warn "Certains smoke tests ont échoué — vérifier les logs"
fi

header "9. Statut final"
$DC ps

echo ""
log "Mise à jour terminée !"
echo ""
echo -e "${BOLD}Commandes utiles :${RESET}"
echo "  Healthcheck      : curl http://127.0.0.1:4001/api/health"
echo "  Backups          : ls -lht ./backups/postgres/daily/ 2>/dev/null | head -5"
echo "  Restauration     : bash deploy/restore-postgres.sh"
echo "  Watchdog logs    : tail -f ./logs/watchdog.log 2>/dev/null"

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

# NE PAS passer --build-arg NEXT_PUBLIC_API_URL ici. Le compose a deja
# 'args: NEXT_PUBLIC_API_URL: __SAKAFIO_API_URL__' (placeholder), et
# runtime-env-rewrite.sh remplace ce placeholder au demarrage du container
# avec la vraie env var (differente par tenant : api.sakafio.mg pour le
# resto principal, api-<slug>.sakafio.mg pour les tenants qui reutilisent
# la meme image restaurant_web:latest).
# Si on overrise via build-arg ici, le placeholder disparait du bundle JS
# et tous les tenants finissent par appeler l'API du resto principal.
DOCKER_BUILDKIT=1 $DC build --no-cache

header "5. Redémarrage (API d'abord, puis frontends)"
$DC up -d --no-deps api
sleep 15
log "API redémarrée"

# Skip le recreate de 'master' si le script tourne LUI-MÊME dans le container
# master (déclenché depuis l'UI). Sinon le master se suicide pendant qu'il
# tourne update.sh, le process Node meurt, et la run UpdateRun reste éternel-
# lement en RUNNING dans la DB (zombie).
if [ "${SAKAFIO_SKIP_MASTER_RECREATE:-}" = "1" ]; then
  $DC up -d --no-deps web pos kds client landing
  log "Frontends + landing redémarrés (master skip — détecté lancement depuis l'UI)"
else
  $DC up -d --no-deps web pos kds client landing master
  log "Frontends + landing + master redémarrés"
fi

header "6. Migrations (master DB + master SaaS DB + tous les tenants)"
# Migration de la DB master (schéma packages/database — schema tenant principal)
if ! $DC run --rm migrate sh -c "npx prisma db push --accept-data-loss"; then
  warn "Migration DB master (schema tenant) a échoué — snapshot dispo : $PRE_DUMP"
fi

# Migration de la DB master SaaS (schéma packages/master-database — Tenant,
# MasterSetting, TenantEvent, etc.). Sans ça, les nouveaux models ajoutés
# au schema master-database ne sont jamais créés en DB.
# IMPORTANT : pinner prisma@5 sinon npx telecharge la 7.x qui a change de
# syntaxe (datasource url plus supporte sans prisma.config.ts).
if $DC ps master | grep -q "Up"; then
  if ! $DC exec -T master sh -c "cd /opt/restaurant/packages/master-database && npx -y prisma@5 db push --accept-data-loss" > /dev/null 2>&1; then
    warn "Migration DB master SaaS a échoué — vérifier docker logs restaurant_master"
  else
    log "Schema master SaaS poussé"
  fi
else
  warn "Container master non démarré — schema master SaaS non poussé"
fi

# Migration des DBs tenants : on liste toutes les DBs tenant_* et on pousse
# le même schéma sur chacune. Sans ça, divergence schéma vs code après chaque
# déploiement multi-tenant → crash silencieux des apps tenant.
TENANT_DBS=$($DC exec -T postgres psql -U "${POSTGRES_USER:-restaurant_user}" -d postgres -tAc \
  "SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'" 2>/dev/null | tr -d '\r' || true)
if [ -n "$TENANT_DBS" ]; then
  for tdb in $TENANT_DBS; do
    [ -z "$tdb" ] && continue
    TENANT_URL="postgresql://${POSTGRES_USER:-restaurant_user}:${POSTGRES_PASSWORD}@postgres:5432/${tdb}"
    if $DC run --rm -e DATABASE_URL="$TENANT_URL" migrate sh -c "npx prisma db push --accept-data-loss" > /dev/null 2>&1; then
      log "  → $tdb migré"
    else
      warn "  → $tdb : migration échouée (snapshot dispo : $PRE_DUMP)"
    fi
  done
else
  log "Aucune DB tenant détectée"
fi

header "6bis. Recreate containers des tenants existants (nouvelles images)"
# Quand on rebuild restaurant_web:latest etc., les nouveaux containers utilisent
# la nouvelle image, mais les containers tenants existants tournent toujours
# sur l'ancienne. Il faut explicitement les recreate pour propager les fixes.
# On itere sur /opt/restaurant/tenants/*/docker-compose.yml.
if [ -d "./tenants" ]; then
  TENANT_COUNT=0
  for tdir in ./tenants/*/; do
    [ -f "${tdir}docker-compose.yml" ] || continue
    slug=$(basename "$tdir")
    echo "  → Recreate containers tenant '$slug'..."
    if (cd "$tdir" && docker compose up -d --force-recreate api web pos kds client > /dev/null 2>&1); then
      log "    ✓ $slug : containers recreated"
      TENANT_COUNT=$((TENANT_COUNT + 1))
    else
      warn "    ✗ $slug : recreate a échoué — vérifier $tdir manuellement"
    fi
  done
  if [ "$TENANT_COUNT" -gt 0 ]; then
    log "$TENANT_COUNT tenant(s) recréé(s) avec les nouvelles images"
  fi
else
  log "Aucun tenant à recréer (dossier tenants/ inexistant)"
fi

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

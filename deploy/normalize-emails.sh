#!/usr/bin/env bash
# Normalise tous les emails en minuscules dans toutes les bases tenants + master.
# Idempotent : peut être relancé plusieurs fois sans effet de bord.
# À lancer UNE FOIS après le déploiement de la PR "lowercase emails".

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PG_USER="${POSTGRES_USER:-restaurant_user}"
DC="docker compose -f $ROOT_DIR/docker-compose.prod.yml --env-file $ROOT_DIR/.env.prod"

normalize_db() {
  local db="$1"
  echo "→ $db"
  # Table users (tenants) ou master_users (master). Detecte automatiquement.
  $DC exec -T postgres psql -U "$PG_USER" -d "$db" -v ON_ERROR_STOP=1 <<'SQL' || true
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='users') THEN
    -- Détection conflits potentiels (2 users avec même email à des casses différentes)
    PERFORM 1 FROM (
      SELECT LOWER(email) AS k, COUNT(*) AS c FROM users GROUP BY LOWER(email) HAVING COUNT(*) > 1
    ) t LIMIT 1;
    IF FOUND THEN
      RAISE WARNING 'CONFLIT : 2+ users avec même email à casses différentes — corrigez manuellement avant relance';
    ELSE
      UPDATE users SET email = LOWER(email) WHERE email <> LOWER(email);
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='customers') THEN
    UPDATE customers SET email = LOWER(email) WHERE email IS NOT NULL AND email <> LOWER(email);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='master_users') THEN
    UPDATE master_users SET email = LOWER(email) WHERE email <> LOWER(email);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='tenants') THEN
    UPDATE tenants SET "contactEmail" = LOWER("contactEmail") WHERE "contactEmail" <> LOWER("contactEmail");
  END IF;
END$$;
SQL
}

# Liste toutes les DB tenant_* + master_db + restaurant_db
DBS=$($DC exec -T postgres psql -U "$PG_USER" -d postgres -tAc \
  "SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%' OR datname IN ('master_db','restaurant_db');")

for db in $DBS; do
  [ -n "$db" ] || continue
  normalize_db "$db"
done

echo "✅ Normalisation terminée"

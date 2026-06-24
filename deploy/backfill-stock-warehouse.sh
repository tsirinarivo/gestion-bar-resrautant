#!/usr/bin/env bash
# Rattache les articles de stock orphelins (warehouseId NULL) à l'entrepôt par
# défaut de leur restaurant. Sans ça, la page Entrepôt les compte nulle part et
# affiche un stock à 0 alors que les quantités existent bien.
# Idempotent : peut être relancé sans effet de bord.
# À lancer UNE FOIS après le déploiement du fix "stock/entrepôt".

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PG_USER="${POSTGRES_USER:-restaurant_user}"
DC="docker compose -f $ROOT_DIR/docker-compose.prod.yml --env-file $ROOT_DIR/.env.prod"

backfill_db() {
  local db="$1"
  echo "→ $db"
  $DC exec -T postgres psql -U "$PG_USER" -d "$db" -v ON_ERROR_STOP=1 <<'SQL' || true
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='stock_items')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='warehouses') THEN
    UPDATE stock_items si
    SET "warehouseId" = w.id
    FROM (
      SELECT DISTINCT ON ("restaurantId") "restaurantId", id
      FROM warehouses
      ORDER BY "restaurantId", "isDefault" DESC, "createdAt" ASC
    ) w
    WHERE si."warehouseId" IS NULL
      AND si."restaurantId" = w."restaurantId";
  END IF;
END$$;
SQL
}

DBS=$($DC exec -T postgres psql -U "$PG_USER" -d postgres -tAc \
  "SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%' OR datname = 'restaurant_db';")

for db in $DBS; do
  [ -n "$db" ] || continue
  backfill_db "$db"
done

echo "✅ Backfill stock → entrepôt terminé"

#!/usr/bin/env bash
# Initialise les niveaux de stock par entrepôt (table stock_levels) à partir de
# l'état actuel : pour chaque article, crée une ligne (article, entrepôt, quantité)
# dans son entrepôt actuel (warehouseId) ou, à défaut, l'entrepôt par défaut du
# restaurant. Sans ça, après le passage au modèle multi-entrepôt, les articles
# existants n'apparaîtraient dans aucun entrepôt.
# Idempotent : ne touche pas un article qui a déjà au moins un niveau.
# À lancer UNE FOIS après le déploiement du fix "stock multi-entrepôt".

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
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='stock_levels')
     OR NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='stock_items')
     OR NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='warehouses') THEN
    RETURN;
  END IF;

  INSERT INTO stock_levels (id, "stockItemId", "warehouseId", quantity, "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text,
         si.id,
         COALESCE(si."warehouseId", w.id),
         si."currentQuantity",
         now(), now()
  FROM stock_items si
  LEFT JOIN LATERAL (
    SELECT id FROM warehouses ww
    WHERE ww."restaurantId" = si."restaurantId"
    ORDER BY ww."isDefault" DESC, ww."createdAt" ASC
    LIMIT 1
  ) w ON true
  WHERE COALESCE(si."warehouseId", w.id) IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM stock_levels sl WHERE sl."stockItemId" = si.id);
END$$;
SQL
}

DBS=$($DC exec -T postgres psql -U "$PG_USER" -d postgres -tAc \
  "SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%' OR datname = 'restaurant_db';")

for db in $DBS; do
  [ -n "$db" ] || continue
  backfill_db "$db"
done

echo "✅ Backfill niveaux de stock par entrepôt terminé"

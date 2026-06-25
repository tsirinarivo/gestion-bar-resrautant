#!/usr/bin/env bash
# Réconcilie les niveaux de stock par entrepôt (table stock_levels) avec le total
# de chaque article (stock_items.currentQuantity) : si la somme des niveaux d'un
# article est inférieure à son total, l'écart est ajouté dans son entrepôt
# (warehouseId) ou, à défaut, l'entrepôt par défaut du restaurant.
# Couvre aussi bien les articles sans aucun niveau que ceux dont un niveau à 0
# avait été créé après la migration (laissant le stock "coincé" dans le cache).
# Idempotent : après exécution, somme(niveaux) == currentQuantity, donc une
# relance ne change plus rien.
# À lancer après le déploiement du fix "stock multi-entrepôt".

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

  WITH target AS (
    SELECT si.id AS sid,
           si."currentQuantity"
             - COALESCE((SELECT SUM(sl.quantity) FROM stock_levels sl WHERE sl."stockItemId" = si.id), 0) AS shortfall,
           COALESCE(si."warehouseId", w.id) AS wid
    FROM stock_items si
    LEFT JOIN LATERAL (
      SELECT id FROM warehouses ww
      WHERE ww."restaurantId" = si."restaurantId"
      ORDER BY ww."isDefault" DESC, ww."createdAt" ASC
      LIMIT 1
    ) w ON true
  )
  INSERT INTO stock_levels (id, "stockItemId", "warehouseId", quantity, "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, sid, wid, shortfall, now(), now()
  FROM target
  WHERE wid IS NOT NULL AND shortfall > 0
  ON CONFLICT ("stockItemId", "warehouseId")
  DO UPDATE SET quantity = stock_levels.quantity + EXCLUDED.quantity, "updatedAt" = now();
END$$;
SQL
}

DBS=$($DC exec -T postgres psql -U "$PG_USER" -d postgres -tAc \
  "SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%' OR datname = 'restaurant_db';")

for db in $DBS; do
  [ -n "$db" ] || continue
  backfill_db "$db"
done

echo "✅ Réconciliation des niveaux de stock par entrepôt terminée"


#!/usr/bin/env bash
# Déduplique les produits : pour chaque (restaurant, nom, catégorie), garde le
# plus ancien et marque les autres comme supprimés (soft-delete via deletedAt).
# Origine du doublon : un import CSV sans SKU relancé deux fois → catalogue dupliqué.
# Soft-delete = RÉVERSIBLE (on remet deletedAt à NULL pour restaurer) et sans
# risque FK (les commandes référençant un produit restent valides).
# Idempotent : après exécution, chaque groupe n'a plus qu'un produit actif.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PG_USER="${POSTGRES_USER:-restaurant_user}"
DC="docker compose -f $ROOT_DIR/docker-compose.prod.yml --env-file $ROOT_DIR/.env.prod"

dedupe_db() {
  local db="$1"
  echo "→ $db"
  $DC exec -T postgres psql -U "$PG_USER" -d "$db" -v ON_ERROR_STOP=1 <<'SQL' || true
DO $$
DECLARE
  dups INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='products') THEN
    RETURN;
  END IF;

  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY "restaurantId", lower(name), "categoryId"
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
    FROM products
    WHERE "deletedAt" IS NULL
  )
  SELECT COUNT(*) INTO dups FROM ranked WHERE rn > 1;

  RAISE NOTICE 'Doublons à archiver : %', dups;

  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY "restaurantId", lower(name), "categoryId"
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
    FROM products
    WHERE "deletedAt" IS NULL
  )
  UPDATE products p
  SET "deletedAt" = now()
  FROM ranked r
  WHERE p.id = r.id AND r.rn > 1;
END$$;
SQL
}

DBS=$($DC exec -T postgres psql -U "$PG_USER" -d postgres -tAc \
  "SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%' OR datname = 'restaurant_db';")

for db in $DBS; do
  [ -n "$db" ] || continue
  dedupe_db "$db"
done

echo "✅ Déduplication des produits terminée"

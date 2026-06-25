#!/usr/bin/env bash
# Répare le stock perdu par les transferts bugués de l'ANCIEN code de la page
# Stock (avant le correctif moveStock). Ces transferts soustrayaient la quantité
# du total au lieu de la déplacer → stock total trop bas.
#
# Identification SANS ambiguïté : un transfert bugué = mouvement type='TRANSFER'
# SANS reference (reference IS NULL). Tous les vrais transferts (ancien onglet
# Entrepôts ET nouveau code) portent reference = id du transfert.
#
# Action : restitue la quantité au total ET au niveau de l'entrepôt de l'article
# (un transfert doit être neutre sur le total). Marque le mouvement réconcilié.
# Idempotent : un mouvement déjà réconcilié n'est jamais retraité.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PG_USER="${POSTGRES_USER:-restaurant_user}"
DC="docker compose -f $ROOT_DIR/docker-compose.prod.yml --env-file $ROOT_DIR/.env.prod"

reconcile_db() {
  local db="$1"
  echo "→ $db"
  $DC exec -T postgres psql -U "$PG_USER" -d "$db" -v ON_ERROR_STOP=1 <<'SQL' || true
DO $$
DECLARE
  r RECORD;
  n INT := 0;
  total_qty NUMERIC := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='stock_movements')
     OR NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='stock_levels') THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT m.id AS mid, m."stockItemId" AS sid, m.quantity AS qty,
           COALESCE(si."warehouseId",
             (SELECT w.id FROM warehouses w
              WHERE w."restaurantId" = si."restaurantId"
              ORDER BY w."isDefault" DESC, w."createdAt" ASC LIMIT 1)) AS wid
    FROM stock_movements m
    JOIN stock_items si ON si.id = m."stockItemId"
    WHERE m.type = 'TRANSFER'
      AND m.reference IS NULL
      AND m."warehouseId" IS NULL
      AND m.quantity > 0
  LOOP
    UPDATE stock_items SET "currentQuantity" = "currentQuantity" + r.qty WHERE id = r.sid;

    IF r.wid IS NOT NULL THEN
      INSERT INTO stock_levels (id, "stockItemId", "warehouseId", quantity, "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, r.sid, r.wid, r.qty, now(), now())
      ON CONFLICT ("stockItemId", "warehouseId")
      DO UPDATE SET quantity = stock_levels.quantity + r.qty, "updatedAt" = now();
    END IF;

    UPDATE stock_movements SET reference = 'reconciled-legacy-transfer' WHERE id = r.mid;
    n := n + 1;
    total_qty := total_qty + r.qty;
  END LOOP;

  RAISE NOTICE 'Transferts bugués réconciliés : % (quantité restituée : %)', n, total_qty;
END$$;
SQL
}

DBS=$($DC exec -T postgres psql -U "$PG_USER" -d postgres -tAc \
  "SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%' OR datname = 'restaurant_db';")

for db in $DBS; do
  [ -n "$db" ] || continue
  reconcile_db "$db"
done

echo "✅ Réconciliation des transferts bugués terminée"

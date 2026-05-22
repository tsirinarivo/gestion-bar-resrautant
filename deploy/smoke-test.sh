#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/smoke-test.sh — Tests de fumée post-déploiement
#
# Valide que les services clés répondent correctement après un deploy.
# Non destructif : aucune écriture en base.
#
# Usage: bash deploy/smoke-test.sh
#        Exit code 0 si tout passe, 1 si un test échoue.
# ═══════════════════════════════════════════════════════════════════════════

set +e  # ne pas s'arrêter au premier échec — on veut le rapport complet

# Load env (POSTGRES_USER, POSTGRES_DB, REDIS_PASSWORD, …) if available
if [ -f ./.env.prod ]; then
  set -a; . ./.env.prod; set +a
fi

GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[0;33m"
BOLD="\033[1m"
RESET="\033[0m"

PASSED=0
FAILED=0
TOTAL=0

check() {
  local name="$1"
  local url="$2"
  local expected="${3:-200}"
  local method="${4:-GET}"
  TOTAL=$((TOTAL + 1))

  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X "$method" "$url" 2>/dev/null)

  if [ "$status" = "$expected" ]; then
    echo -e "  ${GREEN}✓${RESET} $name ($status)"
    PASSED=$((PASSED + 1))
  else
    echo -e "  ${RED}✗${RESET} $name (got $status, expected $expected) — $method $url"
    FAILED=$((FAILED + 1))
  fi
}

check_json() {
  local name="$1"
  local url="$2"
  local jq_filter="$3"
  TOTAL=$((TOTAL + 1))

  local body
  body=$(curl -s --max-time 10 "$url" 2>/dev/null)

  if echo "$body" | grep -q "$jq_filter"; then
    echo -e "  ${GREEN}✓${RESET} $name"
    PASSED=$((PASSED + 1))
  else
    echo -e "  ${RED}✗${RESET} $name — body: ${body:0:120}"
    FAILED=$((FAILED + 1))
  fi
}

echo -e "${BOLD}Smoke tests RestaurantOS${RESET}\n"

echo -e "${BOLD}API${RESET}"
check_json "API health"                              "http://127.0.0.1:4001/api/health" '"status":"ok"'
check      "API login POST sans body (expected 400)" "http://127.0.0.1:4001/api/auth/login" 400 POST
check      "API protégée sans token (expected 401)"  "http://127.0.0.1:4001/api/orders" 401

echo -e "\n${BOLD}Frontends${RESET}"
check "Web admin (Next.js)"        "http://127.0.0.1:4002/login"
check "POS"                        "http://127.0.0.1:4003"
check "KDS"                        "http://127.0.0.1:4004"
check "Client app"                 "http://127.0.0.1:4005"

echo -e "\n${BOLD}Endpoints publics${RESET}"
check_json "API public info"          "http://127.0.0.1:4001/api/public/restaurant-demo/info" '"success"'
check_json "API public menu"          "http://127.0.0.1:4001/api/public/restaurant-demo/menu" '"success"'

echo -e "\n${BOLD}Base de données${RESET}"
DC="docker compose -f docker-compose.prod.yml --env-file .env.prod"
if $DC exec -T postgres pg_isready -U restaurant_user > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓${RESET} Postgres pg_isready"
  PASSED=$((PASSED + 1))
else
  echo -e "  ${RED}✗${RESET} Postgres pg_isready"
  FAILED=$((FAILED + 1))
fi
TOTAL=$((TOTAL + 1))

if $DC exec -T redis redis-cli -a "${REDIS_PASSWORD}" ping 2>/dev/null | grep -q PONG; then
  echo -e "  ${GREEN}✓${RESET} Redis ping"
  PASSED=$((PASSED + 1))
else
  echo -e "  ${RED}✗${RESET} Redis ping"
  FAILED=$((FAILED + 1))
fi
TOTAL=$((TOTAL + 1))

echo ""
echo -e "${BOLD}Résultat : $PASSED/$TOTAL tests passés${RESET}"

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}${FAILED} test(s) échoué(s)${RESET}"
  exit 1
fi
echo -e "${GREEN}Tous les smoke tests sont passés${RESET}"
exit 0

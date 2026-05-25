#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════════
# Réécrit les placeholders NEXT_PUBLIC_* dans les bundles Next.js compilés.
# Les NEXT_PUBLIC_* sont inlinés au build par Next.js — impossible de
# changer à runtime sans rebuild. On contourne en buildant avec des
# placeholders uniques, puis on les substitue ici au démarrage du container
# avec la vraie valeur d'env (différente par tenant).
#
# Placeholders attendus dans les bundles :
#   __SAKAFIO_API_URL__     ← remplacé par $NEXT_PUBLIC_API_URL
#   __SAKAFIO_SOCKET_URL__  ← remplacé par $NEXT_PUBLIC_SOCKET_URL
# ═══════════════════════════════════════════════════════════════════════════

set -e

rewrite() {
  placeholder="$1"
  value="$2"
  [ -z "$value" ] && return 0
  # On échappe les caractères spéciaux pour sed (& / \ et le délimiteur)
  esc=$(printf '%s' "$value" | sed -e 's/[\\&|]/\\&/g')
  find ./.next -type f \( -name '*.js' -o -name '*.html' -o -name '*.json' \) 2>/dev/null \
    | xargs -r sed -i "s|${placeholder}|${esc}|g" 2>/dev/null || true
}

rewrite '__SAKAFIO_API_URL__'    "${NEXT_PUBLIC_API_URL:-}"
rewrite '__SAKAFIO_SOCKET_URL__' "${NEXT_PUBLIC_SOCKET_URL:-}"

exec "$@"

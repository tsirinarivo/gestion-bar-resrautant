#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/install-finalize-cron.sh — Installe le cron pour finalize-tenants.sh
#
# Une seule exécution suffit (idempotent). À lancer en root sur le VPS.
# ═══════════════════════════════════════════════════════════════════════════

set -e

CRON_FILE="/etc/cron.d/sakafio-finalize"
LOG="/var/log/sakafio-finalize.log"

GREEN="\033[0;32m"; CYAN="\033[0;36m"; RESET="\033[0m"

echo -e "${CYAN}Installation du cron sakafio-finalize${RESET}"

# 1. Créer le fichier de log si absent
touch "$LOG"
chmod 644 "$LOG"
echo -e "${GREEN}✓${RESET} Log : $LOG"

# 2. Écrire la règle cron (toutes les minutes)
cat > "$CRON_FILE" <<EOF
# Sakafio — finalise le provisioning SSL des tenants
# Voir /opt/restaurant/deploy/finalize-tenants.sh
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

* * * * * root /opt/restaurant/deploy/finalize-tenants.sh
EOF
chmod 644 "$CRON_FILE"
echo -e "${GREEN}✓${RESET} Cron : $CRON_FILE"

# 3. Recharger cron
systemctl reload cron 2>/dev/null || service cron reload 2>/dev/null || true
echo -e "${GREEN}✓${RESET} Cron rechargé"

# 4. Premier run manuel pour traiter les tenants déjà en attente
echo -e "${CYAN}Premier run manuel...${RESET}"
bash /opt/restaurant/deploy/finalize-tenants.sh || true

echo ""
echo -e "${GREEN}✅ Installation terminée${RESET}"
echo ""
echo "Le watcher tournera maintenant toutes les minutes."
echo "Suivre l'activité :  tail -f $LOG"
echo "Désinstaller     :  rm $CRON_FILE && systemctl reload cron"

#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy/diagnose.sh — Diagnostic complet du VPS
# Usage: bash deploy/diagnose.sh
# Partagez la sortie complète avec Claude.
# ═══════════════════════════════════════════════════════════════════════════

SEP="═══════════════════════════════════════════════════════"

section() { echo -e "\n$SEP\n  $1\n$SEP"; }

section "OS & SYSTÈME"
uname -a
cat /etc/os-release 2>/dev/null || cat /etc/issue
echo "Uptime: $(uptime)"
echo "Hostname: $(hostname)"
echo "IP publique: $(curl -s --max-time 5 ifconfig.me || curl -s --max-time 5 api.ipify.org || echo 'non détecté')"

section "CPU & RAM"
echo "--- CPU ---"
nproc && cat /proc/cpuinfo | grep "model name" | head -1
echo "--- RAM ---"
free -h
echo "--- Swap ---"
swapon --show 2>/dev/null || echo "Pas de swap"

section "DISQUE"
df -h

section "DOCKER"
if command -v docker &>/dev/null; then
  docker --version
  docker compose version 2>/dev/null || docker-compose --version 2>/dev/null || echo "docker-compose non disponible"
  echo ""
  echo "--- Containers en cours ---"
  docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
  echo ""
  echo "--- Tous les containers ---"
  docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
  echo ""
  echo "--- Images ---"
  docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
  echo ""
  echo "--- Volumes ---"
  docker volume ls
  echo ""
  echo "--- Réseaux Docker ---"
  docker network ls
  echo ""
  echo "--- Détail des réseaux (containers connectés) ---"
  for net in $(docker network ls --format "{{.Name}}" | grep -v "^bridge$\|^host$\|^none$"); do
    echo ""
    echo ">> Réseau: $net"
    docker network inspect "$net" --format '{{range .Containers}}  - {{.Name}} ({{.IPv4Address}}){{"\n"}}{{end}}' 2>/dev/null
  done
else
  echo "Docker NON installé"
fi

section "PORTS OUVERTS"
ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null || echo "ss/netstat non disponible"

section "FIREWALL"
if command -v ufw &>/dev/null; then
  ufw status verbose
elif command -v firewall-cmd &>/dev/null; then
  firewall-cmd --list-all
elif command -v iptables &>/dev/null; then
  iptables -L -n --line-numbers 2>/dev/null | head -40
else
  echo "Aucun firewall détecté"
fi

section "NGINX (système)"
if command -v nginx &>/dev/null; then
  nginx -v 2>&1
  echo "--- Sites activés ---"
  ls /etc/nginx/sites-enabled/ 2>/dev/null || ls /etc/nginx/conf.d/ 2>/dev/null || echo "Pas de sites"
  echo "--- Config principale ---"
  nginx -T 2>/dev/null | head -80 || echo "Erreur lecture config"
else
  echo "Nginx système: NON installé"
fi

section "APACHE"
if command -v apache2 &>/dev/null || command -v httpd &>/dev/null; then
  apache2 -v 2>/dev/null || httpd -v 2>/dev/null
  echo "Apache détecté !"
else
  echo "Apache: NON installé"
fi

section "CERTBOT / SSL"
if command -v certbot &>/dev/null; then
  certbot --version
  echo "--- Certificats existants ---"
  certbot certificates 2>/dev/null || ls /etc/letsencrypt/live/ 2>/dev/null || echo "Aucun certificat"
else
  echo "Certbot: NON installé"
fi
echo ""
echo "--- Certificats dans /etc/letsencrypt ---"
ls /etc/letsencrypt/live/ 2>/dev/null || echo "Répertoire inexistant"

section "FICHIERS DOCKER-COMPOSE EXISTANTS"
find /opt /home /root /srv /var/www -name "docker-compose*.yml" -o -name "docker-compose*.yaml" 2>/dev/null | head -20
echo ""
echo "--- Contenu de /opt ---"
ls -la /opt/ 2>/dev/null
echo ""
echo "--- Contenu de /var/www ---"
ls -la /var/www/ 2>/dev/null || echo "Répertoire inexistant"

section "VARIABLES D'ENVIRONNEMENT PERTINENTES"
env | grep -iE "docker|node|npm|path|home|user" | sort

section "NGINX PROXY MANAGER (détection)"
if docker ps --format "{{.Image}}" 2>/dev/null | grep -qi "nginx-proxy-manager\|jc21"; then
  echo "✅ Nginx Proxy Manager détecté dans Docker"
  docker ps --filter "ancestor=jc21/nginx-proxy-manager" --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}" 2>/dev/null
elif docker ps --format "{{.Names}}" 2>/dev/null | grep -qi "npm\|proxy"; then
  echo "Un proxy possible détecté :"
  docker ps --format "{{.Names}}\t{{.Image}}" | grep -i "npm\|proxy"
else
  echo "❌ Nginx Proxy Manager non détecté"
fi

section "TRAEFIK (détection)"
if docker ps --format "{{.Image}}" 2>/dev/null | grep -qi "traefik"; then
  echo "✅ Traefik détecté"
  docker ps --filter "name=traefik" --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
else
  echo "❌ Traefik non détecté"
fi

section "MÉMOIRE DOCKER"
docker system df 2>/dev/null || echo "Non disponible"

section "RÉSUMÉ"
echo "IP publique     : $(curl -s --max-time 5 ifconfig.me)"
echo "OS              : $(grep PRETTY_NAME /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d '"' || uname -s)"
echo "Docker          : $(docker --version 2>/dev/null | awk '{print $3}' | tr -d ',' || echo 'absent')"
echo "Containers actifs: $(docker ps -q 2>/dev/null | wc -l)"
echo "Port 80 libre   : $(ss -tlnp 2>/dev/null | grep -q ':80' && echo 'NON (occupé)' || echo 'OUI')"
echo "Port 443 libre  : $(ss -tlnp 2>/dev/null | grep -q ':443' && echo 'NON (occupé)' || echo 'OUI')"
echo "Port 81 libre   : $(ss -tlnp 2>/dev/null | grep -q ':81' && echo 'NON (occupé)' || echo 'OUI')"
echo ""
echo "═══ FIN DU DIAGNOSTIC — Partagez cette sortie complète ═══"

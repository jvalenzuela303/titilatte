#!/usr/bin/env bash
# =============================================================================
# docker-cleanup.sh — Limpieza automática diaria de imágenes Docker obsoletas
# Ejecutado por cron como root en server01.titilatte.cl
#
# Instalación (ejecutar una sola vez en el servidor):
#   chmod +x /opt/titilatte/infra/scripts/docker-cleanup.sh
#   (crontab -l 2>/dev/null; echo "0 3 * * * /opt/titilatte/infra/scripts/docker-cleanup.sh >> /var/log/docker-cleanup.log 2>&1") | crontab -
# =============================================================================
set -euo pipefail

LOG_FILE="/var/log/docker-cleanup.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

log() { echo "[${TIMESTAMP}] $*" | tee -a "$LOG_FILE"; }

log "=== Inicio limpieza Docker ==="

# Espacio en disco antes
BEFORE=$(df -h /var/lib/docker 2>/dev/null | awk 'NR==2 {print $4}' || echo "N/A")
log "Espacio libre antes: ${BEFORE}"

# 1. Imágenes sin tag (dangling) — generadas en cada build, nunca usadas
DANGLING=$(docker image prune -f 2>&1)
log "Dangling: ${DANGLING}"

# 2. Imágenes sin contenedor asociado más viejas de 7 días
#    --filter until=168h protege rebuilds recientes de la última semana
UNUSED=$(docker image prune -a --force --filter "until=168h" 2>&1)
log "Unused (>7d): ${UNUSED}"

# 3. Volúmenes anónimos huérfanos
VOLUMES=$(docker volume prune -f 2>&1)
log "Volumes: ${VOLUMES}"

# 4. Redes no usadas
NETWORKS=$(docker network prune -f 2>&1)
log "Networks: ${NETWORKS}"

# Espacio en disco después
AFTER=$(df -h /var/lib/docker 2>/dev/null | awk 'NR==2 {print $4}' || echo "N/A")
log "Espacio libre después: ${AFTER}"
log "=== Fin limpieza Docker ==="

# Rotar log si supera 5 MB
if [ -f "$LOG_FILE" ] && [ "$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)" -gt 5242880 ]; then
    mv "$LOG_FILE" "${LOG_FILE}.old"
    log "Log rotado (superó 5 MB)"
fi

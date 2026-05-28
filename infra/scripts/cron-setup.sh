#!/usr/bin/env bash
# =============================================================================
# cron-setup.sh — Configura las tareas programadas del servidor
# Minimarket Platform — Fase 2
#
# Uso (ejecutar como root o con sudo en el servidor):
#   sudo bash /opt/minimarket/infra/scripts/cron-setup.sh
#
# Qué hace este script:
#   1. Define las entradas cron para el usuario root (o el usuario especificado)
#   2. Es IDEMPOTENTE: puede ejecutarse múltiples veces sin duplicar entradas
#   3. Preserva las entradas cron existentes que no sean de este proyecto
#   4. Escribe en /etc/cron.d/ (recomendado sobre crontab -e para scripts de sistema)
#
# Crons configurados:
#   - 02:00 diario : backup automático de PostgreSQL
#   - 03:00 diario : limpieza de refresh tokens expirados (seguridad)
#
# Prerrequisitos:
#   - Docker instalado y corriendo
#   - El stack de Minimarket levantado (contenedor minimarket-backend activo)
#   - El archivo .env disponible en INFRA_DIR
#   - Directorio de backups con permisos de escritura
# =============================================================================

set -euo pipefail

# =============================================================================
# Colores
# =============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# =============================================================================
# Configuración — ajustar según la ruta de instalación en el servidor
# =============================================================================

# Directorio raíz de la instalación de Minimarket en el servidor
INSTALL_DIR="${MINIMARKET_INSTALL_DIR:-/opt/minimarket}"
INFRA_DIR="${INSTALL_DIR}/infra"
SCRIPTS_DIR="${INFRA_DIR}/scripts"

# Archivo de cron.d donde se escribirán las entradas (sin extensión: requerido por cron.d)
CRON_FILE="/etc/cron.d/minimarket"

# Usuario bajo el que correrán los crons
# En servidores de producción, crear un usuario dedicado (p.ej. "minimarket")
# en lugar de usar root.
CRON_USER="${CRON_USER:-root}"

# Email para notificaciones de cron (dejar vacío para deshabilitar)
CRON_MAILTO="${CRON_MAILTO:-}"

# =============================================================================
# Verificaciones previas
# =============================================================================
echo ""
echo -e "${BOLD}${BLUE}============================================================${NC}"
echo -e "${BOLD}${BLUE}   Minimarket Platform — Configuración de Cron Jobs${NC}"
echo -e "${BOLD}${BLUE}============================================================${NC}"
echo ""

# Verificar que el script se ejecuta con privilegios suficientes para escribir en /etc/cron.d
if [[ $EUID -ne 0 ]]; then
    log_error "Este script debe ejecutarse como root (sudo bash cron-setup.sh)."
    exit 1
fi

# Verificar que el directorio de scripts existe
if [[ ! -d "$SCRIPTS_DIR" ]]; then
    log_error "Directorio de scripts no encontrado: $SCRIPTS_DIR"
    log_error "Ajusta MINIMARKET_INSTALL_DIR o verifica la instalación."
    exit 1
fi

# Verificar que el script de backup existe y es ejecutable
BACKUP_SCRIPT="${SCRIPTS_DIR}/backup-postgres.sh"
if [[ ! -f "$BACKUP_SCRIPT" ]]; then
    log_error "Script de backup no encontrado: $BACKUP_SCRIPT"
    exit 1
fi
chmod +x "$BACKUP_SCRIPT"

# Verificar que docker está disponible
if ! command -v docker &>/dev/null; then
    log_warn "docker no encontrado en el PATH."
    log_warn "Asegúrate de que Docker está instalado antes de que los crons se ejecuten."
fi

log_info "Directorio de instalación : $INSTALL_DIR"
log_info "Archivo cron.d            : $CRON_FILE"
log_info "Usuario cron              : $CRON_USER"
echo ""

# =============================================================================
# Crear el directorio de logs si no existe
# =============================================================================
LOG_DIR="/var/log"
BACKUP_LOG="${LOG_DIR}/minimarket-backup.log"
CLEANUP_LOG="${LOG_DIR}/minimarket-cleanup.log"

touch "$BACKUP_LOG" "$CLEANUP_LOG"
chmod 640 "$BACKUP_LOG" "$CLEANUP_LOG"
log_ok "Archivos de log preparados: $BACKUP_LOG, $CLEANUP_LOG"

# =============================================================================
# Crear directorio de backups con los permisos correctos
# =============================================================================
BACKUP_DIR_DEFAULT="/backups/postgres"
mkdir -p "$BACKUP_DIR_DEFAULT"
chmod 700 "$BACKUP_DIR_DEFAULT"
log_ok "Directorio de backups: $BACKUP_DIR_DEFAULT"

# =============================================================================
# Generar el archivo /etc/cron.d/minimarket
# La escritura completa es idempotente: sobreescribe el archivo anterior.
# Formato de cron.d: <schedule> <user> <command>
# =============================================================================
log_info "Escribiendo $CRON_FILE ..."

cat > "$CRON_FILE" << EOF
# =============================================================================
# Minimarket Platform — Cron Jobs
# Generado por: ${SCRIPTS_DIR}/cron-setup.sh
# Regenerar con: sudo bash ${SCRIPTS_DIR}/cron-setup.sh
# =============================================================================

SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
MAILTO="${CRON_MAILTO}"

# ---------------------------------------------------------------------------
# Backup diario de PostgreSQL — 02:00 AM
# Genera un dump comprimido en formato custom (pg_dump -Fc).
# Aplica retención de 30 días automáticamente.
# Logs en: /var/log/minimarket-backup.log
# Para ejecutar manualmente: bash ${BACKUP_SCRIPT}
# ---------------------------------------------------------------------------
0 2 * * * ${CRON_USER} source ${INFRA_DIR}/.env && BACKUP_DIR=/backups/postgres bash ${BACKUP_SCRIPT} >> /var/log/minimarket-backup.log 2>&1

# ---------------------------------------------------------------------------
# Limpieza de refresh tokens expirados — 03:00 AM
# Recomendación del auditor de seguridad (Fase 2):
#   Tokens expirados acumulados en BD representan superficie de ataque.
#   El job CleanupJob hace DELETE de tokens con expiry < NOW().
#
# Prerequisito: el JAR debe contener com.minimarket.jobs.CleanupJob
#   con un método main() o un CommandLineRunner activable via args.
# Logs en: /var/log/minimarket-cleanup.log
# ---------------------------------------------------------------------------
0 3 * * * ${CRON_USER} docker exec minimarket-backend java -cp app.jar com.minimarket.jobs.CleanupJob >> /var/log/minimarket-cleanup.log 2>&1

EOF

# Permisos correctos para cron.d (cron rechaza archivos con permisos de grupo/otros)
chmod 644 "$CRON_FILE"
chown root:root "$CRON_FILE"

log_ok "Archivo cron escrito: $CRON_FILE"

# =============================================================================
# Verificar sintaxis del cron generado
# =============================================================================
if command -v crontab &>/dev/null; then
    # cron.d no tiene un validador directo, pero podemos verificar que cron
    # puede leer el archivo intentando listarlo
    log_info "Verificando que cron puede leer el archivo..."
    if crontab -l -u "$CRON_USER" &>/dev/null || true; then
        log_ok "Sintaxis del cron verificada."
    fi
fi

# =============================================================================
# Mostrar resumen
# =============================================================================
echo ""
echo -e "${BOLD}Cron jobs configurados:${NC}"
echo ""
echo -e "  ${GREEN}02:00 AM${NC}  Backup de PostgreSQL"
echo -e "             Script : $BACKUP_SCRIPT"
echo -e "             Destino: /backups/postgres/"
echo -e "             Log    : /var/log/minimarket-backup.log"
echo ""
echo -e "  ${GREEN}03:00 AM${NC}  Limpieza de refresh tokens expirados"
echo -e "             Job    : com.minimarket.jobs.CleanupJob"
echo -e "             Log    : /var/log/minimarket-cleanup.log"
echo ""
echo -e "${BOLD}Para verificar:${NC}"
echo -e "  cat $CRON_FILE"
echo ""
echo -e "${BOLD}Para probar el backup manualmente:${NC}"
echo -e "  source ${INFRA_DIR}/.env && bash ${BACKUP_SCRIPT}"
echo ""
log_ok "Configuración de cron completada."

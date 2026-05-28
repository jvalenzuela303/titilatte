#!/usr/bin/env bash
# =============================================================================
# backup-postgres.sh — Backup automático de PostgreSQL (Minimarket Platform)
# Fase 2
#
# Uso:
#   bash backup-postgres.sh
#
# Compatible con ejecución:
#   a) Desde el HOST con variables del .env:
#        source /opt/minimarket/infra/.env && bash backup-postgres.sh
#   b) Desde DENTRO del contenedor postgres:
#        docker exec minimarket-postgres bash /scripts/backup-postgres.sh
#   c) Via cron (ver infra/scripts/cron-setup.sh)
#
# Variables de entorno reconocidas (sobreescriben los defaults):
#   POSTGRES_DB       — nombre de la base de datos (requerido)
#   POSTGRES_USER     — usuario de la base de datos (requerido)
#   POSTGRES_PASSWORD — contraseña (requerido)
#   POSTGRES_HOST     — hostname del servidor postgres (default: localhost)
#   POSTGRES_PORT     — puerto (default: 5432)
#   BACKUP_DIR        — directorio donde se guardan los dumps (default: /backups/postgres)
#   BACKUP_RETENTION_DAYS — días de retención antes de eliminar (default: 30)
# =============================================================================

set -euo pipefail

# =============================================================================
# Configuración — todos sobreescribibles por variables de entorno
# =============================================================================
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:?ERROR: POSTGRES_DB no definido}"
POSTGRES_USER="${POSTGRES_USER:?ERROR: POSTGRES_USER no definido}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?ERROR: POSTGRES_PASSWORD no definido}"
BACKUP_DIR="${BACKUP_DIR:-/backups/postgres}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
LOG_FILE="${BACKUP_LOG_FILE:-/var/log/minimarket-backup.log}"

# Timestamp para el nombre del archivo y los logs
TIMESTAMP="$(date '+%Y%m%d_%H%M%S')"
BACKUP_FILENAME="minimarket_${TIMESTAMP}.dump"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

# =============================================================================
# Funciones auxiliares
# =============================================================================

# Escribe en stdout Y en el log file (con timestamp en cada línea)
log() {
    local level="$1"
    shift
    local message="$*"
    local entry="[$(date '+%Y-%m-%d %H:%M:%S')] [${level}] ${message}"
    echo "$entry"

    # Asegurar que el directorio del log existe
    local log_dir
    log_dir="$(dirname "$LOG_FILE")"
    if [[ ! -d "$log_dir" ]]; then
        mkdir -p "$log_dir" 2>/dev/null || true
    fi

    echo "$entry" >> "$LOG_FILE" 2>/dev/null || true
}

log_info()  { log "INFO " "$@"; }
log_ok()    { log "OK   " "$@"; }
log_warn()  { log "WARN " "$@"; }
log_error() { log "ERROR" "$@" >&2; }

# Función de limpieza: se ejecuta al salir (exit trap)
# Si el dump quedó incompleto por un error, lo elimina para no dejar archivos corruptos.
cleanup_on_error() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        if [[ -f "$BACKUP_PATH" ]]; then
            log_warn "Backup fallido — eliminando archivo incompleto: $BACKUP_PATH"
            rm -f "$BACKUP_PATH"
        fi
        log_error "Backup FALLIDO con código de salida $exit_code. Revisa $LOG_FILE"
    fi
}

trap cleanup_on_error EXIT

# =============================================================================
# Paso 1: Verificar prerrequisitos
# =============================================================================
log_info "=== Iniciando backup de PostgreSQL ==="
log_info "Base de datos : ${POSTGRES_DB}"
log_info "Host          : ${POSTGRES_HOST}:${POSTGRES_PORT}"
log_info "Directorio    : ${BACKUP_DIR}"
log_info "Retención     : ${BACKUP_RETENTION_DAYS} días"

if ! command -v pg_dump &>/dev/null; then
    log_error "pg_dump no encontrado en el PATH."
    log_error "  Instala postgresql-client o ejecuta este script dentro del contenedor postgres."
    exit 1
fi

# =============================================================================
# Paso 2: Crear directorio de backups si no existe
# =============================================================================
if [[ ! -d "$BACKUP_DIR" ]]; then
    log_info "Creando directorio de backups: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
    # Permisos restrictivos — solo el usuario actual puede leer/escribir
    chmod 700 "$BACKUP_DIR"
fi

# =============================================================================
# Paso 3: Ejecutar pg_dump
# Formato custom (-Fc): binario comprimido, permite restauración selectiva.
# Permite usar pg_restore con --table, --schema, etc.
# =============================================================================
log_info "Ejecutando pg_dump → $BACKUP_PATH"

# Exportar la contraseña via PGPASSWORD para evitar prompt interactivo.
# pg_dump nunca pone la contraseña en argumentos de línea de comandos (visible en ps).
export PGPASSWORD="$POSTGRES_PASSWORD"

pg_dump \
    --host="$POSTGRES_HOST" \
    --port="$POSTGRES_PORT" \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --format=custom \
    --compress=9 \
    --no-password \
    --verbose \
    --file="$BACKUP_PATH" 2>>"$LOG_FILE"

unset PGPASSWORD

# =============================================================================
# Paso 4: Verificar integridad del archivo generado
# =============================================================================
if [[ ! -f "$BACKUP_PATH" ]]; then
    log_error "El archivo de backup no fue creado: $BACKUP_PATH"
    exit 1
fi

BACKUP_SIZE="$(du -sh "$BACKUP_PATH" | cut -f1)"

# Tamaño mínimo esperado: 1KB. Un dump de 0 bytes indica un error silencioso.
BACKUP_SIZE_BYTES="$(stat -c%s "$BACKUP_PATH")"
if [[ "$BACKUP_SIZE_BYTES" -lt 1024 ]]; then
    log_error "El archivo de backup es sospechosamente pequeño (${BACKUP_SIZE_BYTES} bytes)."
    log_error "Posible dump vacío o error no capturado. Revisa los logs."
    exit 1
fi

log_ok "Backup completado: $BACKUP_PATH ($BACKUP_SIZE)"

# =============================================================================
# Paso 5: Aplicar política de retención
# Elimina backups con más de BACKUP_RETENTION_DAYS días de antigüedad.
# =============================================================================
log_info "Aplicando retención: eliminando backups con más de ${BACKUP_RETENTION_DAYS} días..."

DELETED_COUNT=0
while IFS= read -r old_file; do
    log_warn "Eliminando backup antiguo: $old_file"
    rm -f "$old_file"
    DELETED_COUNT=$((DELETED_COUNT + 1))
done < <(find "$BACKUP_DIR" \
    -maxdepth 1 \
    -name "minimarket_*.dump" \
    -type f \
    -mtime +"$BACKUP_RETENTION_DAYS" \
    2>/dev/null)

if [[ "$DELETED_COUNT" -gt 0 ]]; then
    log_ok "Eliminados $DELETED_COUNT backup(s) expirado(s)."
else
    log_info "No hay backups expirados para eliminar."
fi

# =============================================================================
# Paso 6: Resumen final
# =============================================================================
TOTAL_BACKUPS="$(find "$BACKUP_DIR" -maxdepth 1 -name "minimarket_*.dump" -type f 2>/dev/null | wc -l)"
TOTAL_SIZE="$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo "desconocido")"

log_ok "=== Backup finalizado con éxito ==="
log_info "Archivo    : $BACKUP_FILENAME"
log_info "Tamaño     : $BACKUP_SIZE"
log_info "Total dumps: $TOTAL_BACKUPS archivo(s) en $BACKUP_DIR ($TOTAL_SIZE)"

# El exit code 0 indica éxito — cron / alertas pueden depender de esto.
exit 0

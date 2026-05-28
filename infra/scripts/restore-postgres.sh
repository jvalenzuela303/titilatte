#!/usr/bin/env bash
# =============================================================================
# restore-postgres.sh — Restauración de backup PostgreSQL (Minimarket Platform)
# Fase 2
#
# Uso:
#   bash restore-postgres.sh <archivo.dump>
#
# Ejemplos:
#   bash restore-postgres.sh /backups/postgres/minimarket_20260526_020001.dump
#   bash restore-postgres.sh /backups/postgres/minimarket_20260526_020001.dump --yes
#
# Opciones:
#   --yes   Salta la confirmación interactiva (útil en pipelines automatizados
#           donde la restauración ya fue aprobada externamente). Usar con cuidado.
#
# ADVERTENCIA: Esta operación es DESTRUCTIVA.
#   pg_restore --clean elimina y recrea todos los objetos del schema antes
#   de importar los datos. Todo lo que no esté en el dump se perderá.
#
# Variables de entorno requeridas (carga desde .env si existe):
#   POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
#   POSTGRES_HOST (default: localhost), POSTGRES_PORT (default: 5432)
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
# Carga variables desde .env si existe en el directorio padre del script
# (permite ejecutar el script directamente sin source previo)
# =============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"

if [[ -f "$ENV_FILE" ]]; then
    log_info "Cargando variables desde: $ENV_FILE"
    # shellcheck disable=SC1090
    set -a
    source "$ENV_FILE"
    set +a
else
    log_warn ".env no encontrado en ${SCRIPT_DIR}/../"
    log_warn "Asegúrate de tener POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD en el entorno."
fi

# =============================================================================
# Argumentos
# =============================================================================
DUMP_FILE=""
SKIP_CONFIRM=false

for arg in "$@"; do
    case "$arg" in
        --yes)  SKIP_CONFIRM=true ;;
        --help)
            grep '^#' "$0" | head -30 | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        -*)
            log_error "Opción desconocida: $arg"
            echo "Uso: $0 <archivo.dump> [--yes]"
            exit 1
            ;;
        *)
            # El primer argumento posicional es el archivo de dump
            DUMP_FILE="$arg"
            ;;
    esac
done

# =============================================================================
# Verificar argumento obligatorio
# =============================================================================
if [[ -z "$DUMP_FILE" ]]; then
    log_error "Debes especificar el archivo .dump a restaurar."
    echo ""
    echo "  Uso: $0 <archivo.dump> [--yes]"
    echo ""
    echo "  Ejemplo:"
    echo "    $0 /backups/postgres/minimarket_20260526_020001.dump"
    exit 1
fi

# =============================================================================
# Verificar que el archivo existe y es legible
# =============================================================================
if [[ ! -f "$DUMP_FILE" ]]; then
    log_error "El archivo no existe: $DUMP_FILE"
    exit 1
fi

if [[ ! -r "$DUMP_FILE" ]]; then
    log_error "Sin permisos de lectura sobre: $DUMP_FILE"
    exit 1
fi

# Verificar que el archivo tiene contenido mínimo
DUMP_SIZE_BYTES="$(stat -c%s "$DUMP_FILE")"
if [[ "$DUMP_SIZE_BYTES" -lt 1024 ]]; then
    log_error "El archivo parece estar vacío o corrupto (${DUMP_SIZE_BYTES} bytes)."
    exit 1
fi

DUMP_SIZE="$(du -sh "$DUMP_FILE" | cut -f1)"

# =============================================================================
# Verificar variables de entorno requeridas
# =============================================================================
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
: "${POSTGRES_DB:?ERROR: POSTGRES_DB no definido}"
: "${POSTGRES_USER:?ERROR: POSTGRES_USER no definido}"
: "${POSTGRES_PASSWORD:?ERROR: POSTGRES_PASSWORD no definido}"

# =============================================================================
# Verificar que pg_restore está disponible
# =============================================================================
if ! command -v pg_restore &>/dev/null; then
    log_error "pg_restore no encontrado en el PATH."
    log_error "  Instala postgresql-client o ejecuta desde dentro del contenedor postgres."
    exit 1
fi

# =============================================================================
# Mostrar resumen y solicitar confirmación
# =============================================================================
echo ""
echo -e "${BOLD}${RED}============================================================${NC}"
echo -e "${BOLD}${RED}   ADVERTENCIA — OPERACION DESTRUCTIVA${NC}"
echo -e "${BOLD}${RED}============================================================${NC}"
echo ""
echo -e "  Archivo dump  : ${BOLD}$DUMP_FILE${NC} (${DUMP_SIZE})"
echo -e "  Base de datos : ${BOLD}${POSTGRES_DB}${NC}"
echo -e "  Host          : ${BOLD}${POSTGRES_HOST}:${POSTGRES_PORT}${NC}"
echo -e "  Usuario       : ${BOLD}${POSTGRES_USER}${NC}"
echo ""
echo -e "${YELLOW}  Esta operacion ELIMINARA todos los objetos existentes en la base${NC}"
echo -e "${YELLOW}  de datos '${POSTGRES_DB}' y los reemplazara con el contenido del dump.${NC}"
echo -e "${YELLOW}  Los datos que no esten en el backup se PERDERAN PERMANENTEMENTE.${NC}"
echo ""

if [[ "$SKIP_CONFIRM" == "false" ]]; then
    # Doble confirmación para operación destructiva en producción/staging
    read -rp "  ¿Confirmas que deseas restaurar? Escribe 'RESTAURAR' para continuar: " CONFIRM_1
    if [[ "$CONFIRM_1" != "RESTAURAR" ]]; then
        log_info "Restauración cancelada por el usuario."
        exit 0
    fi

    read -rp "  Confirmación final: ¿estás seguro? [s/N]: " CONFIRM_2
    if [[ ! "$CONFIRM_2" =~ ^[sS]$ ]]; then
        log_info "Restauración cancelada por el usuario."
        exit 0
    fi
else
    # SECURITY: --yes bypasses interactive confirmation. Log a mandatory audit trail so
    # unattended restores (e.g., CI pipelines) are always traceable.
    # WHO triggered this, WHEN, from WHERE, and WHICH dump was used is critical evidence
    # in a post-incident review. Do NOT suppress this block when adding --yes to a pipeline.
    log_warn "--yes especificado: saltando confirmación interactiva."
    log_warn "AUDIT: restauración no-interactiva iniciada"
    log_warn "  Dump     : $DUMP_FILE"
    log_warn "  Usuario  : ${USER:-desconocido} (UID=${UID:-?})"
    log_warn "  Hostname : $(hostname -f 2>/dev/null || hostname)"
    log_warn "  Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
fi

# =============================================================================
# Ejecutar pg_restore
# Opciones clave:
#   --clean       : DROP + CREATE de cada objeto antes de restaurar
#   --if-exists   : evita errores si un objeto ya fue dropeado en cascada
#   --no-owner    : no restaura el ownership (útil si el usuario difiere)
#   --no-privileges: no restaura GRANT/REVOKE (idem)
#   --exit-on-error: aborta al primer error de restauración
#   --verbose     : imprime cada objeto restaurado al log
# =============================================================================
log_info "Iniciando restauración..."

export PGPASSWORD="$POSTGRES_PASSWORD"

pg_restore \
    --host="$POSTGRES_HOST" \
    --port="$POSTGRES_PORT" \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --exit-on-error \
    --verbose \
    "$DUMP_FILE"

RESTORE_EXIT_CODE=$?
unset PGPASSWORD

# =============================================================================
# Resultado
# =============================================================================
if [[ $RESTORE_EXIT_CODE -eq 0 ]]; then
    echo ""
    log_ok "======================================================"
    log_ok "Restauracion completada exitosamente."
    log_ok "Base de datos '${POSTGRES_DB}' restaurada desde:"
    log_ok "  $DUMP_FILE"
    log_ok "======================================================"
    echo ""
    log_warn "Acciones recomendadas post-restauracion:"
    log_warn "  1. Reiniciar el backend para limpiar connection pool:"
    log_warn "       docker restart minimarket-backend"
    log_warn "  2. Verificar migraciones Flyway:"
    log_warn "       docker logs minimarket-backend | grep -i flyway"
    log_warn "  3. Ejecutar smoke tests sobre el ambiente restaurado."
else
    log_error "pg_restore finalizó con errores (código: $RESTORE_EXIT_CODE)."
    log_error "Revisa la salida anterior para identificar qué objetos fallaron."
    exit 1
fi

exit 0

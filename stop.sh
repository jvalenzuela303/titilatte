#!/usr/bin/env bash
# =============================================================================
# stop.sh — Detiene el sistema Minimarket
#
# Uso desde la raíz del proyecto:
#   bash stop.sh           # detiene contenedores, conserva datos
#   bash stop.sh --clean   # detiene y elimina volúmenes (borra BD)
#   bash stop.sh --help    # muestra ayuda
# =============================================================================

set -euo pipefail

# ── Directorio del script (raíz del proyecto) ───────────────────────────────
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="${ROOT_DIR}/infra"
ENV_FILE="${INFRA_DIR}/.env"

# ── Colores ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# ── Flags ────────────────────────────────────────────────────────────────────
CLEAN=false

for arg in "$@"; do
    case "$arg" in
        --clean) CLEAN=true ;;
        --help|-h)
            echo "Uso: bash stop.sh [opciones]"
            echo ""
            echo "Opciones:"
            echo "  --clean    Elimina volúmenes y datos de la base de datos (reset total)"
            echo "  -h, --help Muestra esta ayuda"
            echo ""
            echo "Sin opciones: detiene los contenedores pero conserva los datos."
            exit 0
            ;;
        *)
            echo -e "${RED}Argumento desconocido: $arg${NC}" >&2
            echo "Usa --help para ver las opciones." >&2
            exit 1
            ;;
    esac
done

# ── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}║       Minimarket Platform — Detener Sistema      ║${NC}"
echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ── Verificar Docker ─────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null || ! docker info &>/dev/null 2>&1; then
    echo -e "${YELLOW}[WARN]${NC} Docker no está corriendo. No hay nada que detener."
    exit 0
fi

# ── Construir comando base ───────────────────────────────────────────────────
ENV_ARGS=()
[[ -f "$ENV_FILE" ]] && ENV_ARGS+=(--env-file "${ENV_FILE}")

COMPOSE_BASE=(
    docker compose
    -f "${INFRA_DIR}/docker-compose.yml"
    -f "${INFRA_DIR}/docker-compose.override.yml"
    "${ENV_ARGS[@]}"
)

# ── Verificar si hay contenedores corriendo ───────────────────────────────────
RUNNING=$(docker compose -f "${INFRA_DIR}/docker-compose.yml" ps --quiet 2>/dev/null | wc -l | tr -d ' ')

if [[ "$RUNNING" -eq 0 ]]; then
    echo -e "${YELLOW}[INFO]${NC} No hay contenedores de Minimarket en ejecución."
    exit 0
fi

echo -e "${BLUE}[INFO]${NC} Contenedores activos: ${RUNNING}"

# ── Detener con o sin limpieza ────────────────────────────────────────────────
if [[ "$CLEAN" == "true" ]]; then
    echo ""
    echo -e "${RED}  ADVERTENCIA: Se eliminarán TODOS los datos de la base de datos.${NC}"
    echo -e "${RED}  Esta acción no se puede deshacer.${NC}"
    echo ""
    read -rp "  ¿Confirmar eliminación de datos? [s/N]: " CONF
    if [[ "$CONF" =~ ^[sS]$ ]]; then
        echo -e "${BLUE}[INFO]${NC} Deteniendo y eliminando volúmenes..."
        cd "${INFRA_DIR}"
        "${COMPOSE_BASE[@]}" down --volumes --remove-orphans
        echo ""
        echo -e "${GREEN}[OK]${NC}   Sistema detenido y datos eliminados."
    else
        echo -e "${YELLOW}[INFO]${NC} Cancelado. Sin cambios."
        exit 0
    fi
else
    echo -e "${BLUE}[INFO]${NC} Deteniendo contenedores (los datos se conservan)..."
    cd "${INFRA_DIR}"
    "${COMPOSE_BASE[@]}" down --remove-orphans
    echo ""
    echo -e "${GREEN}[OK]${NC}   Sistema detenido correctamente."
    echo ""
    echo -e "  Los datos de la base de datos se conservaron."
    echo -e "  Para volver a levantar: ${BOLD}bash start.sh${NC}"
    echo -e "  Para eliminar datos:    ${BOLD}bash stop.sh --clean${NC}"
fi

echo ""

#!/usr/bin/env bash
# =============================================================================
# start.sh — Levanta el sistema Minimarket completo
#
# Uso desde la raíz del proyecto:
#   bash start.sh            # modo interactivo (logs en pantalla)
#   bash start.sh -d         # modo background (detached)
#   bash start.sh --build    # fuerza rebuild de imágenes
#   bash start.sh --clean    # reset total (borra datos de BD)
#   bash start.sh -d --build # background + rebuild
# =============================================================================

set -euo pipefail

# ── Directorio del script (raíz del proyecto) ───────────────────────────────
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="${ROOT_DIR}/infra"
ENV_FILE="${INFRA_DIR}/.env"
ENV_EXAMPLE="${INFRA_DIR}/.env.example"

# ── Colores ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# ── Flags ────────────────────────────────────────────────────────────────────
DETACH=false
BUILD=false
CLEAN=false

for arg in "$@"; do
    case "$arg" in
        -d|--detach) DETACH=true ;;
        --build)     BUILD=true  ;;
        --clean)     CLEAN=true  ;;
        --help|-h)
            echo "Uso: bash start.sh [opciones]"
            echo ""
            echo "Opciones:"
            echo "  -d, --detach   Levanta en background (sin logs en pantalla)"
            echo "  --build        Reconstruye las imágenes Docker"
            echo "  --clean        Elimina contenedores y volúmenes (reset de BD)"
            echo "  -h, --help     Muestra esta ayuda"
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
echo -e "${BOLD}${BLUE}║       Minimarket Platform — Sistema Completo     ║${NC}"
echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ── Paso 1: Verificar Docker ─────────────────────────────────────────────────
echo -e "${BLUE}[1/5]${NC} Verificando Docker..."

if ! command -v docker &>/dev/null; then
    echo -e "${RED}[ERROR]${NC} Docker no está instalado."
    echo "        Instala desde: https://docs.docker.com/engine/install/"
    exit 1
fi

if ! docker compose version &>/dev/null; then
    echo -e "${RED}[ERROR]${NC} Docker Compose plugin v2 no encontrado."
    echo "        Instala desde: https://docs.docker.com/compose/install/"
    exit 1
fi

if ! docker info &>/dev/null 2>&1; then
    echo -e "${RED}[ERROR]${NC} El daemon de Docker no está corriendo."
    echo "        Inícialo con: sudo systemctl start docker"
    exit 1
fi

DOCKER_VER=$(docker --version | awk '{print $3}' | tr -d ',')
COMPOSE_VER=$(docker compose version --short 2>/dev/null || echo "?")
echo -e "${GREEN}[OK]${NC}   Docker ${DOCKER_VER} | Compose ${COMPOSE_VER}"

# ── Paso 2: Verificar archivo .env ───────────────────────────────────────────
echo -e "${BLUE}[2/5]${NC} Verificando configuración..."

if [[ ! -f "$ENV_FILE" ]]; then
    if [[ -f "$ENV_EXAMPLE" ]]; then
        echo -e "${YELLOW}[WARN]${NC} .env no encontrado. Creando desde .env.example..."
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        echo -e "${GREEN}[OK]${NC}   .env creado en: ${ENV_FILE}"
        echo ""
        echo -e "${YELLOW}  IMPORTANTE: Antes de usar en producción, edita ${ENV_FILE} y configura:${NC}"
        echo -e "${YELLOW}    - POSTGRES_PASSWORD${NC}"
        echo -e "${YELLOW}    - JWT_SECRET  (genera con: openssl rand -base64 64)${NC}"
        echo ""
        read -rp "  ¿Continuar con los valores por defecto? [s/N]: " RESP
        [[ ! "$RESP" =~ ^[sS]$ ]] && { echo "Abortado. Edita ${ENV_FILE} y vuelve a ejecutar."; exit 0; }
    else
        echo -e "${RED}[ERROR]${NC} No existe ${INFRA_DIR}/.env ni .env.example"
        exit 1
    fi
else
    echo -e "${GREEN}[OK]${NC}   .env encontrado"
fi

# ── Paso 3: Limpieza opcional ────────────────────────────────────────────────
if [[ "$CLEAN" == "true" ]]; then
    echo -e "${BLUE}[3/5]${NC} Limpiando contenedores y volúmenes..."
    echo -e "${RED}  ADVERTENCIA: Se eliminarán todos los datos de la base de datos.${NC}"
    read -rp "  ¿Confirmar reset total? [s/N]: " CONF
    if [[ "$CONF" =~ ^[sS]$ ]]; then
        docker compose \
            -f "${INFRA_DIR}/docker-compose.yml" \
            -f "${INFRA_DIR}/docker-compose.override.yml" \
            --env-file "${ENV_FILE}" \
            down --volumes --remove-orphans 2>/dev/null || true
        echo -e "${GREEN}[OK]${NC}   Limpieza completada"
    else
        echo -e "${YELLOW}[WARN]${NC} Limpieza cancelada"
    fi
else
    echo -e "${GREEN}[OK]${NC}   Sin limpieza (usa --clean para reset total)"
fi

# ── Paso 4: Construir comando Docker Compose ─────────────────────────────────
echo -e "${BLUE}[4/5]${NC} Preparando servicios..."

COMPOSE_ARGS=(
    docker compose
    -f "${INFRA_DIR}/docker-compose.yml"
    -f "${INFRA_DIR}/docker-compose.override.yml"
    --env-file "${ENV_FILE}"
    up
)

[[ "$BUILD"  == "true" ]] && COMPOSE_ARGS+=(--build)
[[ "$DETACH" == "true" ]] && COMPOSE_ARGS+=(-d) || COMPOSE_ARGS+=(--remove-orphans)

echo -e "${GREEN}[OK]${NC}   Servicios: postgres, backend, frontend, nginx"
[[ "$BUILD"  == "true" ]] && echo -e "${YELLOW}[INFO]${NC} Rebuild de imágenes activado"
[[ "$DETACH" == "true" ]] && echo -e "${YELLOW}[INFO]${NC} Modo background (detached)"

# ── Paso 5: Levantar ─────────────────────────────────────────────────────────
echo -e "${BLUE}[5/5]${NC} Levantando el sistema..."
echo ""

cd "${INFRA_DIR}"
"${COMPOSE_ARGS[@]}"

# ── Info post-arranque (solo en modo detached) ───────────────────────────────
if [[ "$DETACH" == "true" ]]; then
    echo ""
    echo -e "${BOLD}${GREEN}Sistema levantado correctamente.${NC}"
    echo ""
    echo -e "${BOLD}Accesos:${NC}"
    echo -e "  Frontend      →  ${BLUE}http://localhost${NC}"
    echo -e "  API REST      →  ${BLUE}http://localhost/api/v1${NC}"
    echo -e "  Swagger UI    →  ${BLUE}http://localhost/api/v1/swagger-ui.html${NC}"
    echo -e "  Health check  →  ${BLUE}http://localhost/actuator/health${NC}"
    echo -e "  Dev server    →  ${BLUE}http://localhost:5173${NC}"
    echo ""
    echo -e "${BOLD}Credenciales por defecto:${NC}"
    echo -e "  Usuario: admin@minimarket.local"
    echo -e "  Clave:   Admin1234!"
    echo ""
    echo -e "${BOLD}Comandos útiles:${NC}"
    echo -e "  Logs en tiempo real:  docker compose -f infra/docker-compose.yml logs -f"
    echo -e "  Logs del backend:     docker compose -f infra/docker-compose.yml logs -f backend"
    echo -e "  Estado de servicios:  docker compose -f infra/docker-compose.yml ps"
    echo -e "  Detener todo:         bash stop.sh"
    echo ""
fi

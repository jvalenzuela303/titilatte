#!/usr/bin/env bash
# =============================================================================
# start-dev.sh — Levanta el ambiente de desarrollo completo
# Minimarket Platform — Fase 1
#
# Uso:
#   cd infra/
#   bash scripts/start-dev.sh [opciones]
#
# Opciones:
#   --build     Fuerza rebuild de imágenes aunque no hayan cambiado
#   --clean     Elimina volúmenes y contenedores antes de levantar (reset total)
#   --detach    Levanta en background (equivalente a -d en docker compose)
#   --help      Muestra esta ayuda
# =============================================================================

set -euo pipefail

# ---- Colores para output ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ---- Directorio del script ----
# Siempre ejecuta los comandos docker compose desde infra/
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ---- Flags ----
FLAG_BUILD=false
FLAG_CLEAN=false
FLAG_DETACH=false

# ---- Parse argumentos ----
for arg in "$@"; do
    case "$arg" in
        --build)  FLAG_BUILD=true ;;
        --clean)  FLAG_CLEAN=true ;;
        --detach) FLAG_DETACH=true ;;
        --help)
            grep '^#' "$0" | head -20 | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *)
            echo -e "${RED}Argumento desconocido: $arg${NC}" >&2
            echo "Usa --help para ver las opciones disponibles." >&2
            exit 1
            ;;
    esac
done

# =============================================================================
# Funciones auxiliares
# =============================================================================

log_info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}   $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# Verifica que un comando está disponible en el PATH
require_command() {
    local cmd="$1"
    local hint="${2:-}"
    if ! command -v "$cmd" &>/dev/null; then
        log_error "Comando requerido no encontrado: '${cmd}'"
        [[ -n "$hint" ]] && log_error "  Instala con: $hint"
        return 1
    fi
}

# =============================================================================
# Banner
# =============================================================================
echo -e ""
echo -e "${BOLD}${BLUE}============================================================${NC}"
echo -e "${BOLD}${BLUE}   Minimarket Platform — Ambiente de Desarrollo (Fase 1)${NC}"
echo -e "${BOLD}${BLUE}============================================================${NC}"
echo -e ""

# =============================================================================
# Paso 1: Verificar prerrequisitos
# =============================================================================
log_info "Verificando prerrequisitos..."

PREREQS_OK=true

require_command "docker"        "https://docs.docker.com/engine/install/" || PREREQS_OK=false
require_command "docker"        "" || true  # Ya capturado arriba

# Verifica que docker compose (plugin v2) esté disponible
if ! docker compose version &>/dev/null; then
    log_error "Docker Compose plugin v2 no encontrado."
    log_error "  Instala con: https://docs.docker.com/compose/install/"
    PREREQS_OK=false
fi

# Verifica que el daemon de Docker esté corriendo
if ! docker info &>/dev/null; then
    log_error "El daemon de Docker no está corriendo."
    log_error "  Inicia Docker Desktop o ejecuta: sudo systemctl start docker"
    PREREQS_OK=false
fi

if [[ "$PREREQS_OK" == "false" ]]; then
    log_error "Faltan prerrequisitos. Resuelve los errores anteriores y vuelve a ejecutar."
    exit 1
fi

DOCKER_VERSION=$(docker --version | awk '{print $3}' | tr -d ',')
COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "desconocida")
log_success "Docker $DOCKER_VERSION | Compose $COMPOSE_VERSION"

# =============================================================================
# Paso 2: Verificar estructura del proyecto
# =============================================================================
log_info "Verificando estructura del proyecto..."

MISSING_FILES=false

check_file() {
    local path="$1"
    if [[ ! -f "$path" ]]; then
        log_warn "Archivo no encontrado: $path"
        MISSING_FILES=true
    fi
}

check_file "${INFRA_DIR}/../backend/Dockerfile"
check_file "${INFRA_DIR}/../frontend/Dockerfile"
check_file "${INFRA_DIR}/nginx/nginx.conf"
check_file "${INFRA_DIR}/docker-compose.yml"

if [[ "$MISSING_FILES" == "true" ]]; then
    log_warn "Algunos archivos no existen aún. El build puede fallar si son requeridos."
fi

# =============================================================================
# Paso 3: Crear .env desde .env.example si no existe
# =============================================================================
ENV_FILE="${INFRA_DIR}/.env"
ENV_EXAMPLE="${INFRA_DIR}/.env.example"

if [[ ! -f "$ENV_FILE" ]]; then
    if [[ -f "$ENV_EXAMPLE" ]]; then
        log_warn "Archivo .env no encontrado. Creando desde .env.example..."
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        log_success ".env creado en: $ENV_FILE"
        echo ""
        echo -e "${YELLOW}  IMPORTANTE: Edita $ENV_FILE y configura:${NC}"
        echo -e "${YELLOW}    - POSTGRES_PASSWORD (contraseña segura)${NC}"
        echo -e "${YELLOW}    - JWT_SECRET (genera con: openssl rand -base64 64)${NC}"
        echo ""
        read -rp "  ¿Deseas continuar con los valores por defecto? [s/N]: " CONTINUE
        if [[ ! "$CONTINUE" =~ ^[sS]$ ]]; then
            log_info "Edita ${ENV_FILE} y vuelve a ejecutar este script."
            exit 0
        fi
    else
        log_error ".env.example no encontrado en ${INFRA_DIR}/"
        log_error "No se puede continuar sin el archivo de variables de entorno."
        exit 1
    fi
else
    log_success ".env encontrado: $ENV_FILE"
fi

# =============================================================================
# Paso 4: Limpieza opcional (--clean)
# =============================================================================
if [[ "$FLAG_CLEAN" == "true" ]]; then
    log_warn "Modo --clean: eliminando contenedores, redes y volúmenes..."
    echo -e "${RED}  ADVERTENCIA: Se perderán todos los datos de la base de datos.${NC}"
    read -rp "  ¿Confirmas? [s/N]: " CONFIRM_CLEAN
    if [[ "$CONFIRM_CLEAN" =~ ^[sS]$ ]]; then
        docker compose -f "${INFRA_DIR}/docker-compose.yml" \
                       -f "${INFRA_DIR}/docker-compose.override.yml" \
                       down --volumes --remove-orphans 2>/dev/null || true
        log_success "Limpieza completada."
    else
        log_info "Limpieza cancelada."
    fi
fi

# =============================================================================
# Paso 5: Levantar los servicios
# =============================================================================
log_info "Levantando servicios..."
echo ""

# Construye el comando docker compose
COMPOSE_CMD=(
    docker compose
    -f "${INFRA_DIR}/docker-compose.yml"
    -f "${INFRA_DIR}/docker-compose.override.yml"
    --env-file "${ENV_FILE}"
    up
)

[[ "$FLAG_BUILD" == "true" ]] && COMPOSE_CMD+=(--build)
[[ "$FLAG_DETACH" == "true" ]] && COMPOSE_CMD+=(-d)

# Ejecuta desde el directorio infra/ para que los contextos de build sean correctos
cd "$INFRA_DIR"
"${COMPOSE_CMD[@]}"

# =============================================================================
# Paso 6: Info post-arranque (solo en modo detach)
# =============================================================================
if [[ "$FLAG_DETACH" == "true" ]]; then
    echo ""
    echo -e "${BOLD}${GREEN}Servicios levantados en background.${NC}"
    echo ""
    echo -e "${BOLD}URLs de acceso:${NC}"
    echo -e "  Frontend (via nginx):  ${BLUE}http://localhost${NC}"
    echo -e "  API (via nginx):       ${BLUE}http://localhost/api/v1${NC}"
    echo -e "  Backend health:        ${BLUE}http://localhost/actuator/health${NC}"
    echo -e "  Vite dev server:       ${BLUE}http://localhost:5173${NC}"
    echo -e "  PostgreSQL:            ${BLUE}localhost:5432${NC} (DB: minimarket_db)"
    echo -e "  JVM Remote Debug:      ${BLUE}localhost:5005${NC}"
    echo ""
    echo -e "${BOLD}Comandos útiles:${NC}"
    echo -e "  Ver logs:              docker compose logs -f"
    echo -e "  Ver logs backend:      docker compose logs -f backend"
    echo -e "  Detener todo:          docker compose down"
    echo -e "  Reset completo:        bash scripts/start-dev.sh --clean"
    echo ""
fi

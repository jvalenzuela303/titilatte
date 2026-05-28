#!/usr/bin/env bash
# =============================================================================
# health-check.sh — Verificación de Salud del Sistema
# Minimarket Platform — Fase 3
#
# Verifica que todos los servicios críticos responden correctamente antes de
# un despliegue en staging o producción.
#
# Uso:
#   ./health-check.sh                    # Verifica servicios por defecto (localhost)
#   BACKEND_HOST=192.168.1.10 ./health-check.sh
#   ./health-check.sh --timeout 10       # Timeout personalizado por check (segundos)
#   ./health-check.sh --json             # Output en formato JSON (para CI/CD)
#
# Retorna:
#   0  — Todos los servicios responden correctamente
#   1  — Uno o más servicios no responden o están en estado degradado
#
# Dependencias: curl, psql (o pg_isready), docker (opcional para checks locales)
# =============================================================================

set -euo pipefail

# =============================================================================
# Configuración — sobreescribible via variables de entorno
# =============================================================================
BACKEND_HOST="${BACKEND_HOST:-localhost}"
BACKEND_PORT="${BACKEND_PORT:-8080}"
FRONTEND_HOST="${FRONTEND_HOST:-localhost}"
FRONTEND_PORT="${FRONTEND_PORT:-80}"
NGINX_HOST="${NGINX_HOST:-localhost}"
NGINX_PORT="${NGINX_PORT:-80}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-minimarket_user}"
POSTGRES_DB="${POSTGRES_DB:-minimarket_db}"

# Timeout en segundos para cada request HTTP (no afecta a pg_isready)
HTTP_TIMEOUT="${HTTP_TIMEOUT:-5}"

# Modo de salida: "table" (por defecto) o "json"
OUTPUT_MODE="table"

# =============================================================================
# Colores para output de consola
# =============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

# Deshabilitar colores si no es terminal interactivo (ej: CI, redirección)
if [ ! -t 1 ]; then
  RED='' GREEN='' YELLOW='' BLUE='' BOLD='' RESET=''
fi

# =============================================================================
# Parseo de argumentos
# =============================================================================
while [[ $# -gt 0 ]]; do
  case "$1" in
    --timeout)
      HTTP_TIMEOUT="$2"
      shift 2
      ;;
    --json)
      OUTPUT_MODE="json"
      shift
      ;;
    --help|-h)
      grep '^#' "$0" | grep -v '#!/' | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Argumento desconocido: $1. Usa --help para ver opciones." >&2
      exit 1
      ;;
  esac
done

# =============================================================================
# Estado global
# =============================================================================
OVERALL_STATUS=0   # 0 = OK, 1 = hay al menos un fallo

# Arrays para acumular resultados (compatibles con bash 3+)
declare -a CHECK_NAMES=()
declare -a CHECK_STATUSES=()
declare -a CHECK_DETAILS=()
declare -a CHECK_TIMES=()

# =============================================================================
# Funciones auxiliares
# =============================================================================

# Registra el resultado de un check
# $1: nombre, $2: status ("OK"|"FAIL"|"WARN"), $3: detalle, $4: tiempo_ms
register_result() {
  local name="$1" status="$2" detail="$3" time_ms="$4"
  CHECK_NAMES+=("$name")
  CHECK_STATUSES+=("$status")
  CHECK_DETAILS+=("$detail")
  CHECK_TIMES+=("${time_ms}ms")
  if [[ "$status" == "FAIL" ]]; then
    OVERALL_STATUS=1
  fi
}

# Ejecuta un HTTP check y registra el resultado
# $1: nombre del servicio, $2: URL, $3: (opcional) string esperado en body
http_check() {
  local name="$1"
  local url="$2"
  local expected_body="${3:-}"

  local start_ms end_ms elapsed_ms
  start_ms=$(date +%s%3N)

  local http_code body
  # Capturamos código HTTP y body por separado para no mezclarlos
  body=$(curl -sf --max-time "${HTTP_TIMEOUT}" \
    --write-out "\n__HTTP_CODE__:%{http_code}" \
    "$url" 2>/dev/null) || {
      end_ms=$(date +%s%3N)
      elapsed_ms=$(( end_ms - start_ms ))
      register_result "$name" "FAIL" "No responde o timeout (${HTTP_TIMEOUT}s)" "$elapsed_ms"
      return
    }

  end_ms=$(date +%s%3N)
  elapsed_ms=$(( end_ms - start_ms ))

  http_code=$(echo "$body" | grep '__HTTP_CODE__:' | cut -d: -f2)
  body=$(echo "$body" | grep -v '__HTTP_CODE__:')

  # Verificar código HTTP
  if [[ "$http_code" -lt 200 || "$http_code" -ge 400 ]]; then
    register_result "$name" "FAIL" "HTTP $http_code" "$elapsed_ms"
    return
  fi

  # Verificar que el body contenga el string esperado (si se especificó)
  if [[ -n "$expected_body" && "$body" != *"$expected_body"* ]]; then
    register_result "$name" "WARN" "HTTP $http_code pero body no contiene '$expected_body'" "$elapsed_ms"
    return
  fi

  register_result "$name" "OK" "HTTP $http_code" "$elapsed_ms"
}

# Check de PostgreSQL via pg_isready (no requiere password para el ping básico)
postgres_check() {
  local name="PostgreSQL"
  local start_ms end_ms elapsed_ms
  start_ms=$(date +%s%3N)

  if command -v pg_isready &>/dev/null; then
    if pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q 2>/dev/null; then
      end_ms=$(date +%s%3N)
      elapsed_ms=$(( end_ms - start_ms ))
      register_result "$name" "OK" "pg_isready: accepting connections" "$elapsed_ms"
    else
      end_ms=$(date +%s%3N)
      elapsed_ms=$(( end_ms - start_ms ))
      register_result "$name" "FAIL" "pg_isready: no acepta conexiones en ${POSTGRES_HOST}:${POSTGRES_PORT}" "$elapsed_ms"
    fi
  else
    # Fallback: TCP port check via curl (no requiere cliente psql)
    if curl -sf --max-time "${HTTP_TIMEOUT}" "telnet://${POSTGRES_HOST}:${POSTGRES_PORT}" &>/dev/null 2>&1 || \
       timeout "${HTTP_TIMEOUT}" bash -c "echo > /dev/tcp/${POSTGRES_HOST}/${POSTGRES_PORT}" 2>/dev/null; then
      end_ms=$(date +%s%3N)
      elapsed_ms=$(( end_ms - start_ms ))
      register_result "$name" "OK" "Puerto ${POSTGRES_PORT} abierto (pg_isready no disponible)" "$elapsed_ms"
    else
      end_ms=$(date +%s%3N)
      elapsed_ms=$(( end_ms - start_ms ))
      register_result "$name" "FAIL" "Puerto ${POSTGRES_PORT} no accesible en ${POSTGRES_HOST}" "$elapsed_ms"
    fi
  fi
}

# =============================================================================
# Impresión de resultados
# =============================================================================
print_table() {
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')

  echo ""
  echo "${BOLD}=== Minimarket Platform — Health Check ===${RESET}"
  echo "${BLUE}Timestamp: ${timestamp}${RESET}"
  echo ""
  printf "${BOLD}%-30s %-8s %-10s %s${RESET}\n" "Servicio" "Estado" "Tiempo" "Detalle"
  printf '%0.s─' {1..75}; echo

  local i
  for i in "${!CHECK_NAMES[@]}"; do
    local name="${CHECK_NAMES[$i]}"
    local status="${CHECK_STATUSES[$i]}"
    local detail="${CHECK_DETAILS[$i]}"
    local time="${CHECK_TIMES[$i]}"

    local color
    case "$status" in
      OK)   color="${GREEN}"  ;;
      WARN) color="${YELLOW}" ;;
      FAIL) color="${RED}"    ;;
      *)    color="${RESET}"  ;;
    esac

    printf "${color}%-30s %-8s %-10s %s${RESET}\n" "$name" "$status" "$time" "$detail"
  done

  printf '%0.s─' {1..75}; echo
  echo ""

  if [[ $OVERALL_STATUS -eq 0 ]]; then
    echo "${GREEN}${BOLD}Resultado: TODOS LOS SERVICIOS OK${RESET}"
  else
    local fail_count=0
    for s in "${CHECK_STATUSES[@]}"; do [[ "$s" == "FAIL" ]] && (( fail_count++ )); done
    echo "${RED}${BOLD}Resultado: ${fail_count} servicio(s) con FALLO${RESET}"
  fi
  echo ""
}

print_json() {
  local timestamp
  timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  local overall="ok"
  [[ $OVERALL_STATUS -ne 0 ]] && overall="fail"

  echo "{"
  echo "  \"timestamp\": \"${timestamp}\","
  echo "  \"overall\": \"${overall}\","
  echo "  \"checks\": ["

  local i last_i
  last_i=$(( ${#CHECK_NAMES[@]} - 1 ))
  for i in "${!CHECK_NAMES[@]}"; do
    local comma=""
    [[ $i -lt $last_i ]] && comma=","
    local status="${CHECK_STATUSES[$i]}"
    local json_status
    case "$status" in
      OK)   json_status="ok"   ;;
      WARN) json_status="warn" ;;
      FAIL) json_status="fail" ;;
      *)    json_status="unknown" ;;
    esac
    echo "    {"
    echo "      \"name\": \"${CHECK_NAMES[$i]}\","
    echo "      \"status\": \"${json_status}\","
    echo "      \"detail\": \"${CHECK_DETAILS[$i]}\","
    echo "      \"response_time\": \"${CHECK_TIMES[$i]}\""
    echo "    }${comma}"
  done

  echo "  ]"
  echo "}"
}

# =============================================================================
# Checks
# =============================================================================

# 1. Backend Spring Boot — /actuator/health
#    Retorna {"status":"UP"} cuando todos los componentes (DB, etc.) están listos
http_check \
  "Backend (/actuator/health)" \
  "http://${BACKEND_HOST}:${BACKEND_PORT}/actuator/health" \
  '"status":"UP"'

# 2. Backend — endpoint POS crítico (solo responde, no verifica datos)
#    Un 401/403 es aceptable (autenticación requerida); 5xx indica problema real
http_check \
  "Backend (/api/v1/products)" \
  "http://${BACKEND_HOST}:${BACKEND_PORT}/api/v1/products?page=0&size=1"

# 3. Frontend — ruta raíz (React SPA)
http_check \
  "Frontend (/)" \
  "http://${FRONTEND_HOST}:${FRONTEND_PORT}/"

# 4. Nginx — health check interno (location = /health en nginx.conf)
http_check \
  "Nginx (/health)" \
  "http://${NGINX_HOST}:${NGINX_PORT}/health" \
  "ok"

# 5. Nginx → Backend proxy (a través del proxy, no directo al backend)
http_check \
  "Nginx → Backend (/api/v1/health)" \
  "http://${NGINX_HOST}:${NGINX_PORT}/actuator/health"

# 6. PostgreSQL — aceptando conexiones
postgres_check

# =============================================================================
# Salida
# =============================================================================
if [[ "$OUTPUT_MODE" == "json" ]]; then
  print_json
else
  print_table
fi

exit $OVERALL_STATUS

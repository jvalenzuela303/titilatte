#!/usr/bin/env bash
# =============================================================================
# start-prod.sh — Levanta el stack completo en modo PRODUCCIÓN
#
# Usa únicamente docker-compose.yml + docker-compose.ssl.yml.
# NO carga docker-compose.override.yml (modo desarrollo).
#
# Uso:
#   cd infra/
#   bash scripts/start-prod.sh [--build] [--down]
#
# Opciones:
#   --build   Fuerza rebuild de imágenes antes de levantar
#   --down    Detiene y elimina contenedores antes de levantar
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

COMPOSE="docker compose -f ${INFRA_DIR}/docker-compose.yml -f ${INFRA_DIR}/docker-compose.ssl.yml"

BUILD=false
DOWN=false

for arg in "$@"; do
  case $arg in
    --build) BUILD=true ;;
    --down)  DOWN=true  ;;
  esac
done

cd "${INFRA_DIR}"

if [ "$DOWN" = true ]; then
  echo "Deteniendo contenedores existentes..."
  $COMPOSE down
fi

if [ "$BUILD" = true ]; then
  echo "Construyendo imágenes..."
  $COMPOSE build
fi

echo "Levantando stack de producción..."
$COMPOSE up -d

echo "Estado de los contenedores:"
$COMPOSE ps

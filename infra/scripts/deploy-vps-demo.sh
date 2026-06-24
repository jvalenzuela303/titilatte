#!/usr/bin/env bash
# =============================================================================
# deploy-vps-demo.sh — Despliega Minimarket Demo en demo.s3suite.cl (VPS)
#
# Uso (ejecutar desde la máquina local):
#   bash infra/scripts/deploy-vps-demo.sh
#
# Requisitos previos en VPS:
#   - Stack s3suite corriendo (s3suite-postgres, s3suite-db-net)
#   - Git, Docker, Docker Compose instalados
#   - Nginx instalado en el host
#   - Puerto 80/443 abierto en firewall
# =============================================================================

set -euo pipefail

# ---- Configuración ----
VPS_HOST="root@38.107.237.0"
VPS_DIR="/opt/titilatte"
GITHUB_REPO="https://github.com/jvalenzuela303/titilatte.git"
NGINX_CONF_SRC="infra/nginx/demo.s3suite.cl.conf"
DOMAIN="demo.s3suite.cl"

YELLOW='\033[1;33m'; GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $*"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] WARN:${NC} $*"; }
err()  { echo -e "${RED}[$(date +%H:%M:%S)] ERROR:${NC} $*" >&2; exit 1; }

# ---- 1. Verificar .env.vps-demo local ----
ENVFILE="infra/.env.vps-demo"
[[ -f "$ENVFILE" ]] || err "No se encontró $ENVFILE. Copia .env.vps-demo.example y completa los valores."

log "Iniciando deploy de Minimarket Demo → $DOMAIN"

# ---- 2. Subir código con rsync (excluye node_modules, target, .git) ----
log "Sincronizando código fuente con VPS..."
rsync -az --delete \
    --exclude='.git' \
    --exclude='*/node_modules' \
    --exclude='*/target' \
    --exclude='*/build' \
    --exclude='infra/.env.vps-demo' \
    --exclude='infra/.env' \
    ./ "${VPS_HOST}:${VPS_DIR}/"

# ---- 3. Subir .env.vps-demo ----
log "Subiendo archivo de entorno..."
scp "$ENVFILE" "${VPS_HOST}:${VPS_DIR}/infra/.env.vps-demo"

# ---- 4. Subir nginx config al host VPS ----
log "Actualizando configuración nginx..."
scp "$NGINX_CONF_SRC" "${VPS_HOST}:/etc/nginx/sites-enabled/${DOMAIN}.conf"

# ---- 5. Ejecutar setup remoto ----
log "Ejecutando setup en VPS..."
ssh "$VPS_HOST" bash -s << 'REMOTE'
set -euo pipefail

VPS_DIR="/opt/titilatte"
DOMAIN="demo.s3suite.cl"
COMPOSE_FILE="$VPS_DIR/infra/docker-compose.vps-demo.yml"
ENV_FILE="$VPS_DIR/infra/.env.vps-demo"

# ---- Cargar variables de entorno ----
set -a
source "$ENV_FILE"
set +a

# ---- Crear DB en s3suite-postgres si no existe ----
echo "Verificando base de datos $POSTGRES_DB en s3suite-postgres..."
DB_EXISTS=$(docker exec s3suite-postgres psql -U bariatric_user -tAc \
    "SELECT 1 FROM pg_database WHERE datname='$POSTGRES_DB'" 2>/dev/null || echo "")

if [[ "$DB_EXISTS" != "1" ]]; then
    echo "Creando usuario y base de datos $POSTGRES_DB..."
    docker exec s3suite-postgres psql -U bariatric_user << SQL
CREATE USER $POSTGRES_USER WITH PASSWORD '$POSTGRES_PASSWORD';
CREATE DATABASE $POSTGRES_DB OWNER $POSTGRES_USER;
GRANT ALL PRIVILEGES ON DATABASE $POSTGRES_DB TO $POSTGRES_USER;
\c $POSTGRES_DB
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
SQL
    echo "Base de datos creada correctamente."
else
    echo "Base de datos $POSTGRES_DB ya existe."
fi

# ---- Validar nginx config y recargar ----
echo "Validando configuración nginx..."
nginx -t || { echo "ERROR: nginx config inválida"; exit 1; }
systemctl reload nginx
echo "Nginx recargado."

# ---- Obtener SSL si no existe ----
if [[ ! -d "/etc/letsencrypt/live/$DOMAIN" ]]; then
    echo "Obteniendo certificado SSL para $DOMAIN..."
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
        --email jvalenzuela303@gmail.com --redirect
    echo "SSL configurado correctamente."
else
    echo "Certificado SSL ya existe para $DOMAIN."
fi

# ---- Buildear y levantar contenedores ----
echo "Construyendo y levantando contenedores..."
cd "$VPS_DIR/infra"
docker compose -f docker-compose.vps-demo.yml --env-file .env.vps-demo \
    up -d --build --remove-orphans

# ---- Esperar que el backend levante ----
echo "Esperando que el backend esté healthy (max 120s)..."
for i in $(seq 1 24); do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' minimarket-demo-backend 2>/dev/null || echo "starting")
    if [[ "$STATUS" == "healthy" ]]; then
        echo "Backend healthy después de $((i*5))s."
        break
    fi
    [[ $i -eq 24 ]] && { echo "TIMEOUT: backend no levantó. Revisa: docker logs minimarket-demo-backend"; exit 1; }
    sleep 5
done

echo ""
echo "============================================"
echo " Deploy completado: https://$DOMAIN"
echo " Admin: admin@minimarket.local / Admin1234!"
echo "============================================"
REMOTE

log "Deploy finalizado."
log "URL: https://${DOMAIN}"

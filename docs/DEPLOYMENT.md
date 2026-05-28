# Guia de Despliegue

**Minimarket Platform — Fase 1, Fase 2, Fase 3 y Fase 4**

Este documento cubre el despliegue del stack completo (PostgreSQL + Backend + Frontend + Nginx) usando Docker Compose.

---

## Tabla de Contenidos

1. [Desarrollo Local](#desarrollo-local)
2. [Variables de Entorno](#variables-de-entorno)
3. [Ambiente Staging](#ambiente-staging)
4. [Backups PostgreSQL](#backups-postgresql)
5. [Comandos Utiles](#comandos-utiles)
6. [Troubleshooting](#troubleshooting)
7. [Advertencia Pre-Produccion](#advertencia-pre-produccion)
8. [Fase 3 — SSE, Audit, Dashboard y Cache](#fase-3--sse-audit-dashboard-y-cache)
9. [Fase 4 — Multi-sucursal y CI/CD](#fase-4--multi-sucursal-y-cicd)

---

## Desarrollo Local

### Prerrequisitos

| Herramienta | Version minima | Verificar con |
|---|---|---|
| Docker Engine | 24.x | `docker --version` |
| Docker Compose plugin v2 | 2.20 | `docker compose version` |
| Sistema operativo | Linux, macOS o Windows con WSL2 | — |

> No se requiere Java ni Node.js instalados localmente. Todo el stack corre dentro de contenedores Docker.

### Paso 1 — Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd titilatte
```

### Paso 2 — Crear el archivo de variables de entorno

```bash
cp infra/.env.example infra/.env
```

### Paso 3 — Editar las variables obligatorias

Abrir `infra/.env` en un editor y configurar al minimo:

```bash
# Generar un JWT_SECRET seguro:
openssl rand -base64 64
```

Variables que se deben cambiar obligatoriamente antes del primer arranque:

| Variable | Accion requerida |
|---|---|
| `POSTGRES_PASSWORD` | Reemplazar `change_me_in_production` por una contrasena real |
| `JWT_SECRET` | Reemplazar `change_me_generate_with_openssl_rand_base64_64` con la salida de `openssl rand -base64 64` |

### Paso 4 — Levantar el stack

**Opcion A — Script automatizado (recomendado):**

```bash
cd infra
bash scripts/start-dev.sh
```

El script verifica prerrequisitos, valida la existencia del `.env` y levanta todos los servicios con hot reload. Los logs se muestran en la terminal.

**Opcion B — Docker Compose directo:**

```bash
cd infra
docker compose up --build
```

**Opcion C — Background (detached):**

```bash
cd infra
bash scripts/start-dev.sh --detach
# o bien:
docker compose up --build -d
```

### Paso 5 — Verificar el arranque

El orden de inicio es: `postgres` → `backend` → `frontend` → `nginx`.

El backend tarda entre 30 y 90 segundos en iniciar porque Flyway ejecuta las migraciones al arrancar.

Verificar que todos los servicios esten healthy:

```bash
docker compose ps
```

Todos los servicios deben mostrar `(healthy)` en la columna STATUS.

Verificar el health check de la API:

```bash
curl http://localhost/actuator/health
# Respuesta esperada: {"status":"UP"}
```

### Paso 6 — Acceder a la aplicacion

| Recurso | URL |
|---|---|
| Frontend | http://localhost |
| API REST | http://localhost/api/v1 |
| Swagger UI | http://localhost/api/v1/swagger-ui.html |
| Health | http://localhost/actuator/health |

Credenciales por defecto: `admin@minimarket.local` / `Admin1234!`

### Paso 7 — Detener el stack

```bash
cd infra
docker compose down
```

Para detener y eliminar todos los datos (reset total):

```bash
bash scripts/start-dev.sh --clean
# o bien:
docker compose down --volumes
```

---

## Variables de Entorno

Todas las variables se definen en `infra/.env`. El archivo base nunca debe ser commiteado al repositorio (ya esta en `.gitignore`).

### PostgreSQL

| Variable | Requerida | Descripcion | Valor de ejemplo |
|---|---|---|---|
| `POSTGRES_DB` | Si | Nombre de la base de datos | `minimarket_db` |
| `POSTGRES_USER` | Si | Usuario de la base de datos (no usar `postgres`) | `minimarket_user` |
| `POSTGRES_PASSWORD` | Si | Contrasena del usuario de BD. Min 32 chars en produccion | `S3cr3t!aBcDeFgH123456789012345` |
| `POSTGRES_PORT` | No | Puerto de PostgreSQL expuesto al host (solo dev override) | `5432` |

### Backend — Spring Boot

| Variable | Requerida | Descripcion | Valor de ejemplo |
|---|---|---|---|
| `SPRING_DATASOURCE_URL` | Si | URL JDBC. El hostname `postgres` es el nombre del servicio Docker | `jdbc:postgresql://postgres:5432/minimarket_db` |
| `SPRING_PROFILES_ACTIVE` | No | Perfil activo de Spring Boot | `dev` |
| `JWT_SECRET` | Si | Clave HMAC-SHA256 en Base64. Min 64 bytes (512 bits de entropia) | Salida de `openssl rand -base64 64` |
| `JWT_EXPIRATION` | No | TTL del access token en milisegundos. Default: 900000 ms (15 min) | `3600000` |
| `JWT_REFRESH_EXPIRATION` | No | TTL del refresh token en ms. Default: 604800000 ms (7 dias) | `86400000` |
| `JAVA_OPTS` | No | Flags de la JVM para el contenedor del backend | `-Xms256m -Xmx512m -XX:+UseG1GC` |

### Frontend — Vite

| Variable | Requerida | Descripcion | Valor de ejemplo |
|---|---|---|---|
| `VITE_API_URL` | Si | URL base de la API consumida por React/Axios | `http://localhost/api/v1` |

### Nginx

| Variable | Requerida | Descripcion | Valor de ejemplo |
|---|---|---|---|
| `NGINX_HTTP_PORT` | No | Puerto HTTP expuesto al host. Default: 80 | `80` |

### Solo en override de desarrollo

Las siguientes variables son inyectadas automaticamente por `docker-compose.override.yml` y no requieren configuracion manual:

| Variable | Descripcion |
|---|---|
| `SPRING_DEVTOOLS_RESTART_ENABLED` | Habilita hot reload del backend |
| `CHOKIDAR_USEPOLLING` | Necesario para HMR de Vite dentro de Docker |
| `VITE_HMR_HOST` / `VITE_HMR_PORT` | Configuracion del Hot Module Replacement |

---

## Ambiente Staging

El ambiente staging replica la configuracion de produccion con datos de prueba. Usa un archivo de override dedicado (`docker-compose.staging.yml`) que desactiva el hot reload, habilita el perfil `prod` de Spring Boot y agrega el stack de monitoreo.

### Prerrequisitos de staging

- Mismos requisitos de Docker que desarrollo local.
- Acceso al archivo `infra/.env.staging.example` incluido en el repositorio.
- Puertos 3000 (Grafana) y 9090 (Prometheus) disponibles en el host si se levanta el monitoreo.

### Paso 1 — Preparar variables de staging

```bash
cd infra/
cp .env.staging.example .env.staging
```

Editar `infra/.env.staging` y configurar obligatoriamente:

| Variable | Descripcion |
|---|---|
| `JWT_SECRET` | Generar con `openssl rand -base64 64` (diferente al de desarrollo) |
| `POSTGRES_PASSWORD` | Contrasena segura, distinta a la de desarrollo |
| `GRAFANA_ADMIN_PASSWORD` | Contrasena para el panel de Grafana |

### Paso 2 — Levantar staging

```bash
cd infra/
docker compose -f docker-compose.yml -f docker-compose.staging.yml \
               --env-file .env.staging up -d --build
```

El flag `-d` levanta en background. Para ver los logs en tiempo real omitirlo o ejecutar `docker compose logs -f` aparte.

### Paso 3 — Levantar monitoreo (opcional)

```bash
docker compose -f monitoring/docker-compose.monitoring.yml \
               --env-file .env.staging up -d
```

Una vez levantado el monitoreo:

| Servicio | URL | Credenciales |
|---|---|---|
| Grafana | `http://localhost:3000` | `admin` / valor de `GRAFANA_ADMIN_PASSWORD` |
| Prometheus | `http://localhost:9090` | Sin autenticacion (acceso local solo) |

### Paso 4 — Verificar staging

```bash
# Verificar servicios healthy
docker compose -f docker-compose.yml -f docker-compose.staging.yml \
               --env-file .env.staging ps

# Health check del backend
curl http://localhost/actuator/health
```

### Paso 5 — Detener staging

```bash
cd infra/
docker compose -f docker-compose.yml -f docker-compose.staging.yml \
               --env-file .env.staging down

# Detener monitoreo
docker compose -f monitoring/docker-compose.monitoring.yml \
               --env-file .env.staging down
```

> El archivo `infra/.env.staging` **no** debe commitearse al repositorio. Verificar que esta en `.gitignore`.

---

## Backups PostgreSQL

El directorio `infra/scripts/` incluye tres scripts para la gestion de backups del volumen de datos de PostgreSQL.

### Backup manual

```bash
source infra/.env && bash infra/scripts/backup-postgres.sh
```

El script genera un archivo `.dump` en formato custom de pg_dump con la fecha y hora en el nombre:

```
/backups/postgres/minimarket_20260527_020000.dump
```

El directorio de destino se puede configurar con la variable `BACKUP_DIR` antes de ejecutar el script (default: `/backups/postgres`).

### Restaurar desde backup

```bash
bash infra/scripts/restore-postgres.sh /backups/postgres/minimarket_20260527_020000.dump
```

El script pide **confirmacion interactiva** antes de proceder porque la restauracion elimina y recrea la base de datos. Ingresa `yes` cuando se solicite para continuar.

> Advertencia: la restauracion detiene el backend temporalmente durante el proceso. Planificar una ventana de mantenimiento.

### Configurar backup automatico con cron

Para programar backups diarios automaticos en el servidor de produccion o staging:

```bash
sudo MINIMARKET_INSTALL_DIR=/opt/minimarket bash infra/scripts/cron-setup.sh
```

El script instala una entrada cron que ejecuta el backup a las 02:00 AM todos los dias. La variable `MINIMARKET_INSTALL_DIR` debe apuntar al directorio donde esta clonado el repositorio en el servidor.

Verificar la entrada cron instalada:

```bash
sudo crontab -l | grep minimarket
```

### Verificar integridad de un backup

```bash
# Listar el contenido de un archivo dump sin restaurarlo
pg_restore --list /backups/postgres/minimarket_20260527_020000.dump | head -30
```

---

## Comandos Utiles

### Ver logs de los servicios

```bash
# Todos los servicios en tiempo real
docker compose logs -f

# Un servicio especifico
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f nginx
docker compose logs -f postgres

# Ultimas N lineas
docker compose logs --tail=100 backend
```

### Reiniciar servicios

```bash
# Reiniciar un servicio sin rebuild
docker compose restart backend

# Reiniciar con rebuild de imagen (tras cambios en Dockerfile o pom.xml)
docker compose up --build backend

# Reiniciar todo el stack
docker compose down && docker compose up --build
```

### Conectar a la base de datos

```bash
# Via psql dentro del contenedor de postgres
docker compose exec postgres psql -U minimarket_user -d minimarket_db

# Comandos utiles dentro de psql:
# \dt             -- listar tablas
# \d products     -- describir tabla products
# \q              -- salir
```

Con herramienta grafica (DBeaver, pgAdmin, TablePlus):
- Host: `localhost`
- Puerto: `5432` (solo disponible con el override de desarrollo activo)
- Database: `minimarket_db`
- Username: `minimarket_user`
- Password: valor de `POSTGRES_PASSWORD` en el `.env`

### Ejecutar migraciones manualmente

Las migraciones se ejecutan automaticamente al arrancar el backend (Flyway). Para ejecutarlas manualmente dentro del contenedor:

```bash
# Ver estado de migraciones aplicadas
docker compose exec backend ./mvnw flyway:info -pl .

# Reparar checksum de una migracion corrupta
docker compose exec backend ./mvnw flyway:repair -pl .
```

Tambien se puede conectar a psql y consultar el historial de Flyway directamente:

```sql
SELECT version, description, installed_on, success
FROM flyway_schema_history
ORDER BY installed_rank;
```

### Ejecutar los tests

```bash
# Tests del backend dentro del contenedor
docker compose exec backend ./mvnw test

# Tests del frontend dentro del contenedor
docker compose exec frontend npm test

# Tests del frontend con cobertura
docker compose exec frontend npm run test:coverage
```

### Limpiar recursos Docker

```bash
# Eliminar contenedores y redes (conserva volumenes y datos)
docker compose down

# Eliminar todo incluyendo datos de la BD
docker compose down --volumes

# Reset completo con confirmacion interactiva
bash scripts/start-dev.sh --clean

# Limpiar imagenes huerfanas del sistema Docker
docker image prune -f
```

### Ver metricas del contenedor

```bash
# Uso de CPU y memoria en tiempo real
docker stats minimarket-backend minimarket-postgres
```

---

## Troubleshooting

### El backend no arranca: "JWT_SECRET environment variable must be set"

**Sintoma:** El contenedor `minimarket-backend` sale inmediatamente con error similar a:
```
APPLICATION FAILED TO START
...
Caused by: java.lang.IllegalStateException: JWT_SECRET environment variable must be set
```

**Causa:** La variable `JWT_SECRET` no esta definida en `infra/.env` o tiene el valor placeholder.

**Solucion:**
```bash
# 1. Generar un valor valido
openssl rand -base64 64

# 2. Copiar la salida y pegarla en infra/.env:
#    JWT_SECRET=<valor generado>

# 3. Reiniciar el backend
docker compose up backend
```

---

### Error de migracion Flyway al arrancar el backend

**Sintoma:** El backend falla con:
```
FlywayException: Validate failed: Migration checksum mismatch for migration version X
```

**Causa:** Se modifico el contenido de un script de migracion ya aplicado. Flyway detecta el cambio de checksum y rechaza arrancar.

**Solucion A (desarrollo — solo si los datos pueden perderse):**
```bash
# Reset completo: elimina la BD y reaplica todas las migraciones desde cero
bash scripts/start-dev.sh --clean
```

**Solucion B (conservar datos):**
```bash
# 1. Conectar a la BD
docker compose exec postgres psql -U minimarket_user -d minimarket_db

# 2. Actualizar el checksum con el valor correcto de la migracion actual
UPDATE flyway_schema_history
SET checksum = <nuevo_checksum>
WHERE version = '<version_fallida>';

# 3. Reiniciar el backend
docker compose restart backend
```

> Nunca modificar scripts de migracion ya aplicados en entornos con datos reales. Crear siempre una nueva migracion `VN+1`.

---

### El frontend no conecta con el backend: errores CORS o "Network Error"

**Sintoma:** En el navegador aparecen errores `CORS policy` o el frontend no carga datos.

**Causa posible 1 — `VITE_API_URL` mal configurada:**

Verificar en `infra/.env`:
```bash
VITE_API_URL=http://localhost/api/v1
```

En desarrollo con Docker Compose, el frontend siempre debe apuntar a `http://localhost/api/v1` (a traves de Nginx), no directamente al backend.

**Causa posible 2 — El backend aun no esta healthy:**

```bash
docker compose ps
# Verificar que backend muestra "(healthy)"
# Si no, ver logs:
docker compose logs -f backend
```

**Causa posible 3 — El override de Nginx no cargo:**

```bash
# Verificar la configuracion de Nginx
docker compose exec nginx nginx -t

# Reiniciar Nginx
docker compose restart nginx
```

---

### Puerto ya en uso: "bind: address already in use"

**Sintoma:** Docker Compose falla con:
```
Error response from daemon: driver failed programming external connectivity:
Bind for 0.0.0.0:80 failed: port is already allocated
```

**Causa:** Otro proceso en la maquina anfitriona esta usando el puerto 80, 5432 o 5173.

**Solucion:**
```bash
# Identificar que proceso usa el puerto
sudo ss -tlnp | grep :80
# o en macOS:
lsof -i :80

# Opcion A: detener el proceso conflictivo

# Opcion B: cambiar el puerto en infra/.env
NGINX_HTTP_PORT=8080    # usar 8080 en lugar de 80
POSTGRES_PORT=5433      # usar 5433 en lugar de 5432
```

---

### La base de datos esta vacia tras el arranque

**Sintoma:** El backend arranca correctamente pero las migraciones no crearon las tablas.

**Causa:** El volumen `postgres_data` tiene datos de una version anterior incompatible.

**Solucion:**
```bash
# Detener todo y eliminar el volumen de datos
docker compose down --volumes
docker compose up --build
```

---

## Advertencia Pre-Produccion

> **LEER ANTES DE DESPLEGAR EN CUALQUIER ENTORNO ACCESIBLE DESDE LA RED.**

Los siguientes elementos **deben** ser resueltos antes de ir a produccion. Para el detalle completo ver `infra/SECURITY_CHECKLIST.md`.

### Secretos y credenciales

- [ ] Generar `JWT_SECRET` con `openssl rand -base64 64`. El valor de `.env.example` es un placeholder sin entropia real.
- [ ] Cambiar `POSTGRES_PASSWORD` por una contrasena aleatoria de al menos 32 caracteres.
- [ ] Cambiar la contrasena del usuario `admin@minimarket.local` (actualmente `Admin1234!` del seed V6).
- [ ] Verificar que el archivo `infra/.env` **no** esta en el repositorio: `git log --all -- infra/.env`.
- [ ] Reducir `JWT_EXPIRATION` a 900000 ms (15 minutos) para produccion.
- [ ] Generar `GRAFANA_ADMIN_PASSWORD` si se despliega el stack de monitoreo.

### HTTPS y red

- [ ] Configurar certificado TLS/SSL (Let's Encrypt via Certbot o certificado corporativo).
- [ ] Habilitar el header `Strict-Transport-Security` en `nginx.conf` (marcado como TODO en el archivo).
- [ ] Revisar y endurecer el `Content-Security-Policy` en `nginx.conf` (actualmente permite `unsafe-inline` en `style-src`).
- [ ] Verificar que el puerto 5432 de PostgreSQL **no** esta expuesto al exterior (solo en el override de desarrollo).
- [ ] Verificar que el puerto 5005 (JVM debug) **no** esta expuesto en produccion.
- [ ] Verificar que los puertos 3000 (Grafana) y 9090 (Prometheus) no estan expuestos publicamente si se usa monitoreo.

### Swagger y endpoints internos

- [ ] Cambiar `SPRING_PROFILES_ACTIVE` a `prod` para deshabilitar Swagger UI y la ruta `/v3/api-docs`.
- [ ] Agregar bloqueo de `/swagger-ui/**` y `/v3/api-docs/**` en `nginx.conf` para el perfil de produccion.

### Base de datos

- [ ] Configurar backups automaticos con `infra/scripts/cron-setup.sh` y verificar restauracion desde dump.
- [ ] Probar la restauracion al menos una vez antes de ir a produccion: `bash infra/scripts/restore-postgres.sh <archivo.dump>`.
- [ ] Agregar un job periodico de limpieza de refresh tokens expirados en `refresh_tokens` (aun no implementado en Fase 1).
- [ ] Evaluar permisos minimos del usuario de BD (actualmente el usuario tiene permisos amplios necesarios para Flyway).

### Monitoreo

- [ ] Configurar retencion y rotacion de logs de Nginx y del backend.
- [ ] Evaluar integracion con sistema de alertas para el endpoint `/actuator/health`.
- [ ] Configurar datasource de Prometheus en Grafana apuntando a `http://prometheus:9090`.

---

## Fase 3 — SSE, Audit, Dashboard y Cache

### Nginx — configuracion SSE obligatoria

El bloque SSE en `infra/nginx/nginx.conf` es **critico** para que las conexiones Server-Sent Events funcionen correctamente. Sin `proxy_buffering off`, Nginx acumula la respuesta y el frontend nunca recibe los eventos.

```nginx
# Ya incluido en infra/nginx/nginx.conf — verificar que este presente:
location /api/v1/events/ {
    proxy_pass         http://backend:8080;
    proxy_buffering    off;           # CRITICO: sin esto SSE no funciona
    proxy_read_timeout 3600s;         # conexiones de larga duracion
    proxy_http_version 1.1;
    proxy_set_header   Connection '';
    proxy_set_header   Host $host;
    proxy_set_header   X-Real-IP $remote_addr;
    proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Verificar que el bloque este presente antes de desplegar Fase 3:

```bash
grep -A 8 "location /api/v1/events/" infra/nginx/nginx.conf
```

### Limite de conexiones SSE

`SseEmitterRegistry` rechaza conexiones nuevas cuando hay 500 activas simultáneas (devuelve HTTP 503). En entornos con muchos usuarios concurrentes, este valor puede ajustarse en:

```java
// backend/src/main/java/com/minimarket/sse/SseEmitterRegistry.java
private static final int MAX_CONNECTIONS = 500;
```

Monitorear con la métrica Micrometer `sse_active_connections` (visible en el dashboard de Grafana, panel "SSE Active Connections").

### Grafana — importar dashboard de monitoreo

El archivo `infra/monitoring/grafana/dashboards/minimarket-overview.json` contiene 6 paneles para el stack completo incluyendo Fase 3:

| Panel | Alerta |
|-------|--------|
| HTTP Request Rate | — |
| POS Latency p95 | `> 300ms` |
| Cache Hit Rate | — |
| SSE Active Connections | — |
| 5xx Error Rate | — |
| JVM Heap Usage | — |

Para importar el dashboard en Grafana:

1. Acceder a Grafana (`http://localhost:3000`, credenciales en `.env`).
2. Ir a **Dashboards → Import**.
3. Cargar el archivo `infra/monitoring/grafana/dashboards/minimarket-overview.json`.
4. Seleccionar el datasource de Prometheus y confirmar.

> Si Grafana no esta configurado aun, ver la seccion [Ambiente Staging](#ambiente-staging) para levantar el stack de monitoreo completo.

### Cache Caffeine — consideraciones operativas

La cache Caffeine corre **en memoria JVM**, sin persistencia externa. Esto implica:

- Cada reinicio del contenedor backend vacía todas las caches.
- No hay invalidación cross-instancia (no aplica en instancia única, pero debe considerarse antes de escalar horizontalmente).
- El TTL de `dashboard-kpis` (15 s) garantiza que los datos del dashboard no tengan mas de 15 segundos de retraso respecto a la BD.

Para **deshabilitar la cache temporalmente** (debugging), agregar al `.env`:

```
SPRING_CACHE_TYPE=none
```

Para **ver estadisticas de cache** en runtime, el endpoint Actuator expone métricas Caffeine via Micrometer:

```bash
curl http://localhost:8080/actuator/metrics/cache.gets?tag=name:products-catalog
```

### Variables de entorno nuevas (Fase 3)

No se agregaron variables de entorno obligatorias nuevas en Fase 3. Las siguientes variables ya existentes son relevantes para el comportamiento de SSE y monitoreo:

| Variable | Descripcion | Valor recomendado |
|----------|-------------|-------------------|
| `SPRING_PROFILES_ACTIVE` | Activar perfil `prod` deshabilita Swagger | `prod` en produccion |
| `GF_SECURITY_ADMIN_PASSWORD` | Password de Grafana | Valor seguro en `.env` |
| `GF_SECURITY_ADMIN_USER` | Usuario admin de Grafana | Valor en `.env` |

### Checklist pre-produccion Fase 3

- [ ] Verificar bloque `location /api/v1/events/` con `proxy_buffering off` en `nginx.conf`.
- [ ] Confirmar que `V12__audit_log.sql` hasta `V15__phase3_permissions.sql` se aplicaron sin errores (Flyway log en inicio del backend).
- [ ] Importar dashboard `minimarket-overview.json` en Grafana y verificar que los 6 paneles tienen datos.
- [ ] Conectar al stream SSE manualmente y verificar que los eventos llegan:
  ```bash
  curl -N -H "Authorization: Bearer <token>" \
    "http://localhost:8080/api/v1/events/stream"
  # Alternativa con ?token=:
  curl -N "http://localhost:8080/api/v1/events/stream?token=<jwt>"
  ```
- [ ] Realizar una venta de prueba y confirmar que el evento `VENTA_CONFIRMADA` aparece en el stream.
- [ ] Acceder al endpoint `GET /api/v1/audit` con un usuario ADMIN y confirmar que la tabla de auditoría tiene registros.
- [ ] Verificar que `GET /api/v1/dashboard` devuelve el DTO correcto para cada rol (ADMIN, SUPERVISOR, CAJERO, BODEGA).
- [ ] Monitorear `sse_active_connections` en Grafana durante pruebas de carga para verificar que no supera el límite de 500.

---

## Fase 4 — Multi-sucursal y CI/CD

### Paso obligatorio: NOBYPASSRLS en el usuario de aplicacion

> **Este paso es critico para la seguridad del aislamiento multi-sucursal (F4-11).** Si el usuario de la aplicacion tiene el atributo `BYPASSRLS` (o es superusuario), las policies RLS de PostgreSQL son ignoradas y el aislamiento de datos entre sucursales queda sin efecto.

Ejecutar en produccion **antes** de aplicar las migraciones V17 o con posterioridad inmediata:

```sql
-- Conectar como superusuario de PostgreSQL
ALTER ROLE <app_user> NOBYPASSRLS;

-- Verificar que el atributo fue revocado
SELECT rolname, rolbypassrls
FROM pg_roles
WHERE rolname = '<app_user>';
-- Debe retornar: rolbypassrls = false
```

Reemplazar `<app_user>` por el valor de `POSTGRES_USER` en el archivo `.env` de produccion.

> **Nota de automatizacion pendiente (F4-11 INFO):** este paso no esta automatizado en los scripts de despliegue ni en las migraciones Flyway. Debe ejecutarse manualmente por el DBA o el responsable de operaciones en cada entorno (staging y produccion). Considerar agregarlo al runbook de migraciones.

---

### Secretos de GitHub Actions requeridos

Los siguientes secretos deben estar configurados en **Settings → Secrets and variables → Actions** del repositorio antes de que el pipeline CD pueda desplegarse en produccion:

| Secreto | Descripcion | Como obtenerlo |
|---------|-------------|----------------|
| `SSH_PRIVATE_KEY` | Clave privada SSH (Ed25519 recomendado) para autenticar el deploy en el servidor | Generar con `ssh-keygen -t ed25519 -C "github-actions-deploy"`. La clave publica va en `~/.ssh/authorized_keys` del usuario de deploy en el servidor. |
| `SSH_HOST` | Hostname o IP del servidor de produccion | Direccion del servidor de produccion |
| `SSH_USER` | Usuario SSH para el deploy (debe tener permisos Docker) | Usuario del servidor (ej. `deploy`) |
| `GHCR_PULL_TOKEN` | PAT de GitHub con scope `read:packages` **unicamente** (fix F4-03) | GitHub → Settings → Developer settings → Personal access tokens (classic) → scope: `read:packages` |
| `ENV_FILE` | Contenido completo del `.env` de produccion. Debe configurarse en el bloque `env:` del workflow, NO interpolado como parte de un comando shell (fix F4-04) | Construir manualmente con los valores reales de produccion y pegarlo como valor del secreto |

> **Atencion sobre `ENV_FILE`:** el valor de este secreto es el contenido literal del archivo `.env` de produccion (clave=valor, una por linea). No incluir comillas alrededor del contenido ni interpolacion de variables shell. El workflow lo vuelca a un archivo `.env` en el servidor via `echo "${{ secrets.ENV_FILE }}" > .env` dentro de un bloque `env:` que evita que el contenido sea interpretado por el shell del runner (fix F4-04).

---

### Ventana de mantenimiento para migracion V16

La migracion `V16__multi_branch.sql` es **no-apta para migracion en caliente**. Agrega la columna `branch_id` a todas las tablas transaccionales (products, sales, sale_details, stock_movements, cash_registers, purchases, purchase_details, customers, audit_log) y reconstruye el trigger `fn_confirm_sale_stock`.

**Procedimiento recomendado:**

1. Comunicar la ventana de mantenimiento a todos los usuarios (sugerido: inicio del dia antes de la apertura).
2. Detener la aplicacion backend:
   ```bash
   docker compose stop backend
   ```
3. Tomar un backup completo de la base de datos:
   ```bash
   source infra/.env && bash infra/scripts/backup-postgres.sh
   ```
   Verificar que el backup es valido:
   ```bash
   pg_restore --list <archivo.dump> | head -20
   ```
4. Aplicar las migraciones V16–V19 levantando el backend:
   ```bash
   docker compose up -d backend
   docker compose logs -f backend | grep -E "(Flyway|ERROR|Successfully)"
   ```
5. Verificar que las 9 tablas tienen RLS activo:
   ```sql
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public' AND rowsecurity = true
   ORDER BY tablename;
   ```
6. Ejecutar el paso `NOBYPASSRLS` descrito arriba si no se hizo previamente.
7. Verificar el health check:
   ```bash
   curl http://localhost/actuator/health
   ```
8. Realizar una venta de prueba y confirmar que el stock se descuenta correctamente en la sucursal correspondiente.

**Rollback:** si la migracion falla o se detectan problemas, restaurar desde el backup tomado en el paso 3:
```bash
bash infra/scripts/restore-postgres.sh <archivo.dump>
docker compose restart backend
```

---

### Checklist pre-produccion Fase 4

- [ ] Ejecutar el pipeline CI/CD completo contra **staging** con las migraciones V16–V19 y verificar que todos los pasos pasan sin errores.
- [ ] Planificar y comunicar la **ventana de mantenimiento** para la migracion V16 (ver procedimiento arriba). La aplicacion debe estar offline durante la migracion.
- [ ] Tomar un **backup verificado** de la base de datos antes de iniciar la ventana de mantenimiento.
- [ ] Ejecutar `ALTER ROLE <app_user> NOBYPASSRLS` en produccion (F4-11) y verificar que `rolbypassrls = false`.
- [ ] Verificar que RLS esta activo en las 9 tablas transaccionales tras aplicar V17.
- [ ] Configurar los cinco secretos de GitHub Actions listados en la tabla de secretos de este documento.
- [ ] Verificar que `GHCR_PULL_TOKEN` tiene **solo** scope `read:packages` (no `write:packages` ni otros scopes).
- [ ] Confirmar que el selector de sucursal (`BranchSelector.tsx`) en el header funciona correctamente para usuarios ADMIN global y que los usuarios con sucursal asignada solo ven datos de su sucursal.

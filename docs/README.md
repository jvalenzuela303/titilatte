# Minimarket Platform

> Plataforma de gestión para minimarket: ventas POS, catálogo de productos, control de stock y administración de usuarios.

---

## Tabla de Contenidos

1. [Descripcion del Proyecto](#descripcion-del-proyecto)
2. [Stack Tecnologico](#stack-tecnologico)
3. [Arquitectura](#arquitectura)
4. [Prerrequisitos](#prerrequisitos)
5. [Instalacion y Arranque Rapido](#instalacion-y-arranque-rapido)
6. [URLs de Acceso](#urls-de-acceso)
7. [Credenciales Iniciales](#credenciales-iniciales)
8. [Estructura del Repositorio](#estructura-del-repositorio)
9. [Ejecucion de Tests](#ejecucion-de-tests)
10. [Variables de Entorno](#variables-de-entorno)

---

## Descripcion del Proyecto

**Minimarket Platform** es una aplicacion web de gestion pensada para comercios de barrio y minimarkets. Cubre el ciclo operativo completo:

- **Punto de Venta (POS)**: registro de ventas rapidas por codigo de barras con descuento de stock automatico.
- **Catalogo de Productos**: alta, edicion y baja de productos con categorias, impuestos y unidades de medida.
- **Control de Stock**: visualizacion de inventario, alertas de stock bajo y ajustes manuales auditados.
- **Administracion de Usuarios**: creacion de usuarios con roles diferenciados (ADMIN, CAJERO, BODEGA, SUPERVISOR).
- **Autenticacion**: JWT stateless con refresh tokens persistidos y revocacion explicita.

### Fase 1 — Estado Actual

La Fase 1 implementa el nucleo operativo: autenticacion, catalogo, ventas y stock. Los modulos de reportes avanzados, notificaciones en tiempo real y despacho se incorporan en fases posteriores.

### Fase 2 — Modulos Nuevos

La Fase 2 extiende la plataforma con cuatro modulos operativos adicionales:

- **Compras**: gestion de proveedores, registro de ordenes de compra con tipos de documento (FACTURA, BOLETA, SIN_DOCUMENTO), y actualizacion automatica de stock y costo promedio ponderado al confirmar la compra.
- **Caja**: apertura y cierre de turno, arqueo de caja, movimientos manuales de ingreso/egreso, con restriccion de una sola caja abierta por cajero a la vez.
- **Clientes y Credito**: gestion completa de clientes, cuenta corriente con limite de credito configurable, pagos parciales y proteccion contra concurrencia mediante optimistic locking (`@Version`).
- **Reportes**: reportes de ventas por periodo, vendedor y categoria; utilidades; top productos; deudores; stock critico; y exportacion a Excel con Apache POI.

### Fase 3 — Tiempo Real, Auditoria y Dashboard

**Prerrequisitos:** Fase 1 y Fase 2 completas y en funcionamiento.

La Fase 3 agrega capacidades transversales de observabilidad, notificaciones en tiempo real y visualizacion ejecutiva:

- **SSE (Server-Sent Events)**: canal unidireccional servidor → cliente para alertas de stock critico, nuevas ventas y actualizacion del dashboard en tiempo real. Limitado a 500 conexiones concurrentes con cap gestionado en `SseEmitterRegistry`. Autenticacion via `?token=` en lugar de header (limitacion del protocolo SSE en navegadores).
- **Auditoria**: aspecto Spring AOP (`@Auditable`) que registra automaticamente operaciones sensibles en la tabla `audit_log` (JSONB) con IP, usuario, entidad, accion y timestamp. Transacciona con `Propagation.REQUIRES_NEW` para no perder registros ante rollbacks del negocio.
- **Dashboard polomorfico por rol**: endpoint unico `GET /api/v1/dashboard` que retorna un DTO diferente segun el rol del usuario autenticado (ADMIN, SUPERVISOR, CAJERO, BODEGA). El frontend actualiza el dashboard automaticamente cuando recibe eventos SSE.
- **Cache Caffeine**: cache local en memoria para reducir carga en PostgreSQL. Catalogo de productos: TTL 5 min / 5.000 entradas. KPIs del dashboard: TTL 15 s. Historial del dashboard: TTL 1 h.

#### Nuevos endpoints en Fase 3

| Metodo | Path | Descripcion |
|--------|------|-------------|
| `GET` | `/api/v1/events/stream` | Stream SSE — requiere `?token=<jwt>` |
| `GET` | `/api/v1/dashboard` | Dashboard polomorfico por rol |
| `GET` | `/api/v1/audit` | Historial de auditoria paginado y filtrable |
| `GET` | `/api/v1/audit/export/excel` | Exportacion del log de auditoria a `.xlsx` |

### Fase 4 — Multi-sucursal y CI/CD

**Prerrequisitos:** Fase 1, Fase 2 y Fase 3 completas y en funcionamiento.

La Fase 4 agrega soporte multi-sucursal con aislamiento de datos garantizado por la base de datos y un pipeline CI/CD completamente automatizado:

- **Multi-sucursal con Row-Level Security**: columna `branch_id` en todas las tablas transaccionales con politicas RLS en PostgreSQL. El aislamiento de datos entre sucursales es garantizado por el motor de base de datos, no por convencion de codigo. Un ADMIN global (branch_id = null) tiene acceso a todas las sucursales usando el sentinel `'ALL'`.
- **BranchContextFilter**: filtro de orden -200 que ejecuta `SET LOCAL app.current_branch_id` al inicio de cada request, activando el contexto RLS correcto para la transaccion. El claim `branch_id` se incluye en el JWT.
- **CI/CD con GitHub Actions**: dos workflows principales (`ci.yml` y `cd.yml`) y un workflow de seguridad (`security-scan.yml`). Las imagenes se publican en GitHub Container Registry (`ghcr.io`) con tag por SHA de commit. El despliegue se realiza via SSH al servidor de produccion.
- **Migraciones V16–V19**: tablas `branches`. RLS habilitado en tablas transaccionales. Indices de performance para consultas multi-sucursal.

#### Nuevos endpoints en Fase 4

| Metodo | Path | Descripcion |
|--------|------|-------------|
| `GET` | `/api/v1/branches` | Listar sucursales — roles ADMIN, SUPERVISOR |
| `POST` | `/api/v1/branches` | Crear sucursal — ADMIN |
| `PUT` | `/api/v1/branches/{id}` | Actualizar sucursal — ADMIN |
| `DELETE` | `/api/v1/branches/{id}` | Desactivar sucursal (soft delete) — ADMIN |

---

## Stack Tecnologico

| Capa | Tecnologia | Version |
|---|---|---|
| Backend | Java + Spring Boot | 21 / 3.3.5 |
| Frontend | React + TypeScript + Vite | 18.3 / 5.x |
| Base de datos | PostgreSQL | 16 |
| Migraciones BD | Flyway | incluido en Spring Boot |
| Proxy inverso | Nginx | 1.27-alpine |
| Contenedores | Docker + Docker Compose | >= 24 / >= 2.20 |
| ORM | Spring Data JPA + Hibernate | 6.x |
| Seguridad | Spring Security + JJWT + BCrypt | 6.x / 0.12.6 |
| Validacion | Jakarta Validation (Bean Validation) | 3.x |
| Documentacion API | SpringDoc OpenAPI (Swagger UI) | 2.6.0 |
| Exportaciones Excel | Apache POI (poi-ooxml) | 5.x |
| Cache en memoria | Caffeine | 3.x |
| Metricas JVM | Micrometer + Prometheus | incluido en Spring Boot |
| UI Components | Ant Design | 5.x |
| Estado frontend | Zustand | 4.x |
| Formularios | React Hook Form + Zod | 7.x / 3.x |
| Graficos | Recharts | 2.x |
| Tests backend | JUnit 5 + Mockito | incluido en Spring Boot |
| Tests frontend | Vitest + React Testing Library | 2.x |

---

## Arquitectura

```
                            INTERNET / NAVEGADOR
                                     |
                               HTTP :80
                                     |
                          +----------+----------+
                          |       Nginx          |
                          |   Reverse Proxy      |
                          |  (nginx:1.27-alpine) |
                          |                      |
                          |  /api/*  → backend   |
                          |  /*      → frontend  |
                          +----+----------+------+
                               |          |
               backend-net     |          |   frontend-net
                 +-------------+          +-----------+
                 |                                    |
    +------------+------------+        +-------------+------------+
    |         Backend          |        |          Frontend        |
    |   Java 21 / Spring Boot  |        |   React 18 + Vite        |
    |         :8080            |        |   Build estatico / :5173 |
    |                          |        |   (dev server en dev)    |
    |  Modulos Fase 1:         |        +--------------------------+
    |    auth / products       |
    |    sales / stock         |
    |    users                 |
    |  Modulos Fase 2:         |
    |    purchases / cash      |
    |    customers / reports   |
    |  Modulos Fase 3:         |
    |    sse / audit           |
    |    dashboard / config    |
    |                          |
    |  Flyway (migraciones)    |
    +------------+-------------+
                 |
         backend-net
                 |
    +------------+-------------+
    |         PostgreSQL        |
    |     postgres:16-alpine    |
    |            :5432          |
    |                           |
    |  Schemas:                 |
    |    security / products    |
    |    sales / stock          |
    |    purchases / cash       |
    |    customers              |
    +---------------------------+
```

**Redes Docker:**
- `frontend-net`: Nginx <-> Frontend
- `backend-net`: Nginx <-> Backend <-> PostgreSQL

El puerto 5432 de PostgreSQL **no** se expone al host en produccion. Solo el override de desarrollo lo abre para acceso con herramientas de cliente.

---

## Prerrequisitos

| Herramienta | Version minima | Notas |
|---|---|---|
| Docker Engine | 24.x | Requiere daemon corriendo |
| Docker Compose | 2.20 (plugin v2) | `docker compose` (sin guion) |
| Java JDK | 21 | Solo para ejecutar tests backend fuera de Docker |
| Node.js | 20 LTS | Solo para ejecutar tests frontend fuera de Docker |
| OpenSSL | cualquiera | Para generar `JWT_SECRET` |

> En desarrollo todo el stack corre dentro de Docker. Java y Node solo son necesarios si se quieren ejecutar los tests desde la maquina anfitriona sin contenedores.

---

## Instalacion y Arranque Rapido

```bash
# 1. Clonar el repositorio
git clone <url-del-repositorio>
cd titilatte

# 2. Crear el archivo de variables de entorno
cp infra/.env.example infra/.env

# 3. Editar .env con valores reales (obligatorio antes del primer arranque)
#    - POSTGRES_PASSWORD: contrasena segura para la base de datos
#    - JWT_SECRET: cadena aleatoria de 64 bytes en Base64
#
#    Genera JWT_SECRET con:
#    openssl rand -base64 64

# 4. Levantar el stack completo
cd infra
bash scripts/start-dev.sh
```

El script `start-dev.sh` verifica los prerrequisitos, crea el `.env` si no existe, y levanta los cuatro servicios (postgres, backend, frontend, nginx) con hot reload habilitado.

### Opciones del script

```bash
bash scripts/start-dev.sh --build    # Fuerza rebuild de imagenes
bash scripts/start-dev.sh --clean    # Elimina volumenes (reset total, borra datos)
bash scripts/start-dev.sh --detach   # Levanta en background
bash scripts/start-dev.sh --help     # Muestra ayuda
```

### Arranque manual con Docker Compose

```bash
cd infra
docker compose up --build
```

---

## URLs de Acceso

| Recurso | URL | Notas |
|---|---|---|
| Frontend | `http://localhost` | React SPA via Nginx |
| Vite dev server | `http://localhost:5173` | Solo en modo desarrollo |
| API REST | `http://localhost/api/v1` | Prefijo de todos los endpoints |
| Swagger UI | `http://localhost/api/v1/swagger-ui.html` | Solo en perfil `dev` |
| OpenAPI JSON | `http://localhost/api/v1/v3/api-docs` | Solo en perfil `dev` |
| Health check | `http://localhost/actuator/health` | Publico, sin autenticacion |
| Grafana | `http://localhost:3000` | Solo en ambiente staging (monitoreo) |
| Prometheus | `http://localhost:9090` | Solo en ambiente staging (metricas) |
| PostgreSQL | `localhost:5432` | Solo expuesto en override de desarrollo |
| JVM Debug | `localhost:5005` | Solo expuesto en override de desarrollo |

---

## Credenciales Iniciales

El seed de datos (migracion `V6`) crea un usuario administrador por defecto:

| Campo | Valor |
|---|---|
| Email | `admin@minimarket.local` |
| Contrasena | `Admin1234!` |
| Rol | `ADMIN` |

**Cambiar esta contrasena antes de cualquier uso en produccion o en un entorno accesible desde la red.**

El hash BCrypt corresponde a fuerza de trabajo 12 (`$2a$12$...`). Para actualizar la contrasena sin recrear la base de datos, ejecutar desde psql:

```sql
UPDATE users
SET password_hash = '<nuevo-hash-bcrypt>'
WHERE email = 'admin@minimarket.local';
```

Generar el nuevo hash con cualquier utilidad BCrypt de fuerza 12.

---

## Estructura del Repositorio

```
titilatte/
├── backend/                    # Aplicacion Spring Boot
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/minimarket/
│   │   │   │   ├── config/         # SecurityConfig, CorsConfig, CacheConfig
│   │   │   │   ├── exception/      # GlobalExceptionHandler
│   │   │   │   ├── security/       # JwtService, JwtAuthFilter, BranchContextFilter (Fase 4)
│   │   │   │   ├── sse/            # Fase 3: SseEmitterRegistry, SseController
│   │   │   │   ├── audit/          # Fase 3: AuditAspect, AuditController
│   │   │   │   ├── dashboard/      # Fase 3: DashboardController
│   │   │   │   └── modules/
│   │   │   │       ├── auth/       # Login, Refresh, Logout
│   │   │   │       ├── products/   # Catalogo de productos
│   │   │   │       ├── sales/      # POS y gestion de ventas
│   │   │   │       ├── stock/      # Inventario y movimientos
│   │   │   │       ├── users/      # Administracion de usuarios
│   │   │   │       ├── purchases/  # Fase 2: Compras y proveedores
│   │   │   │       ├── cash/       # Fase 2: Caja y turnos
│   │   │   │       ├── customers/  # Fase 2: Clientes y credito
│   │   │   │       ├── reports/    # Fase 2: Reportes y exportaciones
│   │   │   │       └── branches/   # Fase 4: CRUD de sucursales
│   │   │   └── resources/
│   │   │       ├── application.yml
│   │   │       └── db/migration/   # Flyway V1-V6 (F1) + V7-V11 (F2) + V12-V15 (F3) + V16-V19 (F4)
│   │   └── test/                   # JUnit + Mockito
│   ├── Dockerfile
│   └── pom.xml
│
├── frontend/                   # Aplicacion React + Vite
│   ├── src/
│   │   ├── pages/              # Login, POS, Products, Stock
│   │   │   ├── Dashboard/      # Fase 3: DashboardPage.tsx (polomorfico por rol)
│   │   │   ├── Audit/          # Fase 3: AuditPage.tsx
│   │   │   └── Branches/       # Fase 4: BranchesPage.tsx (CRUD sucursales)
│   │   ├── components/
│   │   │   └── layout/         # Fase 4: BranchSelector.tsx (selector en header para ADMIN global)
│   │   ├── services/           # productService, saleService, stockService
│   │   │   └── branchService.ts    # Fase 4
│   │   ├── store/              # Estado global (Zustand); Fase 4: campo activeBranchId en authStore.ts
│   │   ├── hooks/              # Custom hooks (Fase 3: useSse.ts)
│   │   ├── types/              # Tipos TypeScript
│   │   └── config/             # axiosInstance, rutas
│   ├── Dockerfile
│   └── package.json
│
├── infra/                      # Infraestructura
│   ├── docker-compose.yml          # Configuracion base
│   ├── docker-compose.override.yml # Sobreescritura para desarrollo
│   ├── docker-compose.staging.yml  # Sobreescritura para staging (Fase 2)
│   ├── .env.example                # Plantilla de variables de entorno
│   ├── .env.staging.example        # Plantilla para staging (Fase 2)
│   ├── nginx/
│   │   └── nginx.conf              # Reverse proxy, rate limiting, SSE location block (Fase 3)
│   ├── scripts/
│   │   ├── start-dev.sh            # Script de arranque con validaciones
│   │   ├── backup-postgres.sh      # Backup manual de la BD (Fase 2)
│   │   ├── restore-postgres.sh     # Restauracion interactiva (Fase 2)
│   │   └── cron-setup.sh           # Configuracion de cron automatico (Fase 2)
│   ├── monitoring/
│   │   ├── docker-compose.monitoring.yml  # Grafana + Prometheus (Fase 2)
│   │   └── grafana/dashboards/
│   │       └── minimarket-overview.json   # Dashboard Grafana 6 paneles (Fase 3)
│   └── SECURITY_CHECKLIST.md       # Checklist pre-produccion
│
└── docs/                       # Documentacion tecnica
    ├── README.md               # Este archivo
    ├── API.md                  # Referencia de endpoints REST
    ├── DEPLOYMENT.md           # Guia de despliegue
    ├── ARCHITECTURE.md         # Decisiones de arquitectura (ADRs)
    └── MODULES.md              # Documentacion de modulos funcionales
```

Cada modulo del backend sigue la estructura interna:
```
modules/<nombre>/
├── controller/     # @RestController — HTTP handlers
├── service/        # Interfaz + implementacion — logica de negocio
├── domain/         # Entidades JPA y enums
├── dto/            # Request/Response records
└── repository/     # Spring Data JPA repositories
```

---

## Ejecucion de Tests

### Backend (JUnit 5 + Mockito)

```bash
# Dentro del contenedor (no requiere Java local)
docker compose exec backend ./mvnw test

# Desde la maquina anfitriona (requiere Java 21 y Maven)
cd backend
./mvnw test

# Con reporte de cobertura
./mvnw verify
# El reporte HTML queda en: backend/target/site/jacoco/index.html
```

### Frontend (Vitest + React Testing Library)

```bash
# Dentro del contenedor (no requiere Node local)
docker compose exec frontend npm test

# Desde la maquina anfitriona (requiere Node 20)
cd frontend
npm test

# Modo watch
npm test -- --watch

# Con cobertura
npm run test:coverage
# El reporte queda en: frontend/coverage/index.html

# Con UI interactiva de Vitest
npm run test:ui
```

---

## Variables de Entorno

Todas las variables se definen en `infra/.env` (creado desde `infra/.env.example`).

### PostgreSQL

| Variable | Requerida | Descripcion | Ejemplo |
|---|---|---|---|
| `POSTGRES_DB` | Si | Nombre de la base de datos | `minimarket_db` |
| `POSTGRES_USER` | Si | Usuario de la base de datos | `minimarket_user` |
| `POSTGRES_PASSWORD` | Si | Contrasena del usuario | `S3cr3t!2025` |
| `POSTGRES_PORT` | No | Puerto expuesto al host (solo dev) | `5432` |

### Backend — Spring Boot

| Variable | Requerida | Descripcion | Ejemplo |
|---|---|---|---|
| `SPRING_DATASOURCE_URL` | Si | URL JDBC de conexion | `jdbc:postgresql://postgres:5432/minimarket_db` |
| `SPRING_PROFILES_ACTIVE` | No | Perfil activo de Spring | `dev` |
| `JWT_SECRET` | Si | Clave HMAC-SHA256 en Base64 (>= 64 bytes) | `openssl rand -base64 64` |
| `JWT_EXPIRATION` | No | Duracion del access token en ms | `3600000` (1 hora) |
| `JWT_REFRESH_EXPIRATION` | No | Duracion del refresh token en ms | `86400000` (24 horas) |
| `JAVA_OPTS` | No | Flags de la JVM | `-Xms256m -Xmx512m` |

### Frontend — Vite

| Variable | Requerida | Descripcion | Ejemplo |
|---|---|---|---|
| `VITE_API_URL` | Si | URL base de la API para el frontend | `http://localhost/api/v1` |

### Nginx

| Variable | Requerida | Descripcion | Ejemplo |
|---|---|---|---|
| `NGINX_HTTP_PORT` | No | Puerto HTTP expuesto al host | `80` |

### Staging (Fase 2 y Fase 3)

| Variable | Requerida | Descripcion | Ejemplo |
|---|---|---|---|
| `GRAFANA_ADMIN_PASSWORD` | Si (staging) | Contrasena del admin de Grafana | `GrafanaS3cr3t!` |

### Cache — Caffeine (Fase 3)

Las siguientes variables son opcionales. Los valores por defecto estan definidos en `CacheConfig.java` y son adecuados para el uso previsto en un minimarket de instancia unica.

| Variable | Requerida | Descripcion | Default |
|---|---|---|---|
| `CACHE_PRODUCTS_TTL_SECONDS` | No | TTL del cache de catalogo de productos | `300` (5 min) |
| `CACHE_PRODUCTS_MAX_SIZE` | No | Maximo de entradas en el cache de productos | `5000` |
| `CACHE_KPI_TTL_SECONDS` | No | TTL del cache de KPIs del dashboard | `15` |
| `CACHE_HISTORY_TTL_SECONDS` | No | TTL del cache del historial del dashboard | `3600` (1 h) |


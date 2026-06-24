# Minimarket Platform

Plataforma de gestion integral para minimarkets y comercios de barrio: punto de venta POS, catalogo de productos, control de stock, compras, caja, clientes con credito, reportes, dashboard en tiempo real y soporte multi-sucursal.

---

## Tabla de Contenidos

1. [Descripcion del Proyecto](#descripcion-del-proyecto)
2. [Stack Tecnologico](#stack-tecnologico)
3. [Arquitectura](#arquitectura)
4. [Modulos del Sistema](#modulos-del-sistema)
5. [Roles y Permisos](#roles-y-permisos)
6. [Prerrequisitos](#prerrequisitos)
7. [Instalacion y Arranque Rapido](#instalacion-y-arranque-rapido)
8. [URLs de Acceso](#urls-de-acceso)
9. [Credenciales Iniciales](#credenciales-iniciales)
10. [Estructura del Repositorio](#estructura-del-repositorio)
11. [Ejecucion de Tests](#ejecucion-de-tests)
12. [Variables de Entorno](#variables-de-entorno)
13. [Documentacion](#documentacion)

---

## Descripcion del Proyecto

**Minimarket Platform** es una aplicacion web de gestion pensada para comercios de barrio y minimarkets. Cubre el ciclo operativo completo en cuatro fases:

### Fase 1 — Nucleo Operativo
- **Punto de Venta (POS)**: registro de ventas rapidas por codigo de barras con descuento de stock automatico via triggers PostgreSQL.
- **Catalogo de Productos**: alta, edicion y baja logica de productos con categorias, impuestos y unidades de medida.
- **Control de Stock**: inventario en tiempo real, alertas de stock bajo y ajustes manuales auditados.
- **Autenticacion JWT**: tokens de acceso (15 min) y refresh tokens (7 dias) persistidos como hash SHA-256, con revocacion explicita.

### Fase 2 — Modulos Operativos
- **Compras**: gestion de proveedores, ordenes de compra con tipos de documento, actualizacion automatica de stock y calculo de costo promedio ponderado (CPP).
- **Caja**: apertura y cierre de turno, arqueo, movimientos manuales de ingreso/egreso. Una caja abierta por cajero a la vez (constraint unico en BD).
- **Clientes y Credito**: cuenta corriente con limite configurable, pagos parciales y proteccion de concurrencia con optimistic locking (`@Version`).
- **Reportes**: ventas por periodo/vendedor/categoria, utilidades, top productos, deudores, stock critico, exportacion a Excel (Apache POI).

### Fase 3 — Tiempo Real, Auditoria y Dashboard
- **SSE (Server-Sent Events)**: canal servidor → cliente para alertas de stock critico, nuevas ventas y actualizacion del dashboard. Limite de 500 conexiones concurrentes.
- **Auditoria**: aspecto Spring AOP (`@Auditable`) que registra operaciones sensibles en tabla JSONB con `Propagation.REQUIRES_NEW` para no perder registros ante rollbacks.
- **Dashboard polimorfico**: endpoint unico `GET /api/v1/dashboard` que retorna un DTO diferente segun el rol (ADMIN, SUPERVISOR, CAJERO, BODEGA).
- **Cache Caffeine**: cache local en memoria JVM para reducir carga en PostgreSQL (catalogo 5 min, KPIs 15 s, historial 1 h).

### Fase 4 — Multi-sucursal y CI/CD
- **Row-Level Security (RLS)**: columna `branch_id` en todas las tablas transaccionales con politicas RLS en PostgreSQL. Aislamiento de datos garantizado por el motor, no por convencion de codigo.
- **BranchContextFilter**: filtro de orden -200 que ejecuta `SET LOCAL app.current_branch_id` al inicio de cada request.
- **CI/CD con GitHub Actions**: pipelines de integracion (`ci.yml`), entrega (`cd.yml`) y escaneo de seguridad (`security-scan.yml`). Imagenes publicadas en GitHub Container Registry.

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
| Validacion | Jakarta Bean Validation | 3.x |
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

El sistema sigue un **monolito modular** (ADR-001): paquetes separados por bounded context pero desplegados como una sola unidad. Cuatro contenedores Docker separados por red:

```
                        INTERNET / NAVEGADOR
                                 |
                           HTTP :80
                                 |
                      +----------+----------+
                      |        Nginx         |
                      |    Reverse Proxy     |
                      |  /api/*  -> backend  |
                      |  /*      -> frontend |
                      +----+----------+------+
                           |          |
           backend-net     |          |   frontend-net
             +-------------+          +-----------+
             |                                    |
+------------+------------+        +-------------+------------+
|         Backend          |        |          Frontend        |
|   Java 21 / Spring Boot  |        |   React 18 + Vite        |
|         :8080            |        |   Build estatico / :5173 |
+------------+-------------+        +--------------------------+
             |
     backend-net
             |
+------------+-------------+
|        PostgreSQL         |
|    postgres:16-alpine     |
|           :5432           |
+---------------------------+
```

**Redes Docker:**
- `frontend-net`: Nginx <-> Frontend
- `backend-net`: Nginx <-> Backend <-> PostgreSQL

PostgreSQL **no** se expone al host en produccion. Solo el override de desarrollo lo abre para herramientas de cliente.

### Decisiones de Arquitectura Clave

| ADR | Decision |
|-----|----------|
| ADR-001 | Monolito modular (no microservicios en fases 1-3) |
| ADR-002 | JWT stateless + refresh tokens con hash SHA-256 en BD |
| ADR-003 | Stock atomico via triggers PL/pgSQL con `SELECT FOR UPDATE` |
| ADR-004/009 | SSE sobre WebSockets para notificaciones en tiempo real |
| ADR-005 | CQRS ligero con SQL nativo para reportes |
| ADR-006 | Apache POI para exportacion Excel (no JasperReports) |
| ADR-007 | Auditoria con Spring AOP y `Propagation.REQUIRES_NEW` |
| ADR-008 | Cache Caffeine local (no Redis) para instancia unica |
| ADR-010 | Dashboard polimorfico por rol con Strategy Pattern |
| ADR-011 | CI/CD con GitHub Actions |
| ADR-013 | Multi-sucursal con Row-Level Security en PostgreSQL |

---

## Modulos del Sistema

| Modulo | Fase | Responsabilidad |
|--------|------|-----------------|
| **AUTH** | 1 | Login, refresh, logout. JWT + refresh tokens. BCrypt cost-12. |
| **PRODUCTS** | 1 | Catalogo de productos, categorias, precios, soft delete. GIN trigram index para busqueda. |
| **SALES** | 1 | POS, registro de ventas, estado machine PENDING → CONFIRMED/CANCELLED. Stock via trigger. |
| **STOCK** | 1 | Inventario, ledger inmutable de movimientos, alertas de stock minimo. |
| **PURCHASES** | 2 | Ordenes de compra, proveedores, calculo de costo promedio ponderado. |
| **CASH** | 2 | Turnos de caja, arqueo, movimientos manuales. Una caja abierta por cajero. |
| **CUSTOMERS** | 2 | Clientes, cuenta corriente, limite de credito, pagos parciales, optimistic locking. |
| **REPORTS** | 2 | Reportes SQL nativo (CQRS ligero), exportacion Excel. Ventana maxima 366 dias. |
| **SSE** | 3 | Notificaciones en tiempo real via Server-Sent Events. Registry con cap 500 conexiones. |
| **AUDIT** | 3 | Log inmutable de operaciones sensibles con Spring AOP y JSONB. |
| **DASHBOARD** | 3 | KPIs polimorficos por rol con cache Caffeine y actualizacion via SSE. |
| **BRANCHES** | 4 | CRUD de sucursales. Aislamiento de datos via RLS en PostgreSQL. |

---

## Roles y Permisos

| Rol | Usuario | Acceso Principal |
|-----|---------|-----------------|
| **ADMIN** | Administrador | Acceso total: usuarios, catalogo, compras, cancelaciones, limites de credito, todas las sucursales |
| **CAJERO** | Vendedor en caja | Ventas POS, apertura/cierre de su propia caja, pagos de clientes |
| **BODEGA** | Personal de almacen | Catalogo de productos, ordenes de compra, control de stock |
| **SUPERVISOR** | Supervisor / gerente | Ventas, cancelaciones, ajustes de stock, limites de credito, todos los reportes |

---

## Prerrequisitos

| Herramienta | Version minima | Notas |
|---|---|---|
| Docker Engine | 24.x | Requiere daemon corriendo |
| Docker Compose | 2.20 (plugin v2) | `docker compose` (sin guion) |
| Java JDK | 21 | Solo para tests fuera de Docker |
| Node.js | 20 LTS | Solo para tests fuera de Docker |
| OpenSSL | cualquiera | Para generar `JWT_SECRET` |

---

## Instalacion y Arranque Rapido

```bash
# 1. Clonar el repositorio
git clone <url-del-repositorio>
cd titilatte

# 2. Crear el archivo de variables de entorno
cp infra/.env.example infra/.env

# 3. Editar .env con valores reales (obligatorio antes del primer arranque)
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
| Grafana | `http://localhost:3000` | Solo en ambiente staging |
| Prometheus | `http://localhost:9090` | Solo en ambiente staging |
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

> **Cambiar esta contrasena antes de cualquier uso en produccion.**

Para actualizar la contrasena sin recrear la base de datos:

```sql
UPDATE users
SET password_hash = '<nuevo-hash-bcrypt>'
WHERE email = 'admin@minimarket.local';
```

---

## Estructura del Repositorio

```
titilatte/
├── backend/                    # Aplicacion Spring Boot (Java 21)
│   ├── src/main/java/com/minimarket/
│   │   ├── config/             # SecurityConfig, CorsConfig, CacheConfig
│   │   ├── exception/          # GlobalExceptionHandler
│   │   ├── security/           # JwtService, JwtAuthFilter, BranchContextFilter
│   │   ├── sse/                # SseEmitterRegistry, SseController
│   │   ├── audit/              # AuditAspect, AuditController
│   │   ├── dashboard/          # DashboardController (polimorfico por rol)
│   │   └── modules/
│   │       ├── auth/           # Login, Refresh, Logout
│   │       ├── products/       # Catalogo de productos
│   │       ├── sales/          # POS y gestion de ventas
│   │       ├── stock/          # Inventario y movimientos
│   │       ├── users/          # Administracion de usuarios
│   │       ├── purchases/      # Compras y proveedores
│   │       ├── cash/           # Caja y turnos
│   │       ├── customers/      # Clientes y credito
│   │       ├── reports/        # Reportes y exportaciones
│   │       └── branches/       # CRUD de sucursales
│   └── src/main/resources/
│       └── db/migration/       # Flyway V1-V6 (F1) V7-V11 (F2) V12-V15 (F3) V16-V19 (F4)
│
├── frontend/                   # Aplicacion React 18 + Vite
│   └── src/
│       ├── pages/              # Login, POS, Products, Stock, Dashboard, Audit, Branches
│       ├── components/         # Componentes reutilizables y layout
│       ├── services/           # Clientes HTTP por modulo (axios)
│       ├── store/              # Estado global con Zustand
│       ├── hooks/              # Custom hooks (useSse.ts para tiempo real)
│       └── types/              # Tipos TypeScript
│
├── infra/                      # Infraestructura Docker
│   ├── docker-compose.yml          # Configuracion base
│   ├── docker-compose.override.yml # Sobreescritura para desarrollo
│   ├── docker-compose.staging.yml  # Sobreescritura para staging
│   ├── nginx/nginx.conf            # Reverse proxy, rate limiting, SSE location
│   ├── scripts/
│   │   ├── start-dev.sh            # Script de arranque con validaciones
│   │   ├── backup-postgres.sh      # Backup manual de la BD
│   │   └── restore-postgres.sh     # Restauracion interactiva
│   └── monitoring/                 # Grafana + Prometheus (staging)
│
├── docs/                       # Documentacion tecnica detallada
│   ├── ARCHITECTURE.md         # ADRs y diagramas C4
│   ├── MODULES.md              # Documentacion de modulos funcionales
│   ├── API.md                  # Referencia de endpoints REST
│   └── DEPLOYMENT.md          # Guia de despliegue
│
├── start.sh                    # Shortcut de arranque
└── stop.sh                     # Shortcut de parada
```

Cada modulo del backend sigue la misma estructura interna:

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

# Desde la maquina anfitriona (requiere Java 21)
cd backend && ./mvnw test

# Con reporte de cobertura (JaCoCo)
./mvnw verify
# Reporte: backend/target/site/jacoco/index.html
```

> Los tests de integracion requieren PostgreSQL real — no se puede usar H2 porque la logica de stock usa PL/pgSQL y triggers propios de PostgreSQL.

### Frontend (Vitest + React Testing Library)

```bash
# Dentro del contenedor
docker compose exec frontend npm test

# Desde la maquina anfitriona (requiere Node 20)
cd frontend
npm test              # Ejecutar una vez
npm test -- --watch   # Modo watch
npm run test:coverage # Con cobertura
npm run test:ui       # UI interactiva de Vitest
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
| `JWT_EXPIRATION` | No | Duracion del access token en ms | `900000` (15 min) |
| `JWT_REFRESH_EXPIRATION` | No | Duracion del refresh token en ms | `604800000` (7 dias) |
| `JAVA_OPTS` | No | Flags de la JVM | `-Xms256m -Xmx512m` |

### Frontend — Vite

| Variable | Requerida | Descripcion | Ejemplo |
|---|---|---|---|
| `VITE_API_URL` | Si | URL base de la API para el frontend | `http://localhost/api/v1` |

### Nginx

| Variable | Requerida | Descripcion | Ejemplo |
|---|---|---|---|
| `NGINX_HTTP_PORT` | No | Puerto HTTP expuesto al host | `80` |

### Staging

| Variable | Requerida | Descripcion | Ejemplo |
|---|---|---|---|
| `GRAFANA_ADMIN_PASSWORD` | Si (staging) | Contrasena del admin de Grafana | `GrafanaS3cr3t!` |

### Cache — Caffeine (opcionales)

| Variable | Descripcion | Default |
|---|---|---|
| `CACHE_PRODUCTS_TTL_SECONDS` | TTL del cache de catalogo | `300` (5 min) |
| `CACHE_PRODUCTS_MAX_SIZE` | Max entradas en cache de productos | `5000` |
| `CACHE_KPI_TTL_SECONDS` | TTL del cache de KPIs del dashboard | `15` |
| `CACHE_HISTORY_TTL_SECONDS` | TTL del cache del historial del dashboard | `3600` (1 h) |

---

## Documentacion

| Documento | Descripcion |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Decisiones de arquitectura (ADRs), diagramas C4, flujos de autenticacion y POS |
| [`docs/MODULES.md`](docs/MODULES.md) | Documentacion detallada de cada modulo: entidades, reglas de negocio, endpoints, tablas |
| [`docs/API.md`](docs/API.md) | Referencia completa de endpoints REST |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Guia de despliegue en produccion y staging |
| [`infra/SECURITY_CHECKLIST.md`](infra/SECURITY_CHECKLIST.md) | Checklist de seguridad pre-produccion |

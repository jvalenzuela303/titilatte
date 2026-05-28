# Architecture — Minimarket Platform

## Table of Contents

- [Architecture Decision Records (ADRs)](#architecture-decision-records-adrs)
  - [ADR-001: Monolito Modular vs Microservicios](#adr-001-monolito-modular-vs-microservicios)
  - [ADR-002: JWT Stateless con Refresh Tokens Persistidos en BD](#adr-002-jwt-stateless-con-refresh-tokens-persistidos-en-bd)
  - [ADR-003: Lógica de Stock Atómica mediante Triggers PostgreSQL](#adr-003-lógica-de-stock-atómica-mediante-triggers-postgresql)
  - [ADR-004: Server-Sent Events (SSE) sobre WebSockets para Tiempo Real](#adr-004-server-sent-events-sse-sobre-websockets-para-tiempo-real)
  - [ADR-005: Patrón de Reportes — CQRS Ligero con Native Queries](#adr-005-patrón-de-reportes--cqrs-ligero-con-native-queries)
  - [ADR-006: Exportaciones — Apache POI vs JasperReports](#adr-006-exportaciones--apache-poi-vs-jasperreports)
  - [ADR-007: Auditoria con Spring AOP @Auditable y Propagation.REQUIRES_NEW](#adr-007-auditoria-con-spring-aop-auditable-y-propagationrequires_new)
  - [ADR-008: Cache Local Caffeine en lugar de Redis](#adr-008-cache-local-caffeine-en-lugar-de-redis)
  - [ADR-009: SSE sobre WebSocket para Alertas de Stock en Tiempo Real](#adr-009-sse-sobre-websocket-para-alertas-de-stock-en-tiempo-real)
  - [ADR-010: Endpoint de Dashboard Polimorfico por Rol](#adr-010-endpoint-de-dashboard-polimorfico-por-rol)
  - [ADR-011: CI/CD con GitHub Actions](#adr-011-cicd-con-github-actions)
  - [ADR-013: Multi-sucursal con Row-Level Security en PostgreSQL](#adr-013-multi-sucursal-con-row-level-security-en-postgresql)
- [Diagrams](#diagrams)
  - [C4 Level 1 — System Context](#c4-level-1--system-context)
  - [C4 Level 2 — Containers](#c4-level-2--containers)
  - [Authentication Flow](#authentication-flow)
  - [POS Sale Flow](#pos-sale-flow)

---

## Architecture Decision Records (ADRs)

### ADR-001: Monolito Modular vs Microservicios

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | Phase 1 |
| **Deciders** | Engineering team |

#### Context

The project starts as a single system for a minimarket. The operational complexity of microservices — service discovery, distributed tracing, network latency, independent deployments — does not justify the benefits at this stage. The team is small and the bounded contexts are well-understood from the start.

#### Decision

Adopt a **modular monolith** with packages separated by bounded context: `auth`, `products`, `sales`, `stock`. Each module owns its full vertical slice:

```
com.minimarket.
  ├── auth/
  │   ├── controller/
  │   ├── service/
  │   ├── repository/
  │   ├── domain/
  │   └── dto/
  ├── products/   (same structure)
  ├── sales/      (same structure)
  └── stock/      (same structure)
```

Modules communicate only through well-defined service interfaces — no direct cross-module repository calls.

#### Consequences

**Positive:**
- Simple single-unit deployment
- Local ACID transactions across module boundaries with no distributed saga overhead
- Low operational overhead (one JVM, one database connection pool)
- Agile refactoring — rename, move, or merge modules without network contracts

**Negative:**
- Vertical scaling only in Phases 1–3 (scale the entire monolith, not individual hotspots)
- Extraction to microservices is deferred to Phase 4 via the [Strangler Fig pattern](https://martinfowler.com/bliki/StranglerFigApplication.html)

---

### ADR-002: JWT Stateless con Refresh Tokens Persistidos en BD

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | Phase 1 |
| **Deciders** | Engineering team |

#### Context

The API is stateless REST — JWT is the natural fit. However, pure stateless JWT cannot support session revocation (forced logout, compromised token invalidation). A balance between statelessness and revocability is required.

#### Decision

Two-token strategy:

| Token | Type | TTL | Storage | Revocable |
|-------|------|-----|---------|-----------|
| Access token | JWT (signed) | 15 min | Client only (memory/cookie) | No |
| Refresh token | UUID v4 | 7 days | SHA-256 hash in `refresh_tokens` table | Yes |

- The access token is **never persisted** — it is verified by signature only.
- The refresh token is stored as `SHA-256(token)` — the plaintext never touches the database.
- Revoking a session: delete or mark the refresh token row as `revoked = true`.
- Expired refresh token rows must be cleaned periodically (scheduled job or database cron).

#### Consequences

- An access token **cannot** be revoked before its 15-minute expiry. This trade-off is accepted: the short TTL limits the exposure window.
- The refresh token **can** be revoked at any time, covering forced logout and compromised-token scenarios.
- Periodic cleanup of expired tokens is required to prevent unbounded table growth.

---

### ADR-003: Lógica de Stock Atómica mediante Triggers PostgreSQL

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | Phase 1 |
| **Deciders** | Engineering team |

#### Context

Stock consistency is business-critical. Two cashiers selling the last unit simultaneously must not produce negative stock. The application layer (Spring Boot) cannot guarantee atomicity across concurrent transactions without pessimistic locking at the database level.

#### Decision

The PL/pgSQL function `fn_apply_stock_movement` performs the atomic stock decrement:

1. Acquires a **pessimistic row-level lock** via `SELECT ... FOR UPDATE` on the product row.
2. Validates the resulting stock would not be negative.
3. Inserts a `stock_movements` ledger record with `quantity_before` and `quantity_after`.
4. Updates `products.stock_current`.

The trigger `fn_confirm_sale_stock` fires `AFTER UPDATE` on `sales.status`:
- Transition to `CONFIRMED` → calls `fn_apply_stock_movement` (decrement).
- Transition to `CANCELLED` → calls `fn_apply_stock_movement` (increment/reversal).

The Java service layer only changes `sale.status` — the stock side-effect is fully owned by the database.

#### Consequences

- Critical business logic lives in the database, not exclusively in Java. This is an intentional trade-off for atomicity guarantees.
- **Integration tests must use real PostgreSQL** (not H2 or in-memory databases) to fully validate this logic. H2 does not support the same PL/pgSQL dialect.
- The trigger approach means stock movements are always consistent even if the Java layer crashes mid-transaction.

---

### ADR-004: Server-Sent Events (SSE) sobre WebSockets para Tiempo Real

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | Phase 3 |
| **Deciders** | Engineering team |

#### Context

Phase 3 requires real-time updates for: stock level changes, new sales, and the admin dashboard. Two main options: WebSockets (full-duplex) or Server-Sent Events (server-to-client only).

#### Decision

Use **SSE over HTTP/2** rather than WebSockets.

| Criterion | SSE | WebSockets |
|-----------|-----|------------|
| Communication | Unidirectional (server → client) | Bidirectional |
| Proxy compatibility | Native HTTP — works through any standard HTTP proxy | Requires special proxy configuration |
| Complexity | Low — standard HTTP endpoint | Higher — separate protocol upgrade |
| Reconnection | Automatic (browser built-in) | Manual implementation required |
| Use case fit | Notifications push | Interactive two-way communication |

All real-time scenarios (stock alerts, sales notifications, dashboard refresh) are server-push — bidirectionality is not needed.

#### Consequences

- Bidirectional communication is not supported. This is acceptable for the defined use cases.
- The browser handles automatic reconnection via the `EventSource` API.
- Nginx is already configured for SSE proxy (`proxy_buffering off`, `X-Accel-Buffering: no`).
- If future requirements demand bidirectionality (e.g., collaborative editing), WebSockets can be introduced for that specific endpoint without replacing SSE.

---

### ADR-005: Patrón de Reportes — CQRS Ligero con Native Queries

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | Phase 2 |
| **Deciders** | Engineering team |

#### Context

Los reportes del módulo `reports` requieren agregaciones complejas sobre múltiples tablas: `DATE()` y funciones de ventana para agrupar por periodo, `GROUP BY` con cálculos de utilidad, joins entre ventas, compras, clientes y productos. JPQL no puede expresar estas consultas de forma legible ni eficiente, y la alternativa de vistas materializadas en PostgreSQL agregaría complejidad operacional significativa (mantenimiento de refreshes, permisos adicionales, gestión del lag de datos).

#### Decision

Adoptar **CQRS ligero**: el módulo `reports` usa `EntityManager` con SQL nativo directamente. Los queries son de solo lectura y no comparten el modelo de dominio transaccional con el resto de los módulos.

Reglas de implementación:
- Todos los parámetros de los queries se pasan como **parámetros nombrados** (`:startDate`, `:sellerId`, etc.) — nunca concatenación de strings.
- Los métodos del servicio de reportes están anotados con `@Transactional(readOnly = true)`.
- El módulo `reports` no tiene entidades JPA propias ni repositorios Spring Data — accede a las tablas de otros módulos exclusivamente a través de SQL nativo de lectura.

#### Consequences

**Positivas:**
- Queries optimizados específicamente para reportes, sin compromisos con el modelo JPA de dominio.
- Fácil de optimizar con índices específicos (índices parciales por fecha, índices cubrientes para las queries más frecuentes).
- Menor impedance mismatch entre la query SQL y la estructura del DTO de salida.

**Negativas:**
- SQL nativo es menos portable entre motores de base de datos. Este riesgo es aceptado: PostgreSQL 16 es el único target y no hay planes de cambio en el roadmap.
- Requiere más cuidado con inyección SQL que JPQL. Mitigado completamente con el uso obligatorio de parámetros nombrados.
- Los queries no se validan en tiempo de compilación. Los tests de integración contra PostgreSQL real son esenciales para detectar errores de sintaxis SQL.

---

### ADR-006: Exportaciones — Apache POI vs JasperReports

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | Phase 2 |
| **Deciders** | Engineering team |

#### Context

La Fase 2 requiere exportación de reportes a Excel. Dos candidatos principales: **JasperReports** y **Apache POI**. JasperReports es una solución madura y potente que soporta Excel, PDF y múltiples formatos mediante templates `.jrxml`. Apache POI (poi-ooxml) es la librería estándar de facto para manipulación programática de archivos Office en Java.

| Criterio | JasperReports | Apache POI |
|----------|---------------|------------|
| Footprint de dependencias | ~15 MB adicionales + transitive deps | ~8 MB |
| Curva de aprendizaje | Alta (templates XML, compilación .jasper) | Media (API programática Java) |
| Formatos soportados | Excel, PDF, HTML, CSV, etc. | Excel y Word nativos |
| Templates visuales | Si (diseñador visual disponible) | No — código Java puro |
| Mantenimiento de templates | Requiere herramienta externa (Jaspersoft Studio) | El template es el código |
| Uso actual | Solo Excel en Fase 2 | Solo Excel en Fase 2 |

#### Decision

Usar **Apache POI (poi-ooxml)** para la generación de archivos Excel. El endpoint `GET /api/v1/reports/export/excel` retorna un `StreamingResponseBody` con el archivo `.xlsx` generado dinámicamente.

PDF **no se implementa en Fase 2**. Se evalúa para Fase 3 con iText o WeasyPrint según el tipo de layout requerido (programático vs HTML-to-PDF).

#### Consequences

- Menor footprint de dependencias (~8 MB vs ~15 MB + transitivas de JasperReports).
- Código más explícito y navegable: el formato del Excel se lee directamente del código Java, sin templates externos.
- Sin herramientas visuales para diseñar el layout — aceptable para la audiencia técnica del proyecto.
- Si Fase 3 requiere PDF con layout complejo, se introducirá una dependencia adicional para ese formato específico sin afectar la lógica Excel.

---

### ADR-007: Auditoria con Spring AOP @Auditable y Propagation.REQUIRES_NEW

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | Phase 3 |
| **Deciders** | Engineering team |

#### Context

La Fase 3 requiere auditoria automatica de operaciones sensibles (altas, bajas, modificaciones de precios, anulacion de ventas, cambios de credito). Las alternativas eran: (1) llamadas explicitas al servicio de auditoria dentro de cada metodo de negocio, o (2) un aspecto Spring AOP transversal activado por anotacion.

La opcion 1 dispersa logica de auditoria por todos los servicios y es facil de olvidar al agregar nuevos metodos. La opcion 2 centraliza la implementacion en un unico aspecto y es optable por anotacion.

Un problema adicional: si el metodo de negocio hace rollback (ej. venta rechazada por stock insuficiente), un log de auditoria que participa en la misma transaccion seria desechado junto con el rollback — perdiendo el registro del intento fallido.

#### Decision

Implementar `AuditAspect` con Spring AOP `@Around("@annotation(auditable)")`:

1. El aspecto intercepta cualquier metodo anotado con `@Auditable`.
2. Captura el estado antes y despues de la operacion (snapshots JSON del objeto de dominio).
3. Persiste el `AuditLog` en una **transaccion separada con `Propagation.REQUIRES_NEW`**. Esto garantiza que el registro se graba independientemente de si la transaccion del negocio hace commit o rollback.
4. La IP del cliente se extrae con validacion de proxy trust (`X-Forwarded-For` solo se acepta de IPs de proxy configuradas en la lista blanca) para prevenir spoofing.

La tabla `audit_log` es inmutable a nivel de base de datos: `REVOKE UPDATE DELETE ON audit_log FROM PUBLIC` — ningun usuario de aplicacion puede alterar ni borrar registros de auditoria.

#### Consequences

**Positivas:**
- La logica de auditoria es transversal y opt-in: agregar `@Auditable` a un metodo es suficiente para auditarlo.
- `Propagation.REQUIRES_NEW` garantiza que los intentos fallidos quedan registrados, no solo las operaciones exitosas.
- La tabla `audit_log` es append-only por restriccion de base de datos, no por convencion de codigo.

**Negativas:**
- `Propagation.REQUIRES_NEW` abre una segunda conexion a la base de datos por cada operacion auditada. En escenarios de alta concurrencia esto incrementa la presion sobre el pool de conexiones de HikariCP.
- Los snapshots JSON del estado antes/despues pueden volverse grandes para entidades con muchos campos. Se recomienda anotar solo los campos relevantes en los DTOs de snapshot.

---

### ADR-008: Cache Local Caffeine en lugar de Redis

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | Phase 3 |
| **Deciders** | Engineering team |

#### Context

El dashboard y el catalogo de productos tienen patrones de acceso de alta lectura con actualizaciones infrecuentes. Sin cache, cada request al dashboard ejecuta multiples queries SQL agregadas contra PostgreSQL. En un minimarket de instancia unica esto es manejable, pero genera carga innecesaria y latencia visible.

Dos candidatos: **Redis** (cache distribuido externo) vs **Caffeine** (cache en memoria local a la JVM).

| Criterio | Redis | Caffeine |
|----------|-------|----------|
| Complejidad operacional | Requiere servicio adicional | Zero — en la JVM |
| Consistencia multi-instancia | Si (cache compartido) | No aplica (instancia unica) |
| Latencia | ~1 ms (red local) | ~microsegundos (memoria) |
| Eviccion/TTL | Si | Si |
| Monitoreo | Requiere exporter separado | Micrometer nativo |
| Dependencia de red | Si (SPOF adicional) | No |

#### Decision

Usar **Caffeine** como proveedor de Spring Cache para la Fase 3. La arquitectura es de instancia unica (monolito en un solo Docker container) — no hay necesidad de coherencia de cache entre nodos.

Tres caches configurados en `CacheConfig.java`:

| Cache | TTL | Max entries | Uso |
|-------|-----|-------------|-----|
| `products-catalog` | 5 minutos | 5.000 | Listado y busqueda del catalogo de productos |
| `dashboard-kpis` | 15 segundos | 50 | KPIs del dia por rol (alta frecuencia de lectura) |
| `dashboard-history` | 1 hora | 20 | Historial semanal/mensual del dashboard |

La eviccion se realiza con `@CacheEvict` en las operaciones de escritura relevantes (crear/editar/eliminar producto evicta `products-catalog`; confirmar una venta evicta `dashboard-kpis`).

#### Consequences

**Positivas:**
- Zero overhead operacional: no hay servicio externo que mantener ni monitorear por separado.
- Latencia de cache en microsegundos (acceso a heap local).
- La metrica `cache.hit.ratio` esta disponible en Micrometer/Prometheus sin configuracion adicional.

**Negativas:**
- Si en Fase 4 la arquitectura evoluciona a multiples instancias (scale-out horizontal), Caffeine deberá ser reemplazado por Redis o invalidacion de cache via mensajeria. Esta decision deberá revisarse al iniciar Fase 4.
- Los caches son locales al proceso: un reinicio del backend limpia completamente el cache (cold start).

---

### ADR-009: SSE sobre WebSocket para Alertas de Stock en Tiempo Real

Este ADR consolida la decision tomada conceptualmente en ADR-004 con los detalles de implementacion de Fase 3.

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | Phase 3 |
| **Deciders** | Engineering team |

#### Context

La implementacion concreta de SSE en Fase 3 requiere decisiones adicionales mas alla de la eleccion del protocolo (ya cubierta en ADR-004): gestion del ciclo de vida de las conexiones, autenticacion (el protocolo `EventSource` del navegador no permite headers personalizados), limite de conexiones, y configuracion de proxy.

#### Decision

1. **Autenticacion via `?token=`**: el JWT se pasa como query parameter exclusivamente para `/events/stream`. `JwtAuthFilter` fue modificado para leer el token de este parametro para esa ruta. El parametro no se registra en los access logs de Nginx.

2. **`SseEmitterRegistry`**: `ConcurrentHashMap<UUID, SseEmitter>` con cap de 500 conexiones. Al alcanzar el limite, la conexion mas antigua del mismo usuario es evictada antes de registrar la nueva. Un gauge Micrometer (`sse.active.connections`) expone el conteo actual.

3. **Broadcast por rol**: `SseEmitterRegistry` tiene metodos `broadcastToAll()`, `broadcastToRole(Role)`, y `broadcastToUser(UUID)`. Los eventos se emiten solo a los roles relevantes (ej. `STOCK_LOW` no se envia a CAJERO).

4. **Nginx**: bloque `location /api/v1/events/` con `proxy_buffering off`, `proxy_read_timeout 3600s`, `proxy_http_version 1.1`, `Connection ''` — configuracion necesaria para que Nginx no almacene en buffer el stream SSE.

#### Consequences

- La autenticacion por query param expone el JWT en URLs, que pueden quedar en logs del servidor si no se configuran correctamente. Mitigado: el access log de Nginx usa un formato que omite query strings en rutas `/events/`.
- El cap de 500 conexiones limita el escalado a ese numero de usuarios concurrentes conectados al stream. Suficiente para el uso previsto de un minimarket.
- La reconexion automatica del navegador (built-in en `EventSource`) elimina la necesidad de logica de reconexion en el backend.

---

### ADR-010: Endpoint de Dashboard Polimorfico por Rol

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | Phase 3 |
| **Deciders** | Engineering team |

#### Context

El dashboard de Fase 3 debe mostrar informacion diferente segun el rol del usuario: el ADMIN ve KPIs globales y utilidades; el SUPERVISOR ve ventas por vendedor y alertas; el CAJERO ve el resumen de su propio turno; BODEGA ve alertas de stock critico.

Opciones de diseno:
1. **Cuatro endpoints separados**: `/dashboard/admin`, `/dashboard/supervisor`, `/dashboard/cashier`, `/dashboard/warehouse`.
2. **Un endpoint polimorfico**: `GET /dashboard` retorna un DTO diferente segun el rol del JWT.

#### Decision

Usar **un endpoint polimorfico** `GET /api/v1/dashboard` que delega a una implementacion de `DashboardViewStrategy` segun el rol del usuario autenticado. El `DashboardController` lee el rol del `SecurityContext`, selecciona la estrategia correspondiente, y retorna el DTO apropiado con `Content-Type: application/json`.

Cada estrategia (`AdminDashboardView`, `SupervisorDashboardView`, `CashierDashboardView`, `WarehouseDashboardView`) es una clase de servicio independiente con su propia logica de query y su propio DTO de respuesta. Los DTOs comparten el campo discriminador `"role"` para que el frontend pueda deserializar dinamicamente.

En el frontend, `DashboardPage.tsx` lee el campo `role` de la respuesta y renderiza el componente correspondiente (`AdminDashboardView` con Recharts BarChart + LineChart, etc.).

#### Consequences

**Positivas:**
- URL simple y consistente para el frontend: siempre `GET /dashboard`, independientemente del rol.
- Agregar un nuevo rol con vista de dashboard diferente no requiere un nuevo endpoint — solo una nueva estrategia.
- `@PreAuthorize` se aplica en un unico punto.

**Negativas:**
- La respuesta JSON tiene forma variable — el consumidor debe usar el campo `role` como discriminador antes de deserializar. Esto es una ruptura del principio de que un endpoint tiene una forma de respuesta fija, aunque es un patron reconocido (union type / discriminated union).
- Si en Fase 4 el dashboard evoluciona a un BFF (Backend for Frontend) dedicado, este endpoint debera ser migrado o eliminado.

---

### ADR-011: CI/CD con GitHub Actions

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | Phase 4 |
| **Deciders** | Engineering team |

#### Context

El proyecto no tiene pipeline automatizado. Los deploys son manuales: el desarrollador se conecta al servidor via SSH, hace `git pull` y ejecuta `docker compose up -d`. Este proceso no tiene gate de calidad (tests), no tiene trazabilidad de deploys, y expone secretos de produccion en archivos `.env` del servidor que deben mantenerse manualmente sincronizados.

#### Decision

Dos workflows de GitHub Actions:

**`ci.yml`** — se activa en Pull Request contra `main`:

| Paso | Descripcion |
|------|-------------|
| Lint | `./mvnw checkstyle:check` + `eslint --max-warnings 0` |
| Test | `./mvnw verify` contra un PostgreSQL 16 en servicio de GitHub Actions |
| Build | `./mvnw package -DskipTests` + `vite build` |

El merge del PR queda **bloqueado** si cualquier paso falla. No hay merge a `main` sin tests verdes.

**`cd.yml`** — se activa en `push` a `main` (merge de PR):

| Paso | Descripcion |
|------|-------------|
| Build imagen backend | `docker build --target production -t ghcr.io/org/minimarket-backend:$SHA` |
| Build imagen frontend | `docker build --target production -t ghcr.io/org/minimarket-frontend:$SHA` |
| Push | `docker push` a GitHub Container Registry (`ghcr.io`) |
| Deploy | SSH al servidor de produccion: `docker compose pull && docker compose up -d` |
| Health check | `curl --retry 5 --retry-delay 10 https://app/api/v1/actuator/health` |

Los secretos de produccion (contrasena de BD, JWT secret, clave SSH) se almacenan en **GitHub Secrets** (cifrados en reposo). El servidor de produccion tiene configurado un deploy key SSH de solo uso para este repositorio. Los archivos `.env` del repositorio contienen unicamente valores de ejemplo para desarrollo local.

El tag de imagen usa el SHA corto del commit (`${{ github.sha }}`) para trazabilidad: cada imagen puede vincularse a un commit exacto.

#### Consequences

**Positivas:**
- Ningun cambio llega a produccion sin haber pasado lint, tests de integracion contra PostgreSQL real, y build exitoso.
- Los secretos de produccion no existen en archivos del repositorio ni en el servidor fuera de variables de entorno del proceso Docker.
- Cada deploy es trazable: el tag de imagen y el log de GitHub Actions registran quien desplegó que commit y cuando.
- El rollback es reproducible: `docker compose up` con el tag anterior del SHA es suficiente para revertir.

**Negativas:**
- El pipeline de CD ejecuta SSH directo al servidor — esto es deployment simple, no zero-downtime. Si el `docker compose up -d` tarda mas de los 5 segundos de reinicio del contenedor, hay una ventana breve de downtime. Aceptable para la escala actual; mitigable en Fase 5 con un health check de readiness antes de redirigir trafico.
- GitHub Actions usa minutos de ejecucion incluidos en el plan gratuito. Si el repo es privado, el limite mensual debe monitorearse.

---

### ADR-013: Multi-sucursal con Row-Level Security en PostgreSQL

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | Phase 4 |
| **Deciders** | Engineering team |

#### Context

El sistema fue disenado para una sola sucursal. La expansion a multi-sucursal implica que todos los datos transaccionales deben estar aislados por sucursal: una venta de la sucursal A no debe ser visible ni modificable desde la sucursal B, incluso si un bug en la aplicacion omite un filtro `WHERE branch_id = ?`.

Opciones evaluadas:

| Opcion | Descripcion | Riesgo |
|--------|-------------|--------|
| Filtro solo en aplicacion | Cada query agrega `WHERE branch_id = ?` | Un bug o query faltante expone datos cross-sucursal |
| Schema separado por sucursal | Una BD por sucursal (`db_sucursal_a`, `db_sucursal_b`) | Explosiva complejidad operacional para N sucursales |
| **Row-Level Security (RLS) en PostgreSQL** | La BD rechaza filas que no pertenecen a la sucursal del contexto | Aislamiento garantizado a nivel de motor, no de aplicacion |

#### Decision

**Columna `branch_id`:** se agrega `branch_id UUID NOT NULL` a las tablas transaccionales: `products`, `sales`, `sale_items`, `stock_movements`, `cash_registers`, `purchases`, `purchase_items`, `customers`, `audit_log`.

**Tabla `branches`:**

```
branches(id UUID PK, nombre VARCHAR, direccion VARCHAR, rut VARCHAR, activa BOOLEAN, created_at TIMESTAMP)
```

**Usuario y sucursal:** la entidad `User` tiene `branch_id UUID` (nullable). Un ADMIN con `branch_id = NULL` tiene acceso global; cualquier otro rol debe tener `branch_id` asignado obligatoriamente al momento del alta.

**Activacion de RLS:**

```sql
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales FORCE ROW LEVEL SECURITY;  -- aplica incluso al table owner
```

Se replica para cada tabla transaccional listada arriba.

**Policy de aislamiento:**

```sql
CREATE POLICY branch_isolation ON sales
  USING (
    branch_id = current_setting('app.current_branch_id')::uuid
    OR current_setting('app.current_branch_id', true) = 'ALL'
  );
```

El valor `'ALL'` es el sentinel para usuarios ADMIN con acceso global. La funcion `current_setting('app.current_branch_id', true)` (segundo parametro `true` = no lanzar excepcion si no existe) evita errores en contextos donde el setting aun no fue establecido.

**`BranchContextFilter`:** Servlet filter con orden `-200` (antes del `JwtAuthFilter` de Spring Security que tiene orden `-100`). Al inicio de cada request:

1. Lee `branch_id` del claim del JWT.
2. Si el usuario es ADMIN y el claim no tiene `branch_id`, usa el sentinel `'ALL'`.
3. Ejecuta `SET LOCAL app.current_branch_id = '<uuid>'` dentro de la transaccion del request.

`SET LOCAL` garantiza que el setting es valido solo para la transaccion actual — no persiste entre requests ni conexiones del pool.

**Triggers de stock actualizados:** `fn_confirm_sale_stock` y `fn_apply_stock_movement` agregan validacion:

```sql
IF NEW.branch_id != product.branch_id THEN
  RAISE EXCEPTION 'branch_id mismatch: sale % vs product %', NEW.branch_id, product.branch_id;
END IF;
```

**Migracion:** la migracion Flyway `V17__multi_branch.sql` ejecuta en una unica transaccion:
1. Crea la tabla `branches` e inserta la "Sucursal Principal" con un UUID fijo.
2. Agrega `branch_id` a todas las tablas con `DEFAULT '<uuid-sucursal-principal>'::uuid NOT NULL`.
3. Activa RLS en cada tabla.
4. Crea todas las policies.
5. Al finalizar, elimina el `DEFAULT` de `branch_id` (para forzar que los nuevos registros siempre especifiquen la sucursal explicita).

La migracion **requiere ventana de mantenimiento**: tomar la aplicacion offline, ejecutar la migracion, verificar integridad, volver a levantar. No hay migracion en caliente para este cambio estructural.

#### Consequences

**Positivas:**
- El aislamiento de datos entre sucursales es garantizado por el motor de base de datos, no por convencion de codigo. Un query sin filtro `branch_id` en la aplicacion no expone datos de otras sucursales — PostgreSQL los filtra.
- Agregar una nueva sucursal es una operacion de datos (INSERT en `branches`), no un cambio de esquema.
- Los triggers de stock heredan el aislamiento automaticamente a traves de la policy RLS activa en la sesion.

**Negativas:**
- `SET LOCAL` requiere que cada request backend opere dentro de una transaccion activa cuando el filtro se ejecuta. El `BranchContextFilter` debe coordinarse con el manejo de transacciones de Spring para garantizar el orden correcto de ejecucion.
- Las queries de reportes del modulo `reports` que usan SQL nativo deben ser revisadas: con RLS activo, un ADMIN con sentinel `'ALL'` vera filas de todas las sucursales, lo cual puede generar resultados inesperadamente grandes si no se agrega un filtro explicito de sucursal en las queries de agregacion.
- La ventana de mantenimiento para V17 es un evento coordinado con operaciones: debe planificarse con anticipacion y comunicarse a todos los usuarios.
- Flyway ejecuta migraciones como el usuario propietario del esquema. Para que `ENABLE ROW LEVEL SECURITY` y `FORCE ROW LEVEL SECURITY` funcionen correctamente, ese usuario debe ser superusuario o propietario de la tabla. Verificar permisos del usuario Flyway antes de ejecutar V17 en produccion.

---

## Diagrams

### C4 Level 1 — System Context

This diagram shows the Minimarket Platform in relation to its users. All three user roles (Cashier, Admin, Warehouse) access the system through a standard web browser or tablet.

```
┌─────────────────────────────────────────────────────────────┐
│                    Minimarket Platform                       │
│                                                              │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────────┐  │
│  │  Cajero  │───▶│   Navegador  │───▶│  Minimarket SPA   │  │
│  └──────────┘    │  Web/Tablet  │    │  (React + Vite)   │  │
│                  └──────────────┘    └─────────┬─────────┘  │
│  ┌──────────┐                                  │ HTTPS       │
│  │  Admin   │───▶[mismo navegador]             ▼            │
│  └──────────┘                        ┌─────────────────┐    │
│                                      │   API Backend   │    │
│  ┌──────────┐                        │ (Spring Boot 3) │    │
│  │  Bodega  │───▶[mismo navegador]   └────────┬────────┘    │
│  └──────────┘                                 │             │
│                                               ▼             │
│                                      ┌─────────────────┐    │
│                                      │   PostgreSQL 16  │    │
│                                      └─────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Caption:** Three user roles share a single-page application. The SPA communicates with the Spring Boot API over HTTPS. PostgreSQL is the sole persistence layer.

---

### C4 Level 2 — Containers

This diagram shows the four Docker containers and their network boundaries. Nginx acts as the single ingress point, routing traffic to either the React SPA container or the Spring Boot backend container.

```
Browser/Tablet
     │
     ▼ :80 (HTTP)
┌──────────────────────────────────────────────────────────────┐
│ Nginx (Reverse Proxy)                                        │
│  /          → frontend:5173 (SPA React)                      │
│  /api/v1/*  → backend:8080  (Spring Boot)                    │
│  Rate limit: /api/v1/auth/* = 5 req/min                      │
└────────────────────┬─────────────────────┬───────────────────┘
                     │                     │
              frontend-net           backend-net
                     │                     │
        ┌────────────┴──┐        ┌────────┴───────────┐
        │  Frontend     │        │     Backend         │
        │  React 18     │        │  Spring Boot 3      │
        │  Vite/Nginx   │        │  Java 21            │
        │  :5173        │        │  :8080              │
        └───────────────┘        └────────┬────────────┘
                                          │ backend-net
                                          ▼
                                 ┌────────────────────┐
                                 │   PostgreSQL 16     │
                                 │   :5432             │
                                 │   Vol: pg_data      │
                                 └────────────────────┘
```

**Caption:** `frontend-net` and `backend-net` are isolated Docker networks. The frontend container has no direct route to PostgreSQL. The backend container is the only service on `backend-net` that can reach the database.

---

### Authentication Flow

This sequence diagram shows the two-token authentication lifecycle: initial login and subsequent API access using the short-lived access token.

```
Cliente          Nginx           Backend         PostgreSQL
  │                │                │                │
  │─── POST /auth/login ──────────▶│                │
  │                │                │─ SELECT user ─▶│
  │                │                │◀─ user row ────│
  │                │                │  BCrypt.verify │
  │                │                │─ INSERT        │
  │                │                │  refresh_token▶│
  │◀── 200 {accessToken,           │                │
  │         refreshToken} ─────────│                │
  │                │                │                │
  │─── GET /api/* ─────────────────▶                │
  │    Bearer: accessToken          │                │
  │                │                │  JwtAuthFilter │
  │                │                │  valida JWT    │
  │◀── 200 data ──────────────────-│                │
```

**Caption:** The access token (15 min JWT) is validated in-process by `JwtAuthFilter` — no database round-trip. The refresh token is only queried when a new access token is needed via `POST /auth/refresh`.

---

### POS Sale Flow

This sequence diagram shows the cashier workflow from barcode scan to confirmed ticket. Note that stock decrement is performed entirely by the PostgreSQL trigger — the backend only changes the sale status.

```
Cajero   Frontend   Backend    PostgreSQL (triggers)
  │         │          │              │
  │─escanea │          │              │
  │  barcode│          │              │
  │         │─GET /products/barcode/{code}──▶│
  │         │◀─ producto ───────────────────│
  │         │          │              │
  │─confirma│          │              │
  │  venta  │          │              │
  │         │─POST /sales ──────────▶│
  │         │          │─ INSERT sale (PENDING) ──▶│
  │         │          │─ UPDATE sale.status=CONFIRMED ─▶│
  │         │          │              │ fn_confirm_sale_stock()
  │         │          │              │  SELECT product FOR UPDATE
  │         │          │              │  INSERT stock_movement
  │         │          │              │  UPDATE product.stock_current
  │         │◀─ 201 {saleNumber} ────│              │
  │◀─ticket │          │              │
```

**Caption:** The `SELECT FOR UPDATE` lock inside `fn_confirm_sale_stock` serializes concurrent sales of the same product at the database row level, preventing negative stock without requiring application-level distributed locks.

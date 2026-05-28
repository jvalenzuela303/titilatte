# Modules — Minimarket Platform (Fases 1, 2, 3 y 4)

## Table of Contents

- [Module AUTH](#module-auth)
- [Module PRODUCTS](#module-products)
- [Module SALES](#module-sales)
- [Module STOCK](#module-stock)
- [Module PURCHASES](#module-purchases)
- [Module CASH](#module-cash)
- [Module CUSTOMERS](#module-customers)
- [Module REPORTS](#module-reports)
- [Module SSE (Fase 3)](#module-sse)
- [Module AUDIT (Fase 3)](#module-audit)
- [Module DASHBOARD (Fase 3)](#module-dashboard)
- [Configuracion Cache (Fase 3)](#configuracion-cache)
- [Module BRANCHES (Fase 4)](#module-branches)
- [Module CICD (Fase 4)](#module-cicd)
- [Roles and Permissions Matrix](#roles-and-permissions-matrix)

---

## Module AUTH

### Responsibility

Authentication of users, issuance and renewal of JWT tokens, and session management. This module is the security gateway for all other modules — every protected endpoint depends on the token pipeline defined here.

### Entities

| Entity | Description |
|--------|-------------|
| `User` | System user with credentials, role assignments, and active status |
| `Role` | Named role (ADMIN, CAJERO, BODEGA, SUPERVISOR) with a set of permissions |
| `Permission` | Granular permission string used by Spring Security method-level authorization |
| `RefreshToken` | Persisted SHA-256 hash of an issued refresh token, with expiry and revocation state |

### Business Rules

1. Passwords are stored as **BCrypt hash at cost-12**. Plaintext passwords are never persisted or logged.
2. The **access token** (JWT) expires in **15 minutes**. Configurable via environment variable `JWT_EXPIRATION`.
3. The **refresh token** (UUID v4) expires in **7 days**. Configurable via `JWT_REFRESH_EXPIRATION`.
4. Refresh tokens are stored as `SHA-256(token)` — the raw token value is never written to the database.
5. A revoked refresh token (`revoked = true` or past its `expires_at`) cannot be used to obtain a new access token. Attempting to do so returns `401 Unauthorized`.
6. Brute-force login rate limiting is **not implemented in Phase 1** — deferred to Phase 2 alongside account lockout.

### Endpoints

| Method | Path | Role Required | Description |
|--------|------|---------------|-------------|
| `POST` | `/auth/login` | Public | Authenticate with username and password; returns access token and refresh token |
| `POST` | `/auth/refresh` | Public (valid refresh token) | Exchange a valid refresh token for a new access token |
| `POST` | `/auth/logout` | Authenticated | Revoke the current refresh token, invalidating the session |

### Database Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts with BCrypt-hashed password, active flag, and timestamps |
| `roles` | Role definitions |
| `permissions` | Permission strings assigned to roles |
| `user_roles` | Join table between users and roles |
| `refresh_tokens` | Hashed refresh tokens with `expires_at` and `revoked` columns |

### Security Notes

- Token signing: HS256 (Phase 1) — configurable for RS256 via `JWT_SECRET` / key-pair configuration.
- `JwtAuthFilter` validates access tokens in-process (no database round-trip per request).
- Expired `refresh_tokens` rows should be purged periodically via a scheduled job to prevent unbounded table growth.

---

## Module PRODUCTS

### Responsibility

Master product catalog management, including categories, product families, taxes, and units of measure. This module is the source of truth for all product data consumed by Sales and Stock modules.

### Entities

| Entity | Description |
|--------|-------------|
| `Product` | Core product record: barcode, name, prices, stock levels, tax, unit, category |
| `ProductCategory` | Two-level classification (category → family) for reporting and filtering |
| `ProductFamily` | Sub-grouping within a category |
| `Tax` | Tax rate (e.g., IGV 18%) associated with a product |
| `Unit` | Unit of measure (unit, kg, litre, box, etc.) |

### Business Rules

1. Only users with role **ADMIN** may create, edit, or delete products.
2. The **barcode is unique** across the entire product catalog. Duplicate barcode insertion returns `409 Conflict`.
3. The **sale price must be >= purchase price** at all times. Violating this constraint returns `400 Bad Request`.
4. Deletion is **logical (soft delete)** via the `deleted_at` timestamp column. Deleted products are excluded from catalog queries but their data is preserved for historical sale records.
5. Every price change is recorded in `price_audit_log` with the old price, new price, changed-by user, and timestamp.
6. A product with an associated sale history **cannot be physically deleted**, even by ADMIN. Soft delete must be used.
7. `stock_minimum` must always be strictly less than `stock_maximum`. Violated values return `400 Bad Request`.

### Endpoints

| Method | Path | Role Required | Description |
|--------|------|---------------|-------------|
| `GET` | `/products` | All authenticated | List products with pagination, filters, and search |
| `GET` | `/products/{id}` | All authenticated | Retrieve a single product by UUID |
| `GET` | `/products/barcode/{code}` | All authenticated | Look up product by barcode (used by POS scanner) |
| `POST` | `/products` | ADMIN | Create a new product |
| `PUT` | `/products/{id}` | ADMIN | Full update of a product |
| `PATCH` | `/products/{id}` | ADMIN | Partial update (e.g., price change) |
| `DELETE` | `/products/{id}` | ADMIN | Soft-delete a product |

### Database Tables

| Table | Purpose |
|-------|---------|
| `products` | Master product records with prices, stock levels, and foreign keys to tax/unit/category |
| `product_categories` | Product category definitions |
| `product_families` | Product family definitions, each belonging to a category |
| `taxes` | Tax rate records (name, rate percentage) |
| `units` | Unit of measure definitions |
| `price_audit_log` | Immutable log of every price change with before/after values and actor |

### Performance Considerations

- **GIN trigram index** on `products.name` (`pg_trgm` extension) enables efficient `ILIKE '%search%'` queries without full table scans.
- **B-tree index** on `products.barcode` for O(log n) lookup — critical for POS scanner response time.
- Queries on the catalog always filter `deleted_at IS NULL` — this predicate is included in the indexes.

---

## Module SALES

### Responsibility

Registration of sales at the point of sale (POS), sale history, and cancellations. This module coordinates with the Stock module through the database trigger layer — it does not call Stock service methods directly.

### Entities

| Entity | Description |
|--------|-------------|
| `Sale` | Sale header: number, status, total, payment type, cashier, customer, timestamps |
| `SaleDetail` | Line items: product snapshot (price at time of sale), quantity, subtotal |
| `Payment` | Payment record(s) for a sale: method, amount, change |

### Business Rules

1. A sale follows a strict state machine: `PENDING` → `CONFIRMED` or `CANCELLED`. Transitions outside this graph are rejected.
2. **Stock is decremented only on confirmation** (`status = CONFIRMED`), not on sale creation. Stock is **restored automatically on cancellation** (`status = CANCELLED`) — both transitions are handled by the database trigger `fn_confirm_sale_stock`.
3. Only users with roles **ADMIN** or **SUPERVISOR** may cancel a sale.
4. A sale in `CANCELLED` state **cannot be cancelled again**. Attempting this returns `409 Conflict`.
5. `SaleDetail` stores a **price snapshot** at the moment of the sale. Subsequent product price changes do not affect historical sale records.
6. The **sale number is a sequential integer** (e.g., `000001`, `000002`) used for receipts and human reference. The internal primary key is a UUID.
7. **Change (vuelto)** is calculated and stored only for `EFECTIVO` payment method. For card or transfer, change is always zero.

### Sale Types

| Type | Description |
|------|-------------|
| `CONTADO` | Full payment at time of sale |
| `CREDITO` | Charged to customer account (customer record required) |
| `MIXTO` | Combination of payment methods (e.g., partial cash + card) |

### Payment Methods

| Method | Description |
|--------|-------------|
| `EFECTIVO` | Cash — change calculation applies |
| `TARJETA` | Debit or credit card |
| `TRANSFERENCIA` | Bank transfer |

### Endpoints

| Method | Path | Role Required | Description |
|--------|------|---------------|-------------|
| `POST` | `/sales` | CAJERO, ADMIN, SUPERVISOR | Create and confirm a new sale |
| `GET` | `/sales` | CAJERO, ADMIN, SUPERVISOR | List sales with date/status filters and pagination |
| `GET` | `/sales/{id}` | CAJERO, ADMIN, SUPERVISOR | Retrieve full sale detail including line items and payments |
| `POST` | `/sales/{id}/cancel` | ADMIN, SUPERVISOR | Cancel a confirmed sale and trigger stock restoration |

### Database Tables

| Table | Purpose |
|-------|---------|
| `sales` | Sale headers with status, totals, and FK to cashier user and optional customer |
| `sale_details` | Line items with price snapshot, quantity, and discount |
| `payments` | Payment records linked to a sale (supports multiple payments per sale for MIXTO) |
| `customers` | Customer reference for credit sales (managed by module, referenced here) |

### Concurrency

The `SELECT ... FOR UPDATE` lock inside `fn_confirm_sale_stock` serializes concurrent sales of the same product at the database row level. Two simultaneous sale confirmations for the same product are processed sequentially by PostgreSQL — the second transaction blocks until the first releases the row lock. This guarantees stock integrity without application-level locks or retry logic.

---

## Module STOCK

### Responsibility

Inventory control, stock movement ledger, and manual adjustments. This module maintains the complete audit trail of every inventory change and provides low-stock alerts for replenishment.

### Entities

| Entity | Description |
|--------|-------------|
| `StockMovement` | Immutable ledger record of every inventory change: type, quantity, before/after balances, reference, actor |

### Movement Types

| Type | Effect on Stock | Triggered By |
|------|-----------------|--------------|
| `VENTA` | Decrement | Sale confirmation (via database trigger) |
| `COMPRA` | Increment | Purchase order receipt (Phase 2) |
| `DEVOLUCION` | Increment | Sale cancellation or return |
| `MERMA` | Decrement | Waste or spoilage (manual, authorized) |
| `AJUSTE` | Increment or Decrement | Manual correction by authorized user |

### Business Rules

1. **Stock can never go negative.** The PL/pgSQL trigger enforces this with a hard constraint — an attempt to decrement below zero raises an exception and rolls back the transaction.
2. Manual adjustments (`MERMA`, `AJUSTE`) require an **authorized user with role SUPERVISOR or ADMIN**. The `authorized_by` field is mandatory for these movement types.
3. The `stock_movements` table is an **immutable ledger** — rows are never updated or deleted. Corrections are made by inserting a compensating entry, not by modifying existing records.
4. Every movement record stores both `quantity_before` and `quantity_after` for complete auditability.
5. The ledger balance constraint `chk_stock_movements_ledger_balance` enforces: `quantity_before + quantity = quantity_after` at the database level.
6. **Low-stock alert threshold:** a product is considered low-stock when `stock_current <= stock_minimum`.

### Endpoints

| Method | Path | Role Required | Description |
|--------|------|---------------|-------------|
| `GET` | `/stock` | ADMIN, BODEGA, SUPERVISOR | List current stock levels for all products |
| `GET` | `/stock/low` | ADMIN, BODEGA, SUPERVISOR | List products at or below minimum stock threshold |
| `POST` | `/stock/adjustment` | ADMIN, SUPERVISOR | Create a manual stock adjustment (MERMA or AJUSTE) |
| `GET` | `/stock/movements` | ADMIN, BODEGA, SUPERVISOR | Paginated movement history with filters by product and date range |

### Database Tables

| Table | Purpose |
|-------|---------|
| `stock_movements` | Immutable ledger of all stock changes with full before/after state |

> Note: `stock_movements` is planned for **range partitioning by date** in Phase 3 to maintain query performance as the table grows over years of operation.

### Database View

| View | Purpose |
|------|---------|
| `v_products_low_stock` | Joins `products` with their current stock against minimum threshold; used by the replenishment alert endpoint and dashboard widget |

---

## Module PURCHASES

### Responsibility

Gestion de ordenes de compra a proveedores, incluyendo el ciclo completo desde la creacion del borrador hasta la confirmacion. Al confirmar una orden, el modulo actualiza el stock de cada producto y recalcula su costo promedio ponderado (CPP) de forma atomica.

### Entities

| Entity | Description |
|--------|-------------|
| `Purchase` | Cabecera de la orden de compra: numero secuencial, proveedor, tipo de documento, fecha, estado, total |
| `PurchaseDetail` | Linea de la orden: producto, cantidad, costo unitario, subtotal |
| `Supplier` | Proveedor con datos de contacto y RUT |

### Business Rules

1. Una orden de compra sigue la maquina de estados: `DRAFT` → `CONFIRMED` o `CANCELLED`. Solo las transiciones explicitas son validas.
2. El **stock solo se incrementa al confirmar** (`status = CONFIRMED`). Una orden en `DRAFT` no tiene efecto sobre el inventario.
3. **Una orden confirmada no puede cancelarse.** Solo las ordenes en estado `DRAFT` pueden ser canceladas.
4. Al confirmar, el **costo promedio ponderado (CPP)** de cada producto se recalcula con la formula: `CPP_nuevo = (stock_actual * CPP_anterior + cantidad_comprada * costo_unitario) / (stock_actual + cantidad_comprada)`.
5. El campo `documentNumber` es **obligatorio** cuando `documentType` es `FACTURA` o `BOLETA`. Para `SIN_DOCUMENTO` puede omitirse.
6. El **RUT del proveedor es unico** en el sistema. Intentar crear dos proveedores con el mismo RUT retorna `409 Conflict`.
7. Los roles **ADMIN** y **BODEGA** pueden crear y confirmar ordenes. Solo **ADMIN** puede cancelarlas.
8. El numero de orden (`purchaseNumber`) es un entero secuencial, independiente del UUID interno.

### Endpoints

| Method | Path | Role Required | Description |
|--------|------|---------------|-------------|
| `POST` | `/purchases` | ADMIN, BODEGA | Crear una nueva orden de compra en estado DRAFT |
| `POST` | `/purchases/{id}/confirm` | ADMIN, BODEGA | Confirmar la orden: incrementa stock y recalcula CPP |
| `POST` | `/purchases/{id}/cancel` | ADMIN | Cancelar una orden en estado DRAFT |
| `GET` | `/purchases` | ADMIN, BODEGA, SUPERVISOR | Listar ordenes con filtros por proveedor, estado y fecha |
| `GET` | `/purchases/{id}` | ADMIN, BODEGA, SUPERVISOR | Obtener una orden completa con todos sus items |
| `POST` | `/suppliers` | ADMIN, BODEGA | Crear un nuevo proveedor |
| `GET` | `/suppliers` | ADMIN, BODEGA, SUPERVISOR | Listar proveedores activos |
| `PUT` | `/suppliers/{id}` | ADMIN, BODEGA | Actualizar datos de un proveedor |

### Database Tables

| Table | Purpose |
|-------|---------|
| `purchases` | Cabeceras de ordenes de compra con estado, total y FK al proveedor |
| `purchase_details` | Lineas de la orden con snapshot de costo unitario al momento de la compra |
| `suppliers` | Proveedores con RUT, contacto y estado activo/inactivo |

### Nota sobre Costo Promedio Ponderado

El CPP actualizado se persiste en `products.purchase_price` al confirmar la compra. Este valor es el que utiliza el modulo `reports` para calcular las utilidades brutas. El historial de cambios de CPP queda registrado en `price_audit_log` via el trigger existente de auditoria de precios.

---

## Module CASH

### Responsibility

Gestion de turnos de caja (apertura, cierre, arqueo) y registro de movimientos manuales de efectivo (ingresos y egresos no vinculados a ventas). Provee el balance esperado al cierre para facilitar el arqueo.

### Entities

| Entity | Description |
|--------|-------------|
| `CashRegister` | Turno de caja: cajero, saldo de apertura, saldo de cierre, saldo esperado, diferencia, timestamps |
| `CashMovement` | Movimiento manual de ingreso o egreso dentro de un turno abierto |

### Business Rules

1. **Un cajero solo puede tener una caja abierta a la vez.** Intentar abrir una segunda caja retorna `409 Conflict`. Esta regla se aplica a nivel de constraint unico en la base de datos (`uq_cash_register_open_per_user`).
2. El **saldo de apertura** (`openingBalance`) debe ser >= 0. Representa el efectivo inicial declarado por el cajero al comenzar el turno.
3. Solo el cajero dueno del turno o un usuario con rol **ADMIN** puede cerrar una caja.
4. Al cerrar, se calcula automaticamente el **saldo esperado**: `saldo_apertura + suma_ventas_efectivo + total_ingresos_manuales - total_egresos_manuales`.
5. La **diferencia de cierre** = `saldo_declarado_cierre - saldo_esperado`. Un valor negativo indica faltante; positivo indica sobrante. Ambos casos se registran sin bloquear el cierre.
6. Los **movimientos manuales** (`CashMovement`) requieren una descripcion obligatoria para auditoria. Un monto <= 0 es rechazado.
7. Solo se pueden registrar movimientos en una caja en estado `OPEN`. Intentar agregar un movimiento a una caja cerrada retorna `400 Bad Request`.

### Endpoints

| Method | Path | Role Required | Description |
|--------|------|---------------|-------------|
| `POST` | `/cash/open` | ADMIN, CAJERO | Abrir un nuevo turno de caja con saldo inicial |
| `PATCH` | `/cash/{id}/close` | ADMIN, CAJERO | Cerrar el turno declarando el saldo contado |
| `GET` | `/cash/current` | Autenticado | Obtener el turno activo del usuario autenticado |
| `GET` | `/cash/{id}/summary` | ADMIN, CAJERO, SUPERVISOR | Resumen del turno: ventas por metodo de pago y movimientos |
| `POST` | `/cash/{id}/movements` | ADMIN, CAJERO | Registrar ingreso o egreso manual |
| `GET` | `/cash/{id}/movements` | ADMIN, CAJERO, SUPERVISOR | Listar movimientos manuales del turno |

### Database Tables

| Table | Purpose |
|-------|---------|
| `cash_registers` | Turnos de caja con saldos de apertura, cierre y esperado |
| `cash_movements` | Movimientos manuales de ingreso/egreso dentro de un turno |

### Constraint de unicidad de caja abierta

```sql
-- Garantiza que un usuario no pueda tener dos turnos abiertos simultaneamente
CREATE UNIQUE INDEX uq_cash_register_open_per_user
  ON cash_registers (opened_by_user_id)
  WHERE status = 'OPEN';
```

### Formula de saldo esperado al cierre

```
saldo_esperado =
  opening_balance
  + SUM(payments.amount WHERE method = 'EFECTIVO' AND sale.cash_register_id = turno)
  + SUM(cash_movements.amount WHERE type = 'INGRESO')
  - SUM(cash_movements.amount WHERE type = 'EGRESO')
```

---

## Module CUSTOMERS

### Responsibility

Gestion completa del ciclo de vida de clientes: alta, actualizacion de datos personales, administracion del limite de credito, y registro de pagos contra la deuda activa. Este modulo es referenciado por el modulo SALES para ventas a credito.

### Entities

| Entity | Description |
|--------|-------------|
| `Customer` | Cliente con datos personales, limite de credito, deuda actual y campo `version` para optimistic locking |
| `CustomerPayment` | Registro de pago parcial o total: monto, metodo, deuda antes/despues, usuario que registra |

### Business Rules

1. El **limite de credito inicial es siempre $0** al crear un cliente. No se puede asignar un limite en la operacion de creacion — debe hacerse explicitamente via `PUT /customers/{id}/credit-limit` por ADMIN o SUPERVISOR.
2. El **limite de credito no puede ser menor que la deuda actual** del cliente. Intentar reducirlo por debajo de `currentDebt` retorna `400 Bad Request`.
3. La **deuda actual** (`currentDebt`) es gestionada automaticamente por el sistema: incrementa al registrar una venta a credito, y decrementa al registrar un pago.
4. El **credito disponible** = `creditLimit - currentDebt`. Una venta a credito que dejaria la deuda por encima del limite es rechazada con `422 Unprocessable Entity`.
5. El campo `@Version` en la entidad `Customer` habilita **optimistic locking** en JPA. Toda actualizacion de `creditLimit` debe incluir el valor actual de `version` para detectar modificaciones concurrentes. Un conflicto retorna `409 Conflict`.
6. El servicio de pagos usa `@Retryable` (Spring Retry) para reintentar automaticamente hasta 3 veces ante una `OptimisticLockException`. Esto evita que errores transitorios de concurrencia lleguen al cliente.
7. Un pago **no puede superar la deuda actual** del cliente. El monto maximo de un pago es `currentDebt`.
8. El **RUT del cliente es unico** en el sistema si se provee. Puede omitirse para clientes sin RUT registrado.

### Endpoints

| Method | Path | Role Required | Description |
|--------|------|---------------|-------------|
| `POST` | `/customers` | Autenticado | Crear un nuevo cliente (creditLimit = $0 siempre) |
| `GET` | `/customers` | Autenticado | Listar clientes con busqueda por nombre o RUT |
| `GET` | `/customers/{id}` | Autenticado | Obtener cliente con estado de credito actual |
| `PUT` | `/customers/{id}` | ADMIN, SUPERVISOR | Actualizar datos personales del cliente |
| `PUT` | `/customers/{id}/credit-limit` | ADMIN, SUPERVISOR | Modificar limite de credito (requiere `version`) |
| `POST` | `/customers/{id}/payments` | ADMIN, CAJERO, SUPERVISOR | Registrar pago parcial o total de deuda |
| `GET` | `/customers/{id}/payments` | Autenticado | Historial de pagos del cliente |
| `GET` | `/customers/debtors` | ADMIN, SUPERVISOR | Reporte de clientes con deuda activa |

### Database Tables

| Table | Purpose |
|-------|---------|
| `customers` | Clientes con datos personales, limite de credito, deuda actual y columna `version` para optimistic locking |
| `customer_payments` | Historial de pagos con snapshot de deuda antes y despues de cada pago |

### Notas de Concurrencia

El campo `version` en la tabla `customers` es incrementado por JPA automaticamente en cada `UPDATE`. Si dos usuarios intentan modificar el limite de credito del mismo cliente al mismo tiempo, el segundo en confirmar recibira un `409 Conflict` porque el valor de `version` en su request ya no coincide con el de la base de datos. El flujo correcto es: releer el cliente (para obtener la `version` actualizada) y reintentar la modificacion.

El `@Retryable` en pagos resuelve el mismo problema de forma transparente para el llamante: el servicio reintenta la transaccion hasta 3 veces con backoff exponencial antes de propagar el error.

---

## Module REPORTS

### Responsibility

Generacion de reportes operativos y financieros para ADMIN y SUPERVISOR. El modulo no tiene entidades propias ni repositorios Spring Data — accede a las tablas de otros modulos exclusivamente a traves de SQL nativo de solo lectura via `EntityManager` (ver ADR-005: CQRS ligero).

### Sin Entidades Propias

Este modulo no define entidades JPA. Opera exclusivamente como una capa de lectura sobre las tablas de `sales`, `sale_details`, `products`, `customers`, `customer_payments`, `purchases`, `stock_movements` y `suppliers`.

### Tipos de Reportes Disponibles

| Reporte | Endpoint | Descripcion |
|---------|----------|-------------|
| Ventas por periodo | `GET /reports/sales` | Totales, descuentos, impuestos y desglose diario |
| Ventas por vendedor | `GET /reports/sales/by-seller` | Comparativo de performance por cajero/vendedor |
| Ventas por categoria | `GET /reports/sales/by-category` | Distribucion de ventas por categoria de producto |
| Top productos | `GET /reports/top-products` | Ranking por cantidad vendida o por monto |
| Utilidades brutas | `GET /reports/profit` | Margen bruto por periodo y por categoria |
| Deudores | `GET /reports/debtors` | Clientes con deuda activa ordenados por monto |
| Stock critico | `GET /reports/stock-critical` | Productos en nivel de reposicion urgente |
| Exportacion Excel | `GET /reports/export/excel` | Descarga de reportes en formato `.xlsx` |

### Parametros Comunes

| Parametro | Aplica a | Descripcion |
|-----------|----------|-------------|
| `startDate` | Reportes de periodo | Fecha inicio en formato `YYYY-MM-DD` |
| `endDate` | Reportes de periodo | Fecha fin en formato `YYYY-MM-DD` |
| `limit` | `top-products` | Maximo de items a retornar. Default: 10, maximo: 100 |
| `reportType` | `export/excel` | Tipo de reporte a exportar: `sales` o `debtors` |

### Limites y Restricciones

- **Ventana maxima de consulta:** 366 dias para todos los reportes con parametros `startDate`/`endDate`. Consultas de mayor rango retornan `400 Bad Request`.
- **Limite de top-N:** el parametro `limit` en `top-products` acepta valores entre 1 y 100. Valores fuera de rango retornan `400 Bad Request`.
- **Tipos de exportacion en Fase 2:** solo `sales` y `debtors`. PDF no implementado (evaluado para Fase 3).
- Todos los metodos del servicio estan anotados con `@Transactional(readOnly = true)`.

### Endpoints

| Method | Path | Role Required | Description |
|--------|------|---------------|-------------|
| `GET` | `/reports/sales` | ADMIN, SUPERVISOR | Ventas totales por periodo con desglose diario |
| `GET` | `/reports/sales/by-seller` | ADMIN, SUPERVISOR | Ventas agrupadas por vendedor |
| `GET` | `/reports/sales/by-category` | ADMIN, SUPERVISOR | Ventas agrupadas por categoria de producto |
| `GET` | `/reports/top-products` | ADMIN, SUPERVISOR | Top N productos por cantidad o monto vendido |
| `GET` | `/reports/profit` | ADMIN, SUPERVISOR | Utilidades brutas por periodo y categoria |
| `GET` | `/reports/debtors` | ADMIN, SUPERVISOR | Clientes con deuda activa |
| `GET` | `/reports/stock-critical` | ADMIN, SUPERVISOR, BODEGA | Productos con stock <= stock minimo |
| `GET` | `/reports/export/excel` | ADMIN, SUPERVISOR | Exportacion a archivo `.xlsx` via Apache POI |

### Consideraciones de Performance

- Los queries de reportes usan indices especificos creados para este patron de acceso (indices parciales por fecha en `sales`, indices cubrientes en `sale_details`).
- Para reportes de periodos largos se recomienda ejecutarlos en horarios de baja carga operacional.
- El modulo no tiene cache en Fase 2. Si el tiempo de respuesta se convierte en un problema, se evaluara implementar cache de reportes con TTL corto en Fase 3.

---

## Module BRANCHES

### Responsabilidad

Gestion del catalogo de sucursales fisicas de la empresa. Este modulo es el punto de entrada para la configuracion del modelo multi-sucursal: cada sucursal creada aqui sera la unidad de aislamiento de datos gestionada por RLS en PostgreSQL (ver ADR-013).

### Entidades

| Entidad | Descripcion |
|---------|-------------|
| `Branch` | Sucursal con nombre, direccion, telefono, RUT y estado activo/inactivo |

### Reglas de negocio

1. Solo el rol **ADMIN** puede crear, actualizar o desactivar sucursales.
2. La desactivacion es **logica**: marca `active = false`, no elimina el registro ni los datos historicos de la sucursal.
3. El nombre de la sucursal debe ser **unico entre sucursales activas**.
4. La **Sucursal Principal** (UUID `00000000-0000-0000-0000-000000000001`) es creada por la migracion V16 y no puede eliminarse: es la sucursal destino de todos los datos historicos migrados.
5. Un usuario ADMIN con `branch_id = null` tiene acceso global a todas las sucursales (sentinel `'ALL'` en el claim JWT). Cualquier otro rol debe tener una sucursal asignada obligatoriamente.

### Endpoints

| Metodo | Path | Rol requerido | Descripcion |
|--------|------|---------------|-------------|
| `GET` | `/api/v1/branches` | ADMIN, SUPERVISOR | Listar todas las sucursales |
| `POST` | `/api/v1/branches` | ADMIN | Crear una nueva sucursal |
| `PUT` | `/api/v1/branches/{id}` | ADMIN | Actualizar datos de una sucursal |
| `DELETE` | `/api/v1/branches/{id}` | ADMIN | Desactivar una sucursal (soft delete) |

### Integracion con RLS

El modulo BRANCHES define el contorno de aislamiento que PostgreSQL aplica via Row-Level Security. El `BranchContextFilter` (orden -200, paquete `com.minimarket.security.branch`) lee el claim `branch_id` del JWT y ejecuta `SET LOCAL app.current_branch_id = '<uuid>'` al inicio de cada request. La funcion PostgreSQL `current_branch_id()` (SECURITY DEFINER) lee ese valor y es referenciada por las policies de las 9 tablas transaccionales protegidas.

### Tablas de base de datos

| Tabla | Proposito |
|-------|-----------|
| `branches` | Catalogo de sucursales (V16) |

### Hallazgo de seguridad pendiente

**F4-06 MEDIO:** `BranchController` expone la lista completa de sucursales al rol SUPERVISOR, incluyendo sucursales de otras regiones. Se debe evaluar si el SUPERVISOR debe ver solo su propia sucursal o si la vista global es intencional para uso en reportes. Pendiente de decision del arquitecto.

---

## Module CICD

### Responsabilidad

Pipeline de integracion y entrega continua implementado con GitHub Actions. Garantiza que ningun cambio llegue a produccion sin haber pasado lint, tests de integracion contra PostgreSQL real, y un build exitoso. Las imagenes Docker se publican en GitHub Container Registry y el despliegue se realiza via SSH.

### Workflows disponibles

| Archivo | Trigger | Proposito |
|---------|---------|-----------|
| `.github/workflows/ci.yml` | Pull Request a `main` | Lint + test + build. Bloquea el merge si falla cualquier paso |
| `.github/workflows/cd.yml` | Push a `main` (merge de PR) | Build de imagenes, push a `ghcr.io`, deploy SSH al servidor de produccion |
| `.github/workflows/security-scan.yml` | Cron lunes 6:00 AM UTC | OWASP dependency-check + Trivy (versiones pineadas, fix F4-07/F4-10) |

### Pasos del workflow CI (ci.yml)

| Paso | Herramienta | Descripcion |
|------|-------------|-------------|
| Lint backend | `./mvnw checkstyle:check` | Verifica estilo de codigo Java |
| Lint frontend | `eslint --max-warnings 0` | Verifica calidad del codigo TypeScript/React |
| Tests backend | `./mvnw verify` + PostgreSQL 16 service | Tests de integracion contra BD real (sin mocks de BD) |
| Build backend | `./mvnw package -DskipTests` | Genera el JAR de produccion |
| Build frontend | `vite build` | Genera el bundle estatico |

### Pasos del workflow CD (cd.yml)

| Paso | Descripcion |
|------|-------------|
| Build imagen backend | `docker build --target production -t ghcr.io/org/minimarket-backend:$SHA` |
| Build imagen frontend | `docker build --target production -t ghcr.io/org/minimarket-frontend:$SHA` |
| Push a ghcr.io | Push de ambas imagenes al GitHub Container Registry |
| Deploy SSH | `docker compose pull && docker compose up -d` en el servidor de produccion |
| Health check | `curl --retry 5 --retry-delay 10 <host>/api/v1/actuator/health` |

### Secretos de GitHub Actions requeridos

Los siguientes secretos deben estar configurados en **Settings → Secrets and variables → Actions** del repositorio:

| Secreto | Descripcion | Como obtenerlo |
|---------|-------------|----------------|
| `SSH_PRIVATE_KEY` | Clave privada SSH para el servidor de produccion | Generar con `ssh-keygen -t ed25519`; la clave publica va en `~/.ssh/authorized_keys` del servidor |
| `SSH_HOST` | Hostname o IP del servidor de produccion | Valor del servidor de produccion |
| `SSH_USER` | Usuario SSH para el deploy | Usuario del servidor con permisos Docker |
| `GHCR_PULL_TOKEN` | PAT de GitHub con scope `read:packages` (fix F4-03) | GitHub → Settings → Developer settings → Personal access tokens |
| `ENV_FILE` | Contenido completo del `.env` de produccion (bloque `env:`, no interpolado, fix F4-04) | Construir manualmente con los valores de produccion |

### Checklist pre-produccion Fase 4

- [ ] Ejecutar el pipeline CI/CD completo en el ambiente de **staging** antes del primer merge a `main` con codigo de Fase 4.
- [ ] Planificar **ventana de mantenimiento** para la aplicacion de la migracion V16 (agrega `branch_id` a todas las tablas transaccionales y activa RLS). Esta migracion no puede aplicarse en caliente: requiere bajar la aplicacion, migrar, y volver a levantar.
- [ ] Verificar que RLS esta activo en las 9 tablas transaccionales despues de V17:
  ```sql
  SELECT tablename, rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public' AND rowsecurity = true;
  -- Debe retornar: products, sales, sale_details, stock_movements,
  --               cash_registers, purchases, purchase_details, customers, audit_log
  ```
- [ ] Verificar que todos los secretos de GitHub Actions listados arriba estan configurados y son correctos antes del primer deploy automatico.
- [ ] Confirmar que `GHCR_PULL_TOKEN` tiene scope `read:packages` (no `write:packages` ni scope excesivo).

---

## Roles and Permissions Matrix

The following matrix defines what each role can do in each module. Permissions are enforced at the Spring Security method level (`@PreAuthorize`) using the `Permission` entity values loaded at authentication time.

| Module | Action | ADMIN | CAJERO | BODEGA | SUPERVISOR |
|--------|--------|:-----:|:------:|:------:|:----------:|
| **Auth** | Login | Yes | Yes | Yes | Yes |
| **Users** | Manage users (CRUD) | Yes | — | — | — |
| **Products** | View catalog | Yes | Yes | Yes | Yes |
| **Products** | Create / Edit / Delete | Yes | — | — | — |
| **Sales** | Register sale | Yes | Yes | — | Yes |
| **Sales** | View sale history | Yes | Yes | — | Yes |
| **Sales** | Cancel sale | Yes | — | — | Yes |
| **Stock** | View inventory | Yes | — | Yes | Yes |
| **Stock** | Manual adjustment | Yes | — | — | Yes |
| **Stock** | View movements | Yes | — | Yes | Yes |
| **Purchases** | Create / confirm purchase | Yes | — | Yes | — |
| **Purchases** | Cancel purchase | Yes | — | — | — |
| **Purchases** | View purchases | Yes | — | Yes | Yes |
| **Purchases** | Manage suppliers | Yes | — | Yes | — |
| **Purchases** | View suppliers | Yes | — | Yes | Yes |
| **Cash** | Open / close shift | Yes | Yes | — | — |
| **Cash** | View current shift | Yes | Yes | Yes | Yes |
| **Cash** | View shift summary | Yes | Yes | — | Yes |
| **Cash** | Register manual movement | Yes | Yes | — | — |
| **Cash** | View manual movements | Yes | Yes | — | Yes |
| **Customers** | Create customer | Yes | Yes | Yes | Yes |
| **Customers** | View customers | Yes | Yes | Yes | Yes |
| **Customers** | Edit customer data | Yes | — | — | Yes |
| **Customers** | Modify credit limit | Yes | — | — | Yes |
| **Customers** | Register payment | Yes | Yes | — | Yes |
| **Customers** | View debtors report | Yes | — | — | Yes |
| **Reports** | Sales / profit reports | Yes | — | — | Yes |
| **Reports** | Top products / debtors | Yes | — | — | Yes |
| **Reports** | Stock critical report | Yes | — | Yes | Yes |
| **Reports** | Export to Excel | Yes | — | — | Yes |
| **Branches** | Ver sucursales | Yes | — | — | Yes |
| **Branches** | Gestionar sucursales (crear/editar/desactivar) | Yes | — | — | — |

### Role Descriptions

| Role | Primary User | Summary |
|------|-------------|---------|
| **ADMIN** | System administrator | Full access to all modules including user management, product catalog, purchases cancellation, and credit limit administration |
| **CAJERO** | Point-of-sale cashier | Can scan products, register sales, open/close their own cash register, and register customer payments |
| **BODEGA** | Warehouse staff | Can view and manage product catalog, create and confirm purchase orders, and monitor stock levels |
| **SUPERVISOR** | Floor supervisor / manager | Operational oversight: can sell, cancel sales, adjust stock, modify credit limits, view all operational data, and access all reports |

---

## Module SSE

### Responsabilidad

Entrega de notificaciones en tiempo real al frontend mediante **Server-Sent Events (SSE)**. Reemplaza el polling periódico para alertas de stock crítico, apertura/cierre de caja y confirmación de ventas. Seleccionado sobre WebSocket por su simplicidad HTTP/1.1 y compatibilidad con proxies (ADR-009).

### Clases principales

| Clase | Descripcion |
|-------|-------------|
| `SseEmitterRegistry` | Registro central de conexiones activas. `ConcurrentHashMap<UUID, SseEmitter>`, límite 500 conexiones, evicta la conexión anterior cuando el mismo usuario reconecta. Expone gauge Micrometer `sse_active_connections`. |
| `SseController` | `GET /api/v1/events/stream`. Lee el JWT desde el query param `?token=` (necesario porque `EventSource` del navegador no soporta headers personalizados). |
| `SseEvent` | Record inmutable: `type`, `entityId`, `payload` (Map<String,Object>). |

### Tipos de eventos emitidos

| Evento | Emisor | Roles destinatarios |
|--------|--------|---------------------|
| `STOCK_CRITICO` | `StockService` al confirmar venta | ADMIN, SUPERVISOR, BODEGA |
| `VENTA_CONFIRMADA` | `SaleService` | ADMIN, SUPERVISOR |
| `CAJA_ABIERTA` / `CAJA_CERRADA` | `CashRegisterService` | ADMIN, SUPERVISOR |

### Autenticacion SSE

`JwtAuthFilter` fue extendido (fix F3-C01) para leer el JWT desde `request.getParameter("token")` **exclusivamente** cuando `servletPath` es `/events/stream`. En cualquier otro endpoint el header `Authorization: Bearer` es el único mecanismo válido.

### Limites y reconexion

- El registry rechaza nuevas conexiones cuando hay 500 activas (devuelve `503`).
- El frontend (`useSse.ts`) implementa backoff exponencial con máximo 30 segundos entre reintentos.
- Los emitters inactivos son eliminados del registry via `emitter.onCompletion()` y `emitter.onTimeout()`.

### Migraciones relacionadas

- `V14`: índice `idx_products_stock_critical` para la consulta de alertas de stock.
- `V15`: permiso `SSE_CONNECT` asignado a todos los roles.

---

## Module AUDIT

### Responsabilidad

Registro inmutable de todas las operaciones sensibles del sistema (cambios de precio, cancelaciones, modificaciones de crédito, etc.) mediante **Spring AOP** sin acoplar la lógica de auditoría al código de negocio.

### Clases principales

| Clase | Descripcion |
|-------|-------------|
| `@Auditable` | Anotacion en métodos de servicio. Parámetros: `entityType`, `action`, `captureOldValue`. |
| `AuditAspect` | `@Around("@annotation(auditable)")`. Extrae `userId` del `SecurityContextHolder`, IP del request con validación de proxy (fix F3-A01), serializa `oldValue` y `newValue` como JSON. |
| `AuditService` / `AuditServiceImpl` | Persiste `AuditLog` con `Propagation.REQUIRES_NEW` (transacción propia, fail-safe). |
| `AuditLog` | Entidad JPA. Columnas JSONB `old_value` / `new_value`. `REVOKE UPDATE, DELETE` a nivel de BD para inmutabilidad. |
| `AuditController` | `GET /api/v1/audit` (paginado, filtros: `entityType`, `action`, `dateFrom`, `dateTo`) + `GET /api/v1/audit/export/excel`. Requiere permiso `AUDIT_READ`. |

### Semantica fail-safe (ADR-007)

`AuditService.log()` corre en su propia transacción (`REQUIRES_NEW`). Si el guardado del log falla, la excepción es capturada en `AuditAspect` y se emite `log.error(...)`. La transacción de negocio ya está confirmada en ese punto — esta es una decisión explícita: la disponibilidad de la operación de negocio tiene prioridad sobre la completitud del audit.

### Tabla audit_log (V12)

```sql
CREATE TABLE audit_log (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type  VARCHAR(50) NOT NULL,
    entity_id    UUID,
    action       VARCHAR(50) NOT NULL,
    old_value    JSONB,
    new_value    JSONB,
    reason       VARCHAR(500),
    performed_by UUID REFERENCES users(id),
    ip_address   INET,
    user_agent   VARCHAR(500),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;
CREATE INDEX idx_audit_new_value_gin ON audit_log USING GIN (new_value);
```

### Migraciones relacionadas

- `V12`: tabla `audit_log`, índices, restricciones de permisos.
- `V15`: permiso `AUDIT_READ` asignado a ADMIN y SUPERVISOR.

---

## Module DASHBOARD

### Responsabilidad

Exposicion de KPIs operativos con un **único endpoint polimórfico** que devuelve un DTO diferente según el rol del usuario autenticado (ADR-010). El frontend discrimina el tipo via el campo `dashboardType` en la respuesta.

### Endpoint

```
GET /api/v1/dashboard
Authorization: Bearer <token>
```

Requiere `@PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR','CAJERO','BODEGA')")` (fix F3-A02).

### DTOs por rol

| Rol | DTO | Contenido |
|-----|-----|-----------|
| ADMIN | `AdminDashboardDto` | Revenue hoy, profit, margen %, ventas hoy, stock crítico, deudores, historial 7 días, top 5 productos |
| SUPERVISOR | `SupervisorDashboardDto` | Ventas propias, caja activa, stock crítico, clientes con crédito pendiente |
| CAJERO | `CashierDashboardDto` | Estado de caja propia, ventas del turno, total recaudado |
| BODEGA | `WarehouseDashboardDto` | Productos con stock crítico, últimas recepciones de compra |

### Implementacion

`DashboardServiceImpl` usa `EntityManager.createNativeQuery()` con SQL nativo para las agregaciones de revenue/cost (ADR-005 heredado de Fase 2). Los KPIs de "historial 7 días" son cacheados con TTL 1 hora (`dashboard-history`). Los KPIs del día actual tienen TTL 15 segundos (`dashboard-kpis`).

### Integracion SSE

`DashboardPage.tsx` suscribe via `useSse` y llama `refetch()` al recibir eventos `VENTA_CONFIRMADA`, `CAJA_ABIERTA` o `CAJA_CERRADA`, manteniendo el dashboard actualizado en tiempo real sin polling.

### Migraciones relacionadas

- `V14`: índices de performance para consultas del dashboard (`idx_sales_status_date`, `idx_sale_details_product`, `idx_stock_movements_product_date`).
- `V15`: permiso `DASHBOARD_ADMIN` para vistas de KPIs financieros.

---

## Configuracion Cache

### Decision (ADR-008)

Se eligió **Caffeine** (caché local en memoria JVM) sobre Redis para reducir la complejidad operacional. La plataforma corre como instancia única y no requiere invalidación distribuida.

### Regiones de cache

| Region | TTL | Max entradas | Proposito |
|--------|-----|--------------|-----------|
| `products-catalog` | 5 minutos | 5 000 | Búsquedas por código de barras en el POS — hot path crítico de latencia |
| `dashboard-kpis` | 15 segundos | 50 | KPIs del día actual — balance entre frescura y carga en BD |
| `dashboard-history` | 1 hora | 100 | Historial de días anteriores — datos inmutables una vez cerrado el día |

### Clase de configuracion

`com.minimarket.config.CacheConfig` define los tres `CaffeineCache` y los registra en `SimpleCacheManager`.

### Anotaciones usadas

| Anotacion | Clase | Metodo |
|-----------|-------|--------|
| `@Cacheable("products-catalog")` | `ProductServiceImpl` | `findByBarcode()` |
| `@CacheEvict(value="products-catalog", allEntries=true)` | `ProductServiceImpl` | `updateProduct()`, `delete()` (fix F3-A03) |
| `@Cacheable("dashboard-kpis")` | `DashboardServiceImpl` | `getTodayKpis()` |
| `@Cacheable("dashboard-history")` | `DashboardServiceImpl` | `getHistoricalData()` |

### Importante

La caché **no persiste** entre reinicios del contenedor. En un redespliegue, el primer request después de levantar el servicio siempre irá a la BD. Esto es aceptable dado el bajo TTL de `dashboard-kpis` (15 s) y que el catálogo de productos carga en milisegundos desde PostgreSQL.

# API REST — Referencia de Endpoints

**Base URL:** `http://localhost/api/v1`
**Prefijo configurado en:** `server.servlet.context-path=/api/v1` (application.yml)
**Formato:** JSON en todas las peticiones y respuestas
**Autenticacion:** Bearer Token (JWT) en el header `Authorization`

---

## Tabla de Contenidos

- [Autenticacion](#autenticacion)
  - [POST /auth/login](#post-authlogin)
  - [POST /auth/refresh](#post-authrefresh)
  - [POST /auth/logout](#post-authlogout)
- [Productos](#productos)
  - [GET /products](#get-products)
  - [GET /products/{id}](#get-productsid)
  - [GET /products/barcode/{code}](#get-productsbarcodecode)
  - [POST /products](#post-products)
  - [PUT /products/{id}](#put-productsid)
  - [DELETE /products/{id}](#delete-productsid)
- [Ventas](#ventas)
  - [POST /sales](#post-sales)
  - [GET /sales](#get-sales)
  - [GET /sales/{id}](#get-salesid)
  - [POST /sales/{id}/cancel](#post-salesidcancel)
- [Stock](#stock)
  - [GET /stock](#get-stock)
  - [GET /stock/low](#get-stocklow)
  - [POST /stock/adjustment](#post-stockadjustment)
  - [GET /stock/movements](#get-stockmovements)
- [Usuarios](#usuarios)
  - [GET /users](#get-users)
  - [POST /users](#post-users)
  - [PUT /users/{id}](#put-usersid)
- [Codigos de Error Comunes](#codigos-de-error-comunes)
- [Fase 2 — Nuevos Endpoints](#fase-2--nuevos-endpoints)
  - [Compras](#compras)
  - [Caja](#caja)
  - [Clientes](#clientes)
  - [Reportes](#reportes)
- [Fase 3 — Nuevos Endpoints](#fase-3--nuevos-endpoints)
  - [SSE — Eventos en Tiempo Real](#sse--eventos-en-tiempo-real)
  - [Dashboard](#dashboard)
  - [Auditoria](#auditoria)
  - [Auditoria — Exportacion Excel](#auditoria--exportacion-excel)
- [Fase 4 — Nuevos Endpoints](#fase-4--nuevos-endpoints)
  - [Sucursales](#sucursales)

---

## Autenticacion

Los endpoints de autenticacion no requieren token. Todos los demas endpoints requieren:

```
Authorization: Bearer <access_token>
```

El `access_token` se obtiene en la respuesta de `/auth/login` o `/auth/refresh` y expira segun `JWT_EXPIRATION` (por defecto 1 hora).

> **Rate limiting aplicado por Nginx:** `/auth/*` tiene un limite de 5 requests por minuto por IP con ráfagas de hasta 3 requests. Las peticiones que superan el limite reciben `HTTP 429`.

---

### POST /auth/login

Autentica un usuario con email y contrasena. Devuelve un access token JWT y un refresh token.

**Autenticacion requerida:** No
**Roles permitidos:** Publico

#### Request Body

```json
{
  "email": "admin@minimarket.local",
  "password": "Admin1234!"
}
```

| Campo | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `email` | string | Si | Email valido del usuario |
| `password` | string | Si | Contrasena del usuario (no se registra en logs) |

#### Response 200 OK

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbkBtaW5pbWFya2V0LmxvY2FsIn0...",
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4gZXhhbXBsZQ==",
  "tokenType": "Bearer",
  "expiresIn": 3600000,
  "userId": "00000000-0000-0000-0000-000000000010",
  "email": "admin@minimarket.local",
  "firstName": "Admin",
  "lastName": "Sistema",
  "roles": ["ADMIN"]
}
```

| Campo | Tipo | Descripcion |
|---|---|---|
| `accessToken` | string | JWT firmado con HS256. Incluir en `Authorization: Bearer <token>`. Desde Fase 4 incluye el claim `branch_id`. |
| `refreshToken` | string | Token de larga duracion para renovar el access token |
| `tokenType` | string | Siempre `"Bearer"` |
| `expiresIn` | number | Duracion del access token en milisegundos |
| `userId` | UUID | Identificador del usuario autenticado |
| `email` | string | Email del usuario |
| `firstName` | string | Nombre del usuario |
| `lastName` | string | Apellido del usuario |
| `roles` | array | Lista de roles: `ADMIN`, `CAJERO`, `BODEGA`, `SUPERVISOR` |
| `branchId` | UUID o null | (Fase 4) UUID de la sucursal asignada al usuario. `null` para ADMIN global (acceso a todas las sucursales). |

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | Request malformado (email invalido, campo faltante) |
| 401 | Credenciales incorrectas |
| 403 | Usuario desactivado (`is_active = false`) |
| 429 | Rate limit excedido (mas de 5 requests/minuto) |

---

### POST /auth/refresh

Emite un nuevo access token usando un refresh token valido y no revocado.

**Autenticacion requerida:** No
**Roles permitidos:** Publico (con refresh token valido)

#### Request Body

```json
{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4gZXhhbXBsZQ=="
}
```

#### Response 200 OK

La respuesta tiene el mismo esquema que `/auth/login`, con un nuevo `accessToken` y el mismo `refreshToken`.

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | `refreshToken` vacio o nulo |
| 401 | Token no encontrado, expirado o revocado |

---

### POST /auth/logout

Revoca el refresh token en el servidor. El access token expira naturalmente por TTL.

**Autenticacion requerida:** No (se requiere el refresh token en el cuerpo)
**Roles permitidos:** Publico (con refresh token valido)

#### Request Body

```json
{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4gZXhhbXBsZQ=="
}
```

#### Response 204 No Content

Sin cuerpo de respuesta.

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | `refreshToken` vacio o nulo |

---

## Productos

Gestion del catalogo de productos. La busqueda por barcode y el listado son accesibles para todos los roles autenticados. Las operaciones de escritura requieren rol `ADMIN`.

---

### GET /products

Lista productos con filtros opcionales y paginacion.

**Autenticacion requerida:** Si (cualquier rol)
**Roles permitidos:** ADMIN, CAJERO, BODEGA, SUPERVISOR

#### Query Parameters

| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `name` | string | No | Filtro por nombre (busqueda parcial) |
| `barcode` | string | No | Filtro exacto por codigo de barras |
| `categoryId` | UUID | No | Filtro por ID de categoria |
| `active` | boolean | No | `true` solo activos, `false` solo inactivos |
| `page` | integer | No | Numero de pagina (0-indexed, default: 0) |
| `size` | integer | No | Tamano de pagina (default: 20) |
| `sort` | string | No | Campo de ordenamiento (default: `name,asc`) |

#### Response 200 OK

```json
{
  "content": [
    {
      "id": "a1b2c3d4-0000-0000-0000-000000000001",
      "barcode": "7801234567890",
      "name": "Leche Entera 1L",
      "description": "Leche entera pasteurizada",
      "purchasePrice": 800.0000,
      "salePrice": 1050.0000,
      "stockCurrent": 48.0000,
      "stockMinimum": 10.0000,
      "stockMaximum": 100.0000,
      "active": true,
      "category": {
        "id": "cat-uuid-001",
        "code": "LAC",
        "name": "Lacteos"
      },
      "tax": {
        "id": "tax-uuid-001",
        "code": "IVA19",
        "name": "IVA 19%",
        "rate": 0.1900
      },
      "unit": {
        "id": "unit-uuid-001",
        "code": "LT",
        "name": "Litro",
        "abbreviation": "lt"
      },
      "createdAt": "2025-01-15T10:30:00Z",
      "updatedAt": "2025-05-20T08:00:00Z"
    }
  ],
  "pageable": {
    "pageNumber": 0,
    "pageSize": 20
  },
  "totalElements": 85,
  "totalPages": 5,
  "last": false,
  "first": true
}
```

---

### GET /products/{id}

Obtiene un producto por su UUID.

**Autenticacion requerida:** Si (cualquier rol)
**Roles permitidos:** ADMIN, CAJERO, BODEGA, SUPERVISOR

#### Path Parameters

| Parametro | Tipo | Descripcion |
|---|---|---|
| `id` | UUID | Identificador del producto |

#### Response 200 OK

Objeto `ProductResponse` con el mismo esquema que los items del listado.

#### Errores

| Codigo | Descripcion |
|---|---|
| 404 | Producto no encontrado o eliminado (soft delete) |

---

### GET /products/barcode/{code}

Busca un producto por su codigo de barras. Endpoint de alta frecuencia en POS.

**Autenticacion requerida:** Si (cualquier rol)
**Roles permitidos:** ADMIN, CAJERO, BODEGA, SUPERVISOR

#### Path Parameters

| Parametro | Tipo | Descripcion |
|---|---|---|
| `code` | string | Codigo de barras (EAN-13, UPC u codigo interno) |

#### Response 200 OK

Objeto `ProductResponse` completo del producto encontrado.

#### Errores

| Codigo | Descripcion |
|---|---|
| 404 | Ningun producto activo tiene ese codigo de barras |

---

### POST /products

Crea un nuevo producto en el catalogo.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN

#### Request Body

```json
{
  "barcode": "7801234567891",
  "name": "Yogur Natural 200g",
  "description": "Yogur natural sin azucar",
  "purchasePrice": 350.0,
  "salePrice": 490.0,
  "stockMinimum": 5.0,
  "stockMaximum": 60.0,
  "categoryId": "cat-uuid-001",
  "taxId": "tax-uuid-001",
  "unitId": "unit-uuid-002"
}
```

| Campo | Tipo | Requerido | Restricciones |
|---|---|---|---|
| `barcode` | string | Si | Max 50 chars, debe ser unico |
| `name` | string | Si | Max 255 chars |
| `description` | string | No | Texto libre |
| `purchasePrice` | decimal | Si | >= 0 |
| `salePrice` | decimal | Si | >= 0, debe ser >= `purchasePrice` |
| `stockMinimum` | decimal | No | >= 0 |
| `stockMaximum` | decimal | No | >= `stockMinimum` si se provee |
| `categoryId` | UUID | Si | Debe existir en `product_categories` |
| `taxId` | UUID | Si | Debe existir en `taxes` |
| `unitId` | UUID | Si | Debe existir en `units` |

#### Response 201 Created

Objeto `ProductResponse` del producto recien creado.

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | Datos invalidos (precio negativo, barcode duplicado, campos requeridos faltantes) |
| 403 | El usuario no tiene rol ADMIN |
| 404 | `categoryId`, `taxId` o `unitId` no existen |
| 409 | El codigo de barras ya existe en el catalogo |

---

### PUT /products/{id}

Actualiza un producto existente. Solo los campos provistos son actualizados.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN

#### Path Parameters

| Parametro | Tipo | Descripcion |
|---|---|---|
| `id` | UUID | Identificador del producto a actualizar |

#### Request Body

Mismo esquema que `POST /products`. Todos los campos son opcionales en la actualizacion; los no provistos conservan su valor.

Si se modifica `purchasePrice` o `salePrice`, el cambio se registra automaticamente en `price_audit_log` via trigger de PostgreSQL.

#### Response 200 OK

Objeto `ProductResponse` actualizado.

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | Datos invalidos |
| 403 | El usuario no tiene rol ADMIN |
| 404 | Producto no encontrado |
| 409 | El nuevo barcode ya existe en otro producto |

---

### DELETE /products/{id}

Realiza un soft delete del producto (marca `deleted_at`, no elimina el registro).

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN

#### Path Parameters

| Parametro | Tipo | Descripcion |
|---|---|---|
| `id` | UUID | Identificador del producto a eliminar |

#### Response 204 No Content

Sin cuerpo de respuesta.

#### Errores

| Codigo | Descripcion |
|---|---|
| 403 | El usuario no tiene rol ADMIN |
| 404 | Producto no encontrado |

---

## Ventas

Registro y consulta de ventas. Al confirmar una venta el stock se descuenta atomicamente via trigger en PostgreSQL con lock pesimista (`SELECT FOR UPDATE`).

**Roles disponibles en el sistema:** ADMIN, CAJERO, BODEGA, SUPERVISOR

---

### POST /sales

Crea y confirma una nueva venta. El stock de cada producto se descuenta en la misma transaccion.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, CAJERO

#### Request Body

```json
{
  "type": "CONTADO",
  "items": [
    {
      "productId": "a1b2c3d4-0000-0000-0000-000000000001",
      "quantity": 2,
      "discount": 0
    },
    {
      "productId": "a1b2c3d4-0000-0000-0000-000000000002",
      "quantity": 1,
      "discount": 50.0
    }
  ],
  "paymentMethod": "EFECTIVO",
  "paymentAmount": 2550.0,
  "changeAmount": 50.0,
  "paymentReference": null,
  "customerId": null,
  "notes": "Cliente habitual"
}
```

| Campo | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `type` | enum | Si | `CONTADO`, `CREDITO` o `MIXTO` |
| `items` | array | Si | Al menos 1 item |
| `items[].productId` | UUID | Si | Producto a vender |
| `items[].quantity` | decimal | Si | Cantidad (> 0) |
| `items[].discount` | decimal | No | Descuento en monto fijo por unidad (>= 0) |
| `paymentMethod` | enum | Si | `EFECTIVO`, `TARJETA`, `TRANSFERENCIA`, `CREDITO` |
| `paymentAmount` | decimal | Si | Monto recibido (> 0) |
| `changeAmount` | decimal | No | Vuelto (>= 0) |
| `paymentReference` | string | No | Numero de operacion (tarjeta/transferencia) |
| `customerId` | UUID | No | Cliente asociado (ventas a credito) |
| `notes` | string | No | Notas internas de la venta |

#### Response 201 Created

```json
{
  "id": "venta-uuid-001",
  "saleNumber": 1042,
  "type": "CONTADO",
  "status": "CONFIRMED",
  "totalAmount": 2550.0,
  "discountAmount": 50.0,
  "taxAmount": 408.40,
  "netAmount": 2141.60,
  "seller": {
    "id": "user-uuid-002",
    "email": "cajero@minimarket.local",
    "firstName": "Maria",
    "lastName": "Perez"
  },
  "customerId": null,
  "notes": "Cliente habitual",
  "cancellationReason": null,
  "cancelledAt": null,
  "details": [
    {
      "id": "detail-uuid-001",
      "productId": "a1b2c3d4-0000-0000-0000-000000000001",
      "productName": "Leche Entera 1L",
      "productBarcode": "7801234567890",
      "quantity": 2.0000,
      "unitPrice": 1050.0000,
      "discount": 0.0000,
      "subtotal": 2100.0000,
      "taxRate": 0.1900,
      "taxAmount": 336.13
    }
  ],
  "payments": [
    {
      "id": "payment-uuid-001",
      "method": "EFECTIVO",
      "amount": 2550.0,
      "changeAmount": 50.0,
      "reference": null,
      "createdAt": "2026-05-26T14:30:00Z"
    }
  ],
  "createdAt": "2026-05-26T14:30:00Z",
  "updatedAt": "2026-05-26T14:30:00Z"
}
```

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | Datos invalidos, producto sin stock suficiente o lista de items vacia |
| 403 | El usuario no tiene rol ADMIN ni CAJERO |
| 404 | Producto no encontrado o inactivo |
| 409 | Stock insuficiente para alguno de los productos |

---

### GET /sales

Lista ventas con filtros opcionales y paginacion. Ordenadas por fecha de creacion descendente.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, CAJERO, SUPERVISOR

#### Query Parameters

| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `startDate` | ISO-8601 | No | Fecha/hora inicio del rango (ej: `2026-05-01T00:00:00Z`) |
| `endDate` | ISO-8601 | No | Fecha/hora fin del rango |
| `sellerId` | UUID | No | Filtrar por vendedor |
| `status` | enum | No | `PENDING`, `CONFIRMED` o `CANCELLED` |
| `page` | integer | No | Default: 0 |
| `size` | integer | No | Default: 20 |

#### Response 200 OK

Pagina con objetos `SaleResponse` en el campo `content`. Mismo esquema que `POST /sales`.

---

### GET /sales/{id}

Obtiene una venta por su UUID con todos los detalles e informacion de pago.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, CAJERO, SUPERVISOR

#### Path Parameters

| Parametro | Tipo | Descripcion |
|---|---|---|
| `id` | UUID | Identificador de la venta |

#### Response 200 OK

Objeto `SaleResponse` completo.

#### Errores

| Codigo | Descripcion |
|---|---|
| 404 | Venta no encontrada |

---

### POST /sales/{id}/cancel

Anula una venta confirmada. Revierte el stock de los productos vendidos y registra el motivo de anulacion.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, SUPERVISOR

#### Path Parameters

| Parametro | Tipo | Descripcion |
|---|---|---|
| `id` | UUID | Identificador de la venta a anular |

#### Request Body

```json
{
  "reason": "Error en el cobro, se cargo dos veces"
}
```

| Campo | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `reason` | string | No | Motivo de la anulacion (default: "No reason provided") |

#### Response 200 OK

Objeto `SaleResponse` con `status: "CANCELLED"`, `cancellationReason` y `cancelledAt` poblados.

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | La venta ya esta cancelada o no es posible anularla en su estado actual |
| 403 | El usuario no tiene rol ADMIN ni SUPERVISOR |
| 404 | Venta no encontrada |

---

## Stock

Gestion de inventario: consulta de niveles de stock, alertas de reposicion, ajustes manuales y trazabilidad de movimientos.

---

### GET /stock

Lista todos los productos activos con su stock actual. Util para el dashboard de inventario.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, BODEGA, SUPERVISOR

#### Query Parameters

| Parametro | Tipo | Descripcion |
|---|---|---|
| `page` | integer | Default: 0 |
| `size` | integer | Default: 20 |
| `sort` | string | Default: `name,asc` |

#### Response 200 OK

Pagina con objetos `ProductResponse` incluyendo `stockCurrent`, `stockMinimum` y `stockMaximum`.

---

### GET /stock/low

Lista productos cuyo `stockCurrent` es menor o igual a `stockMinimum`. Ordenados por stock actual ascendente (los mas criticos primero).

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, BODEGA, SUPERVISOR

#### Response 200 OK

Pagina con objetos `ProductResponse`. Un resultado vacio indica que no hay productos bajo minimo.

---

### POST /stock/adjustment

Registra un ajuste manual de stock. Requiere autorizacion y nota justificativa. El movimiento queda registrado en `stock_movements` con tipo `AJUSTE`.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, SUPERVISOR

#### Request Body

```json
{
  "productId": "a1b2c3d4-0000-0000-0000-000000000001",
  "movementType": "AJUSTE",
  "quantity": -3.0,
  "notes": "Conteo fisico: faltaban 3 unidades respecto al sistema"
}
```

| Campo | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `productId` | UUID | Si | Producto a ajustar |
| `movementType` | enum | Si | `VENTA`, `COMPRA`, `AJUSTE`, `DEVOLUCION`, `MERMA` |
| `quantity` | decimal | Si | Positivo = ingreso, negativo = egreso |
| `notes` | string | Si | Justificacion del ajuste (obligatorio por regla de negocio) |

> Un ajuste con cantidad negativa que dejaria el stock en negativo es rechazado a nivel de base de datos (constraint `chk_stock_movements_quantity_after_positive`).

#### Response 201 Created

```json
{
  "id": "movement-uuid-001",
  "product": {
    "id": "a1b2c3d4-0000-0000-0000-000000000001",
    "barcode": "7801234567890",
    "name": "Leche Entera 1L",
    "stockCurrent": 45.0000
  },
  "movementType": "AJUSTE",
  "quantity": -3.0000,
  "quantityBefore": 48.0000,
  "quantityAfter": 45.0000,
  "referenceId": null,
  "referenceType": null,
  "authorizedBy": {
    "id": "user-uuid-001",
    "email": "admin@minimarket.local",
    "firstName": "Admin",
    "lastName": "Sistema"
  },
  "notes": "Conteo fisico: faltaban 3 unidades respecto al sistema",
  "createdBy": {
    "id": "user-uuid-001",
    "email": "admin@minimarket.local",
    "firstName": "Admin",
    "lastName": "Sistema"
  },
  "createdAt": "2026-05-26T15:00:00Z"
}
```

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | Datos invalidos, notas vacias o ajuste dejaria stock negativo |
| 403 | El usuario no tiene rol ADMIN ni SUPERVISOR |
| 404 | Producto no encontrado |

---

### GET /stock/movements

Historial de movimientos de stock. Opcionalmente filtrado por producto.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, BODEGA, SUPERVISOR

#### Query Parameters

| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `productId` | UUID | No | Filtrar movimientos de un producto especifico |
| `page` | integer | No | Default: 0 |
| `size` | integer | No | Default: 20 |
| `sort` | string | No | Default: `createdAt,desc` |

#### Response 200 OK

Pagina con objetos `StockMovementResponse`. Cada objeto incluye `quantityBefore` y `quantityAfter` para trazabilidad completa del libro mayor de inventario.

---

## Usuarios

Administracion de usuarios del sistema. Todos los endpoints requieren rol `ADMIN`, excepto `GET /users/{id}` que permite al propio usuario ver su perfil.

---

### GET /users

Lista todos los usuarios activos con filtros opcionales.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN

#### Query Parameters

| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `email` | string | No | Filtro por email (busqueda parcial) |
| `firstName` | string | No | Filtro por nombre |
| `page` | integer | No | Default: 0 |
| `size` | integer | No | Default: 20 |
| `sort` | string | No | Default: `createdAt,desc` |

#### Response 200 OK

```json
{
  "content": [
    {
      "id": "user-uuid-001",
      "email": "admin@minimarket.local",
      "firstName": "Admin",
      "lastName": "Sistema",
      "active": true,
      "roles": ["ADMIN"],
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-01T00:00:00Z"
    }
  ],
  "totalElements": 4,
  "totalPages": 1,
  "first": true,
  "last": true
}
```

---

### POST /users

Crea un nuevo usuario en el sistema.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN

#### Request Body

```json
{
  "email": "cajero1@minimarket.local",
  "password": "Cajero1234!",
  "firstName": "Carlos",
  "lastName": "Gomez",
  "roles": ["CAJERO"]
}
```

| Campo | Tipo | Requerido | Restricciones |
|---|---|---|---|
| `email` | string | Si | Email valido, unico en el sistema |
| `password` | string | Si | 8 a 100 caracteres |
| `firstName` | string | Si | Max 100 chars |
| `lastName` | string | Si | Max 100 chars |
| `roles` | array | Si | Al menos un rol: `ADMIN`, `CAJERO`, `BODEGA`, `SUPERVISOR` |

La contrasena se almacena como hash BCrypt con fuerza 12. Nunca se persiste en texto plano.

#### Response 201 Created

```json
{
  "id": "user-uuid-005",
  "email": "cajero1@minimarket.local",
  "firstName": "Carlos",
  "lastName": "Gomez",
  "active": true,
  "roles": ["CAJERO"],
  "createdAt": "2026-05-26T10:00:00Z",
  "updatedAt": "2026-05-26T10:00:00Z"
}
```

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | Datos invalidos (email mal formado, contrasena muy corta, roles vacios) |
| 403 | El usuario no tiene rol ADMIN |
| 409 | El email ya esta registrado |

---

### PUT /users/{id}

Actualiza los datos de un usuario. Solo el rol ADMIN puede modificar otros usuarios.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN (para cualquier usuario) o el propio usuario (para su propio perfil)

#### Path Parameters

| Parametro | Tipo | Descripcion |
|---|---|---|
| `id` | UUID | Identificador del usuario a actualizar |

#### Request Body

Mismo esquema que `POST /users`. La contrasena es opcional; si no se provee, conserva la actual.

#### Response 200 OK

Objeto `UserResponse` actualizado.

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | Datos invalidos |
| 403 | Intento de modificar otro usuario sin ser ADMIN |
| 404 | Usuario no encontrado |
| 409 | El nuevo email ya existe |

---

## Codigos de Error Comunes

La API devuelve errores en formato JSON estandar de Spring:

```json
{
  "timestamp": "2026-05-26T14:30:00.000+00:00",
  "status": 400,
  "error": "Bad Request",
  "message": "Validation failed for object='createProductRequest'",
  "path": "/api/v1/products"
}
```

Para errores de validacion con multiples campos:

```json
{
  "timestamp": "2026-05-26T14:30:00.000+00:00",
  "status": 400,
  "error": "Bad Request",
  "errors": {
    "barcode": "Barcode must not exceed 50 characters",
    "salePrice": "Sale price must be >= 0"
  },
  "path": "/api/v1/products"
}
```

### Tabla de codigos HTTP utilizados

| Codigo | Significado | Cuando ocurre |
|---|---|---|
| 200 | OK | Consulta o actualizacion exitosa |
| 201 | Created | Recurso creado exitosamente |
| 204 | No Content | Eliminacion o logout exitoso |
| 400 | Bad Request | Validacion fallida, datos malformados |
| 401 | Unauthorized | Token ausente, expirado o invalido |
| 403 | Forbidden | Token valido pero sin permiso para la operacion |
| 404 | Not Found | Recurso no encontrado |
| 409 | Conflict | Violacion de unicidad (barcode duplicado, email duplicado) |
| 429 | Too Many Requests | Rate limit de Nginx excedido |
| 500 | Internal Server Error | Error inesperado del servidor |

---

## Swagger UI

La documentacion interactiva de la API esta disponible en desarrollo en:

```
http://localhost/api/v1/swagger-ui.html
```

El JSON de la especificacion OpenAPI 3.0 se puede descargar desde:

```
http://localhost/api/v1/v3/api-docs
```

> Ambas URLs estan bloqueadas en produccion desde `SecurityConfig.java` y por Nginx.

---

## Fase 2 — Nuevos Endpoints

Los siguientes endpoints se incorporan en la Fase 2. El prefijo base sigue siendo `http://localhost/api/v1`.

---

## Compras

Gestion de ordenes de compra a proveedores. Al confirmar una compra el stock se incrementa automaticamente y se recalcula el costo promedio ponderado de cada producto.

---

### POST /api/v1/purchases

Crea una orden de compra en estado `DRAFT`. No modifica el stock hasta que se confirme.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, BODEGA

#### Request Body

```json
{
  "supplierId": "supplier-uuid-001",
  "documentType": "FACTURA",
  "documentNumber": "001-0000542",
  "purchaseDate": "2026-05-26",
  "notes": "Reposicion mensual de lacteos",
  "items": [
    {
      "productId": "a1b2c3d4-0000-0000-0000-000000000001",
      "quantity": 120,
      "unitCost": 780.00
    },
    {
      "productId": "a1b2c3d4-0000-0000-0000-000000000002",
      "quantity": 60,
      "unitCost": 320.00
    }
  ]
}
```

| Campo | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `supplierId` | UUID | Si | Proveedor que emite el documento |
| `documentType` | enum | Si | `FACTURA`, `BOLETA`, `SIN_DOCUMENTO` |
| `documentNumber` | string | No | Numero del documento (requerido si `documentType` es `FACTURA` o `BOLETA`) |
| `purchaseDate` | date | Si | Fecha de la compra (formato `YYYY-MM-DD`) |
| `notes` | string | No | Notas internas de la orden |
| `items` | array | Si | Al menos 1 item |
| `items[].productId` | UUID | Si | Producto a reponer |
| `items[].quantity` | decimal | Si | Cantidad (> 0) |
| `items[].unitCost` | decimal | Si | Costo unitario de compra (>= 0) |

#### Response 201 Created

```json
{
  "id": "purchase-uuid-001",
  "purchaseNumber": 87,
  "status": "DRAFT",
  "supplier": {
    "id": "supplier-uuid-001",
    "name": "Distribuidora Norte S.A.",
    "rut": "76123456-7"
  },
  "documentType": "FACTURA",
  "documentNumber": "001-0000542",
  "purchaseDate": "2026-05-26",
  "totalAmount": 112800.00,
  "notes": "Reposicion mensual de lacteos",
  "items": [
    {
      "id": "pd-uuid-001",
      "productId": "a1b2c3d4-0000-0000-0000-000000000001",
      "productName": "Leche Entera 1L",
      "quantity": 120.0000,
      "unitCost": 780.0000,
      "subtotal": 93600.0000
    }
  ],
  "createdBy": {
    "id": "user-uuid-003",
    "email": "bodega@minimarket.local",
    "firstName": "Luis",
    "lastName": "Vargas"
  },
  "createdAt": "2026-05-26T09:00:00Z",
  "updatedAt": "2026-05-26T09:00:00Z"
}
```

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | Datos invalidos, items vacios o `documentNumber` faltante para FACTURA/BOLETA |
| 403 | El usuario no tiene rol ADMIN ni BODEGA |
| 404 | `supplierId` o algun `productId` no existe |

---

### POST /api/v1/purchases/{id}/confirm

Confirma una orden de compra en estado `DRAFT`. Incrementa el stock de cada producto y recalcula el costo promedio ponderado.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, BODEGA

#### Path Parameters

| Parametro | Tipo | Descripcion |
|---|---|---|
| `id` | UUID | Identificador de la orden de compra |

#### Request Body

Sin cuerpo (el body puede omitirse o enviarse `{}`).

#### Response 200 OK

Objeto `PurchaseResponse` con `status: "CONFIRMED"` y stock actualizado en los productos.

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | La orden ya esta confirmada o cancelada |
| 403 | El usuario no tiene rol ADMIN ni BODEGA |
| 404 | Orden de compra no encontrada |

---

### POST /api/v1/purchases/{id}/cancel

Cancela una orden de compra. Solo se puede cancelar una orden en estado `DRAFT`.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN

#### Path Parameters

| Parametro | Tipo | Descripcion |
|---|---|---|
| `id` | UUID | Identificador de la orden de compra |

#### Request Body

```json
{
  "reason": "Proveedor no tiene stock disponible"
}
```

#### Response 200 OK

Objeto `PurchaseResponse` con `status: "CANCELLED"`.

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | La orden ya esta confirmada y no puede cancelarse |
| 403 | El usuario no tiene rol ADMIN |
| 404 | Orden de compra no encontrada |

---

### GET /api/v1/purchases

Lista ordenes de compra con filtros y paginacion.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, BODEGA, SUPERVISOR

#### Query Parameters

| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `supplierId` | UUID | No | Filtrar por proveedor |
| `status` | enum | No | `DRAFT`, `CONFIRMED`, `CANCELLED` |
| `startDate` | date | No | Fecha inicio del rango (`YYYY-MM-DD`) |
| `endDate` | date | No | Fecha fin del rango |
| `page` | integer | No | Default: 0 |
| `size` | integer | No | Default: 20 |

#### Response 200 OK

Pagina con objetos `PurchaseResponse` resumidos (sin el detalle de items).

---

### GET /api/v1/purchases/{id}

Obtiene una orden de compra completa con todos sus items.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, BODEGA, SUPERVISOR

#### Response 200 OK

Objeto `PurchaseResponse` completo incluyendo el array `items`.

#### Errores

| Codigo | Descripcion |
|---|---|
| 404 | Orden de compra no encontrada |

---

### POST /api/v1/suppliers

Crea un nuevo proveedor.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, BODEGA

#### Request Body

```json
{
  "name": "Distribuidora Norte S.A.",
  "rut": "76123456-7",
  "contactName": "Pedro Soto",
  "email": "pedro.soto@distnorte.cl",
  "phone": "+56912345678",
  "address": "Av. Industrial 1234, Santiago"
}
```

| Campo | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `name` | string | Si | Razon social del proveedor (max 255 chars) |
| `rut` | string | No | RUT del proveedor (unico si se provee) |
| `contactName` | string | No | Nombre del contacto comercial |
| `email` | string | No | Email de contacto |
| `phone` | string | No | Telefono de contacto |
| `address` | string | No | Direccion del proveedor |

#### Response 201 Created

```json
{
  "id": "supplier-uuid-002",
  "name": "Distribuidora Norte S.A.",
  "rut": "76123456-7",
  "contactName": "Pedro Soto",
  "email": "pedro.soto@distnorte.cl",
  "phone": "+56912345678",
  "address": "Av. Industrial 1234, Santiago",
  "active": true,
  "createdAt": "2026-05-26T10:00:00Z"
}
```

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | Datos invalidos |
| 403 | El usuario no tiene rol ADMIN ni BODEGA |
| 409 | El RUT ya existe en el sistema |

---

### GET /api/v1/suppliers

Lista proveedores activos.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, BODEGA, SUPERVISOR

#### Query Parameters

| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `name` | string | No | Busqueda parcial por nombre |
| `page` | integer | No | Default: 0 |
| `size` | integer | No | Default: 20 |

#### Response 200 OK

Pagina con objetos `SupplierResponse`.

---

### PUT /api/v1/suppliers/{id}

Actualiza los datos de un proveedor existente.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, BODEGA

#### Request Body

Mismo esquema que `POST /api/v1/suppliers`. Todos los campos son opcionales.

#### Response 200 OK

Objeto `SupplierResponse` actualizado.

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | Datos invalidos |
| 403 | El usuario no tiene rol ADMIN ni BODEGA |
| 404 | Proveedor no encontrado |
| 409 | El nuevo RUT ya existe en otro proveedor |

---

## Caja

Gestion de turnos de caja, arqueo y movimientos manuales de dinero. Un cajero solo puede tener una caja abierta a la vez.

---

### POST /api/v1/cash/open

Abre un nuevo turno de caja con el monto inicial declarado.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, CAJERO

#### Request Body

```json
{
  "openingBalance": 50000.00,
  "notes": "Turno manana - Maria Perez"
}
```

| Campo | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `openingBalance` | decimal | Si | Monto en caja al abrir el turno (>= 0) |
| `notes` | string | No | Notas del turno |

#### Response 201 Created

```json
{
  "id": "cash-uuid-001",
  "status": "OPEN",
  "openedBy": {
    "id": "user-uuid-002",
    "email": "cajero@minimarket.local",
    "firstName": "Maria",
    "lastName": "Perez"
  },
  "openingBalance": 50000.00,
  "closingBalance": null,
  "expectedBalance": null,
  "difference": null,
  "openedAt": "2026-05-26T08:00:00Z",
  "closedAt": null,
  "notes": "Turno manana - Maria Perez"
}
```

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | `openingBalance` negativo o el usuario ya tiene una caja abierta |
| 403 | El usuario no tiene rol ADMIN ni CAJERO |
| 409 | El usuario ya tiene una caja abierta (solo una caja activa por cajero) |

---

### PATCH /api/v1/cash/{id}/close

Cierra un turno de caja. Registra el monto de cierre y calcula la diferencia respecto al esperado.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, CAJERO

#### Path Parameters

| Parametro | Tipo | Descripcion |
|---|---|---|
| `id` | UUID | Identificador del turno de caja |

#### Request Body

```json
{
  "closingBalance": 87350.00,
  "notes": "Cierre turno manana sin novedad"
}
```

| Campo | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `closingBalance` | decimal | Si | Monto contado al cerrar (>= 0) |
| `notes` | string | No | Notas del cierre |

#### Response 200 OK

```json
{
  "id": "cash-uuid-001",
  "status": "CLOSED",
  "openedBy": {
    "id": "user-uuid-002",
    "email": "cajero@minimarket.local",
    "firstName": "Maria",
    "lastName": "Perez"
  },
  "openingBalance": 50000.00,
  "closingBalance": 87350.00,
  "expectedBalance": 88200.00,
  "difference": -850.00,
  "openedAt": "2026-05-26T08:00:00Z",
  "closedAt": "2026-05-26T16:00:00Z",
  "notes": "Cierre turno manana sin novedad"
}
```

> `expectedBalance` = `openingBalance` + suma de ventas en efectivo + movimientos INGRESO - movimientos EGRESO del turno.
> `difference` = `closingBalance` - `expectedBalance`. Negativo indica faltante; positivo indica sobrante.

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | La caja ya esta cerrada o `closingBalance` es negativo |
| 403 | El usuario no es el dueno del turno ni tiene rol ADMIN |
| 404 | Turno de caja no encontrado |

---

### GET /api/v1/cash/current

Obtiene el turno de caja actualmente abierto para el usuario autenticado.

**Autenticacion requerida:** Si
**Roles permitidos:** Cualquier usuario autenticado

#### Response 200 OK

Objeto `CashRegisterResponse` del turno abierto, o `null` si no hay turno activo para el usuario.

---

### GET /api/v1/cash/{id}/summary

Obtiene el resumen del turno: balance, totales por metodo de pago y conteo de movimientos.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, CAJERO, SUPERVISOR

#### Response 200 OK

```json
{
  "cashRegisterId": "cash-uuid-001",
  "status": "OPEN",
  "openingBalance": 50000.00,
  "currentExpectedBalance": 88200.00,
  "salesTotal": 45200.00,
  "salesByMethod": {
    "EFECTIVO": 35200.00,
    "TARJETA": 10000.00,
    "TRANSFERENCIA": 0.00
  },
  "manualMovementsTotal": {
    "INGRESO": 3000.00,
    "EGRESO": 0.00
  },
  "salesCount": 23,
  "openedAt": "2026-05-26T08:00:00Z"
}
```

#### Errores

| Codigo | Descripcion |
|---|---|
| 403 | El usuario no tiene acceso al resumen de este turno |
| 404 | Turno de caja no encontrado |

---

### POST /api/v1/cash/{id}/movements

Registra un movimiento manual de ingreso o egreso en el turno activo.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, CAJERO

#### Path Parameters

| Parametro | Tipo | Descripcion |
|---|---|---|
| `id` | UUID | Identificador del turno de caja |

#### Request Body

```json
{
  "type": "EGRESO",
  "amount": 5000.00,
  "description": "Pago a proveedor de pan"
}
```

| Campo | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `type` | enum | Si | `INGRESO` o `EGRESO` |
| `amount` | decimal | Si | Monto del movimiento (> 0) |
| `description` | string | Si | Descripcion obligatoria del movimiento |

#### Response 201 Created

```json
{
  "id": "movement-cash-uuid-001",
  "cashRegisterId": "cash-uuid-001",
  "type": "EGRESO",
  "amount": 5000.00,
  "description": "Pago a proveedor de pan",
  "createdBy": {
    "id": "user-uuid-002",
    "email": "cajero@minimarket.local",
    "firstName": "Maria",
    "lastName": "Perez"
  },
  "createdAt": "2026-05-26T11:30:00Z"
}
```

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | Monto <= 0, descripcion vacia o la caja no esta abierta |
| 403 | El usuario no tiene rol ADMIN ni CAJERO, o no es dueno del turno |
| 404 | Turno de caja no encontrado |

---

### GET /api/v1/cash/{id}/movements

Lista todos los movimientos manuales de un turno de caja.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, CAJERO, SUPERVISOR

#### Query Parameters

| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `type` | enum | No | Filtrar por `INGRESO` o `EGRESO` |
| `page` | integer | No | Default: 0 |
| `size` | integer | No | Default: 20 |

#### Response 200 OK

Pagina con objetos `CashMovementResponse`.

---

## Clientes

Gestion de clientes, cuenta corriente a credito y registro de pagos. El limite de credito solo puede ser modificado por ADMIN o SUPERVISOR.

---

### POST /api/v1/customers

Crea un nuevo cliente. El `creditLimit` se establece siempre en $0 al momento de la creacion y solo puede incrementarse luego por ADMIN o SUPERVISOR.

**Autenticacion requerida:** Si
**Roles permitidos:** Cualquier usuario autenticado

#### Request Body

```json
{
  "firstName": "Ana",
  "lastName": "Rodriguez",
  "rut": "12345678-9",
  "email": "ana.rodriguez@email.com",
  "phone": "+56987654321",
  "address": "Calle Los Olivos 456, Santiago"
}
```

| Campo | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `firstName` | string | Si | Nombre del cliente (max 100 chars) |
| `lastName` | string | Si | Apellido del cliente (max 100 chars) |
| `rut` | string | No | RUT del cliente (unico si se provee) |
| `email` | string | No | Email de contacto |
| `phone` | string | No | Telefono de contacto |
| `address` | string | No | Direccion del cliente |

#### Response 201 Created

```json
{
  "id": "customer-uuid-001",
  "firstName": "Ana",
  "lastName": "Rodriguez",
  "rut": "12345678-9",
  "email": "ana.rodriguez@email.com",
  "phone": "+56987654321",
  "address": "Calle Los Olivos 456, Santiago",
  "creditLimit": 0.00,
  "currentDebt": 0.00,
  "availableCredit": 0.00,
  "active": true,
  "version": 0,
  "createdAt": "2026-05-26T10:00:00Z"
}
```

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | Datos invalidos |
| 401 | Usuario no autenticado |
| 409 | El RUT ya existe en el sistema |

---

### GET /api/v1/customers

Lista clientes activos con filtros opcionales.

**Autenticacion requerida:** Si
**Roles permitidos:** Cualquier usuario autenticado

#### Query Parameters

| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `name` | string | No | Busqueda parcial por nombre o apellido |
| `rut` | string | No | Busqueda exacta por RUT |
| `page` | integer | No | Default: 0 |
| `size` | integer | No | Default: 20 |

#### Response 200 OK

Pagina con objetos `CustomerResponse`.

---

### GET /api/v1/customers/{id}

Obtiene un cliente por su UUID con su estado de credito actual.

**Autenticacion requerida:** Si
**Roles permitidos:** Cualquier usuario autenticado

#### Response 200 OK

Objeto `CustomerResponse` completo incluyendo `creditLimit`, `currentDebt` y `availableCredit`.

#### Errores

| Codigo | Descripcion |
|---|---|
| 404 | Cliente no encontrado |

---

### PUT /api/v1/customers/{id}

Actualiza los datos personales de un cliente. No modifica el limite de credito (usar `/credit-limit` para eso).

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, SUPERVISOR

#### Request Body

Mismo esquema que `POST /api/v1/customers`. Todos los campos son opcionales.

#### Response 200 OK

Objeto `CustomerResponse` actualizado.

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | Datos invalidos |
| 403 | El usuario no tiene rol ADMIN ni SUPERVISOR |
| 404 | Cliente no encontrado |
| 409 | El nuevo RUT ya existe en otro cliente |

---

### PUT /api/v1/customers/{id}/credit-limit

Modifica el limite de credito de un cliente. Utiliza optimistic locking con el campo `version` para prevenir condiciones de carrera.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, SUPERVISOR

#### Request Body

```json
{
  "creditLimit": 150000.00,
  "version": 3
}
```

| Campo | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `creditLimit` | decimal | Si | Nuevo limite de credito (>= 0) |
| `version` | integer | Si | Version actual del cliente (obtenida del GET). Necesario para optimistic locking |

#### Response 200 OK

Objeto `CustomerResponse` con el `creditLimit` actualizado y el campo `version` incrementado.

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | `creditLimit` negativo o menor que la deuda actual del cliente |
| 403 | El usuario no tiene rol ADMIN ni SUPERVISOR |
| 404 | Cliente no encontrado |
| 409 | Conflicto de version (`version` desactualizado — otro usuario modifico el cliente simultaneamente). Releer el cliente y reintentar |

---

### POST /api/v1/customers/{id}/payments

Registra un pago (total o parcial) de la deuda del cliente. El servicio usa `@Retryable` para reintentar automaticamente ante conflictos de optimistic locking.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, CAJERO, SUPERVISOR

#### Path Parameters

| Parametro | Tipo | Descripcion |
|---|---|---|
| `id` | UUID | Identificador del cliente |

#### Request Body

```json
{
  "amount": 25000.00,
  "paymentMethod": "EFECTIVO",
  "notes": "Pago parcial cuota mayo"
}
```

| Campo | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `amount` | decimal | Si | Monto del pago (> 0, no puede superar la deuda actual) |
| `paymentMethod` | enum | Si | `EFECTIVO`, `TARJETA`, `TRANSFERENCIA` |
| `notes` | string | No | Notas del pago |

#### Response 201 Created

```json
{
  "id": "cp-uuid-001",
  "customerId": "customer-uuid-001",
  "amount": 25000.00,
  "paymentMethod": "EFECTIVO",
  "debtBefore": 85000.00,
  "debtAfter": 60000.00,
  "notes": "Pago parcial cuota mayo",
  "registeredBy": {
    "id": "user-uuid-002",
    "email": "cajero@minimarket.local",
    "firstName": "Maria",
    "lastName": "Perez"
  },
  "createdAt": "2026-05-26T14:00:00Z"
}
```

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | Monto <= 0 o superior a la deuda actual del cliente |
| 403 | El usuario no tiene rol ADMIN, CAJERO ni SUPERVISOR |
| 404 | Cliente no encontrado |

---

### GET /api/v1/customers/{id}/payments

Lista el historial de pagos de un cliente, ordenado por fecha descendente.

**Autenticacion requerida:** Si
**Roles permitidos:** Cualquier usuario autenticado

#### Query Parameters

| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `page` | integer | No | Default: 0 |
| `size` | integer | No | Default: 20 |

#### Response 200 OK

Pagina con objetos `CustomerPaymentResponse`.

---

### GET /api/v1/customers/debtors

Lista clientes que tienen deuda activa (`currentDebt > 0`), ordenados por monto de deuda descendente.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, SUPERVISOR

#### Query Parameters

| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `minDebt` | decimal | No | Filtrar clientes con deuda >= este monto |
| `page` | integer | No | Default: 0 |
| `size` | integer | No | Default: 20 |

#### Response 200 OK

Pagina con objetos `CustomerResponse` incluyendo `currentDebt` y `availableCredit`.

---

## Reportes

Reportes operativos y financieros. Todos los endpoints retornan JSON salvo `export/excel` que retorna un archivo `.xlsx`. Los reportes usan CQRS ligero con native SQL (ver ADR-005).

**Ventana maxima de consulta:** 366 dias para todos los reportes con parametros `startDate`/`endDate`.

---

### GET /api/v1/reports/sales

Reporte de ventas totales para un periodo de tiempo.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, SUPERVISOR

#### Query Parameters

| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `startDate` | date | Si | Fecha inicio (`YYYY-MM-DD`) |
| `endDate` | date | Si | Fecha fin (`YYYY-MM-DD`, max 366 dias desde `startDate`) |

#### Response 200 OK

```json
{
  "period": {
    "startDate": "2026-05-01",
    "endDate": "2026-05-26"
  },
  "totalSales": 187,
  "totalAmount": 2456800.00,
  "totalDiscounts": 45200.00,
  "totalTax": 392656.30,
  "netAmount": 2019143.70,
  "byDay": [
    {
      "date": "2026-05-01",
      "salesCount": 8,
      "amount": 98400.00
    }
  ]
}
```

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | Fechas invalidas o ventana superior a 366 dias |
| 403 | El usuario no tiene rol ADMIN ni SUPERVISOR |

---

### GET /api/v1/reports/sales/by-seller

Reporte de ventas agrupadas por vendedor para un periodo.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, SUPERVISOR

#### Query Parameters

Mismos que `GET /api/v1/reports/sales` (`startDate`, `endDate` requeridos).

#### Response 200 OK

```json
{
  "period": { "startDate": "2026-05-01", "endDate": "2026-05-26" },
  "bySeller": [
    {
      "sellerId": "user-uuid-002",
      "sellerName": "Maria Perez",
      "salesCount": 94,
      "totalAmount": 1234500.00,
      "averageTicket": 13132.98
    },
    {
      "sellerId": "user-uuid-004",
      "sellerName": "Carlos Gomez",
      "salesCount": 93,
      "totalAmount": 1222300.00,
      "averageTicket": 13142.79
    }
  ]
}
```

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | Fechas invalidas o ventana superior a 366 dias |
| 403 | El usuario no tiene rol ADMIN ni SUPERVISOR |

---

### GET /api/v1/reports/sales/by-category

Reporte de ventas agrupadas por categoria de producto para un periodo.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, SUPERVISOR

#### Query Parameters

Mismos que `GET /api/v1/reports/sales` (`startDate`, `endDate` requeridos).

#### Response 200 OK

```json
{
  "period": { "startDate": "2026-05-01", "endDate": "2026-05-26" },
  "byCategory": [
    {
      "categoryId": "cat-uuid-001",
      "categoryName": "Lacteos",
      "salesCount": 312,
      "totalAmount": 856000.00,
      "percentageOfTotal": 34.85
    }
  ]
}
```

---

### GET /api/v1/reports/top-products

Listado de los productos mas vendidos por cantidad o por monto en un periodo.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, SUPERVISOR

#### Query Parameters

| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `startDate` | date | Si | Fecha inicio (`YYYY-MM-DD`) |
| `endDate` | date | Si | Fecha fin (`YYYY-MM-DD`) |
| `limit` | integer | No | Numero de productos a retornar. Default: 10, maximo: 100 |
| `sortBy` | enum | No | `QUANTITY` (default) o `AMOUNT` |

#### Response 200 OK

```json
{
  "period": { "startDate": "2026-05-01", "endDate": "2026-05-26" },
  "limit": 10,
  "products": [
    {
      "rank": 1,
      "productId": "a1b2c3d4-0000-0000-0000-000000000001",
      "productName": "Leche Entera 1L",
      "barcode": "7801234567890",
      "totalQuantitySold": 1240.00,
      "totalAmount": 1302000.00
    }
  ]
}
```

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | `limit` fuera del rango 1–100 o fechas invalidas |
| 403 | El usuario no tiene rol ADMIN ni SUPERVISOR |

---

### GET /api/v1/reports/profit

Reporte de utilidades (margen bruto) para un periodo. Calcula la diferencia entre precio de venta y costo promedio ponderado al momento de cada venta.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, SUPERVISOR

#### Query Parameters

| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `startDate` | date | Si | Fecha inicio (`YYYY-MM-DD`) |
| `endDate` | date | Si | Fecha fin (ventana maxima: 366 dias) |

#### Response 200 OK

```json
{
  "period": { "startDate": "2026-05-01", "endDate": "2026-05-26" },
  "totalRevenue": 2456800.00,
  "totalCost": 1678320.00,
  "grossProfit": 778480.00,
  "grossMarginPercent": 31.69,
  "byCategory": [
    {
      "categoryName": "Lacteos",
      "revenue": 856000.00,
      "cost": 562400.00,
      "profit": 293600.00,
      "marginPercent": 34.30
    }
  ]
}
```

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | Fechas invalidas o ventana superior a 366 dias |
| 403 | El usuario no tiene rol ADMIN ni SUPERVISOR |

---

### GET /api/v1/reports/debtors

Reporte de clientes con deuda activa, ordenados por monto de deuda descendente.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, SUPERVISOR

#### Response 200 OK

```json
{
  "generatedAt": "2026-05-26T14:00:00Z",
  "totalDebtors": 12,
  "totalDebt": 1250000.00,
  "debtors": [
    {
      "customerId": "customer-uuid-001",
      "customerName": "Ana Rodriguez",
      "rut": "12345678-9",
      "phone": "+56987654321",
      "creditLimit": 150000.00,
      "currentDebt": 85000.00,
      "availableCredit": 65000.00,
      "utilizationPercent": 56.67,
      "lastPaymentDate": "2026-05-10"
    }
  ]
}
```

---

### GET /api/v1/reports/stock-critical

Reporte de productos con stock en nivel critico (igual o inferior al minimo configurado).

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, SUPERVISOR, BODEGA

#### Response 200 OK

```json
{
  "generatedAt": "2026-05-26T14:00:00Z",
  "criticalCount": 7,
  "products": [
    {
      "productId": "a1b2c3d4-0000-0000-0000-000000000005",
      "productName": "Aceite Vegetal 1L",
      "barcode": "7809876543210",
      "categoryName": "Aceites",
      "stockCurrent": 3.00,
      "stockMinimum": 10.00,
      "stockMaximum": 80.00,
      "deficit": 7.00,
      "lastPurchaseDate": "2026-04-15"
    }
  ]
}
```

---

### GET /api/v1/reports/export/excel

Exporta un reporte a formato Excel (`.xlsx`) usando Apache POI. El archivo se descarga directamente.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, SUPERVISOR

#### Query Parameters

| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `reportType` | enum | Si | `sales` o `debtors` |
| `startDate` | date | Condicional | Requerido si `reportType=sales` (`YYYY-MM-DD`) |
| `endDate` | date | Condicional | Requerido si `reportType=sales` (`YYYY-MM-DD`) |

#### Response 200 OK

El response tiene `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` y el header `Content-Disposition: attachment; filename="reporte_<tipo>_<fecha>.xlsx"`.

El cuerpo es el stream binario del archivo Excel. No es JSON.

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | `reportType` invalido, fechas faltantes para tipo `sales`, o ventana superior a 366 dias |
| 403 | El usuario no tiene rol ADMIN ni SUPERVISOR |
| 500 | Error al generar el archivo Excel (ver logs del backend) |

---

## Fase 3 — Nuevos Endpoints

Los siguientes endpoints se incorporan en la Fase 3. Prerrequisito: Fase 1 y Fase 2 completas y en funcionamiento.

---

## SSE — Eventos en Tiempo Real

### GET /api/v1/events/stream

Abre un stream Server-Sent Events (SSE) para recibir notificaciones en tiempo real desde el servidor: alertas de stock critico, confirmacion de nuevas ventas, y eventos de actualizacion del dashboard.

**Autenticacion requerida:** Si — via query param `?token=<jwt>` (no via header `Authorization`; limitacion del protocolo SSE en navegadores)
**Roles permitidos:** ADMIN, CAJERO, BODEGA, SUPERVISOR (requiere permiso `SSE_CONNECT`)

> La autenticacion por query param (`?token=`) es la unica opcion viable para `EventSource` nativo en navegadores. `JwtAuthFilter` fue modificado para leer el JWT desde este parametro exclusivamente para la ruta `/events/stream`. El parametro no se registra en logs de acceso.

#### Query Parameters

| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `token` | string | Si | JWT de acceso valido (access token obtenido en `/auth/login`) |

#### Response — 200 OK (text/event-stream)

El endpoint responde con `Content-Type: text/event-stream` y mantiene la conexion abierta. El cuerpo son lineas SSE en el formato estandar:

```
event: STOCK_LOW
data: {"productId":"a1b2c3d4-...","productName":"Leche Entera 1L","stockCurrent":2.0,"stockMinimum":10.0}

event: SALE_CONFIRMED
data: {"saleId":"venta-uuid-001","saleNumber":1043,"totalAmount":2100.0,"sellerId":"user-uuid-002"}

event: DASHBOARD_REFRESH
data: {"triggeredBy":"SALE_CONFIRMED","timestamp":"2026-05-27T10:00:00Z"}

event: HEARTBEAT
data: {}
```

| Tipo de evento | Descripcion | Roles que lo reciben |
|---|---|---|
| `STOCK_LOW` | Stock de un producto cae por debajo del minimo | ADMIN, BODEGA, SUPERVISOR |
| `SALE_CONFIRMED` | Nueva venta confirmada en POS | ADMIN, SUPERVISOR |
| `DASHBOARD_REFRESH` | Senial para que el frontend refresque el dashboard | ADMIN, SUPERVISOR |
| `HEARTBEAT` | Ping periodico para mantener la conexion viva | Todos |

#### Comportamiento del cliente (hook `useSse.ts`)

El hook `useSse.ts` del frontend implementa reconexion con backoff exponencial (inicio: 1 s, maximo: 30 s). Ante un `STOCK_LOW` muestra una notificacion Ant Design de tipo `warning`; ante un `SALE_CONFIRMED` muestra una de tipo `success`.

#### Limites de conexion

El `SseEmitterRegistry` acepta un maximo de **500 conexiones simultaneas**. Al alcanzar el limite, una nueva conexion evicta la conexion mas antigua del mismo usuario antes de registrarse. La metrica `sse.active.connections` (gauge Micrometer) expone el numero actual de conexiones a Prometheus.

#### Errores

| Codigo | Descripcion |
|---|---|
| 401 | Token ausente, expirado o invalido |
| 403 | El usuario no tiene permiso `SSE_CONNECT` |
| 503 | Capacidad maxima de conexiones SSE alcanzada (situacion transitoria) |

---

## Dashboard

### GET /api/v1/dashboard

Retorna los KPIs y datos del dashboard adaptados al rol del usuario autenticado. Un mismo endpoint, un DTO diferente por rol.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, SUPERVISOR, CAJERO, BODEGA (requiere permiso `DASHBOARD_ADMIN` para los roles ADMIN/SUPERVISOR)

> Los datos del dashboard estan cacheados con Caffeine. KPIs del dia: TTL 15 s. Historial semanal/mensual: TTL 1 h. El cache se invalida automaticamente cuando llegan eventos SSE de tipo `SALE_CONFIRMED` o `STOCK_LOW`.

#### Response 200 OK — Rol ADMIN

```json
{
  "role": "ADMIN",
  "generatedAt": "2026-05-27T10:00:00Z",
  "kpis": {
    "salesToday": 47,
    "revenueToday": 485200.00,
    "grossMarginToday": 32.4,
    "lowStockCount": 3,
    "openCashRegisters": 2,
    "activeDebtors": 8,
    "totalDebt": 620000.00
  },
  "salesHistory": [
    { "date": "2026-05-21", "salesCount": 38, "revenue": 390000.00 },
    { "date": "2026-05-22", "salesCount": 42, "revenue": 430000.00 }
  ],
  "topProductsToday": [
    { "rank": 1, "productName": "Leche Entera 1L", "quantitySold": 24.0, "revenue": 25200.00 }
  ]
}
```

#### Response 200 OK — Rol SUPERVISOR

```json
{
  "role": "SUPERVISOR",
  "generatedAt": "2026-05-27T10:00:00Z",
  "kpis": {
    "salesToday": 47,
    "revenueToday": 485200.00,
    "lowStockCount": 3,
    "openCashRegisters": 2
  },
  "salesBySeller": [
    { "sellerName": "Maria Perez", "salesCount": 25, "revenue": 260000.00 },
    { "sellerName": "Carlos Gomez", "salesCount": 22, "revenue": 225200.00 }
  ],
  "lowStockAlerts": [
    { "productName": "Aceite Vegetal 1L", "stockCurrent": 3.0, "stockMinimum": 10.0 }
  ]
}
```

#### Response 200 OK — Rol CAJERO

```json
{
  "role": "CAJERO",
  "generatedAt": "2026-05-27T10:00:00Z",
  "myShift": {
    "cashRegisterId": "cash-uuid-001",
    "status": "OPEN",
    "openedAt": "2026-05-27T08:00:00Z",
    "salesCount": 25,
    "revenueToday": 260000.00,
    "openingBalance": 50000.00,
    "currentExpectedBalance": 88000.00
  }
}
```

#### Response 200 OK — Rol BODEGA

```json
{
  "role": "BODEGA",
  "generatedAt": "2026-05-27T10:00:00Z",
  "stockSummary": {
    "totalProducts": 87,
    "lowStockCount": 3,
    "outOfStockCount": 0
  },
  "lowStockProducts": [
    {
      "productId": "prod-uuid-005",
      "productName": "Aceite Vegetal 1L",
      "barcode": "7809876543210",
      "stockCurrent": 3.0,
      "stockMinimum": 10.0,
      "deficit": 7.0
    }
  ]
}
```

#### Errores

| Codigo | Descripcion |
|---|---|
| 401 | Token ausente o invalido |
| 403 | Rol sin acceso al dashboard |

---

## Auditoria

### GET /api/v1/audit

Lista el historial de auditoria con paginacion y filtros. Solo registra eventos decorados con `@Auditable` en las capas de servicio.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, SUPERVISOR (requiere permiso `AUDIT_READ`)

#### Query Parameters

| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `entityType` | string | No | Filtrar por tipo de entidad auditada (ej: `Product`, `Sale`, `Customer`) |
| `action` | string | No | Filtrar por accion (ej: `CREATE`, `UPDATE`, `DELETE`, `CANCEL`) |
| `userId` | UUID | No | Filtrar por el usuario que realizo la accion |
| `startDate` | ISO-8601 | No | Fecha/hora inicio del rango (ej: `2026-05-01T00:00:00Z`) |
| `endDate` | ISO-8601 | No | Fecha/hora fin del rango |
| `page` | integer | No | Numero de pagina (0-indexed, default: 0) |
| `size` | integer | No | Tamano de pagina (default: 20, maximo: 100) |
| `sort` | string | No | Campo de ordenamiento (default: `createdAt,desc`) |

#### Response 200 OK

```json
{
  "content": [
    {
      "id": "audit-uuid-001",
      "entityType": "Product",
      "entityId": "a1b2c3d4-0000-0000-0000-000000000001",
      "action": "UPDATE",
      "actor": {
        "userId": "user-uuid-001",
        "email": "admin@minimarket.local",
        "roles": ["ADMIN"]
      },
      "ipAddress": "192.168.1.10",
      "before": { "salePrice": 1000.0, "purchasePrice": 750.0 },
      "after": { "salePrice": 1050.0, "purchasePrice": 800.0 },
      "createdAt": "2026-05-27T09:30:00Z"
    }
  ],
  "pageable": { "pageNumber": 0, "pageSize": 20 },
  "totalElements": 342,
  "totalPages": 18,
  "first": true,
  "last": false
}
```

| Campo | Tipo | Descripcion |
|---|---|---|
| `entityType` | string | Nombre de la entidad de dominio afectada |
| `entityId` | UUID | Identificador del registro afectado |
| `action` | string | Accion realizada: `CREATE`, `UPDATE`, `DELETE`, `CANCEL`, `CONFIRM`, u otras segun la operacion |
| `actor` | object | Usuario que ejecuto la operacion |
| `ipAddress` | string | IP del cliente con validacion de proxy trust (no falsificable via `X-Forwarded-For`) |
| `before` | object (JSONB) | Estado del registro antes de la operacion (null en `CREATE`) |
| `after` | object (JSONB) | Estado del registro despues de la operacion (null en `DELETE`) |

#### Comportamiento de la tabla `audit_log`

- Filas inmutables: `REVOKE UPDATE DELETE ON audit_log FROM PUBLIC` — ningun usuario de la aplicacion puede modificar ni eliminar registros de auditoria.
- Indice GIN en las columnas JSONB `before` y `after` para busquedas rapidas por valores especificos.
- El aspecto `AuditAspect` usa `Propagation.REQUIRES_NEW`: el log de auditoria se persiste en una transaccion independiente, garantizando que un rollback del negocio no borre el registro de auditoria.

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | Parametros de fecha invalidos |
| 403 | El usuario no tiene permiso `AUDIT_READ` |

---

## Auditoria — Exportacion Excel

### GET /api/v1/audit/export/excel

Exporta el historial de auditoria filtrado a un archivo `.xlsx`. Acepta los mismos filtros que `GET /api/v1/audit` (excepto `page` y `size` — exporta todos los registros del rango).

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN (requiere permiso `AUDIT_READ`)

#### Query Parameters

| Parametro | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `entityType` | string | No | Filtrar por tipo de entidad |
| `action` | string | No | Filtrar por accion |
| `userId` | UUID | No | Filtrar por usuario |
| `startDate` | ISO-8601 | Si | Fecha inicio del rango. Obligatorio para exportacion |
| `endDate` | ISO-8601 | Si | Fecha fin del rango. Obligatorio para exportacion |

#### Response 200 OK

`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
`Content-Disposition: attachment; filename="audit_log_<startDate>_<endDate>.xlsx"`

El cuerpo es el stream binario del archivo Excel generado con Apache POI. No es JSON.

El archivo incluye las columnas: Fecha/hora, Entidad, ID entidad, Accion, Usuario, Email, IP, Estado anterior (JSON formateado), Estado posterior (JSON formateado).

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | `startDate` o `endDate` ausentes o invalidos |
| 403 | El usuario no tiene rol ADMIN o permiso `AUDIT_READ` |
| 500 | Error al generar el archivo Excel (ver logs del backend) |

---

## Fase 4 — Nuevos Endpoints

Los siguientes endpoints se incorporan en la Fase 4. Prerrequisito: Fases 1, 2 y 3 completas y en funcionamiento, y migraciones V16–V19 aplicadas.

> **Contexto multi-sucursal:** todos los endpoints de Fase 4 respetan el aislamiento RLS. Los usuarios con sucursal asignada solo ven y operan datos de su sucursal. Los usuarios ADMIN con `branchId = null` tienen acceso global a todas las sucursales.

---

## Sucursales

Gestion del catalogo de sucursales de la empresa. Solo el rol ADMIN puede crear, actualizar o desactivar sucursales. La desactivacion es logica (no elimina el registro ni sus datos).

---

### GET /api/v1/branches

Lista todas las sucursales registradas en el sistema.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN, SUPERVISOR

#### Response 200 OK

```json
[
  {
    "id": "00000000-0000-0000-0000-000000000001",
    "name": "Sucursal Principal",
    "address": "Av. Los Leones 1234, Santiago",
    "phone": "+56229876543",
    "rut": "12345678-9",
    "active": true,
    "createdAt": "2026-01-01T00:00:00Z"
  },
  {
    "id": "a3f2e1d0-0000-0000-0000-000000000002",
    "name": "Sucursal Norte",
    "address": "Calle Providencia 456, Santiago",
    "phone": "+56221234567",
    "rut": null,
    "active": true,
    "createdAt": "2026-05-01T10:00:00Z"
  }
]
```

| Campo | Tipo | Descripcion |
|---|---|---|
| `id` | UUID | Identificador de la sucursal |
| `name` | string | Nombre de la sucursal |
| `address` | string o null | Direccion fisica |
| `phone` | string o null | Telefono de contacto |
| `rut` | string o null | RUT de la sucursal (si difiere del RUT de la empresa) |
| `active` | boolean | `true` si la sucursal esta operativa |
| `createdAt` | ISO-8601 | Fecha y hora de creacion |

#### Errores

| Codigo | Descripcion |
|---|---|
| 401 | Token ausente o invalido |
| 403 | El usuario no tiene rol ADMIN ni SUPERVISOR |

---

### POST /api/v1/branches

Crea una nueva sucursal.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN

#### Request Body

```json
{
  "name": "Sucursal Norte",
  "address": "Calle Providencia 456, Santiago",
  "phone": "+56221234567",
  "rut": null
}
```

| Campo | Tipo | Requerido | Restricciones |
|---|---|---|---|
| `name` | string | Si | Max 255 chars. Debe ser unico entre sucursales activas. |
| `address` | string | No | Texto libre, max 500 chars |
| `phone` | string | No | Max 30 chars |
| `rut` | string | No | RUT en formato `XXXXXXXX-X` |

#### Response 201 Created

Objeto `BranchResponse` de la sucursal recien creada (mismo esquema que el listado).

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | Datos invalidos (nombre vacio, formato de RUT incorrecto) |
| 403 | El usuario no tiene rol ADMIN |
| 409 | Ya existe una sucursal activa con ese nombre |

---

### PUT /api/v1/branches/{id}

Actualiza los datos de una sucursal existente.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN

#### Path Parameters

| Parametro | Tipo | Descripcion |
|---|---|---|
| `id` | UUID | Identificador de la sucursal a actualizar |

#### Request Body

Mismo esquema que `POST /api/v1/branches`. Todos los campos son opcionales; los no provistos conservan su valor actual.

#### Response 200 OK

Objeto `BranchResponse` con los datos actualizados.

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | Datos invalidos |
| 403 | El usuario no tiene rol ADMIN |
| 404 | Sucursal no encontrada |
| 409 | El nuevo nombre ya existe en otra sucursal activa |

---

### DELETE /api/v1/branches/{id}

Desactiva una sucursal (marca `active = false`). No elimina el registro ni sus datos historicos.

**Autenticacion requerida:** Si
**Roles permitidos:** ADMIN

#### Path Parameters

| Parametro | Tipo | Descripcion |
|---|---|---|
| `id` | UUID | Identificador de la sucursal a desactivar |

#### Response 204 No Content

Sin cuerpo de respuesta.

> Los usuarios asignados a una sucursal desactivada conservan su `branchId` en la base de datos pero no podran autenticarse correctamente hasta que se les reasigne a una sucursal activa.

#### Errores

| Codigo | Descripcion |
|---|---|
| 400 | Intento de desactivar la unica sucursal activa del sistema |
| 403 | El usuario no tiene rol ADMIN |
| 404 | Sucursal no encontrada |


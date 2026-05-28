# Security Checklist — Fase 2
Fecha de auditoría: 2026-05-26
Auditor: Cybersecurity Auditor Agent (claude-sonnet-4-6)
Módulos auditados: Compras, Caja, Clientes/Crédito, Reportes, Frontend Fase 2, Infraestructura Fase 2

---

## Resumen de Hallazgos

| ID   | Módulo         | Título                                             | Severidad    | Estado     |
|------|----------------|----------------------------------------------------|--------------|------------|
| F2-01 | Clientes      | CAJERO puede establecer límite de crédito en creación | ALTO      | CORREGIDO  |
| F2-02 | Frontend       | Blob Excel descargado sin MIME type explícito       | MEDIO        | CORREGIDO  |
| F2-03 | Infraestructura| restore.sh --yes no registra auditoría             | MEDIO        | CORREGIDO  |
| F2-04 | Caja           | SUPERVISOR puede ver/acceder a caja de cualquier cajero | BAJO    | ACEPTADO   |
| F2-05 | Reportes       | Queries nativas usan parámetros bind (no concatenación) | INFO    | OK         |
| F2-06 | Reportes       | Excel formula injection sanitizado en hoja deudores | INFO        | OK         |
| F2-07 | Compras        | Trigger de BD con lock pesimista implementado       | INFO         | OK         |
| F2-08 | Compras        | PurchaseItemRequest valida cantidad y costo         | INFO         | OK         |
| F2-09 | Compras        | Confirm/Cancel requieren ADMIN o SUPERVISOR         | INFO         | OK         |
| F2-10 | Clientes       | @Version para optimistic locking implementado       | INFO         | OK         |
| F2-11 | Clientes       | Endpoint deudores protegido ADMIN/SUPERVISOR        | INFO         | OK         |
| F2-12 | Infraestructura| Credenciales en backup.sh no expuestas vía CLI      | INFO         | OK         |
| F2-13 | Infraestructura| restore.sh exige doble confirmación interactiva     | INFO         | OK         |
| F2-14 | Reportes       | Export Excel limitado a 366 días (anti-DoS)         | INFO         | OK         |
| F2-15 | Frontend       | Botón "Confirmar compra" oculto a no-ADMIN/SUPERVISOR | INFO       | OK         |
| F2-16 | Frontend       | Botón "Ajustar límite crédito" oculto a CAJERO      | INFO         | OK         |

---

## Detalle de Hallazgos

### [ALTO] F2-01 — CAJERO puede establecer límite de crédito al crear cliente

**Archivo:** `backend/src/main/java/com/minimarket/modules/customers/service/CustomerServiceImpl.java` (línea 54)
`backend/src/main/java/com/minimarket/modules/customers/dto/CustomerRequest.java` (campo `creditLimit`)

**Descripción:**
El endpoint `POST /customers` acepta `creditLimit` en el cuerpo y la implementación lo aplicaba directamente (`request.creditLimit() != null ? request.creditLimit() : BigDecimal.ZERO`). Este endpoint tiene `@PreAuthorize("hasAnyRole('ADMIN','CAJERO','SUPERVISOR')")`, lo que significa que un CAJERO podía crear un cliente con un límite de crédito arbitrario, evitando el control de acceso diferenciado que sí existe en `PATCH /customers/{id}/credit-limit`.

**Riesgo:**
Un cajero malintencionado podría crear un cliente con un límite de crédito de $999.999 y realizar ventas a crédito sin pasar por la aprobación de SUPERVISOR/ADMIN. Impacto financiero directo.

**Corrección aplicada:**
En `CustomerServiceImpl.createCustomer()` se reemplazó el uso de `request.creditLimit()` por `BigDecimal.ZERO` fijo, con comentario explicativo. El campo sigue existiendo en el DTO para no romper compatibilidad del frontend, pero el backend lo ignora en creación.

```java
// ANTES (vulnerable):
.creditLimit(request.creditLimit() != null ? request.creditLimit() : BigDecimal.ZERO)

// DESPUÉS (corregido):
.creditLimit(BigDecimal.ZERO)
```

Adicionalmente, el campo `creditLimit` fue eliminado del formulario de creación en `CustomersPage.tsx` para que la UI sea consistente con la política del backend.

---

### [MEDIO] F2-02 — Blob Excel descargado sin MIME type explícito

**Archivo:** `frontend/src/pages/Reports/ReportsPage.tsx` (líneas ~95, ~485)

**Descripción:**
`new Blob([res.data])` sin argumento de tipo permite al navegador hacer content sniffing. Si el servidor devolviera un payload manipulado (ej. respuesta de error con HTML en vez de binario), el navegador podría interpretarlo como `text/html` y ejecutarlo como página. Aplica tanto al export de ventas como al de deudores.

**Riesgo:**
Content sniffing attack. Si existe una vulnerabilidad en el backend que permita devolver HTML en ese endpoint (ej. redirección a página de login en HTML), el blob podría descargarse y luego abrirse como HTML activo por el usuario. Baja probabilidad pero el fix es trivial.

**Corrección aplicada:**
```typescript
// ANTES:
new Blob([res.data])

// DESPUÉS:
new Blob([res.data], {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
})
```

---

### [MEDIO] F2-03 — restore-postgres.sh sin auditoría al usar --yes

**Archivo:** `infra/scripts/restore-postgres.sh` (bloque `else` del flag `--yes`)

**Descripción:**
El flag `--yes` está pensado para pipelines CI/CD, pero su uso no dejaba rastro de auditoría: no se registraba quién ejecutó la restauración, desde qué host, ni con qué dump. En un incidente post-mortem esto es información crítica para determinar si una restauración fue autorizada o maliciosa.

**Riesgo:**
Imposibilidad de atribuir responsabilidad en una restauración que destruye datos de producción. También facilita que un atacante con acceso al pipeline borre el rastro de un ataque destructivo.

**Corrección aplicada:**
Se añadió bloque de logging de auditoría obligatorio al usar `--yes`, que registra: usuario del SO, UID, hostname, timestamp UTC, y ruta del dump. Este bloque no puede suprimirse.

---

### [BAJO] F2-04 — SUPERVISOR puede ver y acceder a caja de cualquier cajero

**Archivo:** `backend/src/main/java/com/minimarket/modules/cash/controller/CashRegisterController.java` (línea 63)

**Descripción:**
`GET /cash/{registerId}` tiene `@PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")`. No hay verificación de que el registerId pertenezca al usuario consultante. Un SUPERVISOR puede ver el resumen y movimientos de la caja de cualquier cajero. El endpoint `GET /cash/{registerId}/movements` y `GET /cash/{registerId}/summary` no tienen restricción de propiedad.

**Riesgo:**
Violación del principio de mínimo privilegio. Un SUPERVISOR puede ver información financiera de cualquier caja sin que esto quede como una acción autorizada explícita. Para el modelo de negocio de un minimarket, supervisores sí deben poder auditar cualquier caja — esto es un riesgo aceptable y diseñado intencionalmente.

**Decisión:** ACEPTADO. El rol SUPERVISOR es por definición un rol de auditoría de caja. Se recomienda en todo caso agregar un log de auditoría cuando un SUPERVISOR accede a la caja de otro usuario (`log.info("Supervisor {} accessed cash register {} (owner: {})")`).

---

## Controles Correctamente Implementados (Hallazgos INFORMATIVOS)

### F2-05 — Queries nativas sin SQL injection (EntityManager)
**Archivo:** `backend/src/main/java/com/minimarket/modules/reports/service/ReportServiceImpl.java`

Todas las queries nativas de `ReportServiceImpl` usan `setParameter("start", ...)` y `setParameter("end", ...)` — parámetros bind posicionales de JPA. Ningún string de entrada del usuario se concatena en el SQL. El parámetro `limit` en `getTopProducts` es un `int` clampado a `[1, 100]` en el controlador antes de llegar al servicio. No hay riesgo de SQL injection.

### F2-06 — Excel formula injection sanitizado
**Archivo:** `backend/src/main/java/com/minimarket/modules/reports/service/ExcelExportService.java`

El método `sanitizeExcelCell()` (línea 215) antepone una comilla simple a cualquier celda que comience con `=`, `+`, `-`, `@`, `\t`, `\r`. Este método se aplica correctamente en `generateDebtorsExcel()` sobre `fullName` y `rut`. Los campos numéricos (`creditLimit`, `creditUsed`, `available`) usan `setCellValue(double)` — no pasan por `sanitizeExcelCell` porque son double, lo cual es correcto (los números no pueden ser fórmulas).

Nota: `generateSalesExcel` no contiene strings controlables por usuarios (solo fechas de sistema y números), por lo que la ausencia de `sanitizeExcelCell` en esa hoja no es un riesgo.

### F2-07 — Trigger de BD con lock pesimista
**Archivo:** `backend/src/main/resources/db/migration/V7__create_purchases_schema.sql` (línea 235)

`fn_confirm_purchase()` usa `SELECT ... FOR UPDATE` sobre `products` antes de recalcular el costo promedio ponderado. Esto serializa las actualizaciones de stock concurrentes correctamente. El trigger solo se activa en la transición `DRAFT → CONFIRMED` (cláusula `WHEN (OLD.status = 'DRAFT' AND NEW.status = 'CONFIRMED')`), evitando re-ejecución en actualizaciones no relacionadas.

### F2-08 — Validaciones en PurchaseItemRequest
**Archivo:** `backend/src/main/java/com/minimarket/modules/purchases/dto/PurchaseItemRequest.java`

- `quantity`: `@DecimalMin("0.001")` + `@DecimalMax("99999.999")` — previene cantidades cero, negativas, y unreasonably large.
- `unitCost`: `@DecimalMin("0.0001")` + `@DecimalMax("9999999.9999")` — previene costos negativos o absurdamente altos.
- Restricción adicional a nivel BD: `CHECK (quantity > 0)` y `CHECK (unit_cost > 0)` en `purchase_details`.

### F2-09 — Control de acceso en confirm/cancel compra
**Archivo:** `backend/src/main/java/com/minimarket/modules/purchases/controller/PurchaseController.java` (líneas 43, 49)

- `PATCH /purchases/{id}/confirm`: `@PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")` — BODEGA y CAJERO excluidos correctamente.
- `PATCH /purchases/{id}/cancel`: ídem.
- Frontend: `const canConfirm = hasRole('ADMIN', 'SUPERVISOR')` oculta el botón a roles inferiores. El comentario en el código indica explícitamente que BODEGA fue considerado y excluido.

### F2-10 — @Version para optimistic locking en Customer
**Archivo:** `backend/src/main/java/com/minimarket/modules/customers/domain/Customer.java` (línea 53)

`@Version` sobre campo `version: Long` implementado correctamente. El servicio decora `registerPayment` con `@Retryable(retryFor = ObjectOptimisticLockingFailureException.class, maxAttempts = 3, backoff = @Backoff(delay = 100))` — adecuado para el patrón de concurrencia optimista en actualizaciones de crédito.

### F2-11 — Endpoint /customers/debtors protegido y con datos mínimos
**Archivo:** `backend/src/main/java/com/minimarket/modules/customers/controller/CustomerController.java` (línea 93)
`backend/src/main/java/com/minimarket/modules/customers/dto/CustomerDebtResponse.java`

`GET /customers/debtors`: `@PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")`. El DTO expone únicamente: `customerId`, `fullName`, `rut`, `creditLimit`, `creditUsed`, `available`, `lastPaymentDate`. No incluye teléfono, email, dirección, ni datos financieros más allá del crédito. Exposición mínima necesaria para el propósito del endpoint.

### F2-12 — Credenciales de backup no expuestas en argumentos CLI
**Archivo:** `infra/scripts/backup-postgres.sh` (línea 121)

`pg_dump` recibe la contraseña mediante `export PGPASSWORD="$POSTGRES_PASSWORD"` y la limpia con `unset PGPASSWORD` inmediatamente después. La contraseña nunca aparece en los argumentos de línea de comandos (visible en `ps aux`). Correcto.

### F2-13 — restore.sh requiere doble confirmación
**Archivo:** `infra/scripts/restore-postgres.sh` (líneas 159-169)

Doble confirmación implementada: primero requiere escribir literalmente `RESTAURAR`, luego una segunda confirmación `[s/N]`. Difícil de confirmar accidentalmente. El flag `--yes` existe para automatización pero ahora deja rastro de auditoría (F2-03 corregido).

### F2-14 — Export Excel limitado a 366 días
**Archivo:** `backend/src/main/java/com/minimarket/modules/reports/controller/ReportController.java` (línea 109)

`ChronoUnit.DAYS.between(start, end) > 366` lanza `BusinessException`. Previene ataques de agotamiento de recursos mediante rangos de fechas enormes. El parámetro `REPORT_MAX_EXPORT_ROWS` existe en `docker-compose.staging.yml` para un control adicional a nivel de configuración.

### F2-15 — Botón "Confirmar compra" protegido por rol en frontend
**Archivo:** `frontend/src/pages/Purchases/PurchasesPage.tsx` (línea 56)

`const canConfirm = hasRole('ADMIN', 'SUPERVISOR')` — el botón de confirmación no se renderiza si el usuario no tiene el rol adecuado. Defence-in-depth frente al control server-side.

### F2-16 — Botón "Ajustar límite crédito" protegido por rol en frontend
**Archivo:** `frontend/src/pages/Customers/CustomersPage.tsx` (línea 319)

`{canEditLimit && (<Tooltip title="Ajustar límite crédito">...)}` — el botón solo se renderiza para ADMIN y SUPERVISOR. Coherente con el `@PreAuthorize` del backend.

---

## Pendientes y Recomendaciones

### Recomendaciones de Hardening

1. **[RECOMENDADO]** Agregar logging de auditoría en `CashRegisterServiceImpl` cuando SUPERVISOR accede a caja ajena:
   ```java
   if (!register.getCashierId().equals(userId)) {
       log.info("Supervisor {} accessed cash register {} (owner: {})",
                userId, registerId, register.getCashierId());
   }
   ```

2. **[RECOMENDADO]** El campo `creditLimit` en `CustomerRequest` debería eliminarse o marcarse como `@JsonIgnore` en la deserialización para evitar confusión futura. Actualmente es ignorado en el servicio, pero un desarrollador nuevo podría volver a habilitarlo sin entender el contexto de seguridad.

3. **[RECOMENDADO]** El script `restore-postgres.sh` debería redirigir la salida del bloque de auditoría a un log persistente (no solo stdout), para que sea recuperable si el terminal se cierra.

4. **[ACEPTADO — FASE ANTERIOR]** Tokens en localStorage: pendiente migración a HttpOnly cookies (registrado en Fase 1).

5. **[ACEPTADO — FASE ANTERIOR]** Swagger UI accesible para todos los autenticados: pendiente bloqueo en perfil de producción (registrado en Fase 1).

---

## Métricas

- Total hallazgos: 16
- Críticos: 0
- Altos: 1 (CORREGIDO)
- Medios: 2 (CORREGIDOS)
- Bajos: 1 (ACEPTADO)
- Informativos: 12 (todos OK)

**Correcciones aplicadas en disco: 4**
1. `backend/.../customers/service/CustomerServiceImpl.java` — creditLimit forzado a ZERO en creación
2. `frontend/.../Reports/ReportsPage.tsx` — MIME type explícito en Blob (export ventas y deudores)
3. `frontend/.../Customers/CustomersPage.tsx` — campo creditLimit eliminado del formulario de creación
4. `infra/scripts/restore-postgres.sh` — logging de auditoría obligatorio en modo --yes

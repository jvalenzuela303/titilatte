# Security Checklist — Fase 3

**Fecha de auditoría:** 2026-05-27  
**Auditor:** Cybersecurity Auditor Agent (Claude Sonnet 4.6)  
**Módulos auditados:** SSE, Auditoría (AOP), Dashboard, Frontend SSE, Caché  
**Correcciones aplicadas en disco:** 5 archivos modificados

---

## Resumen Ejecutivo

La Fase 3 introduce tres módulos de mayor superficie de ataque que las fases anteriores: SSE (conexiones persistentes), auditoría AOP (captura masiva de datos), y dashboard con caché compartido. Se identificaron **2 hallazgos CRÍTICOS** (ambos corregidos), **3 ALTOS** (todos corregidos), **2 MEDIOS** y **3 INFORMACIONALES**.

El riesgo más severo fue la combinación de dos fallos en SSE: el `JwtAuthFilter` no leía query params, dejando el endpoint de streaming sin autenticación efectiva; y el registry podía crecer sin límite permitiendo agotamiento de memoria. Ambos se corrigieron en esta sesión.

---

## Hallazgos por Severidad

---

### CRITICO

#### [F3-C01] JwtAuthFilter no autenticaba tokens SSE enviados como query param

**Archivo:** `backend/src/main/java/com/minimarket/security/JwtAuthFilter.java`  
**Descripción:** El `EventSource` del navegador no permite enviar cabeceras `Authorization`. El frontend enviaba el JWT como `?token=` en la URL. El `JwtAuthFilter` solo inspeccionaba la cabecera `Authorization: Bearer` — si no la encontraba, llamaba `filterChain.doFilter()` sin autenticar al usuario. Spring Security rechazaba entonces la request con 403 (ya que el endpoint requiere autenticación), haciendo que SSE nunca funcionara. Sin embargo, si en algún momento se agregara una regla `permitAll` en `/events/stream` por conveniencia, el endpoint quedaría expuesto sin autenticación real.  
**Riesgo:** Posibilidad de saltarse autenticación SSE si se relajan reglas futuras. En el estado actual, el endpoint es inaccesible para todos (incluidos usuarios legítimos).  
**Estado:** CORREGIDO. El filtro ahora acepta el token via `?token=` exclusivamente para `/events/stream`, con la misma validación criptográfica que el header.  
**Corrección aplicada:**
```java
// Solo para /events/stream — ningún otro endpoint acepta token por query param
} else if ("/events/stream".equals(request.getServletPath())) {
    String tokenParam = request.getParameter("token");
    if (tokenParam == null || tokenParam.isBlank()) {
        filterChain.doFilter(request, response);
        return;
    }
    jwt = tokenParam;
}
```

---

#### [F3-C02] SseEmitterRegistry sin límite de conexiones — agotamiento de memoria

**Archivo:** `backend/src/main/java/com/minimarket/sse/SseEmitterRegistry.java`  
**Descripción:** El `ConcurrentHashMap<UUID, SseEmitter>` crecía sin restricción. Un atacante con múltiples tokens válidos (cuentas de prueba, tokens comprometidos) podría abrir miles de conexiones SSE, cada una mantenida por el servidor durante hasta 5 minutos. Adicionalmente, si un mismo usuario abría una segunda pestaña, el emitter anterior quedaba en el mapa sin ser cerrado (leak de conexión).  
**Riesgo:** Agotamiento de memoria del proceso JVM (OutOfMemoryError). Denegación de servicio para todos los usuarios.  
**Estado:** CORREGIDO. Se agregó límite global de 500 conexiones y cierre explícito del emitter previo antes de registrar uno nuevo.  
**Corrección aplicada:**
```java
private static final int MAX_GLOBAL_CONNECTIONS = 500;

public void register(UUID userId, SseEmitter emitter) {
    if (emitters.size() >= MAX_GLOBAL_CONNECTIONS) {
        log.warn("SSE connection limit reached ({}/{}). Rejecting userId={}",
                emitters.size(), MAX_GLOBAL_CONNECTIONS, userId);
        emitter.complete();
        return;
    }
    SseEmitter previous = emitters.get(userId);
    if (previous != null) {
        try { previous.complete(); } catch (Exception ignored) {}
    }
    emitters.put(userId, emitter);
    ...
}
```

---

### ALTO

#### [F3-A01] IP Spoofing en audit log via X-Forwarded-For no validado

**Archivo:** `backend/src/main/java/com/minimarket/audit/aspect/AuditAspect.java`  
**Descripción:** `resolveClientIp()` tomaba el primer valor del header `X-Forwarded-For` sin verificar si la request provenía de un proxy confiable. Cualquier cliente podía enviar `X-Forwarded-For: 127.0.0.1` o `X-Forwarded-For: 10.0.0.1` y el audit log registraría esa IP falsa, invalidando la trazabilidad forense. El primer valor en XFF es siempre el que pone el cliente — solo el último valor (agregado por Nginx) es confiable.  
**Riesgo:** Evasión de trazabilidad en el audit log. Un actor malicioso que realice operaciones sensibles puede suplantar su IP real por la del servidor, localhost, o cualquier otra.  
**Estado:** CORREGIDO. `resolveClientIp()` ahora solo respeta XFF/X-Real-IP cuando el peer directo (`getRemoteAddr()`) pertenece a rangos privados de Docker (proxy interno confiable). Cuando el cliente es externo, se usa directamente `getRemoteAddr()`. Además se toma el último valor de XFF en lugar del primero.  
**CWE:** CWE-290 (Authentication Bypass by Spoofing)

---

#### [F3-A02] DashboardController sin @PreAuthorize — sin enforcement en capa HTTP

**Archivo:** `backend/src/main/java/com/minimarket/dashboard/controller/DashboardController.java`  
**Descripción:** `GET /dashboard` no tenía `@PreAuthorize`. Cualquier token autenticado válido (incluyendo roles no contemplados en el diseño del dashboard) podía llamar al endpoint. La segmentación por rol se hacía únicamente dentro del servicio — si la lógica de `getDashboardForCurrentUser()` no reconocía el rol, caía al branch del cajero y ejecutaba `getCashierDashboard()` sin ser cajero, potencialmente exponiéndose a datos de caja ajena si el routing cambiara.  
**Riesgo:** Falta de defensa en profundidad. Un cambio futuro en la lógica del servicio podría exponer datos sin que la capa HTTP lo impida.  
**Estado:** CORREGIDO. Agregado `@PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'CAJERO', 'BODEGA')")`.

---

#### [F3-A03] Soft-delete de producto no invalida caché — stale data

**Archivo:** `backend/src/main/java/com/minimarket/modules/products/service/ProductServiceImpl.java`  
**Descripción:** `findByBarcode()` usa `@Cacheable(value = "products-catalog", key = "#barcode")` con TTL de 5 minutos. El método `delete()` hacía soft-delete en la DB pero **no tenía `@CacheEvict`**, a diferencia del método `update()` que sí lo tenía. Un producto soft-eliminado podría seguir siendo encontrado por barcode desde caché hasta 5 minutos después, permitiendo su uso en nuevas ventas o consultas cuando ya no debería estar disponible.  
**Riesgo:** Venta de productos eliminados. Inconsistencia de inventario. Exposición de datos de stock obsoletos.  
**Estado:** CORREGIDO. Agregado `@CacheEvict(value = "products-catalog", allEntries = true)` en el método `delete()`.

---

### MEDIO

#### [F3-M01] JWT en URL del EventSource expuesto en historial del navegador y access logs

**Archivo:** `frontend/src/hooks/useSse.ts` (línea 27)  
**Descripción:** La API nativa `EventSource` del navegador no permite enviar cabeceras personalizadas, por lo que el JWT se envía como query param: `?token=<jwt>`. Esto expone el token en: (a) historial del navegador, (b) access logs de Nginx/Spring Boot si se registra la URL completa, (c) Referrer header si el usuario navega desde la app a un sitio externo, (d) proxies intermedios que logueen URLs.  
**Riesgo:** Filtración del access token. Dado que el JWT tiene vida corta (15 min según Fase 1), el impacto es limitado pero real en entornos con logging verboso.  
**Recomendación:** A mediano plazo, migrar SSE a una implementación con ticket de un solo uso: el cliente solicita un token de corta vida (`POST /events/ticket`) que el servidor valida al establecer la conexión, sin exponer el JWT principal en la URL. Esto elimina la exposición del token en logs.  
**Corrección propuesta (Fase 4):**
```java
// POST /events/ticket (autenticado con JWT en header)
// Devuelve: { "ticket": "uuid-de-un-solo-uso", "expiresIn": 30 }
// GET /events/stream?ticket=uuid — el servidor canjea el ticket por userId
```
**Nota:** No se modifica en esta fase porque requiere cambio de arquitectura. El riesgo es aceptable dado el TTL corto del JWT.

---

#### [F3-M02] Ausencia de rate-limiting en GET /events/stream

**Archivo:** `backend/src/main/java/com/minimarket/sse/SseController.java`  
**Descripción:** No hay rate-limiting por usuario ni por IP en el endpoint SSE. Un usuario legítimo podría abrir y cerrar conexiones en un bucle rápido, generando carga innecesaria. El límite global de 500 conexiones (F3-C02) mitiga el agotamiento de memoria, pero no el CPU overhead de establecer y derribar conexiones.  
**Riesgo:** Degradación de rendimiento. DoS parcial si el atacante tiene múltiples cuentas.  
**Recomendación:** Configurar en Nginx `limit_req_zone` para `/events/stream`:
```nginx
limit_req_zone $binary_remote_addr zone=sse:10m rate=5r/m;
limit_req zone=sse burst=3 nodelay;
```

---

### INFORMACIONAL

#### [F3-I01] Token JWT en URL genera entradas en access log de Nginx con el JWT completo

**Archivo:** `infra/nginx/` (configuración de access log)  
**Descripción:** Nginx por defecto registra la URL completa incluyendo query params. Los access logs contendrán líneas como `GET /api/v1/events/stream?token=eyJ...`. Si los logs se retienen o envían a sistemas de monitoreo externos (ELK, Grafana Loki, etc.), el JWT queda expuesto.  
**Recomendación:** Agregar una regla en `nginx.conf` para enmascarar el parámetro `token` en los logs:
```nginx
map $request_uri $loggable_uri {
    ~^(?P<path>/api/v1/events/stream)\?.*  "$path?token=REDACTED";
    default                                 $request_uri;
}
log_format main '$remote_addr - $remote_user [$time_local] "$request_method $loggable_uri $server_protocol" ...';
```

---

#### [F3-I02] showNotification en useSse.ts — sin riesgo XSS con Ant Design notification API

**Archivo:** `frontend/src/hooks/useSse.ts` (línea 68-101)  
**Descripción:** Los valores de evento SSE (`event.data.productName`, `event.data.cashierName`, etc.) se interpolan con `String()` en los campos `description` y `message` de `notification` de Ant Design. La API de `notification` de Ant Design renderiza el contenido como texto plano (no como HTML), por lo que la inyección de etiquetas HTML o scripts no produce XSS. No obstante, si en el futuro se cambia a renderizado con `dangerouslySetInnerHTML` o React node, el riesgo aparecería.  
**Recomendación:** Mantener el patrón actual de `String()`. Si se requieren notificaciones con HTML rico, sanitizar con DOMPurify antes.

---

#### [F3-I03] AuditAspect captura old/new value mediante reflexión sobre findById — riesgo potencial si se agrega @Auditable a UserService

**Archivo:** `backend/src/main/java/com/minimarket/audit/aspect/AuditAspect.java` (línea 114-126)  
**Descripción:** `captureOldValue()` invoca por reflexión el método `findById(UUID)` del servicio objetivo y serializa el resultado completo a JSON para guardarlo en `old_value`. Actualmente `@Auditable(captureOldValue = true)` solo se usa en `ProductServiceImpl.update()`, que devuelve un `ProductResponse` DTO (sin datos sensibles). Si en el futuro se agrega `@Auditable(captureOldValue = true)` a `UserServiceImpl.updatePassword()` y este devuelve el objeto `User` o `UserResponse` con el hash BCrypt, el hash quedaría registrado en `audit_log`.  
**Recomendación:** Agregar validación en `captureOldValue()` para rechazar entityTypes que impliquen datos sensibles, o documentar explícitamente que los métodos anotados con `captureOldValue = true` deben retornar solo DTOs de presentación:
```java
private static final Set<String> SENSITIVE_ENTITY_TYPES = Set.of("USER", "AUTH");

private Object captureOldValue(ProceedingJoinPoint joinPoint, UUID entityId, String entityType) {
    if (SENSITIVE_ENTITY_TYPES.contains(entityType.toUpperCase())) {
        log.debug("Skipping old value capture for sensitive entity type: {}", entityType);
        return null;
    }
    // ... resto del método
}
```

---

## Análisis de Hallazgos NO Confirmados (falsos positivos)

| Pregunta del brief | Resultado |
|---|---|
| ¿El Cajero puede ver datos de otros cajeros? | NO. `getCashierDashboard(userId)` filtra por `userId` propio. No hay `@Cacheable` en este método. Confirmado seguro. |
| ¿Los queries nativos del dashboard son seguros contra SQL injection? | SI. Todos los queries usan JPA bind parameters (`:start`, `:end`, `:userId`). No hay concatenación de strings. |
| ¿El caché puede servir datos de un usuario a otro? | NO. Admin usa key `'admin-today'` (solo ADMIN llama ese método). `getCashierDashboard` no está cacheado. History usa claves globales de datos compartidos (correcto). |
| ¿`old_value`/`new_value` pueden contener contraseñas? | NO en la implementación actual. `@Auditable` no se usa en UserService. Documentado como riesgo futuro en [F3-I03]. |
| ¿La tabla audit_log está protegida? | SI. `V12__create_audit_schema.sql` tiene `REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC`. Correcto. |
| ¿El export de auditoría tiene límite de filas? | SI. `MAX_EXPORT_ROWS = 10_000` en `AuditServiceImpl`. Correcto. |
| ¿Las notificaciones toast pueden usarse para XSS? | NO. Ant Design `notification` API usa texto plano. Ver [F3-I02]. |

---

## Archivos Modificados en Esta Sesión

| Archivo | Hallazgo | Cambio |
|---|---|---|
| `backend/.../security/JwtAuthFilter.java` | F3-C01 | Soporte de token SSE via query param solo para `/events/stream` |
| `backend/.../sse/SseEmitterRegistry.java` | F3-C02 | Límite global 500 conexiones + cierre del emitter previo |
| `backend/.../audit/aspect/AuditAspect.java` | F3-A01 | IP resolution con validación de proxy confiable |
| `backend/.../dashboard/controller/DashboardController.java` | F3-A02 | Agregado `@PreAuthorize("hasAnyRole(...)")` |
| `backend/.../products/service/ProductServiceImpl.java` | F3-A03 | Agregado `@CacheEvict` en método `delete()` |

---

## Métricas

| Severidad | Total | Corregidos | Pendientes |
|---|---|---|---|
| CRITICO | 2 | 2 | 0 |
| ALTO | 3 | 3 | 0 |
| MEDIO | 2 | 0 | 2 (F3-M01 arquitectural/Fase 4, F3-M02 Nginx config) |
| INFORMACIONAL | 3 | 0 | 3 (recomendaciones) |
| **TOTAL** | **10** | **5** | **5** |

---

## Pendientes para Fases Siguientes

1. **[Fase 4 — MEDIO]** Implementar mecanismo de ticket de un solo uso para SSE en lugar de JWT en URL (F3-M01).
2. **[Fase 4 — MEDIO]** Configurar `limit_req_zone` en Nginx para `/events/stream` (F3-M02).
3. **[Fase 4 — INFORMACIONAL]** Enmascarar `?token=` en access logs de Nginx (F3-I01).
4. **[Fase 4 — INFORMACIONAL]** Agregar guardia de entityType sensible en `captureOldValue()` (F3-I03).
5. **[Pendiente de Fases anteriores]** Migrar tokens de localStorage a HttpOnly cookies.
6. **[Pendiente de Fases anteriores]** Bloquear Swagger UI en perfil de producción.
7. **[Pendiente de Fases anteriores]** Configurar HTTPS/TLS en Nginx.

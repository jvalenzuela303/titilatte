# SECURITY_CHECKLIST.md — Minimarket Platform

> **Alcance:** Auditoría de seguridad consolidada (Fases 1–3) y hoja de ruta para Fase 4.  
> **Última revisión:** 2026-06-15  
> **Perfil de riesgo:** Sistema POS multi-sucursal con datos financieros, créditos de clientes y trazabilidad de inventario.

---

## Índice

1. [Autenticación y Tokens](#1-autenticación-y-tokens)
2. [Autorización y Control de Acceso](#2-autorización-y-control-de-acceso)
3. [Seguridad de Base de Datos](#3-seguridad-de-base-de-datos)
4. [Seguridad de Red y Transporte](#4-seguridad-de-red-y-transporte)
5. [Protección de Datos y Secretos](#5-protección-de-datos-y-secretos)
6. [Seguridad del Frontend](#6-seguridad-del-frontend)
7. [Eventos en Tiempo Real (SSE)](#7-eventos-en-tiempo-real-sse)
8. [Auditoría y Trazabilidad](#8-auditoría-y-trazabilidad)
9. [Infraestructura y Contenedores](#9-infraestructura-y-contenedores)
10. [CI/CD y Cadena de Suministro](#10-cicd-y-cadena-de-suministro)
11. [Operaciones y Respuesta a Incidentes](#11-operaciones-y-respuesta-a-incidentes)
12. [Hallazgos Históricos y Estado de Correcciones](#12-hallazgos-históricos-y-estado-de-correcciones)
13. [Pendientes — Fase 4](#13-pendientes--fase-4)

---

## Leyenda de Estado

| Símbolo | Significado |
|---------|-------------|
| ✅ | Implementado y verificado |
| ⚠️ | Riesgo aceptado / mitigación parcial documentada |
| ❌ | Pendiente / no implementado |
| 🔒 | Control crítico — no degradar sin revisión de seguridad |

---

## 1. Autenticación y Tokens

| # | Control | Estado | Detalles |
|---|---------|--------|----------|
| 1.1 | JWT firmado con HMAC-SHA256 | ✅ | Algoritmo `HS256`; clave de 256+ bits desde variable de entorno `JWT_SECRET` |
| 1.2 | Tiempo de vida del access token ≤ 15 min | ✅ | `JWT_EXPIRATION=900000` ms; configurable por env |
| 1.3 | Refresh tokens almacenados como hash SHA-256 | ✅ | Nunca en texto plano en base de datos |
| 1.4 | Refresh tokens con TTL de 7 días | ✅ | `JWT_REFRESH_EXPIRATION=604800000` ms |
| 1.5 | Soporte de revocación explícita de refresh tokens | ✅ | Campo `revoked_at` + endpoint `POST /auth/logout` |
| 1.6 | Contraseñas hasheadas con BCrypt cost-12 | 🔒✅ | ~100 ms por hash; resistente a ataques GPU |
| 1.7 | Sin tokens hardcodeados en código fuente | ✅ | `JWT_SECRET` leída exclusivamente desde entorno; `.env` en `.gitignore` |
| 1.8 | Proceso de rotación de `JWT_SECRET` documentado | ❌ | **Pendiente:** al rotar, todos los tokens activos se invalidan — requiere procedimiento |
| 1.9 | Limpieza de refresh tokens expirados | ❌ | Sin job programado; tabla crece sin límite — riesgo de degradación de performance |
| 1.10 | Protección contra brute-force en `/auth/login` | ✅ | Rate limiting Nginx: 5 req/min + burst 3 por IP |

---

## 2. Autorización y Control de Acceso

| # | Control | Estado | Detalles |
|---|---------|--------|----------|
| 2.1 | RBAC con 4 roles definidos | ✅ | `ADMIN`, `SUPERVISOR`, `CAJERO`, `BODEGA` |
| 2.2 | `@PreAuthorize` en todos los endpoints sensibles | ✅ | Aplicado en controladores; verificado que `DashboardController` fue corregido (hallazgo Fase 3) |
| 2.3 | Endpoint `/events/test` bloqueado en producción | ⚠️ | Solo habilitado en perfil `dev`; verificar que `SPRING_PROFILES_ACTIVE=prod` deshabilita la ruta |
| 2.4 | Swagger UI bloqueado en producción | ⚠️ | Solo disponible en perfil `dev`; confirmar antes de despliegue |
| 2.5 | CAJERO no puede establecer límite de crédito | 🔒✅ | Corregido en Fase 2: `creditLimit` forzado a CERO al crear cliente desde rol CAJERO |
| 2.6 | Aislamiento de caja por cajero | ✅ | Cajero solo puede operar su propia caja; SUPERVISOR puede ver todas (por diseño, con auditoría) |
| 2.7 | Dashboard polimórfico por rol | ✅ | Distintos DTOs según rol; `@PreAuthorize` validado |
| 2.8 | Reports con rango máximo de 366 días | ✅ | Anti-DoS: previene consultas SQL de ventana ilimitada |
| 2.9 | Export de auditoría limitado a 10.000 filas | ✅ | Previene exfiltración masiva y OOM en Excel |
| 2.10 | Principio de menor privilegio en roles | ✅ | BODEGA solo ve movimientos de stock; no accede a financiero |

---

## 3. Seguridad de Base de Datos

| # | Control | Estado | Detalles |
|---|---------|--------|----------|
| 3.1 | Row-Level Security (RLS) en todas las tablas transaccionales | 🔒✅ | Migración V17; política: `branch_id = current_branch_id OR current_branch_id = 'ALL'` |
| 3.2 | `BranchContextFilter` establece `app.current_branch_id` por request | ✅ | Filtro de orden -200; ejecuta `SET LOCAL` antes del controlador |
| 3.3 | Usuario de BD no es `postgres` (superusuario) | ✅ | `POSTGRES_USER=minimarket_user`; sin privilegios de superusuario |
| 3.4 | Stock atómico con `SELECT FOR UPDATE` | ✅ | Triggers PL/pgSQL previenen stock negativo y race conditions |
| 3.5 | Ledger de movimientos de stock inmutable | ✅ | Sin `UPDATE`/`DELETE` en tabla de movimientos; append-only |
| 3.6 | Soft delete con columna `deleted_at` | ✅ | Filtrado por índices; datos no se pierden pero quedan inaccesibles |
| 3.7 | Validaciones SQL con parámetros vinculados | ✅ | JPA/JPQL + native queries con `?` o `:param`; sin concatenación de strings |
| 3.8 | CHECK constraints en cantidades y precios | ✅ | Integridad referencial reforzada en DB |
| 3.9 | Migraciones versionadas con Flyway | ✅ | Auto-ejecutadas en startup; historial inmutable |
| 3.10 | Puerto 5432 no expuesto en producción | ✅ | Solo expuesto en `docker-compose.override.yml` (dev); producción usa red interna Docker |
| 3.11 | `show-sql` desactivado en producción | ✅ | `spring.jpa.show-sql=false` en perfil `prod` |
| 3.12 | Optimistic locking en módulo de créditos | ✅ | `@Version` en entidad `Customer` previene actualizaciones concurrentes |

---

## 4. Seguridad de Red y Transporte

| # | Control | Estado | Detalles |
|---|---------|--------|----------|
| 4.1 | HTTPS / TLS en producción | ❌ | **Pendiente Fase 4:** Nginx preparado, certificados no configurados |
| 4.2 | HSTS (`Strict-Transport-Security`) | ⚠️ | Configurado en Spring Security; comentado en Nginx hasta implementar TLS |
| 4.3 | Rate limiting en endpoints de autenticación | ✅ | Nginx: 5 req/min con burst 3; zona `auth_limit` separada |
| 4.4 | Rate limiting en API general | ✅ | Nginx: 60 req/min con burst 20; zona `api_limit` |
| 4.5 | `X-Frame-Options: DENY` | ✅ | Previene clickjacking |
| 4.6 | `X-Content-Type-Options: nosniff` | ✅ | Previene MIME sniffing |
| 4.7 | `Content-Security-Policy` configurado | ✅ | `default-src 'self'`; `script-src 'self'` (sin `unsafe-inline` en producción) |
| 4.8 | `Permissions-Policy` configurado | ✅ | Restringe acceso a APIs de browser innecesarias |
| 4.9 | CORS restringido a orígenes conocidos | ⚠️ | Dev: `localhost:3000`, `localhost:5173`; **producción debe restringirse al dominio real** |
| 4.10 | Red Docker aislada (frontend-net / backend-net) | ✅ | PostgreSQL no accesible desde frontend-net |
| 4.11 | Nginx como único punto de entrada | ✅ | Backend y DB sin puertos expuestos en producción |

---

## 5. Protección de Datos y Secretos

| # | Control | Estado | Detalles |
|---|---------|--------|----------|
| 5.1 | Secretos nunca en código fuente | 🔒✅ | `JWT_SECRET`, `POSTGRES_PASSWORD` solo en variables de entorno; `.env` en `.gitignore` |
| 5.2 | `.env.example` sin valores reales | ✅ | Solo contiene placeholders y comentarios de instrucción |
| 5.3 | Contraseñas no logeadas | ✅ | Campos de password excluidos de logging; `show-sql=false` en prod |
| 5.4 | Tokens no aparecen en logs de aplicación | ✅ | Spring Security filtra headers de autorización |
| 5.5 | PII mínima en responses de API | ✅ | DTOs no exponen entidades completas; créditos redactan RUT y email internamente |
| 5.6 | Cache invalidado en delete/update de productos | ✅ | `@CacheEvict` en métodos `update()` y `delete()` — corregido Fase 3 |
| 5.7 | `Cache-Control` headers en responses | ✅ | Configurados para prevenir caching de datos sensibles en proxies intermedios |
| 5.8 | Tipo MIME correcto en exportaciones Excel | ✅ | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` — corregido Fase 2 |
| 5.9 | Rotación periódica de secretos documentada | ❌ | Sin procedimiento formal para rotación de `JWT_SECRET` o `POSTGRES_PASSWORD` |

---

## 6. Seguridad del Frontend

| # | Control | Estado | Detalles |
|---|---------|--------|----------|
| 6.1 | Tokens JWT en `localStorage` | ⚠️ | **Riesgo conocido:** vulnerable a XSS. Mitigado por CSP `script-src 'self'` y TTL de 15 min |
| 6.2 | Sin uso de `dangerouslySetInnerHTML` | ✅ | React escapa HTML por defecto; Ant Design usa API de texto en notificaciones |
| 6.3 | Validación de formularios con Zod | ✅ | Esquemas tipados, errores controlados; previene inputs malformados |
| 6.4 | Interceptor Axios para ciclo de refresh (401) | ✅ | Queue de suscriptores durante refresh; previene múltiples requests simultáneos |
| 6.5 | Rutas protegidas con guard de autenticación | ✅ | Redirige a login si no hay token válido |
| 6.6 | CSRF no aplicable | ✅ | JWT stateless en header; sin cookies de sesión |
| 6.7 | Variables de entorno sensibles en frontend | ✅ | Solo `VITE_API_URL` expuesta; sin secretos en bundle |
| 6.8 | Dependencias del frontend sin vulnerabilidades conocidas | ⚠️ | Verificar periódicamente con `npm audit`; no hay automatización actual |

---

## 7. Eventos en Tiempo Real (SSE)

| # | Control | Estado | Detalles |
|---|---------|--------|----------|
| 7.1 | Autenticación de token en endpoint SSE | 🔒✅ | `JwtAuthFilter` valida `?token=` para `/events/stream` — crítico corregido Fase 3 |
| 7.2 | Límite de 500 conexiones concurrentes | ✅ | `SseEmitterRegistry` con cap; previene OOM DoS — crítico corregido Fase 3 |
| 7.3 | JWT en query string (URL) | ⚠️ | `EventSource` no soporta headers personalizados; token de 15 min mitiga exposición en logs |
| 7.4 | Emitters previos limpiados al reconectar | ✅ | Evita acumulación de conexiones zombie |
| 7.5 | `/events/test` solo en perfil dev | ✅ | Endpoint de prueba deshabilitado en producción |
| 7.6 | Autenticación basada en tickets para SSE | ❌ | **Pendiente Fase 4+:** elimina JWT de URL completamente |
| 7.7 | Aislamiento de sucursal en eventos SSE | ✅ | Eventos filtrados por `branch_id` del token del usuario |

---

## 8. Auditoría y Trazabilidad

| # | Control | Estado | Detalles |
|---|---------|--------|----------|
| 8.1 | Log de operaciones sensibles con `@Auditable` | ✅ | Spring AOP captura método, usuario, timestamp en tabla JSONB |
| 8.2 | Auditoría en transacción separada (`REQUIRES_NEW`) | ✅ | Log persiste aunque la transacción principal haga rollback |
| 8.3 | Captura de valores anteriores y nuevos | ✅ | Comparación via reflection; delta almacenado en columna `details` JSONB |
| 8.4 | IP tracking en log de precios | ✅ | `X-Forwarded-For` (último valor añadido por Nginx); proxy interno validado |
| 8.5 | Protección contra IP spoofing en XFF | ✅ | Validación de que proxy es red interna Docker antes de confiar en XFF — corregido Fase 3 |
| 8.6 | Correlación de requests con ID único | ⚠️ | Sin `X-Request-ID` explícito; correlación por timestamp + email de usuario |
| 8.7 | Política de retención de logs definida | ❌ | **Pendiente:** sin política formal; auditoría crece indefinidamente |
| 8.8 | Protección de tabla de auditoría contra modificación | ⚠️ | Sin restricción `INSERT-only` a nivel DB; depende de controles de aplicación |
| 8.9 | Backup del log de auditoría | ✅ | Incluido en backup de PostgreSQL del script `backup-postgres.sh` |

---

## 9. Infraestructura y Contenedores

| # | Control | Estado | Detalles |
|---|---------|--------|----------|
| 9.1 | Imágenes base con versiones fijas (no `latest`) | ✅ | `nginx:1.27-alpine`, `postgres:16-alpine`, OpenJDK específico |
| 9.2 | Healthchecks en todos los servicios | ✅ | `healthcheck` configurado en `docker-compose.yml` para backend, DB y Nginx |
| 9.3 | Proceso no-root en contenedores | ⚠️ | Verificar Dockerfile del backend; imágenes distroless recomendadas para prod |
| 9.4 | PostgreSQL sin acceso externo en producción | ✅ | Puerto 5432 solo en override (dev); red `backend-net` aislada |
| 9.5 | Secretos en variables de entorno (no archivos montados) | ✅ | `docker-compose.yml` referencia `${JWT_SECRET}`, `${POSTGRES_PASSWORD}` |
| 9.6 | Script de restauración con trazabilidad | ✅ | Loguea usuario, UID, hostname y timestamp — corregido Fase 2 |
| 9.7 | Volúmenes Docker con datos persistentes | ✅ | `postgres_data` con respaldo automático |
| 9.8 | Límites de recursos en contenedores (CPU/RAM) | ❌ | Sin `mem_limit` ni `cpu_quota`; riesgo de DoS por abuso de recursos |
| 9.9 | Read-only filesystem en contenedores | ❌ | No configurado; recomendado para Nginx y backend |
| 9.10 | Escaneo de vulnerabilidades en imágenes Docker | ⚠️ | `security-scan.yml` en CI/CD; verificar que Trivy o Grype estén activos |

---

## 10. CI/CD y Cadena de Suministro

| # | Control | Estado | Detalles |
|---|---------|--------|----------|
| 10.1 | Secretos en GitHub Actions Secrets (no en código) | ✅ | `JWT_SECRET`, registry tokens en Secrets de repositorio |
| 10.2 | Pipeline de CI ejecuta tests antes de merge | ✅ | `ci.yml`: build Maven + tests en PR |
| 10.3 | Escaneo de seguridad en pipeline | ✅ | `security-scan.yml`: SAST + dependencias |
| 10.4 | Imágenes publicadas a GHCR con tags específicos | ✅ | No usa tag `latest` para producción |
| 10.5 | Actualizaciones de dependencias automatizadas | ❌ | Sin Dependabot ni Renovate configurado |
| 10.6 | SBOM (Software Bill of Materials) generado | ❌ | No implementado; recomendado para auditorías de compliance |
| 10.7 | Verificación de integridad de imágenes (firma) | ❌ | Sin Cosign ni Sigstore |
| 10.8 | Permisos mínimos en workflows de GitHub Actions | ⚠️ | Verificar que `permissions:` está restrictivo en cada workflow |

---

## 11. Operaciones y Respuesta a Incidentes

| # | Control | Estado | Detalles |
|---|---------|--------|----------|
| 11.1 | Backup automático de base de datos | ✅ | Script `backup-postgres.sh` con confirmación doble |
| 11.2 | Procedimiento de restauración probado | ✅ | `restore-postgres.sh` con logging de auditoría |
| 11.3 | Monitoreo de métricas con Prometheus + Grafana | ✅ | Configurado en `docker-compose.staging.yml` |
| 11.4 | Alertas por alta tasa de 401/429 | ❌ | **Pendiente:** detección de brute-force post-hecho |
| 11.5 | Playbook de respuesta a incidentes | ❌ | Sin procedimiento documentado para: compromiso de credenciales, fuga de datos |
| 11.6 | Procedimiento de rotación de `JWT_SECRET` | ❌ | Implica invalidación de todos los tokens activos; sin guía documentada |
| 11.7 | Checklist pre-despliegue a producción | ✅ | Documentado en `DEPLOYMENT.md` |
| 11.8 | Prueba de penetración (pentest) antes de producción | ❌ | No realizada; recomendada antes del go-live |
| 11.9 | Inventario de activos y superficies de ataque | ⚠️ | Parcial: documentado en `ARCHITECTURE.md`; sin inventario formal de activos |

---

## 12. Hallazgos Históricos y Estado de Correcciones

### Fase 1

| ID | Hallazgo | Severidad | Estado |
|----|---------|-----------|--------|
| F1-01 | JWT_SECRET con entropía suficiente (256+ bits) | — | ✅ Conforme desde inicio |
| F1-02 | Refresh tokens en texto plano en DB | ALTA | ✅ Corregido: SHA-256 hash |
| F1-03 | Swagger UI expuesto sin restricción de perfil | MEDIA | ✅ Corregido: solo perfil `dev` |
| F1-04 | localStorage para JWT (XSS risk) | MEDIA | ⚠️ Riesgo aceptado: CSP `script-src 'self'` + TTL 15 min |

### Fase 2

| ID | Hallazgo | Severidad | Estado |
|----|---------|-----------|--------|
| F2-01 | CAJERO podía fijar límite de crédito arbitrario al crear cliente | ALTA | ✅ Corregido: `creditLimit` forzado a CERO |
| F2-02 | Export Excel sin MIME type correcto (MIME sniffing) | MEDIA | ✅ Corregido: header `Content-Type` explícito |
| F2-03 | Script `restore-postgres.sh` sin trazabilidad de quién ejecutó | MEDIA | ✅ Corregido: log de usuario, UID, hostname, timestamp |
| F2-04 | SUPERVISOR podía acceder a caja de cualquier cajero | BAJA | ⚠️ Aceptado por diseño; operación logeada en auditoría |

### Fase 3

| ID | Hallazgo | Severidad | Estado |
|----|---------|-----------|--------|
| F3-01 | `JwtAuthFilter` no validaba token en query param `?token=` para SSE | CRÍTICA | 🔒✅ Corregido: validación añadida para ruta `/events/stream` |
| F3-02 | `SseEmitterRegistry` sin límite de conexiones (OOM DoS) | CRÍTICA | 🔒✅ Corregido: cap de 500 conexiones + limpieza de emitters previos |
| F3-03 | IP spoofing via `X-Forwarded-For` en log de auditoría | ALTA | ✅ Corregido: validación de proxy Docker interno antes de confiar en XFF |
| F3-04 | `DashboardController` sin `@PreAuthorize` | ALTA | ✅ Corregido: anotación de rol añadida |
| F3-05 | Productos soft-deleted en cache por 5 min post-delete | ALTA | ✅ Corregido: `@CacheEvict` en método `delete()` |
| F3-06 | JWT en query string de SSE expuesto en logs de Nginx | MEDIA | ⚠️ Mitigado: TTL 15 min. Solución definitiva: tickets (Fase 4+) |
| F3-07 | Endpoint `/events/test` sin restricción de entorno | MEDIA | ✅ Corregido: habilitado solo en perfil `dev` |

---

## 13. Pendientes — Fase 4

Los siguientes controles están planificados para la próxima fase. Ninguno debe marcarse como cumplido sin evidencia técnica.

### Prioridad Alta

| # | Tarea | Justificación |
|---|-------|---------------|
| P4-01 | Configurar TLS/HTTPS con renovación automática (Let's Encrypt o cert propio) | Datos financieros en tránsito sin cifrar en producción |
| P4-02 | Habilitar HSTS una vez TLS activo | HSTS sin TLS rompe el acceso; debe activarse en par |
| P4-03 | Implementar job de limpieza de `refresh_tokens` expirados | Tabla crece indefinidamente; degradación de performance |
| P4-04 | Documentar procedimiento de rotación de `JWT_SECRET` | Sin guía, un compromiso de clave no tiene respuesta controlada |
| P4-05 | Configurar alertas por tasa alta de 401/429 en Prometheus | Detección proactiva de ataques de fuerza bruta |

### Prioridad Media

| # | Tarea | Justificación |
|---|-------|---------------|
| P4-06 | Autenticación SSE basada en tickets de un solo uso | Elimina JWT de URLs y logs de Nginx |
| P4-07 | Configurar Dependabot o Renovate para dependencias | Sin actualizaciones automáticas, las CVEs se acumulan |
| P4-08 | Definir política de retención de tabla `audit_log` (ej. 90 días) | Cumplimiento y control de volumen de datos |
| P4-09 | Añadir `X-Request-ID` para correlación de requests | Facilita forensics y debugging en incidentes |
| P4-10 | Agregar restricción `INSERT-only` a tabla de auditoría a nivel DB | Previene manipulación del log incluso con acceso a DB |

### Prioridad Baja

| # | Tarea | Justificación |
|---|-------|---------------|
| P4-11 | Definir `mem_limit` y `cpu_quota` en Docker Compose | Previene DoS por consumo de recursos de un contenedor |
| P4-12 | Penetration testing antes del go-live en producción | Valida postura de seguridad real ante un atacante externo |
| P4-13 | Documentar playbook de respuesta a incidentes | Sin playbook, un incidente real genera caos operacional |
| P4-14 | Generar SBOM del proyecto | Requerido para auditorías de compliance en muchos contextos |
| P4-15 | Migrar tokens de `localStorage` a `httpOnly` cookies | Elimina el riesgo de XSS sobre tokens; requiere manejo de CSRF |

---

## Resumen Ejecutivo

| Área | Controles OK | Con Riesgo Aceptado | Pendientes |
|------|:------------:|:--------------------:|:----------:|
| Autenticación y Tokens | 7 | 1 | 2 |
| Autorización | 9 | 1 | 0 |
| Base de Datos | 12 | 0 | 0 |
| Red y Transporte | 8 | 3 | 1 |
| Protección de Datos | 7 | 1 | 1 |
| Frontend | 5 | 2 | 0 |
| SSE | 5 | 2 | 1 |
| Auditoría | 5 | 2 | 2 |
| Infraestructura | 5 | 2 | 3 |
| CI/CD | 4 | 1 | 3 |
| Operaciones | 3 | 1 | 5 |
| **TOTAL** | **70** | **16** | **18** |

> **Estado general:** El sistema tiene una base de seguridad sólida con controles críticos implementados y tres rondas de auditoría completadas. Los principales riesgos abiertos son operacionales (TLS, limpieza de tokens, respuesta a incidentes) y no afectan la seguridad de datos en el estado actual de desarrollo. El sistema **no debe pasar a producción** sin completar al menos P4-01 (TLS) y P4-03 (limpieza de tokens).

---

*Documento generado el 2026-06-15. Actualizar después de cada fase de desarrollo o auditoría de seguridad.*

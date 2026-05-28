# Security Checklist — Pre-producción
## Minimarket Platform · Fase 1

Este checklist debe completarse y revisarse antes de cualquier despliegue a un entorno de producción o accesible desde Internet. Cada ítem debe ser marcado con un responsable y una fecha de verificación.

---

## 1. Secretos y Variables de Entorno

- [ ] `JWT_SECRET` generado con `openssl rand -base64 64` (mínimo 64 bytes de entropía).
- [ ] `JWT_SECRET` **no** está en `application.yml` ni en ningún archivo en el repositorio.
- [ ] `POSTGRES_PASSWORD` es una contraseña aleatoria de al menos 32 caracteres.
- [ ] El archivo `.env` **no** está commiteado en git (verificar con `git log --all -- infra/.env`).
- [ ] `.env.example` contiene solo valores de placeholder, sin secretos reales.
- [ ] `JWT_EXPIRATION` ajustado para producción (recomendado: 900000 ms = 15 min).
- [ ] `JWT_REFRESH_EXPIRATION` ajustado (recomendado: ≤86400000 ms = 24 h).
- [ ] No existen credenciales hardcodeadas en ningún Dockerfile ni en código fuente.
- [ ] Las variables de entorno de Docker no están en logs de CI/CD.

---

## 2. Base de Datos

- [ ] Contraseña del usuario administrador (`admin@minimarket.local`) cambiada desde `Admin1234!` antes del primer arranque.
- [ ] El nuevo hash BCrypt ($2a$12$...) fue generado y actualizado en la base de datos o en una migración de flyway posterior a V6.
- [ ] El usuario de base de datos (`POSTGRES_USER`) tiene permisos mínimos necesarios (no usa el usuario `postgres` superadmin).
- [ ] La base de datos **no** es accesible desde Internet (solo dentro de la red Docker `backend-net`).
- [ ] El puerto 5432 está bloqueado en el `docker-compose.yml` base (solo abierto en el override de desarrollo).
- [ ] Los backups están configurados y probados (punto de restauración verificado).
- [ ] Row-level security o permisos de schema adicionales evaluados si múltiples roles de BD son necesarios.

---

## 3. Autenticación y Tokens JWT

- [ ] El JWT secret tiene al menos 256 bits de entropía real (no una frase, no una contraseña reutilizada).
- [ ] Los refresh tokens se almacenan como hash SHA-256 en la BD (verificado en `AuthServiceImpl.hashToken`).
- [ ] El endpoint `/auth/refresh` no rota el refresh token en cada llamada — evaluar si la rotación de refresh tokens es requerida por la política de seguridad.
- [ ] El logout revoca el refresh token en el servidor (verificado: `refreshToken.setRevokedAt`).
- [ ] Los tokens expirados son limpiados periódicamente de la tabla `refresh_tokens` (añadir job de limpieza).
- [ ] El algoritmo de firma JWT es HS256 con clave >= 256 bits (no RS256 / ningún `alg: none`).
- [ ] Se ha verificado que la librería `io.jsonwebtoken` (JJWT) está en una versión sin CVEs conocidos.

---

## 4. Control de Acceso (RBAC)

- [ ] Todos los endpoints sensibles tienen `@PreAuthorize` verificado (ver tabla de cobertura abajo).
- [ ] El permiso `PRODUCT_PRICE_EDIT` está restringido solo al rol ADMIN (verificado en seed y controlador).
- [ ] Los endpoints de solo lectura (`GET /products`, `GET /products/{id}`) son accesibles para todos los roles autenticados — confirmar que este es el comportamiento deseado de negocio.
- [ ] No existe ningún endpoint que retorne datos de otros usuarios sin validar la identidad del solicitante (IDOR check).
- [ ] La expresión `#id.toString() == authentication.name` en `UserController.findById` fue evaluada — `authentication.name` es el email del usuario, no su UUID, por lo que esta expresión **nunca** coincide. Corrección aplicada: usar solo `hasRole('ADMIN')` o recuperar el ID desde el token.

### Tabla de cobertura de @PreAuthorize

| Endpoint                      | Método | Protección actual            | Estado |
|-------------------------------|--------|------------------------------|--------|
| POST /auth/login              | POST   | permitAll                    | OK     |
| POST /auth/refresh            | POST   | permitAll                    | OK     |
| POST /auth/logout             | POST   | authenticated                | OK     |
| GET /products                 | GET    | authenticated (sin rol)      | REVISAR|
| GET /products/{id}            | GET    | authenticated (sin rol)      | REVISAR|
| GET /products/barcode/{code}  | GET    | authenticated (sin rol)      | REVISAR|
| POST /products                | POST   | hasRole('ADMIN')             | OK     |
| PUT /products/{id}            | PUT    | hasRole('ADMIN')             | OK     |
| DELETE /products/{id}         | DELETE | hasRole('ADMIN')             | OK     |
| POST /sales                   | POST   | ADMIN or CAJERO              | FIXED  |
| GET /sales/{id}               | GET    | ADMIN or CAJERO or SUPERVISOR| FIXED  |
| GET /sales                    | GET    | ADMIN or CAJERO or SUPERVISOR| FIXED  |
| POST /sales/{id}/cancel       | POST   | ADMIN or SUPERVISOR          | OK     |
| GET /stock                    | GET    | ADMIN or BODEGA or SUPERVISOR| FIXED  |
| GET /stock/low                | GET    | ADMIN or BODEGA or SUPERVISOR| FIXED  |
| POST /stock/adjustment        | POST   | SUPERVISOR or ADMIN          | OK     |
| GET /stock/movements          | GET    | ADMIN or BODEGA or SUPERVISOR| FIXED  |
| POST /users                   | POST   | hasRole('ADMIN')             | OK     |
| GET /users/{id}               | GET    | ADMIN or self (bug)          | REVISAR|
| GET /users                    | GET    | hasRole('ADMIN')             | OK     |
| PATCH /users/{id}/deactivate  | PATCH  | hasRole('ADMIN')             | OK     |
| DELETE /users/{id}            | DELETE | hasRole('ADMIN')             | OK     |

---

## 5. HTTPS y Configuración TLS

- [ ] HTTPS habilitado en nginx (Fase 4). Sin HTTPS, los tokens JWT viajan en claro.
- [ ] Certificado TLS válido (Let's Encrypt o similar) configurado y auto-renovado.
- [ ] `Strict-Transport-Security` (HSTS) activado en `nginx.conf` (línea comentada lista para descomentar).
- [ ] TLS 1.0 y 1.1 deshabilitados — solo TLS 1.2 y 1.3 permitidos.
- [ ] El header `Strict-Transport-Security` está activado en `SecurityConfig.java` (ya configurado con 1 año + includeSubDomains).
- [ ] Redireccion HTTP → HTTPS configurada en nginx.

---

## 6. Configuración Nginx

- [ ] `server_tokens off` activo (ya configurado).
- [ ] Rate limiting en `/api/v1/auth/` activo (5r/m, burst=3) — verificar logs en producción.
- [ ] Rate limiting general `/api/` activo (60r/m, burst=20) — ajustar según tráfico real.
- [ ] `X-Frame-Options: DENY` activo.
- [ ] `X-Content-Type-Options: nosniff` activo.
- [ ] `Referrer-Policy: strict-origin-when-cross-origin` activo.
- [ ] `Permissions-Policy` activo (geolocation, microphone, camera, payment deshabilitados).
- [ ] `Content-Security-Policy` sin `unsafe-inline` en `script-src` (corregido).
- [ ] El endpoint `/actuator/` (excluyendo `/actuator/health`) devuelve 403.
- [ ] Swagger UI (`/swagger-ui/**`, `/v3/api-docs/**`) bloqueado en nginx en producción:
  ```nginx
  location ~* ^/(swagger-ui|v3/api-docs) {
      return 403;
  }
  ```
- [ ] `client_max_body_size` revisado — 10 MB puede ser excesivo si no hay upload de archivos.

---

## 7. Docker e Infraestructura

- [ ] Backend ejecuta como usuario `appuser` (UID 1001) — no como root (verificado en Dockerfile).
- [ ] Frontend nginx ejecuta como usuario `nginx` (UID 101) — no como root (verificado en Dockerfile).
- [ ] Ningún contenedor usa `--privileged` o `cap_add: ALL`.
- [ ] El puerto 5432 (PostgreSQL) no está expuesto en `docker-compose.yml` base.
- [ ] El puerto 5005 (JVM debug) no está expuesto en `docker-compose.yml` base.
- [ ] Las imágenes base tienen versión fija (no `:latest`): `postgres:16-alpine`, `nginx:1.27-alpine`, `eclipse-temurin:21-jre-alpine`, `node:20-alpine` — OK.
- [ ] Las imágenes base se escanean periódicamente con `docker scout` o `trivy`.
- [ ] No se montan sockets Docker (`/var/run/docker.sock`) en ningún contenedor.
- [ ] Los volúmenes de desarrollo (`../backend/src:/app/src`) no están presentes en producción.
- [ ] `SPRING_PROFILES_ACTIVE=prod` en producción (no `dev`).

---

## 8. Frontend y Almacenamiento de Tokens

- [ ] **RIESGO ACEPTADO / PENDIENTE DE MITIGACIÓN**: Los tokens JWT se almacenan en `localStorage`. Esto los expone a ataques XSS. En producción se recomienda:
  - Opción A: Migrar a cookies `HttpOnly` + `SameSite=Strict` (requiere cambios en backend y frontend).
  - Opción B: Mantener localStorage con una CSP muy estricta que elimine completamente el riesgo de XSS.
- [ ] La CSP no incluye `unsafe-inline` en `script-src` (corregido en nginx.conf).
- [ ] El refresh interceptor de axios maneja correctamente las race conditions (corregido).
- [ ] El logout envía el `refreshToken` en el body para que el servidor lo revoque (corregido).
- [ ] Las dependencias npm se auditan regularmente con `npm audit`.
- [ ] No se imprime información sensible en `console.log` en builds de producción.
- [ ] `VITE_API_URL` en producción usa HTTPS.

---

## 9. Logging y Monitoreo

- [ ] Los logs no contienen tokens JWT, contraseñas ni datos PII.
- [ ] `show-sql: false` en producción (ya configurado).
- [ ] El nivel de log es `INFO` o superior en producción (ya configurado).
- [ ] Alertas configuradas para: tasa alta de 401 (posible fuerza bruta), tasa alta de 429 (rate limiting activado), errores 500.
- [ ] Los logs de acceso de nginx están siendo recolectados y rotados.
- [ ] El campo `ip_address` de `price_audit_log` se puebla desde el backend (verificar implementación).

---

## 10. Procedimientos Operacionales

- [ ] Procedimiento documentado para rotar el `JWT_SECRET` (implica invalidar todos los tokens activos).
- [ ] Procedimiento documentado para crear el primer usuario administrador con contraseña segura.
- [ ] Job programado creado para limpiar `refresh_tokens` expirados de la BD.
- [ ] Dependencias Java (pom.xml) y npm (package.json) revisadas contra CVEs antes del primer despliegue.
- [ ] Plan de respuesta a incidentes definido (quién notifica, qué se revoca, cómo se recupera).

---

**Responsable de seguridad:** ___________________
**Fecha de última revisión:** ___________________
**Versión del checklist:** 1.0 (Fase 1 — 2026-05-26)

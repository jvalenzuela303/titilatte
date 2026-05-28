-- =============================================================================
-- V1__create_security_schema.sql
-- Minimarket Platform - Fase 1
-- Módulo: Seguridad, Autenticación y Control de Acceso
--
-- Tablas: users, roles, permissions, user_roles, refresh_tokens
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Extensión requerida para gen_random_uuid()
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- ENUM: Nombres de roles del sistema
-- ---------------------------------------------------------------------------
CREATE TYPE public.role_name AS ENUM (
    'ADMIN',
    'CAJERO',
    'BODEGA',
    'SUPERVISOR'
);

COMMENT ON TYPE public.role_name IS
    'Roles disponibles en el sistema. ADMIN acceso total, CAJERO ventas y caja, '
    'BODEGA stock y compras, SUPERVISOR reportes y validaciones.';

-- ---------------------------------------------------------------------------
-- TABLE: roles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roles (
    id          UUID        NOT NULL DEFAULT gen_random_uuid(),
    name        role_name   NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_roles PRIMARY KEY (id),
    CONSTRAINT uq_roles_name UNIQUE (name)
);

COMMENT ON TABLE  public.roles              IS 'Roles del sistema que agrupan permisos funcionales.';
COMMENT ON COLUMN public.roles.id          IS 'Identificador único del rol (UUID v4).';
COMMENT ON COLUMN public.roles.name        IS 'Nombre canónico del rol. Único en el sistema.';
COMMENT ON COLUMN public.roles.description IS 'Descripción legible del rol y sus responsabilidades.';
COMMENT ON COLUMN public.roles.created_at  IS 'Timestamp de creación del registro (UTC).';
COMMENT ON COLUMN public.roles.updated_at  IS 'Timestamp de última modificación del registro (UTC).';

-- ---------------------------------------------------------------------------
-- TABLE: permissions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.permissions (
    id          UUID        NOT NULL DEFAULT gen_random_uuid(),
    code        VARCHAR(80) NOT NULL,
    module      VARCHAR(40) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_permissions      PRIMARY KEY (id),
    CONSTRAINT uq_permissions_code UNIQUE (code)
);

COMMENT ON TABLE  public.permissions             IS 'Permisos atómicos del sistema organizados por módulo funcional.';
COMMENT ON COLUMN public.permissions.id          IS 'Identificador único del permiso (UUID v4).';
COMMENT ON COLUMN public.permissions.code        IS 'Código único del permiso, ej: PRODUCT_PRICE_EDIT, STOCK_ADJUST.';
COMMENT ON COLUMN public.permissions.module      IS 'Módulo al que pertenece el permiso, ej: PRODUCTS, SALES, STOCK.';
COMMENT ON COLUMN public.permissions.description IS 'Descripción de la acción que habilita el permiso.';
COMMENT ON COLUMN public.permissions.created_at  IS 'Timestamp de creación del registro (UTC).';

-- ---------------------------------------------------------------------------
-- TABLE: role_permissions  (junction table roles <-> permissions)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id       UUID NOT NULL,
    permission_id UUID NOT NULL,
    granted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_role_permissions
        PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_role_permissions_role
        FOREIGN KEY (role_id)
        REFERENCES public.roles (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_role_permissions_permission
        FOREIGN KEY (permission_id)
        REFERENCES public.permissions (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

COMMENT ON TABLE  public.role_permissions               IS 'Tabla de unión entre roles y permisos (M:N).';
COMMENT ON COLUMN public.role_permissions.role_id       IS 'FK al rol que recibe el permiso.';
COMMENT ON COLUMN public.role_permissions.permission_id IS 'FK al permiso otorgado.';
COMMENT ON COLUMN public.role_permissions.granted_at    IS 'Timestamp en que se otorgó el permiso al rol (UTC).';

-- ---------------------------------------------------------------------------
-- TABLE: users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id            UUID         NOT NULL DEFAULT gen_random_uuid(),
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name    VARCHAR(100) NOT NULL,
    last_name     VARCHAR(100) NOT NULL,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ,

    CONSTRAINT pk_users       PRIMARY KEY (id),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT chk_users_email_format
        CHECK (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$')
);

COMMENT ON TABLE  public.users               IS 'Usuarios del sistema con soporte para soft delete.';
COMMENT ON COLUMN public.users.id            IS 'Identificador único del usuario (UUID v4).';
COMMENT ON COLUMN public.users.email         IS 'Dirección de correo electrónico. Único y usado como login.';
COMMENT ON COLUMN public.users.password_hash IS 'Hash BCrypt de la contraseña. Nunca almacenar texto plano.';
COMMENT ON COLUMN public.users.first_name    IS 'Nombres del usuario.';
COMMENT ON COLUMN public.users.last_name     IS 'Apellidos del usuario.';
COMMENT ON COLUMN public.users.is_active     IS 'TRUE si el usuario puede iniciar sesión. FALSE bloquea el acceso.';
COMMENT ON COLUMN public.users.created_at    IS 'Timestamp de creación del registro (UTC).';
COMMENT ON COLUMN public.users.updated_at    IS 'Timestamp de última modificación del registro (UTC).';
COMMENT ON COLUMN public.users.deleted_at    IS 'Soft delete: NULL = activo, NOT NULL = eliminado lógicamente.';

-- ---------------------------------------------------------------------------
-- TABLE: user_roles  (junction table users <-> roles)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id    UUID        NOT NULL,
    role_id    UUID        NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID,

    CONSTRAINT pk_user_roles PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_roles_user
        FOREIGN KEY (user_id)
        REFERENCES public.users (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_user_roles_role
        FOREIGN KEY (role_id)
        REFERENCES public.roles (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_user_roles_assigned_by
        FOREIGN KEY (assigned_by)
        REFERENCES public.users (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

COMMENT ON TABLE  public.user_roles              IS 'Asignación de roles a usuarios (M:N). Un usuario puede tener múltiples roles.';
COMMENT ON COLUMN public.user_roles.user_id      IS 'FK al usuario al que se asigna el rol.';
COMMENT ON COLUMN public.user_roles.role_id      IS 'FK al rol asignado.';
COMMENT ON COLUMN public.user_roles.assigned_at  IS 'Timestamp de asignación del rol (UTC).';
COMMENT ON COLUMN public.user_roles.assigned_by  IS 'FK al usuario administrador que realizó la asignación. Auditoría.';

-- ---------------------------------------------------------------------------
-- TABLE: refresh_tokens
-- Persistencia de refresh tokens para soporte de revocación explícita.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.refresh_tokens (
    id         UUID         NOT NULL DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ  NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_refresh_tokens            PRIMARY KEY (id),
    CONSTRAINT uq_refresh_tokens_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY (user_id)
        REFERENCES public.users (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT chk_refresh_tokens_expires
        CHECK (expires_at > created_at)
);

COMMENT ON TABLE  public.refresh_tokens            IS 'Refresh tokens JWT persistidos para soporte de revocación activa.';
COMMENT ON COLUMN public.refresh_tokens.id         IS 'Identificador único del token (UUID v4).';
COMMENT ON COLUMN public.refresh_tokens.user_id    IS 'FK al usuario propietario del token.';
COMMENT ON COLUMN public.refresh_tokens.token_hash IS 'Hash SHA-256 del refresh token. Nunca almacenar el token en claro.';
COMMENT ON COLUMN public.refresh_tokens.expires_at IS 'Fecha/hora de expiración del token (UTC). Verificar siempre antes de aceptar.';
COMMENT ON COLUMN public.refresh_tokens.revoked_at IS 'Timestamp de revocación explícita. NULL = vigente, NOT NULL = revocado.';
COMMENT ON COLUMN public.refresh_tokens.created_at IS 'Timestamp de emisión del token (UTC).';

-- ---------------------------------------------------------------------------
-- TABLE: price_audit_log
-- Auditoría de cambios de precio. Solo ADMIN puede modificar precios (regla de negocio).
-- Este log se puebla desde trigger definido en V2.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.price_audit_log (
    id            UUID         NOT NULL DEFAULT gen_random_uuid(),
    product_id    UUID         NOT NULL,
    changed_by    UUID         NOT NULL,
    field_name    VARCHAR(50)  NOT NULL,
    old_value     NUMERIC(12,4),
    new_value     NUMERIC(12,4),
    changed_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    ip_address    INET,
    notes         TEXT,

    CONSTRAINT pk_price_audit_log PRIMARY KEY (id),
    CONSTRAINT fk_price_audit_log_user
        FOREIGN KEY (changed_by)
        REFERENCES public.users (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT chk_price_audit_log_field
        CHECK (field_name IN ('purchase_price', 'sale_price'))
);

COMMENT ON TABLE  public.price_audit_log            IS 'Registro inmutable de todos los cambios de precio. Solo ADMIN tiene permiso PRODUCT_PRICE_EDIT.';
COMMENT ON COLUMN public.price_audit_log.id         IS 'Identificador único del registro de auditoría.';
COMMENT ON COLUMN public.price_audit_log.product_id IS 'Producto cuyo precio fue modificado. FK definida en V2 para evitar dependencia circular.';
COMMENT ON COLUMN public.price_audit_log.changed_by IS 'Usuario (debe tener rol ADMIN) que realizó el cambio.';
COMMENT ON COLUMN public.price_audit_log.field_name IS 'Campo modificado: purchase_price o sale_price.';
COMMENT ON COLUMN public.price_audit_log.old_value  IS 'Valor anterior del precio.';
COMMENT ON COLUMN public.price_audit_log.new_value  IS 'Nuevo valor del precio.';
COMMENT ON COLUMN public.price_audit_log.changed_at IS 'Timestamp exacto del cambio (UTC).';
COMMENT ON COLUMN public.price_audit_log.ip_address IS 'IP de origen de la solicitud. Trazabilidad de seguridad.';
COMMENT ON COLUMN public.price_audit_log.notes      IS 'Justificación opcional del cambio de precio.';

-- ---------------------------------------------------------------------------
-- INDEXES - Módulo seguridad
-- ---------------------------------------------------------------------------

-- Búsqueda de usuario por email en login (alta frecuencia)
CREATE INDEX IF NOT EXISTS idx_users_email
    ON public.users (email)
    WHERE deleted_at IS NULL;

-- Filtrado de usuarios activos (usado en listados y validaciones)
CREATE INDEX IF NOT EXISTS idx_users_is_active
    ON public.users (is_active)
    WHERE deleted_at IS NULL;

-- Búsqueda de token activo por hash durante refresh (alta frecuencia en cada request)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash
    ON public.refresh_tokens (token_hash)
    WHERE revoked_at IS NULL;

-- Tokens activos por usuario (para revocación total al logout)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active
    ON public.refresh_tokens (user_id)
    WHERE revoked_at IS NULL;

-- Auditoría de precios por producto (reportes)
CREATE INDEX IF NOT EXISTS idx_price_audit_product
    ON public.price_audit_log (product_id, changed_at DESC);

-- Auditoría de precios por usuario (quién modificó qué)
CREATE INDEX IF NOT EXISTS idx_price_audit_user
    ON public.price_audit_log (changed_by, changed_at DESC);

-- ---------------------------------------------------------------------------
-- FUNCIÓN: actualizar updated_at automáticamente
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_set_updated_at() IS
    'Trigger function que actualiza updated_at al valor actual antes de cada UPDATE.';

-- Trigger en users
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Trigger en roles
CREATE TRIGGER trg_roles_updated_at
    BEFORE UPDATE ON public.roles
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

COMMIT;

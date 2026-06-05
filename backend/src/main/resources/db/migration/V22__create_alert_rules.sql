-- =============================================================================
-- V22__create_alert_rules.sql
-- Minimarket Platform - Fase 5
-- Módulo: Alertas Configurables
--
-- Tablas: alert_rules, alert_history
--
-- Tipos de alerta soportados:
--   SALES_BELOW_THRESHOLD — ventas del día por debajo de un umbral monetario
--   CASH_OPEN_TOO_LONG    — caja lleva más de threshold_minutes minutos abierta
--   LOW_STOCK_COUNT       — cantidad de productos bajo mínimo supera threshold_value
--   HIGH_DEBT_TOTAL       — deuda total de clientes supera threshold_value
--   CUSTOM                — regla personalizada evaluada por la aplicación
--
-- Niveles de severidad:
--   INFO     — informativo, no requiere acción inmediata
--   WARNING  — requiere atención del destinatario
--   CRITICAL — acción urgente requerida
--
-- Reglas de negocio:
--   - alert_history es inmutable: solo INSERT, nunca UPDATE/DELETE
--   - rule_name se desnormaliza en alert_history para preservar historial
--     aunque la regla sea eliminada (soft delete o física)
--   - acknowledged_by y acknowledged_at deben ir juntos o ambos NULL
--   - Soft delete en alert_rules via deleted_at (patrón estándar del proyecto)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- TABLE: alert_rules
-- Configuración de reglas de alerta evaluadas periódicamente por el backend.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alert_rules (
    id                     UUID           NOT NULL DEFAULT gen_random_uuid(),
    name                   VARCHAR(100)   NOT NULL,
    description            TEXT,

    -- Tipo de alerta: define qué métrica se evalúa
    type                   VARCHAR(50)    NOT NULL,

    -- Umbral monetario o de conteo (ej: 50000 para ventas, 10 para productos bajo mínimo)
    threshold_value        NUMERIC(15, 2),

    -- Umbral temporal en minutos (ej: 720 para detectar caja abierta 12+ horas)
    threshold_minutes      INTEGER,

    -- Frecuencia de evaluación en minutos (el scheduler del backend usa este campo)
    check_interval_minutes INTEGER        NOT NULL DEFAULT 60,

    -- Rol que recibe la notificación cuando se dispara la alerta
    recipient_role         VARCHAR(20)    NOT NULL DEFAULT 'ADMIN',

    active                 BOOLEAN        NOT NULL DEFAULT TRUE,

    -- Última vez que el scheduler evaluó esta regla
    last_checked_at        TIMESTAMPTZ,

    -- Última vez que la regla generó una alerta
    last_triggered_at      TIMESTAMPTZ,

    created_by             UUID           NOT NULL,
    created_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    deleted_at             TIMESTAMPTZ,

    -- -----------------------------------------------------------------------
    -- PRIMARY KEY
    -- -----------------------------------------------------------------------
    CONSTRAINT pk_alert_rules PRIMARY KEY (id),

    -- -----------------------------------------------------------------------
    -- FOREIGN KEYS
    -- -----------------------------------------------------------------------
    CONSTRAINT fk_alert_rules_created_by
        FOREIGN KEY (created_by)
        REFERENCES public.users (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    -- -----------------------------------------------------------------------
    -- CHECK CONSTRAINTS
    -- -----------------------------------------------------------------------

    -- Tipos de alerta válidos
    CONSTRAINT chk_alert_rules_type
        CHECK (type IN (
            'SALES_BELOW_THRESHOLD',
            'CASH_OPEN_TOO_LONG',
            'LOW_STOCK_COUNT',
            'HIGH_DEBT_TOTAL',
            'CUSTOM'
        )),

    -- Roles destinatarios válidos (alineados con role_name del proyecto)
    CONSTRAINT chk_alert_rules_recipient_role
        CHECK (recipient_role IN ('ADMIN', 'SUPERVISOR', 'CAJERO', 'BODEGA')),

    -- El intervalo de evaluación debe ser al menos 1 minuto
    CONSTRAINT chk_alert_rules_check_interval
        CHECK (check_interval_minutes >= 1),

    -- Al menos uno de los dos umbrales debe estar definido en reglas no-CUSTOM
    CONSTRAINT chk_alert_rules_threshold_defined
        CHECK (
            type = 'CUSTOM' OR
            threshold_value IS NOT NULL OR
            threshold_minutes IS NOT NULL
        ),

    -- threshold_value siempre positivo si se define
    CONSTRAINT chk_alert_rules_threshold_value_positive
        CHECK (threshold_value IS NULL OR threshold_value > 0),

    -- threshold_minutes siempre positivo si se define
    CONSTRAINT chk_alert_rules_threshold_minutes_positive
        CHECK (threshold_minutes IS NULL OR threshold_minutes > 0)
);

COMMENT ON TABLE  public.alert_rules                       IS 'Reglas de alerta configurables evaluadas periódicamente por el backend del minimarket.';
COMMENT ON COLUMN public.alert_rules.id                    IS 'Identificador único de la regla de alerta (UUID v4).';
COMMENT ON COLUMN public.alert_rules.name                  IS 'Nombre descriptivo de la regla. Visible en el panel de alertas.';
COMMENT ON COLUMN public.alert_rules.description           IS 'Descripción extendida de la regla y su propósito. Opcional.';
COMMENT ON COLUMN public.alert_rules.type                  IS 'Tipo de alerta: define qué métrica del sistema se evalúa.';
COMMENT ON COLUMN public.alert_rules.threshold_value       IS 'Umbral numérico/monetario. Ej: 50000 para ventas mínimas del día, 10 para cantidad de productos bajo mínimo.';
COMMENT ON COLUMN public.alert_rules.threshold_minutes     IS 'Umbral temporal en minutos. Ej: 720 para detectar caja abierta más de 12 horas.';
COMMENT ON COLUMN public.alert_rules.check_interval_minutes IS 'Frecuencia de evaluación de la regla en minutos. El scheduler del backend respeta este valor.';
COMMENT ON COLUMN public.alert_rules.recipient_role        IS 'Rol del sistema que recibe la notificación cuando la regla se dispara.';
COMMENT ON COLUMN public.alert_rules.active                IS 'FALSE suspende la evaluación sin eliminar la regla.';
COMMENT ON COLUMN public.alert_rules.last_checked_at       IS 'Timestamp de la última evaluación por el scheduler (UTC).';
COMMENT ON COLUMN public.alert_rules.last_triggered_at     IS 'Timestamp de la última vez que la regla generó una alerta (UTC).';
COMMENT ON COLUMN public.alert_rules.created_by            IS 'FK al usuario ADMIN que creó la regla.';
COMMENT ON COLUMN public.alert_rules.created_at            IS 'Timestamp de creación del registro (UTC).';
COMMENT ON COLUMN public.alert_rules.updated_at            IS 'Timestamp de última modificación del registro (UTC).';
COMMENT ON COLUMN public.alert_rules.deleted_at            IS 'Soft delete: NULL = activa, NOT NULL = eliminada lógicamente.';

-- ---------------------------------------------------------------------------
-- TABLE: alert_history
-- Registro inmutable de todas las alertas disparadas.
-- NUNCA modificar ni eliminar registros de esta tabla.
-- El acuse de recibo (acknowledged) es la única excepción permitida.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alert_history (
    id              UUID           NOT NULL DEFAULT gen_random_uuid(),

    -- FK a la regla que originó la alerta. ON DELETE SET NULL preserva el historial.
    rule_id         UUID,

    -- Nombre de la regla desnormalizado: se conserva aunque la regla sea eliminada.
    rule_name       VARCHAR(100)   NOT NULL,

    -- Tipo desnormalizado para poder filtrar sin JOIN a alert_rules (que puede ser eliminada)
    type            VARCHAR(50)    NOT NULL,

    -- Nivel de urgencia de la alerta
    severity        VARCHAR(20)    NOT NULL DEFAULT 'WARNING',

    -- Mensaje legible generado por el backend al disparar la alerta
    message         TEXT           NOT NULL,

    -- Contexto adicional en formato JSON (ej: lista de productos con bajo stock, valor actual)
    context_json    JSONB,

    triggered_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    -- Campos de acuse de recibo
    acknowledged        BOOLEAN     NOT NULL DEFAULT FALSE,
    acknowledged_by     UUID,
    acknowledged_at     TIMESTAMPTZ,

    -- -----------------------------------------------------------------------
    -- PRIMARY KEY
    -- -----------------------------------------------------------------------
    CONSTRAINT pk_alert_history PRIMARY KEY (id),

    -- -----------------------------------------------------------------------
    -- FOREIGN KEYS
    -- -----------------------------------------------------------------------
    CONSTRAINT fk_alert_history_rule
        FOREIGN KEY (rule_id)
        REFERENCES public.alert_rules (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    CONSTRAINT fk_alert_history_acknowledged_by
        FOREIGN KEY (acknowledged_by)
        REFERENCES public.users (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    -- -----------------------------------------------------------------------
    -- CHECK CONSTRAINTS
    -- -----------------------------------------------------------------------

    -- Tipos de alerta válidos (espejo de alert_rules para integridad sin FK)
    CONSTRAINT chk_alert_history_type
        CHECK (type IN (
            'SALES_BELOW_THRESHOLD',
            'CASH_OPEN_TOO_LONG',
            'LOW_STOCK_COUNT',
            'HIGH_DEBT_TOTAL',
            'CUSTOM'
        )),

    -- Niveles de severidad válidos
    CONSTRAINT chk_alert_history_severity
        CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),

    -- El acuse de recibo requiere usuario y timestamp, o ninguno de los dos
    CONSTRAINT chk_alert_history_ack_consistency
        CHECK (
            (acknowledged = FALSE AND acknowledged_by IS NULL AND acknowledged_at IS NULL) OR
            (acknowledged = TRUE  AND acknowledged_by IS NOT NULL AND acknowledged_at IS NOT NULL)
        )
);

COMMENT ON TABLE  public.alert_history                  IS 'Historial inmutable de alertas disparadas. Solo INSERT y actualización de acknowledged permitidos.';
COMMENT ON COLUMN public.alert_history.id               IS 'Identificador único de la alerta histórica (UUID v4).';
COMMENT ON COLUMN public.alert_history.rule_id          IS 'FK a la regla que originó la alerta. NULL si la regla fue eliminada (historial se preserva).';
COMMENT ON COLUMN public.alert_history.rule_name        IS 'Nombre de la regla desnormalizado. Preservado aunque la regla sea eliminada.';
COMMENT ON COLUMN public.alert_history.type             IS 'Tipo de alerta desnormalizado. Permite filtros sin JOIN a alert_rules.';
COMMENT ON COLUMN public.alert_history.severity         IS 'Nivel de urgencia: INFO, WARNING o CRITICAL.';
COMMENT ON COLUMN public.alert_history.message          IS 'Mensaje legible generado por el backend. Describe la condición detectada.';
COMMENT ON COLUMN public.alert_history.context_json     IS 'Datos de contexto en JSONB. Ej: lista de SKUs bajo mínimo, valor actual vs umbral.';
COMMENT ON COLUMN public.alert_history.triggered_at     IS 'Timestamp exacto en que se disparó la alerta (UTC).';
COMMENT ON COLUMN public.alert_history.acknowledged     IS 'TRUE cuando un usuario ha acusado recibo de la alerta.';
COMMENT ON COLUMN public.alert_history.acknowledged_by  IS 'FK al usuario que acusó recibo de la alerta.';
COMMENT ON COLUMN public.alert_history.acknowledged_at  IS 'Timestamp del acuse de recibo (UTC).';

-- ---------------------------------------------------------------------------
-- TRIGGER: updated_at en alert_rules
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_alert_rules_updated_at
    BEFORE UPDATE ON public.alert_rules
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- INDEXES — Módulo alertas
-- ---------------------------------------------------------------------------

-- Lookup de historial por regla: "¿cuántas veces se disparó esta regla?"
CREATE INDEX IF NOT EXISTS idx_alert_history_rule_id
    ON public.alert_history (rule_id)
    WHERE rule_id IS NOT NULL;

-- Listado del panel de alertas ordenado por recencia (consulta más frecuente del módulo)
CREATE INDEX IF NOT EXISTS idx_alert_history_triggered_at
    ON public.alert_history (triggered_at DESC);

-- Panel de alertas pendientes: filtra no-acusadas y ordena por recencia
-- Cubre la query: WHERE acknowledged = FALSE ORDER BY triggered_at DESC
CREATE INDEX IF NOT EXISTS idx_alert_history_pending
    ON public.alert_history (acknowledged, triggered_at DESC)
    WHERE acknowledged = FALSE;

-- Filtro por tipo: permite ver solo alertas de stock, de caja, etc.
CREATE INDEX IF NOT EXISTS idx_alert_history_type
    ON public.alert_history (type, triggered_at DESC);

-- Reglas activas para el scheduler: "¿qué reglas debo evaluar ahora?"
-- Cubre la query: WHERE active = TRUE AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_alert_rules_active
    ON public.alert_rules (active, last_checked_at)
    WHERE deleted_at IS NULL AND active = TRUE;

-- Búsqueda de reglas por tipo (administración de reglas por módulo)
CREATE INDEX IF NOT EXISTS idx_alert_rules_type
    ON public.alert_rules (type)
    WHERE deleted_at IS NULL;

-- Índice GIN en context_json: habilita búsquedas dentro del JSON de contexto
-- Útil para queries como: "alertas donde context_json contiene el producto X"
CREATE INDEX IF NOT EXISTS idx_alert_history_context_json
    ON public.alert_history USING GIN (context_json)
    WHERE context_json IS NOT NULL;

COMMIT;

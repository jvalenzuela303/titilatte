-- =============================================================================
-- V8__create_cash_schema.sql
-- Minimarket Platform - Fase 2
-- Módulo: Caja
--
-- Tablas: cash_registers, cash_movements
-- Secuencia: seq_register_number
-- Función: fn_register_sale_cash_movement (trigger AFTER INSERT en payments)
-- Trigger: trg_payments_cash_movement
--
-- Reglas de negocio:
--   - Solo puede haber UNA caja OPEN por cajero en simultaneo (partial unique index)
--   - difference_amount es columna generada: counted_amount - expected_closing_amount
--   - El trigger de pagos NO bloquea la venta si no hay caja abierta
--     (la caja es control gerencial, no operativo)
--   - expected_closing_amount es calculado por la aplicación al cierre;
--     la BD lo persiste pero no lo valida en tiempo real
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- ENUM: Estado de la caja registradora
-- ---------------------------------------------------------------------------
CREATE TYPE public.cash_register_status AS ENUM (
    'OPEN',
    'CLOSED'
);

COMMENT ON TYPE public.cash_register_status IS
    'Estado del turno de caja. OPEN turno en curso, CLOSED turno cerrado y cuadrado.';

-- ---------------------------------------------------------------------------
-- ENUM: Tipo de movimiento de caja
-- ---------------------------------------------------------------------------
CREATE TYPE public.cash_movement_type AS ENUM (
    'INGRESO',
    'EGRESO',
    'VENTA',
    'PAGO_CREDITO'
);

COMMENT ON TYPE public.cash_movement_type IS
    'Naturaleza del movimiento de caja. '
    'INGRESO entrada de dinero, EGRESO salida, '
    'VENTA ingreso por venta en efectivo, PAGO_CREDITO abono de deuda.';

-- ---------------------------------------------------------------------------
-- ENUM: Categoría del movimiento de caja
-- Permite clasificación operacional y contable de los movimientos.
-- ---------------------------------------------------------------------------
CREATE TYPE public.cash_movement_category AS ENUM (
    'VENTA_EFECTIVO',
    'PAGO_CLIENTE',
    'GASTO_OPERACIONAL',
    'RETIRO',
    'DEPOSITO',
    'AJUSTE'
);

COMMENT ON TYPE public.cash_movement_category IS
    'Categoría contable del movimiento de caja. '
    'VENTA_EFECTIVO ventas cobradas, PAGO_CLIENTE abono de crédito, '
    'GASTO_OPERACIONAL egresos del local, RETIRO retiro de fondos, '
    'DEPOSITO ingreso extraordinario, AJUSTE corrección manual.';

-- ---------------------------------------------------------------------------
-- SEQUENCE: register_number
-- Número de apertura de caja secuencial. Sirve para referencias en reportes.
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.seq_register_number
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

COMMENT ON SEQUENCE public.seq_register_number IS
    'Secuencia para el número de apertura de caja. Estrictamente incremental.';

-- ---------------------------------------------------------------------------
-- TABLE: cash_registers
-- Registro de turnos de caja. Un registro por apertura/cierre de cajero.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_registers (
    id                       UUID                         NOT NULL DEFAULT gen_random_uuid(),
    register_number          BIGINT                       NOT NULL DEFAULT nextval('public.seq_register_number'),
    cashier_id               UUID                         NOT NULL,
    opening_amount           NUMERIC(12, 2)               NOT NULL,
    expected_closing_amount  NUMERIC(12, 2),
    counted_amount           NUMERIC(12, 2),
    -- difference_amount: diferencia entre lo contado y lo esperado
    -- NULL cuando counted_amount o expected_closing_amount son NULL (caja aún abierta)
    difference_amount        NUMERIC(12, 2)
        GENERATED ALWAYS AS (
            CASE
                WHEN counted_amount IS NOT NULL AND expected_closing_amount IS NOT NULL
                THEN ROUND(counted_amount - expected_closing_amount, 2)
                ELSE NULL
            END
        ) STORED,
    status                   public.cash_register_status  NOT NULL DEFAULT 'OPEN',
    opened_at                TIMESTAMPTZ                  NOT NULL DEFAULT NOW(),
    closed_at                TIMESTAMPTZ,
    notes                    TEXT,
    created_at               TIMESTAMPTZ                  NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ                  NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_cash_registers      PRIMARY KEY (id),
    CONSTRAINT uq_cash_registers_number UNIQUE (register_number),
    CONSTRAINT fk_cash_registers_cashier
        FOREIGN KEY (cashier_id)
        REFERENCES public.users (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT chk_cash_registers_opening_amount
        CHECK (opening_amount >= 0),
    CONSTRAINT chk_cash_registers_counted_amount
        CHECK (counted_amount IS NULL OR counted_amount >= 0),
    -- Cierre requiere datos consistentes
    CONSTRAINT chk_cash_registers_closure_consistency
        CHECK (
            (status = 'OPEN'   AND closed_at IS NULL) OR
            (status = 'CLOSED' AND closed_at IS NOT NULL)
        )
);

COMMENT ON TABLE  public.cash_registers                       IS 'Turnos de caja del minimarket. Una apertura por cajero por turno.';
COMMENT ON COLUMN public.cash_registers.id                    IS 'Identificador único del turno de caja (UUID v4).';
COMMENT ON COLUMN public.cash_registers.register_number       IS 'Número secuencial de apertura de caja. Legible en reportes.';
COMMENT ON COLUMN public.cash_registers.cashier_id            IS 'FK al usuario cajero responsable del turno.';
COMMENT ON COLUMN public.cash_registers.opening_amount        IS 'Monto de efectivo con que abre la caja (fondo de cambio).';
COMMENT ON COLUMN public.cash_registers.expected_closing_amount IS 'Monto esperado al cierre: apertura + ventas efectivo + ingresos - egresos. Calculado por la app.';
COMMENT ON COLUMN public.cash_registers.counted_amount        IS 'Monto físicamente contado por el cajero al cierre.';
COMMENT ON COLUMN public.cash_registers.difference_amount     IS 'Diferencia generada: counted_amount - expected_closing_amount. NULL mientras caja esté abierta.';
COMMENT ON COLUMN public.cash_registers.status                IS 'OPEN turno activo, CLOSED turno cerrado.';
COMMENT ON COLUMN public.cash_registers.opened_at             IS 'Timestamp de apertura del turno (UTC).';
COMMENT ON COLUMN public.cash_registers.closed_at             IS 'Timestamp de cierre del turno (UTC). NULL mientras OPEN.';
COMMENT ON COLUMN public.cash_registers.notes                 IS 'Observaciones del cajero al abrir o cerrar el turno.';
COMMENT ON COLUMN public.cash_registers.created_at            IS 'Timestamp de creación del registro (UTC).';
COMMENT ON COLUMN public.cash_registers.updated_at            IS 'Timestamp de última modificación del registro (UTC).';

-- ---------------------------------------------------------------------------
-- CONSTRAINT ÚNICO PARCIAL: un cajero no puede tener dos cajas OPEN
-- Índice parcial para enforcar la unicidad solo sobre registros OPEN.
-- Un cajero puede tener múltiples registros CLOSED (historial de turnos).
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_register_open_cashier
    ON public.cash_registers (cashier_id)
    WHERE status = 'OPEN';

COMMENT ON INDEX public.uq_cash_register_open_cashier IS
    'Garantiza que cada cajero tenga como máximo una caja abierta simultáneamente.';

-- ---------------------------------------------------------------------------
-- TABLE: cash_movements
-- Registro de todos los movimientos de dinero en un turno de caja.
-- Inmutable: no se modifica ni elimina. Solo se insertan nuevos registros.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_movements (
    id               UUID                          NOT NULL DEFAULT gen_random_uuid(),
    cash_register_id UUID                          NOT NULL,
    movement_type    public.cash_movement_type     NOT NULL,
    category         public.cash_movement_category NOT NULL,
    amount           NUMERIC(12, 2)                NOT NULL,
    description      VARCHAR(300)                  NOT NULL,
    reference_id     UUID,
    reference_type   VARCHAR(50),
    created_by       UUID                          NOT NULL,
    created_at       TIMESTAMPTZ                   NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_cash_movements PRIMARY KEY (id),
    CONSTRAINT fk_cash_movements_register
        FOREIGN KEY (cash_register_id)
        REFERENCES public.cash_registers (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_cash_movements_created_by
        FOREIGN KEY (created_by)
        REFERENCES public.users (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT chk_cash_movements_amount
        CHECK (amount > 0),
    CONSTRAINT chk_cash_movements_reference_consistency
        CHECK (
            (reference_id IS NULL AND reference_type IS NULL) OR
            (reference_id IS NOT NULL AND reference_type IS NOT NULL)
        )
);

COMMENT ON TABLE  public.cash_movements                   IS 'Movimientos de caja del turno. Registro inmutable: solo INSERT, nunca UPDATE/DELETE.';
COMMENT ON COLUMN public.cash_movements.id                IS 'Identificador único del movimiento (UUID v4).';
COMMENT ON COLUMN public.cash_movements.cash_register_id  IS 'FK al turno de caja al que pertenece el movimiento.';
COMMENT ON COLUMN public.cash_movements.movement_type     IS 'Tipo: INGRESO, EGRESO, VENTA o PAGO_CREDITO.';
COMMENT ON COLUMN public.cash_movements.category          IS 'Categoría contable del movimiento para agrupación en reportes.';
COMMENT ON COLUMN public.cash_movements.amount            IS 'Monto del movimiento. Siempre positivo; el tipo define si es entrada o salida.';
COMMENT ON COLUMN public.cash_movements.description       IS 'Descripción obligatoria del movimiento. Ej: "Venta #1234 efectivo".';
COMMENT ON COLUMN public.cash_movements.reference_id      IS 'UUID de la entidad origen. Ej: payment.id o customer_payment.id.';
COMMENT ON COLUMN public.cash_movements.reference_type    IS 'Tipo de la entidad origen. Ej: SALE, CUSTOMER_PAYMENT.';
COMMENT ON COLUMN public.cash_movements.created_by        IS 'FK al usuario que registra o genera el movimiento.';
COMMENT ON COLUMN public.cash_movements.created_at        IS 'Timestamp del movimiento (UTC). Inmutable.';

-- ---------------------------------------------------------------------------
-- FUNCIÓN: fn_register_sale_cash_movement
-- Trigger AFTER INSERT en payments.
-- Si el pago es en EFECTIVO, busca la caja OPEN del vendedor de la venta
-- y registra un movimiento INGRESO / VENTA_EFECTIVO.
--
-- Diseño intencional: si no hay caja abierta NO lanza excepción.
-- La caja es un control gerencial/contable; no debe bloquear las ventas.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_register_sale_cash_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_cash_register_id UUID;
    v_seller_id        UUID;
    v_sale_number      BIGINT;
BEGIN
    -- Solo procesar pagos en efectivo
    IF NEW.method <> 'EFECTIVO' THEN
        RETURN NEW;
    END IF;

    -- Obtener el vendedor y número de venta
    SELECT s.seller_id, s.sale_number
    INTO   v_seller_id, v_sale_number
    FROM   public.sales s
    WHERE  s.id = NEW.sale_id;

    IF NOT FOUND THEN
        -- La venta no existe: no bloquear, el FK en payments ya lo valida
        RETURN NEW;
    END IF;

    -- Buscar la caja OPEN del vendedor
    SELECT id
    INTO   v_cash_register_id
    FROM   public.cash_registers
    WHERE  cashier_id = v_seller_id
      AND  status     = 'OPEN'
    LIMIT 1;

    -- Si no hay caja abierta: registrar silenciosamente, no fallar
    IF v_cash_register_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Insertar movimiento de caja
    INSERT INTO public.cash_movements (
        cash_register_id,
        movement_type,
        category,
        amount,
        description,
        reference_id,
        reference_type,
        created_by
    ) VALUES (
        v_cash_register_id,
        'VENTA',
        'VENTA_EFECTIVO',
        NEW.amount - NEW.change_amount,  -- monto neto recibido (sin vuelto)
        'Venta #' || v_sale_number || ' - Pago efectivo',
        NEW.sale_id,
        'SALE',
        v_seller_id
    );

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_register_sale_cash_movement() IS
    'Trigger AFTER INSERT en payments. '
    'Si method = EFECTIVO y existe caja OPEN del vendedor, registra movimiento VENTA/VENTA_EFECTIVO. '
    'Si no hay caja abierta, no lanza excepción (la caja es control gerencial, no operativo).';

-- Trigger que registra movimientos de venta en caja automáticamente
CREATE TRIGGER trg_payments_cash_movement
    AFTER INSERT ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_register_sale_cash_movement();

-- ---------------------------------------------------------------------------
-- TRIGGER: updated_at en cash_registers
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_cash_registers_updated_at
    BEFORE UPDATE ON public.cash_registers
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- INDEXES - Módulo caja
-- ---------------------------------------------------------------------------

-- Caja abierta por cajero (consulta más frecuente del módulo: "¿hay caja abierta?")
CREATE INDEX IF NOT EXISTS idx_cash_registers_cashier_open
    ON public.cash_registers (cashier_id, status)
    WHERE status = 'OPEN';

-- Historial de cajas por cajero con fecha (reporte de turnos)
CREATE INDEX IF NOT EXISTS idx_cash_registers_cashier_date
    ON public.cash_registers (cashier_id, opened_at DESC);

-- Cajas por estado y fecha (listado de cajas abiertas en el panel gerencial)
CREATE INDEX IF NOT EXISTS idx_cash_registers_status_date
    ON public.cash_registers (status, opened_at DESC);

-- Movimientos por caja (detalle de turno)
CREATE INDEX IF NOT EXISTS idx_cash_movements_register_id
    ON public.cash_movements (cash_register_id, created_at DESC);

-- Movimientos por tipo (análisis de egresos, ingresos por categoría)
CREATE INDEX IF NOT EXISTS idx_cash_movements_type_category
    ON public.cash_movements (movement_type, category, created_at DESC);

-- Movimientos por referencia (trazabilidad desde una venta o pago)
CREATE INDEX IF NOT EXISTS idx_cash_movements_reference
    ON public.cash_movements (reference_type, reference_id)
    WHERE reference_id IS NOT NULL;

-- Movimientos por fecha (reporte de caja del día)
CREATE INDEX IF NOT EXISTS idx_cash_movements_created_at
    ON public.cash_movements (created_at DESC);

COMMIT;

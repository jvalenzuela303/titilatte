-- =============================================================================
-- V9__alter_customers_credit.sql
-- Minimarket Platform - Fase 2
-- Módulo: Clientes y Crédito
--
-- Modificaciones a tabla customers (ya existe desde V3):
--   - Agrega columna version (optimistic locking para @Version de JPA)
--
-- Tabla nueva: customer_payments (abonos a cuenta corriente)
--
-- Triggers:
--   - trg_customer_payment_credit: descuenta credit_used al registrar abono
--   - trg_sale_credit_update: incrementa credit_used al confirmar venta a crédito
--
-- Nota de diseño:
--   - customers ya tiene en V3: rut, phone, email, address, credit_limit,
--     credit_used, is_active, notes, created_at, updated_at, deleted_at
--     y los constraints: chk_customers_credit_limit, chk_customers_credit_used,
--     chk_customers_credit_range, uq_customers_rut
--   - Esta migración solo agrega la columna `version` que faltaba para
--     optimistic locking en el ORM
--   - La constraint chk_customers_credit_range (credit_used <= credit_limit)
--     ya existe en V3; se renombra aquí para consistencia con la nueva
--     regla de credit_limit = 0 (sin límite)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- ALTERAR tabla customers: agregar columna version para optimistic locking
-- Usada por Spring Data JPA @Version para prevenir lost updates concurrentes.
-- ---------------------------------------------------------------------------
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.customers.version IS
    'Versión para optimistic locking (JPA @Version). '
    'Se incrementa en cada UPDATE. Previene lost updates concurrentes.';

-- ---------------------------------------------------------------------------
-- AJUSTE DE CONSTRAINT: crédito permitido cuando credit_limit = 0 (sin límite)
-- En V3 existe chk_customers_credit_range: credit_used <= credit_limit.
-- Esa regla bloquea clientes sin límite de crédito configurado (credit_limit=0).
-- Se reemplaza por una lógica que permite credit_limit = 0 como "sin límite".
--
-- ADVERTENCIA: operación destructiva en constraint existente.
-- Ejecutar durante ventana de mantenimiento si hay datos en producción.
-- ---------------------------------------------------------------------------
ALTER TABLE public.customers
    DROP CONSTRAINT IF EXISTS chk_customers_credit_range;

ALTER TABLE public.customers
    ADD CONSTRAINT chk_customers_credit_not_exceeded
        CHECK (
            credit_limit = 0 OR
            credit_used <= credit_limit
        );

COMMENT ON CONSTRAINT chk_customers_credit_not_exceeded ON public.customers IS
    'Garantiza que credit_used no supere credit_limit. '
    'Si credit_limit = 0 se interpreta como sin límite de crédito asignado.';

-- ---------------------------------------------------------------------------
-- TABLE: customer_payments
-- Abonos de clientes a su cuenta corriente. Reduce credit_used.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_payments (
    id              UUID                    NOT NULL DEFAULT gen_random_uuid(),
    customer_id     UUID                    NOT NULL,
    cash_register_id UUID,
    amount          NUMERIC(12, 2)          NOT NULL,
    payment_method  public.payment_method   NOT NULL,
    notes           VARCHAR(300),
    received_by     UUID                    NOT NULL,
    created_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_customer_payments PRIMARY KEY (id),
    CONSTRAINT fk_customer_payments_customer
        FOREIGN KEY (customer_id)
        REFERENCES public.customers (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_customer_payments_cash_register
        FOREIGN KEY (cash_register_id)
        REFERENCES public.cash_registers (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_customer_payments_received_by
        FOREIGN KEY (received_by)
        REFERENCES public.users (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT chk_customer_payments_amount
        CHECK (amount > 0)
);

COMMENT ON TABLE  public.customer_payments                   IS 'Abonos de clientes a su cuenta corriente (credit_used). Reduce la deuda del cliente.';
COMMENT ON COLUMN public.customer_payments.id                IS 'Identificador único del abono (UUID v4).';
COMMENT ON COLUMN public.customer_payments.customer_id       IS 'FK al cliente que realiza el abono.';
COMMENT ON COLUMN public.customer_payments.cash_register_id  IS 'FK a la caja donde se recibió el abono. NULL si se recibe fuera de turno.';
COMMENT ON COLUMN public.customer_payments.amount            IS 'Monto del abono. Siempre positivo.';
COMMENT ON COLUMN public.customer_payments.payment_method    IS 'Método de pago del abono: EFECTIVO, TRANSFERENCIA o TARJETA.';
COMMENT ON COLUMN public.customer_payments.notes             IS 'Observaciones del abono (ej: número de transferencia).';
COMMENT ON COLUMN public.customer_payments.received_by       IS 'FK al usuario que recibe el abono. Requerido para auditoría.';
COMMENT ON COLUMN public.customer_payments.created_at        IS 'Timestamp del abono (UTC).';

-- ---------------------------------------------------------------------------
-- FUNCIÓN: fn_customer_payment_credit
-- Trigger AFTER INSERT en customer_payments.
-- Descuenta el credit_used del cliente.
-- Si el abono supera la deuda actual, resetea credit_used a 0 (nunca negativo).
-- Además, si el pago fue en EFECTIVO y hay caja abierta del receptor,
-- registra un movimiento en cash_movements.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_customer_payment_credit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_cash_register_id UUID;
    v_customer_name    VARCHAR;
BEGIN
    -- Obtener nombre del cliente para descripción del movimiento
    SELECT first_name || COALESCE(' ' || last_name, '')
    INTO   v_customer_name
    FROM   public.customers
    WHERE  id = NEW.customer_id;

    -- Descontar credit_used con lock pesimista para prevenir race conditions
    UPDATE public.customers
    SET    credit_used = GREATEST(0, credit_used - NEW.amount),
           version     = version + 1,
           updated_at  = NOW()
    WHERE  id = NEW.customer_id;

    -- Si el abono es en efectivo: buscar caja abierta del receptor para registrar ingreso
    IF NEW.payment_method = 'EFECTIVO' THEN

        -- Usar cash_register_id provisto; si es NULL, buscar caja abierta del receptor
        IF NEW.cash_register_id IS NOT NULL THEN
            v_cash_register_id := NEW.cash_register_id;
        ELSE
            SELECT id
            INTO   v_cash_register_id
            FROM   public.cash_registers
            WHERE  cashier_id = NEW.received_by
              AND  status     = 'OPEN'
            LIMIT 1;
        END IF;

        -- Registrar en caja si existe
        IF v_cash_register_id IS NOT NULL THEN
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
                'PAGO_CREDITO',
                'PAGO_CLIENTE',
                NEW.amount,
                'Abono cuenta corriente cliente: ' || COALESCE(v_customer_name, NEW.customer_id::TEXT),
                NEW.id,
                'CUSTOMER_PAYMENT',
                NEW.received_by
            );
        END IF;

    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_customer_payment_credit() IS
    'Trigger AFTER INSERT en customer_payments. '
    'Descuenta credit_used del cliente (GREATEST(0, credit_used - amount)). '
    'Si payment_method = EFECTIVO y hay caja abierta del receptor, registra movimiento PAGO_CREDITO.';

CREATE TRIGGER trg_customer_payment_credit
    AFTER INSERT ON public.customer_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_customer_payment_credit();

-- ---------------------------------------------------------------------------
-- FUNCIÓN: fn_sale_credit_update
-- Trigger AFTER UPDATE OF status en sales.
-- Cuando una venta se confirma (PENDING → CONFIRMED) y es de tipo CREDITO o MIXTO,
-- incrementa el credit_used del cliente con el monto a crédito.
--
-- El monto a crédito se determina por los pagos de método CREDITO en la venta.
-- Si no existen pagos CREDITO, se toma el total_amount (venta 100% a crédito).
-- Lanza excepción P0004 si el incremento supera el credit_limit del cliente
-- (siempre que credit_limit > 0; si credit_limit = 0 no hay límite asignado).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sale_credit_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_credit_amount  NUMERIC(12, 2);
    v_credit_limit   NUMERIC(12, 2);
    v_credit_used    NUMERIC(12, 2);
    v_customer_name  VARCHAR;
BEGIN
    -- Solo procesar PENDING → CONFIRMED con tipo CREDITO o MIXTO
    IF NOT (NEW.status = 'CONFIRMED' AND OLD.status = 'PENDING'
            AND NEW.type IN ('CREDITO', 'MIXTO')) THEN
        RETURN NEW;
    END IF;

    -- customer_id es obligatorio para ventas a crédito
    IF NEW.customer_id IS NULL THEN
        RAISE EXCEPTION
            'Venta a crédito (id: %) requiere un cliente asociado.', NEW.id
            USING ERRCODE = 'P0005';
    END IF;

    -- Calcular el monto a crédito: suma de pagos con método CREDITO
    SELECT COALESCE(SUM(p.amount), 0)
    INTO   v_credit_amount
    FROM   public.payments p
    WHERE  p.sale_id = NEW.id
      AND  p.method  = 'CREDITO';

    -- Si no hay pagos CREDITO registrados, asumir venta 100% a crédito
    IF v_credit_amount = 0 THEN
        v_credit_amount := NEW.total_amount;
    END IF;

    -- Leer estado actual del cliente con lock pesimista
    SELECT c.credit_limit,
           c.credit_used,
           c.first_name || COALESCE(' ' || c.last_name, '')
    INTO   v_credit_limit,
           v_credit_used,
           v_customer_name
    FROM   public.customers c
    WHERE  c.id = NEW.customer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Cliente % no encontrado al confirmar venta a crédito.', NEW.customer_id
            USING ERRCODE = 'P0001';
    END IF;

    -- Validar límite de crédito (solo si credit_limit > 0, es decir tiene límite asignado)
    IF v_credit_limit > 0 AND (v_credit_used + v_credit_amount) > v_credit_limit THEN
        RAISE EXCEPTION
            'Límite de crédito superado para cliente %. '
            'Límite: %, Deuda actual: %, Monto a crédito: %.',
            v_customer_name, v_credit_limit, v_credit_used, v_credit_amount
            USING ERRCODE = 'P0004';
    END IF;

    -- Incrementar credit_used
    UPDATE public.customers
    SET    credit_used = credit_used + v_credit_amount,
           version     = version + 1,
           updated_at  = NOW()
    WHERE  id = NEW.customer_id;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_sale_credit_update() IS
    'Trigger AFTER UPDATE en sales. '
    'PENDING → CONFIRMED con type CREDITO/MIXTO: incrementa customers.credit_used '
    'con el monto de pagos CREDITO de la venta. '
    'Lanza P0004 si supera credit_limit (cuando credit_limit > 0). '
    'Lanza P0005 si la venta a crédito no tiene cliente asociado.';

CREATE TRIGGER trg_sale_credit_update
    AFTER UPDATE OF status ON public.sales
    FOR EACH ROW
    WHEN (
        OLD.status = 'PENDING'
        AND NEW.status = 'CONFIRMED'
        AND NEW.type IN ('CREDITO', 'MIXTO')
    )
    EXECUTE FUNCTION public.fn_sale_credit_update();

-- ---------------------------------------------------------------------------
-- INDEXES - Módulo clientes y crédito
-- ---------------------------------------------------------------------------

-- Abonos por cliente con fecha (historial de cuenta corriente)
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_date
    ON public.customer_payments (customer_id, created_at DESC);

-- Abonos por caja (para cuadre de caja)
CREATE INDEX IF NOT EXISTS idx_customer_payments_register
    ON public.customer_payments (cash_register_id, created_at DESC)
    WHERE cash_register_id IS NOT NULL;

-- Abonos por receptor (reporte de gestión de cobros)
CREATE INDEX IF NOT EXISTS idx_customer_payments_received_by
    ON public.customer_payments (received_by, created_at DESC);

-- Clientes con deuda activa (reporte de deudores)
CREATE INDEX IF NOT EXISTS idx_customers_credit_active
    ON public.customers (credit_used DESC, credit_limit)
    WHERE credit_used > 0 AND deleted_at IS NULL;

COMMIT;

-- =============================================================================
-- V3__create_sales_schema.sql
-- Minimarket Platform - Fase 1
-- Módulo: Ventas
--
-- Tablas: customers, sales, sale_details, payments
-- Secuencia: sale_number autoincremental
-- Constraints: no vender con stock=0, subtotal calculado, integridad monetaria
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- ENUM: Tipo de venta
-- ---------------------------------------------------------------------------
CREATE TYPE public.sale_type AS ENUM (
    'CONTADO',
    'CREDITO',
    'MIXTO'
);

COMMENT ON TYPE public.sale_type IS
    'Modalidad de pago de la venta. CONTADO pago inmediato, CREDITO fiado/cuenta corriente, MIXTO combinado.';

-- ---------------------------------------------------------------------------
-- ENUM: Estado de la venta
-- ---------------------------------------------------------------------------
CREATE TYPE public.sale_status AS ENUM (
    'PENDING',
    'CONFIRMED',
    'CANCELLED'
);

COMMENT ON TYPE public.sale_status IS
    'Ciclo de vida de una venta. PENDING en proceso, CONFIRMED completada y stock descontado, CANCELLED anulada.';

-- ---------------------------------------------------------------------------
-- ENUM: Método de pago
-- ---------------------------------------------------------------------------
CREATE TYPE public.payment_method AS ENUM (
    'EFECTIVO',
    'TARJETA',
    'TRANSFERENCIA',
    'CREDITO'
);

COMMENT ON TYPE public.payment_method IS
    'Método de pago utilizado en la transacción. CREDITO registra deuda en cuenta corriente.';

-- ---------------------------------------------------------------------------
-- TABLE: customers
-- Clientes del minimarket. Opcional en ventas de mostrador (customer_id nullable).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
    id           UUID         NOT NULL DEFAULT gen_random_uuid(),
    rut          VARCHAR(20),
    first_name   VARCHAR(100) NOT NULL,
    last_name    VARCHAR(100),
    phone        VARCHAR(20),
    email        VARCHAR(255),
    address      TEXT,
    credit_limit NUMERIC(12, 2) NOT NULL DEFAULT 0,
    credit_used  NUMERIC(12, 2) NOT NULL DEFAULT 0,
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    notes        TEXT,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ,

    CONSTRAINT pk_customers          PRIMARY KEY (id),
    CONSTRAINT uq_customers_rut      UNIQUE (rut),
    CONSTRAINT chk_customers_credit_limit
        CHECK (credit_limit >= 0),
    CONSTRAINT chk_customers_credit_used
        CHECK (credit_used >= 0),
    CONSTRAINT chk_customers_credit_range
        CHECK (credit_used <= credit_limit)
);

COMMENT ON TABLE  public.customers              IS 'Clientes del minimarket. Usado para ventas a crédito y fidelización.';
COMMENT ON COLUMN public.customers.id           IS 'Identificador único del cliente (UUID v4).';
COMMENT ON COLUMN public.customers.rut          IS 'RUT o identificador fiscal del cliente. NULL para clientes sin registro formal.';
COMMENT ON COLUMN public.customers.first_name   IS 'Nombres del cliente.';
COMMENT ON COLUMN public.customers.last_name    IS 'Apellidos del cliente. Opcional para clientes de mostrador.';
COMMENT ON COLUMN public.customers.phone        IS 'Teléfono de contacto del cliente.';
COMMENT ON COLUMN public.customers.email        IS 'Correo electrónico del cliente. Opcional.';
COMMENT ON COLUMN public.customers.address      IS 'Dirección del cliente para despachos o registros.';
COMMENT ON COLUMN public.customers.credit_limit IS 'Límite máximo de crédito autorizado en moneda local.';
COMMENT ON COLUMN public.customers.credit_used  IS 'Deuda vigente del cliente. Nunca supera credit_limit.';
COMMENT ON COLUMN public.customers.is_active    IS 'FALSE bloquea nuevas ventas a crédito sin eliminar historial.';
COMMENT ON COLUMN public.customers.notes        IS 'Notas internas sobre el cliente.';
COMMENT ON COLUMN public.customers.created_at   IS 'Timestamp de creación (UTC).';
COMMENT ON COLUMN public.customers.updated_at   IS 'Timestamp de última modificación (UTC).';
COMMENT ON COLUMN public.customers.deleted_at   IS 'Soft delete: NULL = activo, NOT NULL = eliminado lógicamente.';

-- ---------------------------------------------------------------------------
-- SEQUENCE: sale_number
-- Número de venta secuencial y sin huecos visible en tickets/boletas.
-- Separado de la PK UUID para independencia entre legibilidad y PK.
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.seq_sale_number
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

COMMENT ON SEQUENCE public.seq_sale_number IS
    'Secuencia para el número de venta visible en tickets. Estrictamente incremental, sin huecos en condiciones normales.';

-- ---------------------------------------------------------------------------
-- TABLE: sales
-- Cabecera de venta. El stock se descuenta al transitar a CONFIRMED.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales (
    id              UUID               NOT NULL DEFAULT gen_random_uuid(),
    sale_number     BIGINT             NOT NULL DEFAULT nextval('public.seq_sale_number'),
    type            public.sale_type   NOT NULL DEFAULT 'CONTADO',
    status          public.sale_status NOT NULL DEFAULT 'PENDING',
    total_amount    NUMERIC(12, 2)     NOT NULL DEFAULT 0,
    discount_amount NUMERIC(12, 2)     NOT NULL DEFAULT 0,
    tax_amount      NUMERIC(12, 2)     NOT NULL DEFAULT 0,
    net_amount      NUMERIC(12, 2)     NOT NULL DEFAULT 0,
    seller_id       UUID               NOT NULL,
    customer_id     UUID,
    notes           TEXT,
    cancelled_by    UUID,
    cancelled_at    TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_sales             PRIMARY KEY (id),
    CONSTRAINT uq_sales_sale_number UNIQUE (sale_number),
    CONSTRAINT fk_sales_seller
        FOREIGN KEY (seller_id)
        REFERENCES public.users (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_sales_customer
        FOREIGN KEY (customer_id)
        REFERENCES public.customers (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_sales_cancelled_by
        FOREIGN KEY (cancelled_by)
        REFERENCES public.users (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    -- Montos nunca negativos
    CONSTRAINT chk_sales_total_amount
        CHECK (total_amount >= 0),
    CONSTRAINT chk_sales_discount_amount
        CHECK (discount_amount >= 0),
    CONSTRAINT chk_sales_tax_amount
        CHECK (tax_amount >= 0),
    CONSTRAINT chk_sales_net_amount
        CHECK (net_amount >= 0),
    -- Descuento no puede superar el total
    CONSTRAINT chk_sales_discount_range
        CHECK (discount_amount <= total_amount),
    -- Cancelación requiere datos completos
    CONSTRAINT chk_sales_cancellation_consistency
        CHECK (
            (cancelled_by IS NULL AND cancelled_at IS NULL) OR
            (cancelled_by IS NOT NULL AND cancelled_at IS NOT NULL)
        )
);

COMMENT ON TABLE  public.sales                      IS 'Cabecera de venta. El estado CONFIRMED activa el descuento de stock y registro de movimientos.';
COMMENT ON COLUMN public.sales.id                   IS 'Identificador único de la venta (UUID v4).';
COMMENT ON COLUMN public.sales.sale_number          IS 'Número de venta secuencial visible en tickets. Único e irrepetible.';
COMMENT ON COLUMN public.sales.type                 IS 'Modalidad de la venta: CONTADO, CREDITO o MIXTO.';
COMMENT ON COLUMN public.sales.status               IS 'Estado del ciclo de vida: PENDING → CONFIRMED | CANCELLED.';
COMMENT ON COLUMN public.sales.total_amount         IS 'Total bruto de la venta incluyendo impuestos y menos descuentos.';
COMMENT ON COLUMN public.sales.discount_amount      IS 'Total de descuentos aplicados en la venta.';
COMMENT ON COLUMN public.sales.tax_amount           IS 'Total de impuestos incluidos en el precio de venta.';
COMMENT ON COLUMN public.sales.net_amount           IS 'Monto neto sin impuestos (total_amount - tax_amount).';
COMMENT ON COLUMN public.sales.seller_id            IS 'FK al usuario cajero que realizó la venta.';
COMMENT ON COLUMN public.sales.customer_id          IS 'FK al cliente. NULL para ventas de mostrador sin identificación.';
COMMENT ON COLUMN public.sales.notes                IS 'Notas internas de la venta.';
COMMENT ON COLUMN public.sales.cancelled_by         IS 'FK al usuario que anuló la venta. NULL si no cancelada.';
COMMENT ON COLUMN public.sales.cancelled_at         IS 'Timestamp de cancelación (UTC). NULL si no cancelada.';
COMMENT ON COLUMN public.sales.cancellation_reason  IS 'Motivo de la anulación. Requerido por auditoría.';
COMMENT ON COLUMN public.sales.created_at           IS 'Timestamp de creación de la venta (UTC).';
COMMENT ON COLUMN public.sales.updated_at           IS 'Timestamp de última modificación (UTC).';

-- ---------------------------------------------------------------------------
-- TABLE: sale_details
-- Líneas de detalle de cada venta. Cada fila = 1 producto en la transacción.
-- unit_price captura el precio vigente al momento de la venta (snapshot).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sale_details (
    id          UUID           NOT NULL DEFAULT gen_random_uuid(),
    sale_id     UUID           NOT NULL,
    product_id  UUID           NOT NULL,
    quantity    NUMERIC(12, 4) NOT NULL,
    unit_price  NUMERIC(12, 4) NOT NULL,
    discount    NUMERIC(12, 4) NOT NULL DEFAULT 0,
    subtotal    NUMERIC(12, 4) NOT NULL,
    tax_rate    NUMERIC(5, 4)  NOT NULL DEFAULT 0,
    tax_amount  NUMERIC(12, 4) NOT NULL DEFAULT 0,

    CONSTRAINT pk_sale_details PRIMARY KEY (id),
    CONSTRAINT fk_sale_details_sale
        FOREIGN KEY (sale_id)
        REFERENCES public.sales (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_sale_details_product
        FOREIGN KEY (product_id)
        REFERENCES public.products (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    -- Cantidad y precio siempre positivos
    CONSTRAINT chk_sale_details_quantity
        CHECK (quantity > 0),
    CONSTRAINT chk_sale_details_unit_price
        CHECK (unit_price >= 0),
    CONSTRAINT chk_sale_details_discount
        CHECK (discount >= 0 AND discount <= unit_price * quantity),
    CONSTRAINT chk_sale_details_subtotal
        CHECK (subtotal >= 0),
    CONSTRAINT chk_sale_details_tax_rate
        CHECK (tax_rate >= 0 AND tax_rate <= 1)
);

COMMENT ON TABLE  public.sale_details            IS 'Líneas de detalle de la venta. Snapshot de precios al momento de confirmar.';
COMMENT ON COLUMN public.sale_details.id         IS 'Identificador único del detalle (UUID v4).';
COMMENT ON COLUMN public.sale_details.sale_id    IS 'FK a la venta cabecera.';
COMMENT ON COLUMN public.sale_details.product_id IS 'FK al producto vendido.';
COMMENT ON COLUMN public.sale_details.quantity   IS 'Cantidad vendida del producto en esta línea.';
COMMENT ON COLUMN public.sale_details.unit_price IS 'Precio unitario al momento de la venta (snapshot). No refleja cambios posteriores de precio.';
COMMENT ON COLUMN public.sale_details.discount   IS 'Descuento total aplicado en esta línea (monto, no porcentaje).';
COMMENT ON COLUMN public.sale_details.subtotal   IS 'Subtotal de la línea: (unit_price * quantity) - discount.';
COMMENT ON COLUMN public.sale_details.tax_rate   IS 'Tasa de impuesto vigente al momento de la venta (snapshot).';
COMMENT ON COLUMN public.sale_details.tax_amount IS 'Monto de impuesto calculado para esta línea.';

-- ---------------------------------------------------------------------------
-- TABLE: payments
-- Pagos asociados a una venta. Una venta puede tener múltiples pagos
-- (ej: parte efectivo, parte tarjeta en venta MIXTO).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id            UUID                   NOT NULL DEFAULT gen_random_uuid(),
    sale_id       UUID                   NOT NULL,
    method        public.payment_method  NOT NULL,
    amount        NUMERIC(12, 2)         NOT NULL,
    change_amount NUMERIC(12, 2)         NOT NULL DEFAULT 0,
    reference     VARCHAR(100),
    created_at    TIMESTAMPTZ            NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_payments PRIMARY KEY (id),
    CONSTRAINT fk_payments_sale
        FOREIGN KEY (sale_id)
        REFERENCES public.sales (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    -- Monto siempre positivo
    CONSTRAINT chk_payments_amount
        CHECK (amount > 0),
    -- Vuelto solo aplica a efectivo
    CONSTRAINT chk_payments_change_amount
        CHECK (change_amount >= 0),
    CONSTRAINT chk_payments_change_cash_only
        CHECK (
            (method = 'EFECTIVO' AND change_amount >= 0) OR
            (method != 'EFECTIVO' AND change_amount = 0)
        )
);

COMMENT ON TABLE  public.payments               IS 'Pagos registrados para una venta. Múltiples pagos por venta en modalidad MIXTO.';
COMMENT ON COLUMN public.payments.id            IS 'Identificador único del pago (UUID v4).';
COMMENT ON COLUMN public.payments.sale_id       IS 'FK a la venta a la que corresponde este pago.';
COMMENT ON COLUMN public.payments.method        IS 'Método de pago: EFECTIVO, TARJETA, TRANSFERENCIA o CREDITO.';
COMMENT ON COLUMN public.payments.amount        IS 'Monto pagado con este método.';
COMMENT ON COLUMN public.payments.change_amount IS 'Vuelto entregado al cliente. Solo aplica para EFECTIVO.';
COMMENT ON COLUMN public.payments.reference     IS 'Referencia del pago: número de voucher, comprobante de transferencia, etc.';
COMMENT ON COLUMN public.payments.created_at    IS 'Timestamp del registro del pago (UTC).';

-- ---------------------------------------------------------------------------
-- TRIGGERS: updated_at y auditoría
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_sales_updated_at
    BEFORE UPDATE ON public.sales
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- INDEXES - Módulo ventas
-- ---------------------------------------------------------------------------

-- Búsqueda de venta por número (vista de detalle y reimpresión de ticket)
CREATE INDEX IF NOT EXISTS idx_sales_sale_number
    ON public.sales (sale_number DESC);

-- Ventas por cajero con filtro de fecha (reporte de turno)
CREATE INDEX IF NOT EXISTS idx_sales_seller_date
    ON public.sales (seller_id, created_at DESC);

-- Ventas por cliente (historial de compras y cuenta corriente)
CREATE INDEX IF NOT EXISTS idx_sales_customer_id
    ON public.sales (customer_id)
    WHERE customer_id IS NOT NULL;

-- Ventas por estado (listado de pendientes, dashboard)
CREATE INDEX IF NOT EXISTS idx_sales_status
    ON public.sales (status, created_at DESC);

-- Ventas en rango de fechas (reportes diarios, cierre de caja)
CREATE INDEX IF NOT EXISTS idx_sales_created_at
    ON public.sales (created_at DESC);

-- Detalle por venta (carga de ticket, devoluciones)
CREATE INDEX IF NOT EXISTS idx_sale_details_sale_id
    ON public.sale_details (sale_id);

-- Detalle por producto (análisis de ventas por producto)
CREATE INDEX IF NOT EXISTS idx_sale_details_product_id
    ON public.sale_details (product_id);

-- Pagos por venta (carga de comprobante)
CREATE INDEX IF NOT EXISTS idx_payments_sale_id
    ON public.payments (sale_id);

-- Clientes activos por nombre (buscador en POS)
CREATE INDEX IF NOT EXISTS idx_customers_name
    ON public.customers (first_name, last_name)
    WHERE deleted_at IS NULL AND is_active = TRUE;

-- Clientes por RUT (búsqueda fiscal)
CREATE INDEX IF NOT EXISTS idx_customers_rut
    ON public.customers (rut)
    WHERE rut IS NOT NULL AND deleted_at IS NULL;

COMMIT;

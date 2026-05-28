-- =============================================================================
-- V7__create_purchases_schema.sql
-- Minimarket Platform - Fase 2
-- Módulo: Compras y Proveedores
--
-- Tablas: suppliers, purchases, purchase_details
-- Secuencia: seq_purchase_number
-- Función: fn_confirm_purchase (costo promedio ponderado + movimiento de stock)
-- Trigger: trg_confirm_purchase (AFTER UPDATE OF status ON purchases)
--
-- Reglas de negocio:
--   - Al confirmar compra se recalcula el costo promedio ponderado del producto
--   - El costo promedio se actualiza atómicamente con lock pesimista (SELECT FOR UPDATE)
--   - Cada línea de compra genera un movimiento COMPRA en stock_movements
--   - El número de compra es secuencial y human-readable (independiente del UUID PK)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- ENUM: Tipo de documento de compra
-- ---------------------------------------------------------------------------
CREATE TYPE public.purchase_document_type AS ENUM (
    'FACTURA',
    'BOLETA',
    'SIN_DOCUMENTO'
);

COMMENT ON TYPE public.purchase_document_type IS
    'Tipo de documento tributario asociado a la compra. '
    'FACTURA para personas jurídicas, BOLETA para persona natural, '
    'SIN_DOCUMENTO para compras sin respaldo formal.';

-- ---------------------------------------------------------------------------
-- ENUM: Estado de la orden de compra
-- ---------------------------------------------------------------------------
CREATE TYPE public.purchase_status AS ENUM (
    'DRAFT',
    'CONFIRMED',
    'CANCELLED'
);

COMMENT ON TYPE public.purchase_status IS
    'Ciclo de vida de una compra. '
    'DRAFT en preparación, CONFIRMED ingresa stock y actualiza costos, '
    'CANCELLED anulada sin efecto en inventario.';

-- ---------------------------------------------------------------------------
-- SEQUENCE: purchase_number
-- Número de compra secuencial y legible. Separado del UUID PK.
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.seq_purchase_number
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

COMMENT ON SEQUENCE public.seq_purchase_number IS
    'Secuencia para el número de compra visible en documentos. '
    'Estrictamente incremental, sin huecos en condiciones normales.';

-- ---------------------------------------------------------------------------
-- TABLE: suppliers
-- Proveedores del minimarket. Nullable en purchases para compras informales.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.suppliers (
    id           UUID         NOT NULL DEFAULT gen_random_uuid(),
    name         VARCHAR(200) NOT NULL,
    rut          VARCHAR(20),
    contact_name VARCHAR(100),
    phone        VARCHAR(20),
    email        VARCHAR(150),
    address      TEXT,
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ,

    CONSTRAINT pk_suppliers      PRIMARY KEY (id),
    CONSTRAINT uq_suppliers_rut  UNIQUE (rut),
    CONSTRAINT chk_suppliers_name_not_empty
        CHECK (TRIM(name) <> '')
);

COMMENT ON TABLE  public.suppliers              IS 'Proveedores del minimarket. Referenciados desde purchases para trazabilidad.';
COMMENT ON COLUMN public.suppliers.id           IS 'Identificador único del proveedor (UUID v4).';
COMMENT ON COLUMN public.suppliers.name         IS 'Razón social o nombre comercial del proveedor.';
COMMENT ON COLUMN public.suppliers.rut          IS 'RUT o NIT del proveedor (formato chileno). Único cuando informado.';
COMMENT ON COLUMN public.suppliers.contact_name IS 'Nombre del contacto comercial en el proveedor.';
COMMENT ON COLUMN public.suppliers.phone        IS 'Teléfono de contacto del proveedor.';
COMMENT ON COLUMN public.suppliers.email        IS 'Correo electrónico de contacto del proveedor.';
COMMENT ON COLUMN public.suppliers.address      IS 'Dirección física o legal del proveedor.';
COMMENT ON COLUMN public.suppliers.is_active    IS 'FALSE oculta el proveedor en formularios sin eliminarlo.';
COMMENT ON COLUMN public.suppliers.created_at   IS 'Timestamp de creación del registro (UTC).';
COMMENT ON COLUMN public.suppliers.updated_at   IS 'Timestamp de última modificación del registro (UTC).';
COMMENT ON COLUMN public.suppliers.deleted_at   IS 'Soft delete: NULL = activo, NOT NULL = eliminado lógicamente.';

-- ---------------------------------------------------------------------------
-- TABLE: purchases
-- Cabecera de orden de compra. El stock ingresa al confirmar (CONFIRMED).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchases (
    id              UUID                          NOT NULL DEFAULT gen_random_uuid(),
    purchase_number BIGINT                        NOT NULL DEFAULT nextval('public.seq_purchase_number'),
    supplier_id     UUID,
    document_type   public.purchase_document_type NOT NULL DEFAULT 'SIN_DOCUMENTO',
    document_number VARCHAR(50),
    total_amount    NUMERIC(12, 2)                NOT NULL,
    status          public.purchase_status        NOT NULL DEFAULT 'DRAFT',
    notes           TEXT,
    purchased_by    UUID                          NOT NULL,
    purchase_date   TIMESTAMPTZ                   NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ                   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ                   NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_purchases              PRIMARY KEY (id),
    CONSTRAINT uq_purchases_number       UNIQUE (purchase_number),
    CONSTRAINT fk_purchases_supplier
        FOREIGN KEY (supplier_id)
        REFERENCES public.suppliers (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_purchases_purchased_by
        FOREIGN KEY (purchased_by)
        REFERENCES public.users (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT chk_purchases_total_amount
        CHECK (total_amount > 0),
    -- document_number solo aplica cuando hay documento formal
    CONSTRAINT chk_purchases_document_consistency
        CHECK (
            document_type = 'SIN_DOCUMENTO' OR
            (document_type IN ('FACTURA', 'BOLETA') AND document_number IS NOT NULL)
        )
);

COMMENT ON TABLE  public.purchases                  IS 'Cabecera de orden de compra. Al confirmar ingresa stock y recalcula costo promedio ponderado.';
COMMENT ON COLUMN public.purchases.id               IS 'Identificador único de la compra (UUID v4).';
COMMENT ON COLUMN public.purchases.purchase_number  IS 'Número de compra secuencial visible en documentos. Único e irrepetible.';
COMMENT ON COLUMN public.purchases.supplier_id      IS 'FK al proveedor. NULL para compras sin proveedor registrado.';
COMMENT ON COLUMN public.purchases.document_type    IS 'Tipo de documento tributario: FACTURA, BOLETA o SIN_DOCUMENTO.';
COMMENT ON COLUMN public.purchases.document_number  IS 'Número del documento tributario. Requerido para FACTURA y BOLETA.';
COMMENT ON COLUMN public.purchases.total_amount     IS 'Monto total de la compra. Debe ser mayor a cero.';
COMMENT ON COLUMN public.purchases.status           IS 'Estado: DRAFT preparación, CONFIRMED stock ingresado, CANCELLED anulada.';
COMMENT ON COLUMN public.purchases.notes            IS 'Notas internas sobre la compra.';
COMMENT ON COLUMN public.purchases.purchased_by     IS 'FK al usuario de bodega que registra la compra. Requerido.';
COMMENT ON COLUMN public.purchases.purchase_date    IS 'Fecha efectiva de la compra (puede diferir de created_at).';
COMMENT ON COLUMN public.purchases.created_at       IS 'Timestamp de creación del registro (UTC).';
COMMENT ON COLUMN public.purchases.updated_at       IS 'Timestamp de última modificación del registro (UTC).';

-- ---------------------------------------------------------------------------
-- TABLE: purchase_details
-- Líneas de detalle de cada compra. Cada fila = 1 producto de la orden.
-- subtotal es columna generada para consistencia matemática garantizada.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_details (
    id            UUID           NOT NULL DEFAULT gen_random_uuid(),
    purchase_id   UUID           NOT NULL,
    product_id    UUID           NOT NULL,
    quantity      NUMERIC(10, 3) NOT NULL,
    unit_cost     NUMERIC(12, 4) NOT NULL,
    subtotal      NUMERIC(12, 2) GENERATED ALWAYS AS (ROUND(quantity * unit_cost, 2)) STORED,
    previous_cost NUMERIC(12, 4),
    new_avg_cost  NUMERIC(12, 4),

    CONSTRAINT pk_purchase_details PRIMARY KEY (id),
    CONSTRAINT fk_purchase_details_purchase
        FOREIGN KEY (purchase_id)
        REFERENCES public.purchases (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_purchase_details_product
        FOREIGN KEY (product_id)
        REFERENCES public.products (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT chk_purchase_details_quantity
        CHECK (quantity > 0),
    CONSTRAINT chk_purchase_details_unit_cost
        CHECK (unit_cost > 0)
);

COMMENT ON TABLE  public.purchase_details               IS 'Líneas de detalle de una compra. subtotal es columna generada (quantity * unit_cost).';
COMMENT ON COLUMN public.purchase_details.id            IS 'Identificador único del detalle (UUID v4).';
COMMENT ON COLUMN public.purchase_details.purchase_id   IS 'FK a la compra cabecera. ON DELETE CASCADE elimina detalles huérfanos.';
COMMENT ON COLUMN public.purchase_details.product_id    IS 'FK al producto recibido.';
COMMENT ON COLUMN public.purchase_details.quantity      IS 'Cantidad recibida del producto en esta línea. Siempre positiva.';
COMMENT ON COLUMN public.purchase_details.unit_cost     IS 'Costo unitario neto del producto en esta compra. Siempre positivo.';
COMMENT ON COLUMN public.purchase_details.subtotal      IS 'Subtotal generado automáticamente: ROUND(quantity * unit_cost, 2). Inmutable.';
COMMENT ON COLUMN public.purchase_details.previous_cost IS 'Snapshot del purchase_price anterior al confirmar la compra. Auditoría.';
COMMENT ON COLUMN public.purchase_details.new_avg_cost  IS 'Nuevo costo promedio ponderado resultante. Calculado por fn_confirm_purchase.';

-- ---------------------------------------------------------------------------
-- FUNCIÓN: fn_confirm_purchase
-- Ejecutada por trigger al confirmar una compra (status → CONFIRMED).
--
-- Para cada línea de detalle:
--   1. SELECT FOR UPDATE en products (lock pesimista, previene race conditions)
--   2. Calcula nuevo costo promedio ponderado:
--      nuevo_costo = (stock_actual * costo_anterior + cantidad * unit_cost)
--                    / (stock_actual + cantidad)
--   3. Actualiza products.purchase_price con el nuevo costo promedio
--   4. Guarda snapshots en purchase_details (previous_cost, new_avg_cost)
--   5. Llama a fn_apply_stock_movement con tipo COMPRA (cantidad positiva)
--
-- Nota: solo procesa la transición DRAFT → CONFIRMED.
-- Cancelar una compra CONFIRMED requiere ajuste manual de stock.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_confirm_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_detail         RECORD;
    v_current_stock  NUMERIC(12, 4);
    v_current_cost   NUMERIC(12, 4);
    v_new_avg_cost   NUMERIC(12, 4);
BEGIN
    -- Solo procesar la transición DRAFT → CONFIRMED
    IF NEW.status = 'CONFIRMED' AND OLD.status = 'DRAFT' THEN

        FOR v_detail IN
            SELECT pd.id        AS detail_id,
                   pd.product_id,
                   pd.quantity,
                   pd.unit_cost
            FROM   public.purchase_details pd
            WHERE  pd.purchase_id = NEW.id
        LOOP
            -- Lock pesimista sobre el producto para serializar movimientos concurrentes
            SELECT p.stock_current,
                   p.purchase_price
            INTO   v_current_stock,
                   v_current_cost
            FROM   public.products p
            WHERE  p.id = v_detail.product_id
              AND  p.deleted_at IS NULL
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION
                    'Producto % no encontrado o eliminado al confirmar compra %.',
                    v_detail.product_id, NEW.id
                    USING ERRCODE = 'P0001';
            END IF;

            -- Calcular nuevo costo promedio ponderado
            -- Si el stock actual es 0, el nuevo costo es directamente el unit_cost
            IF v_current_stock = 0 THEN
                v_new_avg_cost := v_detail.unit_cost;
            ELSE
                v_new_avg_cost := ROUND(
                    (v_current_stock * v_current_cost + v_detail.quantity * v_detail.unit_cost)
                    / (v_current_stock + v_detail.quantity),
                    4
                );
            END IF;

            -- Guardar snapshots en la línea de detalle
            UPDATE public.purchase_details
            SET    previous_cost = v_current_cost,
                   new_avg_cost  = v_new_avg_cost
            WHERE  id = v_detail.detail_id;

            -- Actualizar costo promedio en el producto
            -- Nota: fn_apply_stock_movement actualizará stock_current y updated_at
            UPDATE public.products
            SET    purchase_price = v_new_avg_cost
            WHERE  id = v_detail.product_id;

            -- Ingresar el stock via fn_apply_stock_movement (movimiento tipo COMPRA)
            PERFORM public.fn_apply_stock_movement(
                p_product_id     => v_detail.product_id,
                p_movement_type  => 'COMPRA',
                p_quantity       => v_detail.quantity,   -- ingreso = positivo
                p_reference_id   => NEW.id,
                p_reference_type => 'PURCHASE',
                p_authorized_by  => NULL,
                p_notes          => 'Ingreso por compra #' || NEW.purchase_number,
                p_created_by     => NEW.purchased_by
            );

        END LOOP;

    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_confirm_purchase() IS
    'Trigger AFTER UPDATE en purchases. '
    'DRAFT → CONFIRMED: para cada línea calcula costo promedio ponderado, '
    'actualiza products.purchase_price y registra movimiento COMPRA en stock_movements. '
    'Usa lock pesimista (SELECT FOR UPDATE) para prevenir race conditions.';

-- Trigger que ejecuta la lógica de confirmación de compra
CREATE TRIGGER trg_confirm_purchase
    AFTER UPDATE OF status ON public.purchases
    FOR EACH ROW
    WHEN (OLD.status = 'DRAFT' AND NEW.status = 'CONFIRMED')
    EXECUTE FUNCTION public.fn_confirm_purchase();

-- ---------------------------------------------------------------------------
-- TRIGGERS: updated_at
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_suppliers_updated_at
    BEFORE UPDATE ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER trg_purchases_updated_at
    BEFORE UPDATE ON public.purchases
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- INDEXES - Módulo compras
-- ---------------------------------------------------------------------------

-- Búsqueda por número de compra (vista de detalle y listado)
CREATE INDEX IF NOT EXISTS idx_purchases_number
    ON public.purchases (purchase_number DESC);

-- Compras por proveedor con fecha (historial de proveedor)
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_date
    ON public.purchases (supplier_id, purchase_date DESC)
    WHERE supplier_id IS NOT NULL;

-- Compras por usuario (reporte de actividad de bodega)
CREATE INDEX IF NOT EXISTS idx_purchases_purchased_by
    ON public.purchases (purchased_by, purchase_date DESC);

-- Compras por estado (listado de pendientes, dashboard bodega)
CREATE INDEX IF NOT EXISTS idx_purchases_status
    ON public.purchases (status, purchase_date DESC);

-- Compras confirmadas por fecha (reporte de compras del período)
CREATE INDEX IF NOT EXISTS idx_purchases_confirmed_date
    ON public.purchases (purchase_date DESC, status)
    WHERE status = 'CONFIRMED';

-- Detalles de compra por producto (análisis de costo histórico)
CREATE INDEX IF NOT EXISTS idx_purchase_details_product
    ON public.purchase_details (product_id, purchase_id);

-- Detalles por compra (carga de líneas al abrir una compra)
CREATE INDEX IF NOT EXISTS idx_purchase_details_purchase_id
    ON public.purchase_details (purchase_id);

-- Proveedores activos por nombre (buscador)
CREATE INDEX IF NOT EXISTS idx_suppliers_name
    ON public.suppliers (name)
    WHERE deleted_at IS NULL AND is_active = TRUE;

-- Proveedores por RUT (búsqueda fiscal)
CREATE INDEX IF NOT EXISTS idx_suppliers_rut
    ON public.suppliers (rut)
    WHERE rut IS NOT NULL AND deleted_at IS NULL;

COMMIT;

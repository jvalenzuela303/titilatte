-- =============================================================================
-- V4__create_stock_schema.sql
-- Minimarket Platform - Fase 1
-- Módulo: Gestión de Stock
--
-- Tablas: stock_movements
-- Función: fn_apply_stock_movement (descuento/ingreso atómico con lock pesimista)
-- Función: fn_confirm_sale_stock   (descuenta stock al confirmar venta)
-- Reglas de negocio:
--   - Stock se descuenta atómicamente al confirmar venta (SELECT FOR UPDATE)
--   - No se puede vender con stock = 0 (CHECK + validación en función)
--   - Ajustes de stock requieren authorized_by (constraint a nivel BD)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- ENUM: Tipo de movimiento de stock
-- ---------------------------------------------------------------------------
CREATE TYPE public.stock_movement_type AS ENUM (
    'VENTA',
    'COMPRA',
    'AJUSTE',
    'DEVOLUCION',
    'MERMA'
);

COMMENT ON TYPE public.stock_movement_type IS
    'Tipo de movimiento de stock. '
    'VENTA: egreso por venta confirmada. '
    'COMPRA: ingreso por orden de compra. '
    'AJUSTE: corrección manual autorizada. '
    'DEVOLUCION: reingreso por devolución de cliente. '
    'MERMA: egreso por pérdida, vencimiento o daño.';

-- ---------------------------------------------------------------------------
-- TABLE: stock_movements
-- Registro inmutable de todos los movimientos de inventario.
-- Es el libro mayor del stock: quantity_before + quantity = quantity_after.
-- NUNCA actualizar ni eliminar registros de esta tabla.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id              UUID                        NOT NULL DEFAULT gen_random_uuid(),
    product_id      UUID                        NOT NULL,
    movement_type   public.stock_movement_type  NOT NULL,
    -- quantity: positivo = ingreso, negativo = egreso
    quantity        NUMERIC(12, 4)              NOT NULL,
    quantity_before NUMERIC(12, 4)              NOT NULL,
    quantity_after  NUMERIC(12, 4)              NOT NULL,
    -- reference_id / reference_type: polimórfico para enlazar con ventas, compras, etc.
    reference_id    UUID,
    reference_type  VARCHAR(50),
    -- authorized_by requerido para AJUSTE y MERMA (regla de negocio)
    authorized_by   UUID,
    notes           TEXT,
    created_at      TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    created_by      UUID                        NOT NULL,

    CONSTRAINT pk_stock_movements PRIMARY KEY (id),
    CONSTRAINT fk_stock_movements_product
        FOREIGN KEY (product_id)
        REFERENCES public.products (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_stock_movements_authorized_by
        FOREIGN KEY (authorized_by)
        REFERENCES public.users (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_stock_movements_created_by
        FOREIGN KEY (created_by)
        REFERENCES public.users (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    -- Consistencia del libro mayor: before + quantity = after
    CONSTRAINT chk_stock_movements_ledger_balance
        CHECK (quantity_before + quantity = quantity_after),
    -- Stock nunca queda negativo después del movimiento
    CONSTRAINT chk_stock_movements_quantity_after_positive
        CHECK (quantity_after >= 0),
    -- Antes también debe ser >= 0 (invariante del sistema)
    CONSTRAINT chk_stock_movements_quantity_before_positive
        CHECK (quantity_before >= 0),
    -- AJUSTE y MERMA requieren autorización explícita
    CONSTRAINT chk_stock_movements_authorization_required
        CHECK (
            movement_type NOT IN ('AJUSTE', 'MERMA') OR
            authorized_by IS NOT NULL
        ),
    -- reference_id y reference_type deben ir juntos o ambos null
    CONSTRAINT chk_stock_movements_reference_consistency
        CHECK (
            (reference_id IS NULL AND reference_type IS NULL) OR
            (reference_id IS NOT NULL AND reference_type IS NOT NULL)
        )
);

COMMENT ON TABLE  public.stock_movements                  IS 'Libro mayor inmutable de movimientos de inventario. Cada fila = 1 movimiento atómico. NUNCA modificar registros existentes.';
COMMENT ON COLUMN public.stock_movements.id               IS 'Identificador único del movimiento (UUID v4).';
COMMENT ON COLUMN public.stock_movements.product_id       IS 'FK al producto afectado.';
COMMENT ON COLUMN public.stock_movements.movement_type    IS 'Tipo de movimiento: VENTA, COMPRA, AJUSTE, DEVOLUCION, MERMA.';
COMMENT ON COLUMN public.stock_movements.quantity         IS 'Cantidad del movimiento. Positivo = ingreso, negativo = egreso.';
COMMENT ON COLUMN public.stock_movements.quantity_before  IS 'Stock del producto inmediatamente antes del movimiento. Snapshot para auditoría.';
COMMENT ON COLUMN public.stock_movements.quantity_after   IS 'Stock del producto inmediatamente después del movimiento. quantity_before + quantity = quantity_after.';
COMMENT ON COLUMN public.stock_movements.reference_id     IS 'UUID de la entidad que origina el movimiento. Ej: sale_id para VENTA.';
COMMENT ON COLUMN public.stock_movements.reference_type   IS 'Tipo de entidad de referencia. Ej: SALE, PURCHASE_ORDER, ADJUSTMENT.';
COMMENT ON COLUMN public.stock_movements.authorized_by    IS 'FK al usuario que autorizó el movimiento. Obligatorio para AJUSTE y MERMA.';
COMMENT ON COLUMN public.stock_movements.notes            IS 'Notas o justificación del movimiento. Obligatorio para AJUSTE y MERMA desde la app.';
COMMENT ON COLUMN public.stock_movements.created_at       IS 'Timestamp exacto del movimiento (UTC). Inmutable.';
COMMENT ON COLUMN public.stock_movements.created_by       IS 'FK al usuario que registró el movimiento.';

-- ---------------------------------------------------------------------------
-- FUNCIÓN: fn_apply_stock_movement
-- Aplica un movimiento de stock de forma atómica usando SELECT FOR UPDATE
-- (lock pesimista) para prevenir race conditions en ventas concurrentes.
--
-- Parámetros:
--   p_product_id     UUID               - producto a afectar
--   p_movement_type  stock_movement_type
--   p_quantity       NUMERIC            - positivo=ingreso, negativo=egreso
--   p_reference_id   UUID               - opcional: id de la entidad origen
--   p_reference_type VARCHAR            - opcional: tipo de entidad origen
--   p_authorized_by  UUID               - requerido para AJUSTE/MERMA
--   p_notes          TEXT               - notas del movimiento
--   p_created_by     UUID               - usuario que origina el movimiento
--
-- Retorna: UUID del stock_movement creado
-- Lanza excepción si: stock insuficiente, producto inactivo/inexistente
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_apply_stock_movement(
    p_product_id     UUID,
    p_movement_type  public.stock_movement_type,
    p_quantity       NUMERIC,
    p_reference_id   UUID    DEFAULT NULL,
    p_reference_type VARCHAR DEFAULT NULL,
    p_authorized_by  UUID    DEFAULT NULL,
    p_notes          TEXT    DEFAULT NULL,
    p_created_by     UUID    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_stock  NUMERIC(12,4);
    v_new_stock      NUMERIC(12,4);
    v_movement_id    UUID;
BEGIN
    -- Lock pesimista sobre el producto para serializar movimientos concurrentes
    SELECT stock_current
    INTO   v_current_stock
    FROM   public.products
    WHERE  id = p_product_id
      AND  deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto % no encontrado o eliminado.', p_product_id
            USING ERRCODE = 'P0001';
    END IF;

    v_new_stock := v_current_stock + p_quantity;

    -- Validar que el stock no quede negativo (regla: no vender con stock = 0)
    IF v_new_stock < 0 THEN
        RAISE EXCEPTION
            'Stock insuficiente para producto %. Stock actual: %, Cantidad solicitada: %.',
            p_product_id, v_current_stock, ABS(p_quantity)
            USING ERRCODE = 'P0002';
    END IF;

    -- Validar autorización para AJUSTE y MERMA
    IF p_movement_type IN ('AJUSTE', 'MERMA') AND p_authorized_by IS NULL THEN
        RAISE EXCEPTION
            'Movimiento de tipo % requiere authorized_by. Proporcione el UUID del autorizante.',
            p_movement_type
            USING ERRCODE = 'P0003';
    END IF;

    -- Insertar el movimiento en el libro mayor
    INSERT INTO public.stock_movements (
        product_id,
        movement_type,
        quantity,
        quantity_before,
        quantity_after,
        reference_id,
        reference_type,
        authorized_by,
        notes,
        created_by
    ) VALUES (
        p_product_id,
        p_movement_type,
        p_quantity,
        v_current_stock,
        v_new_stock,
        p_reference_id,
        p_reference_type,
        p_authorized_by,
        p_notes,
        COALESCE(p_created_by, (SELECT id FROM public.users WHERE email = 'system@minimarket.local' LIMIT 1))
    )
    RETURNING id INTO v_movement_id;

    -- Actualizar el stock desnormalizado en products (single UPDATE atómico)
    UPDATE public.products
    SET    stock_current = v_new_stock,
           updated_at    = NOW()
    WHERE  id = p_product_id;

    RETURN v_movement_id;
END;
$$;

COMMENT ON FUNCTION public.fn_apply_stock_movement(UUID, public.stock_movement_type, NUMERIC, UUID, VARCHAR, UUID, TEXT, UUID) IS
    'Aplica un movimiento de stock atómicamente con lock pesimista (SELECT FOR UPDATE). '
    'Registra en stock_movements y actualiza products.stock_current. '
    'Lanza P0001 si producto no existe, P0002 si stock insuficiente, P0003 si falta autorización.';

-- ---------------------------------------------------------------------------
-- FUNCIÓN: fn_confirm_sale_stock
-- Trigger function que se ejecuta al cambiar status de venta a CONFIRMED.
-- Descuenta el stock de cada producto en sale_details de forma atómica.
-- También revierte el stock si la venta cambia de CONFIRMED a CANCELLED.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_confirm_sale_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_detail        RECORD;
    v_seller_id     UUID;
BEGIN
    v_seller_id := NEW.seller_id;

    -- -----------------------------------------------------------------------
    -- CONFIRMED: descontar stock de cada línea de detalle
    -- -----------------------------------------------------------------------
    IF NEW.status = 'CONFIRMED' AND OLD.status = 'PENDING' THEN

        FOR v_detail IN
            SELECT product_id, quantity
            FROM   public.sale_details
            WHERE  sale_id = NEW.id
        LOOP
            -- fn_apply_stock_movement maneja el lock pesimista y la validación
            PERFORM public.fn_apply_stock_movement(
                p_product_id     => v_detail.product_id,
                p_movement_type  => 'VENTA',
                p_quantity       => -(v_detail.quantity),  -- egreso = negativo
                p_reference_id   => NEW.id,
                p_reference_type => 'SALE',
                p_authorized_by  => NULL,
                p_notes          => 'Descuento por venta #' || NEW.sale_number,
                p_created_by     => v_seller_id
            );
        END LOOP;

    -- -----------------------------------------------------------------------
    -- CANCELLED desde CONFIRMED: revertir stock (devolución automática)
    -- -----------------------------------------------------------------------
    ELSIF NEW.status = 'CANCELLED' AND OLD.status = 'CONFIRMED' THEN

        FOR v_detail IN
            SELECT product_id, quantity
            FROM   public.sale_details
            WHERE  sale_id = NEW.id
        LOOP
            PERFORM public.fn_apply_stock_movement(
                p_product_id     => v_detail.product_id,
                p_movement_type  => 'DEVOLUCION',
                p_quantity       => v_detail.quantity,  -- ingreso = positivo
                p_reference_id   => NEW.id,
                p_reference_type => 'SALE',
                p_authorized_by  => NEW.cancelled_by,
                p_notes          => 'Reposición por anulación venta #' || NEW.sale_number,
                p_created_by     => NEW.cancelled_by
            );
        END LOOP;

    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_confirm_sale_stock() IS
    'Trigger AFTER UPDATE en sales. '
    'PENDING → CONFIRMED: descuenta stock de todos los sale_details via fn_apply_stock_movement. '
    'CONFIRMED → CANCELLED: repone el stock con movimiento DEVOLUCION. '
    'Usa lock pesimista por producto para prevenir race conditions.';

-- Trigger que ejecuta la lógica de stock al cambiar estado de venta
CREATE TRIGGER trg_sales_confirm_stock
    AFTER UPDATE OF status ON public.sales
    FOR EACH ROW
    WHEN (
        (OLD.status = 'PENDING'    AND NEW.status = 'CONFIRMED') OR
        (OLD.status = 'CONFIRMED'  AND NEW.status = 'CANCELLED')
    )
    EXECUTE FUNCTION public.fn_confirm_sale_stock();

-- ---------------------------------------------------------------------------
-- INDEXES - Módulo stock
-- ---------------------------------------------------------------------------

-- Historial de movimientos por producto (vista de stock, trazabilidad)
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id
    ON public.stock_movements (product_id, created_at DESC);

-- Movimientos por tipo (análisis de mermas, ajustes, ventas)
CREATE INDEX IF NOT EXISTS idx_stock_movements_type
    ON public.stock_movements (movement_type, created_at DESC);

-- Movimientos por referencia (ej: todos los movimientos de una venta)
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference
    ON public.stock_movements (reference_type, reference_id)
    WHERE reference_id IS NOT NULL;

-- Movimientos por usuario que los creó (auditoría)
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_by
    ON public.stock_movements (created_by, created_at DESC);

-- Movimientos que requirieron autorización (auditoría de ajustes y mermas)
CREATE INDEX IF NOT EXISTS idx_stock_movements_authorized_by
    ON public.stock_movements (authorized_by)
    WHERE authorized_by IS NOT NULL;

-- Rango de fechas para reportes de movimientos
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at
    ON public.stock_movements (created_at DESC);

COMMIT;

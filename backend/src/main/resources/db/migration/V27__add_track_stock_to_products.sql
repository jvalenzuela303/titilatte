-- =============================================================================
-- V27: Agrega columna track_stock a products
--
-- Productos con track_stock = FALSE no descuentan stock en ventas ni lo
-- validan (útil para pan de casa y elaboración propia con stock volátil).
-- =============================================================================

BEGIN;

-- 1. Agregar columna
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS track_stock BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Marcar marraqueta y hallulla como sin control de stock
UPDATE public.products
   SET track_stock = FALSE
 WHERE id IN (
     'cdcdcd00-0000-0000-0000-000000000024',  -- Marraqueta
     'cdcdcd00-0000-0000-0000-000000000025'   -- Hallulla
 );

COMMIT;

-- 3. Reescribir trigger para respetar track_stock
--    (ADD VALUE no puede ir en la misma transacción; aquí no hay ADD VALUE)
BEGIN;

CREATE OR REPLACE FUNCTION public.fn_confirm_sale_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_detail       RECORD;
    v_stock_before NUMERIC(12,4);
    v_cost_total   NUMERIC(12,2) := 0;
    v_system_user  UUID;
BEGIN
    SELECT id INTO v_system_user
      FROM public.users
     WHERE email = 'system@minimarket.local'
     LIMIT 1;

    -- ── PENDING → CONFIRMED: descontar stock ────────────────────────────────
    IF NEW.status::TEXT = 'CONFIRMED' AND OLD.status::TEXT = 'PENDING' THEN
        FOR v_detail IN
            SELECT sd.product_id, sd.quantity, p.purchase_price,
                   p.stock_current, p.track_stock
              FROM public.sale_details sd
              JOIN public.products p ON p.id = sd.product_id
             WHERE sd.sale_id = NEW.id
               FOR UPDATE OF p
        LOOP
            -- Acumular costo siempre
            v_cost_total := v_cost_total + (v_detail.quantity * v_detail.purchase_price);

            -- Saltar descuento de stock si track_stock = FALSE
            CONTINUE WHEN NOT v_detail.track_stock;

            IF v_detail.stock_current < v_detail.quantity THEN
                RAISE EXCEPTION 'Stock insuficiente para producto %. Disponible: %, solicitado: %',
                    v_detail.product_id, v_detail.stock_current, v_detail.quantity
                    USING ERRCODE = 'P0002';
            END IF;

            v_stock_before := v_detail.stock_current;

            UPDATE public.products
               SET stock_current = stock_current - v_detail.quantity,
                   updated_at    = now()
             WHERE id = v_detail.product_id;

            INSERT INTO public.stock_movements
                   (product_id, branch_id, movement_type, quantity,
                    quantity_before, quantity_after,
                    reference_id, reference_type, notes, created_by)
            VALUES (v_detail.product_id, NEW.branch_id,
                    'SALE_OUT', -v_detail.quantity,
                    v_stock_before, v_stock_before - v_detail.quantity,
                    NEW.id, 'SALE', 'Venta confirmada',
                    COALESCE(NEW.seller_id, v_system_user));
        END LOOP;

        NEW.total_cost := v_cost_total;

    -- ── CONFIRMED → CANCELLED: restaurar stock ──────────────────────────────
    ELSIF NEW.status::TEXT = 'CANCELLED' AND OLD.status::TEXT = 'CONFIRMED' THEN
        FOR v_detail IN
            SELECT sd.product_id, sd.quantity, p.stock_current, p.track_stock
              FROM public.sale_details sd
              JOIN public.products p ON p.id = sd.product_id
             WHERE sd.sale_id = NEW.id
               FOR UPDATE OF p
        LOOP
            -- Saltar restauración de stock si track_stock = FALSE
            CONTINUE WHEN NOT v_detail.track_stock;

            v_stock_before := v_detail.stock_current;

            UPDATE public.products
               SET stock_current = stock_current + v_detail.quantity,
                   updated_at    = now()
             WHERE id = v_detail.product_id;

            INSERT INTO public.stock_movements
                   (product_id, branch_id, movement_type, quantity,
                    quantity_before, quantity_after,
                    reference_id, reference_type, notes, created_by)
            VALUES (v_detail.product_id, NEW.branch_id,
                    'DEVOLUCION', v_detail.quantity,
                    v_stock_before, v_stock_before + v_detail.quantity,
                    NEW.id, 'SALE', 'Cancelación de venta',
                    COALESCE(NEW.cancelled_by, v_system_user));
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

COMMIT;

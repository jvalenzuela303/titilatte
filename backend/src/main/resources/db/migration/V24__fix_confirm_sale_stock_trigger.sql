-- =============================================================================
-- V24: Fix fn_confirm_sale_stock trigger
--
-- Problems introduced by V16:
--   1. Trigger used 'SALE_OUT' which is not in the stock_movement_type enum
--   2. INSERT into stock_movements omitted NOT NULL columns:
--      quantity_before, quantity_after, created_by
--   3. Cancellation stock restore was removed
--
-- This migration:
--   1. Adds 'SALE_OUT' to the enum (keeps V16's choice of value)
--   2. Rewrites the trigger with correct INSERT (all NOT NULL columns)
--   3. Restores CONFIRMED → CANCELLED stock restore using 'DEVOLUCION'
-- =============================================================================

BEGIN;

-- 1. Add missing enum value
ALTER TYPE public.stock_movement_type ADD VALUE IF NOT EXISTS 'SALE_OUT';

COMMIT;

-- Note: ADD VALUE cannot run inside the same transaction as the function
-- that references the new enum value, so we open a new transaction below.

BEGIN;

-- 2. Rewrite the trigger function
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
    -- Fallback user for created_by when no canceller is set
    SELECT id INTO v_system_user
      FROM public.users
     WHERE email = 'system@minimarket.local'
     LIMIT 1;

    -- ── PENDING → CONFIRMED: deduct stock ───────────────────────────────────
    IF NEW.status::TEXT = 'CONFIRMED' AND OLD.status::TEXT = 'PENDING' THEN
        FOR v_detail IN
            SELECT sd.product_id, sd.quantity, p.purchase_price, p.stock_current
              FROM public.sale_details sd
              JOIN public.products p ON p.id = sd.product_id
             WHERE sd.sale_id = NEW.id
               FOR UPDATE OF p
        LOOP
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

            v_cost_total := v_cost_total + (v_detail.quantity * v_detail.purchase_price);
        END LOOP;

        NEW.total_cost := v_cost_total;

    -- ── CONFIRMED → CANCELLED: restore stock ────────────────────────────────
    ELSIF NEW.status::TEXT = 'CANCELLED' AND OLD.status::TEXT = 'CONFIRMED' THEN
        FOR v_detail IN
            SELECT sd.product_id, sd.quantity, p.stock_current
              FROM public.sale_details sd
              JOIN public.products p ON p.id = sd.product_id
             WHERE sd.sale_id = NEW.id
               FOR UPDATE OF p
        LOOP
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

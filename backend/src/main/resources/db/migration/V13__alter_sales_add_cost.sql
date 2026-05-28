BEGIN;

-- Columna total_cost: costo total de los productos al momento de confirmar la venta
ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS total_cost NUMERIC(12,2) NOT NULL DEFAULT 0
    CONSTRAINT chk_sales_total_cost CHECK (total_cost >= 0);

-- Columna cancellation_reason: obligatoria al cancelar
ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(500);

-- Constraint: si status = CANCELLED, cancellation_reason no puede ser NULL
ALTER TABLE public.sales
    DROP CONSTRAINT IF EXISTS chk_sales_cancel_reason;
ALTER TABLE public.sales
    ADD CONSTRAINT chk_sales_cancel_reason
    CHECK (status::TEXT != 'CANCELLED' OR cancellation_reason IS NOT NULL);

-- Backfill total_cost para ventas históricas confirmadas
UPDATE public.sales s
SET total_cost = COALESCE((
    SELECT SUM(sd.quantity * p.purchase_price)
    FROM public.sale_details sd
    JOIN public.products p ON p.id = sd.product_id
    WHERE sd.sale_id = s.id
), 0)
WHERE s.status::TEXT = 'CONFIRMED'
  AND s.total_cost = 0;

-- Reemplazar función del trigger para incluir cálculo de total_cost
CREATE OR REPLACE FUNCTION public.fn_confirm_sale_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_item       RECORD;
    v_cost_total NUMERIC(12,2) := 0;
BEGIN
    IF NEW.status::TEXT = 'CONFIRMED' AND OLD.status::TEXT = 'PENDING' THEN
        FOR v_item IN
            SELECT sd.product_id, sd.quantity, p.purchase_price
            FROM   public.sale_details sd
            JOIN   public.products p ON p.id = sd.product_id
            WHERE  sd.sale_id = NEW.id
        LOOP
            PERFORM public.fn_apply_stock_movement(
                v_item.product_id, 'VENTA'::text,
                -v_item.quantity,
                NEW.id, 'SALE', NULL, NULL
            );
            v_cost_total := v_cost_total + (v_item.quantity * v_item.purchase_price);
        END LOOP;
        NEW.total_cost := v_cost_total;

    ELSIF NEW.status::TEXT = 'CANCELLED' AND OLD.status::TEXT = 'CONFIRMED' THEN
        FOR v_item IN
            SELECT sd.product_id, sd.quantity
            FROM   public.sale_details sd
            WHERE  sd.sale_id = NEW.id
        LOOP
            PERFORM public.fn_apply_stock_movement(
                v_item.product_id, 'DEVOLUCION'::text,
                v_item.quantity,
                NEW.id, 'SALE', NULL, NULL
            );
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;

COMMIT;

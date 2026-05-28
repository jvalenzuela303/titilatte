BEGIN;

-- Dashboard KPIs del día
CREATE INDEX IF NOT EXISTS idx_sales_today_confirmed
    ON public.sales (created_at, status, seller_id, total_amount, total_cost)
    WHERE status = 'CONFIRMED';

-- Ventas por cajero hoy
CREATE INDEX IF NOT EXISTS idx_sales_seller_today
    ON public.sales (seller_id, created_at, total_amount)
    WHERE status = 'CONFIRMED';

-- Deudores activos
CREATE INDEX IF NOT EXISTS idx_customers_active_debtors
    ON public.customers (credit_used, credit_limit, first_name, last_name)
    WHERE credit_used > 0 AND deleted_at IS NULL AND is_active = true;

-- Stock crítico (SSE)
CREATE INDEX IF NOT EXISTS idx_products_critical_stock
    ON public.products (stock_current, stock_minimum, name)
    WHERE is_active = true AND deleted_at IS NULL
      AND stock_current <= stock_minimum;

-- POS barcode covering index (evita heap fetch)
DROP INDEX IF EXISTS public.idx_products_barcode;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode_covering
    ON public.products (barcode)
    INCLUDE (name, sale_price, stock_current, is_active, id)
    WHERE deleted_at IS NULL;

-- Actualiza estadísticas del planner
ANALYZE public.sales;
ANALYZE public.products;
ANALYZE public.customers;
ANALYZE public.audit_log;

COMMIT;

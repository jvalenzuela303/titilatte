-- =============================================================================
-- V10__create_report_indexes.sql
-- Minimarket Platform - Fase 2
-- Módulo: Reportes — índices optimizados y vistas analíticas
--
-- Índices:
--   - Ventas confirmadas por período (reporte de ventas diario/mensual)
--   - Ventas por vendedor confirmadas (reporte de turno/comisiones)
--   - Detalle de venta por producto (reporte de utilidades)
--   - Compras confirmadas por período (reporte de compras)
--   - Clientes con deuda vigente (reporte de deudores)
--   - Stock crítico por mínimos (reporte de reposición)
--   - Búsqueda de clientes por nombre en lower() (búsqueda case-insensitive)
--   - Búsqueda de clientes por RUT
--
-- Notas sobre índices existentes que NO se duplican:
--   - idx_sales_seller_date ya existe en V3 (sales.seller_id, created_at DESC)
--     → se crea idx_sales_seller_confirmed para el subset CONFIRMED con columnas distintas
--   - idx_customers_name ya existe en V3 (first_name, last_name) — cobertura distinta
--     → se crea idx_customers_fullname_lower con lower(first_name || last_name)
--   - idx_customers_rut ya existe en V3 — NO se duplica
--   - idx_products_low_stock ya existe en V5 — NO se duplica
--   - idx_purchases_confirmed_date ya fue creado en V7 — NO se duplica aquí
--
-- Vistas:
--   - v_sale_profit: utilidad por línea de venta (precio venta - costo)
--   - v_cash_summary: resumen de turno de caja con totales de ingresos/egresos
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- ÍNDICE: ventas confirmadas por período
-- Reporte: ventas entre fecha_inicio y fecha_fin, solo CONFIRMED
-- Consulta típica:
--   SELECT * FROM sales WHERE created_at BETWEEN $1 AND $2 AND status = 'CONFIRMED'
-- Nota: idx_sales_report_period en V5 cubre (created_at, seller_id, status) WHERE CONFIRMED.
-- Este índice agrega cobertura de total_amount para reportes de suma sin ir a la tabla.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sales_confirmed_period
    ON public.sales (created_at DESC, total_amount)
    WHERE status = 'CONFIRMED';

-- ---------------------------------------------------------------------------
-- ÍNDICE: ventas confirmadas por vendedor y período
-- Reporte: rendimiento por vendedor en un rango de fechas
-- Consulta típica:
--   SELECT seller_id, SUM(total_amount) FROM sales
--   WHERE seller_id = $1 AND created_at BETWEEN $2 AND $3 AND status = 'CONFIRMED'
-- El índice de V3 (idx_sales_seller_date) no tiene filtro WHERE CONFIRMED;
-- este índice parcial es más eficiente para el reporte de turno.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sales_seller_confirmed
    ON public.sales (seller_id, created_at DESC, total_amount)
    WHERE status = 'CONFIRMED';

-- ---------------------------------------------------------------------------
-- ÍNDICE: detalle de venta por producto
-- Reporte: utilidades por producto (JOIN sale_details + products + sales)
-- Consulta típica:
--   SELECT sd.product_id, SUM(sd.quantity), SUM(sd.subtotal)
--   FROM sale_details sd
--   JOIN sales s ON s.id = sd.sale_id
--   WHERE sd.product_id = $1
-- Nota: idx_sale_details_product_qty en V5 cubre (product_id, quantity, sale_id).
-- Este índice agrega unit_price para cálculo de utilidad sin ir a la tabla.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sale_details_product_report
    ON public.sale_details (product_id, sale_id)
    INCLUDE (quantity, unit_price, subtotal);

-- ---------------------------------------------------------------------------
-- ÍNDICE: deudores activos para reporte de cuenta corriente
-- Reporte: clientes con credit_used > 0 ordenados por deuda descendente
-- Consulta típica:
--   SELECT id, first_name, last_name, credit_used, credit_limit
--   FROM customers WHERE credit_used > 0 AND deleted_at IS NULL
--   ORDER BY credit_used DESC
-- Nota: idx_customers_credit_active fue creado en V9 con columnas credit_used, credit_limit.
-- Este índice agrega cobertura de first_name, last_name para no ir a la tabla en el reporte.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_customers_credit_report
    ON public.customers (credit_used DESC)
    INCLUDE (first_name, last_name, credit_limit, rut)
    WHERE credit_used > 0 AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- ÍNDICE: stock crítico para reporte de reposición
-- Reporte: productos cuyo stock_current <= stock_minimum
-- Consulta típica:
--   SELECT id, name, stock_current, stock_minimum FROM products
--   WHERE stock_current <= stock_minimum AND is_active = TRUE AND deleted_at IS NULL
-- Nota: idx_products_low_stock en V5 cubre (stock_current, stock_minimum, category_id)
--       con los mismos filtros. Se agrega INCLUDE para reporte sin heap access.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_stock_report
    ON public.products (stock_current, stock_minimum)
    INCLUDE (barcode, name, category_id)
    WHERE deleted_at IS NULL AND is_active = TRUE;

-- ---------------------------------------------------------------------------
-- ÍNDICE: búsqueda de clientes por nombre completo en minúsculas
-- Reporte y buscador: búsqueda case-insensitive que une nombre y apellido
-- Consulta típica:
--   SELECT * FROM customers
--   WHERE lower(first_name) LIKE '%juan%' AND deleted_at IS NULL
-- Nota: idx_customers_name en V3 cubre (first_name, last_name) sin lower().
-- Este índice de expresión permite búsqueda case-insensitive eficiente.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_customers_lower_first_name
    ON public.customers (lower(first_name))
    WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- ÍNDICE: compras confirmadas por proveedor y período
-- Reporte: compras por proveedor en un rango de fechas
-- Consulta típica:
--   SELECT supplier_id, SUM(total_amount) FROM purchases
--   WHERE status = 'CONFIRMED' AND purchase_date BETWEEN $1 AND $2
--   GROUP BY supplier_id
-- Nota: idx_purchases_confirmed_date en V7 cubre (purchase_date, status) WHERE CONFIRMED.
-- Este índice agrega supplier_id y total_amount para el reporte de compras por proveedor.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_confirmed
    ON public.purchases (supplier_id, purchase_date DESC, total_amount)
    WHERE status = 'CONFIRMED';

-- ---------------------------------------------------------------------------
-- ESTADÍSTICAS EXTENDIDAS - Fase 2
-- Ayuda al query planner con tablas nuevas de alto volumen.
-- ---------------------------------------------------------------------------
CREATE STATISTICS IF NOT EXISTS stat_cash_movements_type_category
    ON movement_type, category
    FROM public.cash_movements;

CREATE STATISTICS IF NOT EXISTS stat_purchases_status_supplier
    ON status, supplier_id
    FROM public.purchases;

-- ---------------------------------------------------------------------------
-- VISTA: v_sale_profit
-- Utilidad por línea de venta: precio_venta - costo_compra al momento del reporte.
-- IMPORTANTE: purchase_price es el costo promedio actual del producto,
-- no el costo exacto al momento de la venta (ese dato no se captura en sale_details).
-- Para análisis histórico exacto, cruzar con price_audit_log.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_sale_profit AS
SELECT
    s.id                                                          AS sale_id,
    s.sale_number,
    s.created_at                                                  AS sale_date,
    s.seller_id,
    u.first_name || ' ' || u.last_name                           AS seller_name,
    sd.id                                                         AS detail_id,
    sd.product_id,
    p.barcode                                                     AS product_barcode,
    p.name                                                        AS product_name,
    pc.name                                                       AS category_name,
    pf.name                                                       AS family_name,
    sd.quantity,
    sd.unit_price                                                 AS sale_price,
    p.purchase_price                                              AS cost_price,
    ROUND(sd.unit_price - p.purchase_price, 4)                   AS unit_profit,
    ROUND(sd.quantity * (sd.unit_price - p.purchase_price), 2)   AS line_profit,
    ROUND(
        CASE
            WHEN sd.unit_price > 0
            THEN ((sd.unit_price - p.purchase_price) / sd.unit_price) * 100
            ELSE 0
        END,
    2)                                                            AS profit_margin_pct
FROM        public.sales            s
JOIN        public.users            u  ON u.id  = s.seller_id
JOIN        public.sale_details     sd ON sd.sale_id  = s.id
JOIN        public.products         p  ON p.id  = sd.product_id
JOIN        public.product_categories pc ON pc.id = p.category_id
JOIN        public.product_families pf ON pf.id  = pc.family_id
WHERE       s.status = 'CONFIRMED';

COMMENT ON VIEW public.v_sale_profit IS
    'Utilidad por línea de venta confirmada. '
    'cost_price = purchase_price actual del producto (costo promedio ponderado vigente). '
    'Para análisis histórico exacto de costos, cruzar con price_audit_log.';

-- ---------------------------------------------------------------------------
-- VISTA: v_cash_summary
-- Resumen de turno de caja con totales de ingresos y egresos.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_cash_summary AS
SELECT
    cr.id,
    cr.register_number,
    cr.cashier_id,
    u.first_name || ' ' || u.last_name                           AS cashier_name,
    u.email                                                       AS cashier_email,
    cr.opening_amount,
    cr.expected_closing_amount,
    cr.counted_amount,
    cr.difference_amount,
    cr.status,
    cr.opened_at,
    cr.closed_at,
    EXTRACT(EPOCH FROM (COALESCE(cr.closed_at, NOW()) - cr.opened_at)) / 3600
                                                                 AS duration_hours,
    COALESCE(SUM(
        CASE WHEN cm.movement_type IN ('INGRESO', 'VENTA', 'PAGO_CREDITO')
             THEN cm.amount ELSE 0 END
    ), 0)                                                        AS total_income,
    COALESCE(SUM(
        CASE WHEN cm.movement_type = 'EGRESO'
             THEN cm.amount ELSE 0 END
    ), 0)                                                        AS total_expense,
    COALESCE(SUM(
        CASE WHEN cm.movement_type = 'VENTA'
             THEN cm.amount ELSE 0 END
    ), 0)                                                        AS total_sales_cash,
    COALESCE(SUM(
        CASE WHEN cm.movement_type = 'PAGO_CREDITO'
             THEN cm.amount ELSE 0 END
    ), 0)                                                        AS total_credit_payments,
    COUNT(CASE WHEN cm.movement_type = 'VENTA' THEN 1 END)      AS sale_count
FROM        public.cash_registers   cr
JOIN        public.users            u  ON u.id = cr.cashier_id
LEFT JOIN   public.cash_movements   cm ON cm.cash_register_id = cr.id
GROUP BY    cr.id, cr.register_number, cr.cashier_id, u.first_name, u.last_name,
            u.email, cr.opening_amount, cr.expected_closing_amount,
            cr.counted_amount, cr.difference_amount, cr.status,
            cr.opened_at, cr.closed_at;

COMMENT ON VIEW public.v_cash_summary IS
    'Resumen de turno de caja con totales de ingresos, egresos y ventas en efectivo. '
    'Agrupa todos los movimientos de cash_movements por turno. '
    'duration_hours calculada en tiempo real para cajas OPEN.';

-- ---------------------------------------------------------------------------
-- VISTA: v_customer_credit_status
-- Estado de cuenta corriente de clientes con deuda activa.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_customer_credit_status AS
SELECT
    c.id                                                         AS customer_id,
    c.rut,
    c.first_name,
    c.last_name,
    c.first_name || COALESCE(' ' || c.last_name, '')            AS full_name,
    c.phone,
    c.email,
    c.credit_limit,
    c.credit_used,
    CASE
        WHEN c.credit_limit = 0 THEN NULL
        ELSE ROUND(c.credit_limit - c.credit_used, 2)
    END                                                          AS credit_available,
    CASE
        WHEN c.credit_limit = 0 THEN NULL
        ELSE ROUND((c.credit_used / c.credit_limit) * 100, 1)
    END                                                          AS credit_used_pct,
    c.is_active,
    c.created_at                                                 AS customer_since
FROM        public.customers c
WHERE       c.deleted_at IS NULL
  AND       c.credit_used > 0
ORDER BY    c.credit_used DESC;

COMMENT ON VIEW public.v_customer_credit_status IS
    'Clientes con deuda activa (credit_used > 0). '
    'credit_available NULL cuando credit_limit = 0 (sin límite asignado). '
    'credit_used_pct NULL cuando credit_limit = 0. '
    'Ordenado por deuda descendente para reporte de cobranza.';

-- ---------------------------------------------------------------------------
-- ANALYZE: actualizar estadísticas del query planner para tablas nuevas
-- ---------------------------------------------------------------------------
ANALYZE public.purchases;
ANALYZE public.purchase_details;
ANALYZE public.suppliers;
ANALYZE public.cash_registers;
ANALYZE public.cash_movements;
ANALYZE public.customer_payments;
ANALYZE public.customers;

COMMIT;

-- =============================================================================
-- V38__add_performance_indexes.sql
-- Minimarket Platform
-- Índices de performance faltantes — análisis exhaustivo de V1–V37
--
-- Metodología:
--   1. Se auditaron todas las FKs sin índice en el lado "many".
--   2. Se identificaron columnas de filtro frecuente sin cobertura de índice.
--   3. Se analizaron las tablas nuevas de V34–V36 con mínima cobertura.
--   4. Se añadieron índices compuestos para las consultas más costosas
--      detectadas en los servicios Java (reportes, listas paginadas, scheduler).
--
-- Reglas aplicadas:
--   - CREATE INDEX IF NOT EXISTS en todos los casos (idempotente).
--   - Patrón de nombre: idx_{tabla}_{columna(s)}.
--   - Índices parciales donde corresponde (deleted_at IS NULL, status filtrado).
--   - Columnas en orden de mayor a menor selectividad en compuestos.
--   - Un comentario por índice explicando la consulta que optimiza.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- MÓDULO: SEGURIDAD / USUARIOS
-- ---------------------------------------------------------------------------

-- FK user_roles.assigned_by sin índice: auditoría de quién asignó qué rol.
-- Consulta: SELECT * FROM user_roles WHERE assigned_by = $1
-- Sin índice → seq scan en tabla de unión al listar asignaciones del admin.
CREATE INDEX IF NOT EXISTS idx_user_roles_assigned_by
    ON public.user_roles (assigned_by)
    WHERE assigned_by IS NOT NULL;

COMMENT ON INDEX public.idx_user_roles_assigned_by IS
    'Optimiza la trazabilidad de asignación de roles: '
    'SELECT * FROM user_roles WHERE assigned_by = $admin_id';

-- FK permissions.module: filtrado de permisos por módulo funcional.
-- Consulta: SELECT * FROM permissions WHERE module = $1 (panel de gestión de roles)
-- Con ~80 permisos hoy, se volverá costoso al crecer el catálogo de módulos.
CREATE INDEX IF NOT EXISTS idx_permissions_module
    ON public.permissions (module);

COMMENT ON INDEX public.idx_permissions_module IS
    'Optimiza el filtrado de permisos por módulo en el panel de administración de roles: '
    'SELECT * FROM permissions WHERE module = ''PRODUCTS''';

-- ---------------------------------------------------------------------------
-- MÓDULO: PRODUCTOS
-- ---------------------------------------------------------------------------

-- FK products.tax_id sin índice: filtrado por tipo de impuesto.
-- Consulta: SELECT * FROM products WHERE tax_id = $1 (gestión de IVA/EXENTO)
-- El índice idx_products_category_id existe pero tax_id y unit_id no.
CREATE INDEX IF NOT EXISTS idx_products_tax_id
    ON public.products (tax_id)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX public.idx_products_tax_id IS
    'Optimiza consultas de productos por tipo de impuesto: '
    'SELECT * FROM products WHERE tax_id = $iva_id AND deleted_at IS NULL';

-- FK products.unit_id sin índice: filtrado por unidad de medida.
-- Consulta: SELECT * FROM products WHERE unit_id = $1
CREATE INDEX IF NOT EXISTS idx_products_unit_id
    ON public.products (unit_id)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX public.idx_products_unit_id IS
    'Optimiza consultas de productos por unidad de medida: '
    'SELECT * FROM products WHERE unit_id = $kg_id AND deleted_at IS NULL';

-- Productos sin control de stock: usados en el trigger fn_confirm_sale_stock
-- para la condición CONTINUE WHEN NOT v_detail.track_stock.
-- Consulta: SELECT ... FROM products WHERE track_stock = FALSE AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_products_track_stock
    ON public.products (track_stock)
    WHERE deleted_at IS NULL AND is_active = TRUE;

COMMENT ON INDEX public.idx_products_track_stock IS
    'Optimiza la detección de productos sin control de stock (pan de casa, elaboración propia): '
    'SELECT id FROM products WHERE track_stock = FALSE AND deleted_at IS NULL';

-- ---------------------------------------------------------------------------
-- MÓDULO: VENTAS
-- ---------------------------------------------------------------------------

-- FK payments.method: filtrado por método de pago para reportes de turno.
-- Consulta: SELECT SUM(amount) FROM payments WHERE method = 'EFECTIVO' AND sale_id IN (...)
-- El trigger fn_register_sale_cash_movement también filtra por method = 'EFECTIVO'.
-- Sin índice → seq scan en payments al calcular totales por método en cierre de caja.
CREATE INDEX IF NOT EXISTS idx_payments_method
    ON public.payments (method, sale_id);

COMMENT ON INDEX public.idx_payments_method IS
    'Optimiza la agregación de pagos por método (cierre de caja, trigger de caja efectivo): '
    'SELECT SUM(amount) FROM payments WHERE method = ''EFECTIVO'' AND sale_id = $1';

-- Ventas por tipo de venta con estado: consultas de crédito en dashboard.
-- Consulta: SELECT * FROM sales WHERE type = 'CREDITO' AND status = 'CONFIRMED'
-- El índice idx_sales_credit_by_customer (V5) solo cubre customer_id+type+date.
-- Este cubre el caso sin filtro de cliente (total de ventas a crédito del día).
CREATE INDEX IF NOT EXISTS idx_sales_type_status
    ON public.sales (type, status, created_at DESC)
    WHERE type IN ('CREDITO', 'MIXTO');

COMMENT ON INDEX public.idx_sales_type_status IS
    'Optimiza el cálculo de ventas a crédito del período sin filtro de cliente: '
    'SELECT SUM(total_amount) FROM sales WHERE type IN (''CREDITO'',''MIXTO'') AND status = ''CONFIRMED''';

-- FK sales.cancelled_by sin índice: auditoría de anulaciones por usuario.
-- Consulta: SELECT * FROM sales WHERE cancelled_by = $1 (reporte de anulaciones)
CREATE INDEX IF NOT EXISTS idx_sales_cancelled_by
    ON public.sales (cancelled_by, cancelled_at DESC)
    WHERE cancelled_by IS NOT NULL;

COMMENT ON INDEX public.idx_sales_cancelled_by IS
    'Optimiza el reporte de anulaciones por usuario supervisor: '
    'SELECT * FROM sales WHERE cancelled_by = $user_id ORDER BY cancelled_at DESC';

-- ---------------------------------------------------------------------------
-- MÓDULO: COMPRAS / PROVEEDORES
-- ---------------------------------------------------------------------------

-- FK purchases.payment_status: listado de compras pendientes de pago.
-- Consulta: SELECT * FROM purchases WHERE payment_status = 'UNPAID' (agregado en V34)
-- No existe ningún índice sobre payment_status.
CREATE INDEX IF NOT EXISTS idx_purchases_payment_status
    ON public.purchases (payment_status, purchase_date DESC)
    WHERE payment_status IN ('UNPAID', 'PARTIAL');

COMMENT ON INDEX public.idx_purchases_payment_status IS
    'Optimiza el listado de compras pendientes o parcialmente pagadas a proveedores: '
    'SELECT * FROM purchases WHERE payment_status = ''UNPAID'' ORDER BY purchase_date DESC';

-- FK purchase_payments.paid_by sin índice: auditoría de pagos a proveedores.
-- Consulta: SELECT * FROM purchase_payments WHERE paid_by = $user_id
CREATE INDEX IF NOT EXISTS idx_purchase_payments_paid_by
    ON public.purchase_payments (paid_by, paid_at DESC);

COMMENT ON INDEX public.idx_purchase_payments_paid_by IS
    'Optimiza la auditoría de pagos a proveedores por usuario: '
    'SELECT * FROM purchase_payments WHERE paid_by = $user_id ORDER BY paid_at DESC';

-- purchase_payments.paid_at: consultas de pagos en rango de fechas.
-- Consulta: SELECT * FROM purchase_payments WHERE paid_at BETWEEN $1 AND $2
CREATE INDEX IF NOT EXISTS idx_purchase_payments_paid_at
    ON public.purchase_payments (paid_at DESC);

COMMENT ON INDEX public.idx_purchase_payments_paid_at IS
    'Optimiza el reporte de pagos a proveedores por período: '
    'SELECT SUM(amount) FROM purchase_payments WHERE paid_at BETWEEN $start AND $end';

-- ---------------------------------------------------------------------------
-- MÓDULO: CAJA
-- ---------------------------------------------------------------------------

-- cash_movements.created_by: sin índice dedicado para trazabilidad de cajero.
-- Consulta: SELECT * FROM cash_movements WHERE created_by = $cashier_id
-- El índice idx_cash_movements_register_id cubre por caja pero no por usuario.
CREATE INDEX IF NOT EXISTS idx_cash_movements_created_by
    ON public.cash_movements (created_by, created_at DESC);

COMMENT ON INDEX public.idx_cash_movements_created_by IS
    'Optimiza el reporte de movimientos de caja por cajero (auditoría de turno): '
    'SELECT * FROM cash_movements WHERE created_by = $cashier_id ORDER BY created_at DESC';

-- cash_registers.opened_at: rango de fechas para listado de turnos históricos.
-- El índice idx_cash_registers_cashier_date cubre por cajero+fecha,
-- pero no existe un índice solo por fecha para vistas administrativas cross-cajero.
CREATE INDEX IF NOT EXISTS idx_cash_registers_opened_at
    ON public.cash_registers (opened_at DESC);

COMMENT ON INDEX public.idx_cash_registers_opened_at IS
    'Optimiza el listado de turnos de caja por fecha (vista administrativa global): '
    'SELECT * FROM cash_registers WHERE opened_at BETWEEN $start AND $end ORDER BY opened_at DESC';

-- ---------------------------------------------------------------------------
-- MÓDULO: CLIENTES / CRÉDITO
-- ---------------------------------------------------------------------------

-- customer_payments.payment_method: análisis de métodos de abono.
-- Consulta: SELECT SUM(amount) FROM customer_payments WHERE payment_method = 'EFECTIVO'
-- No existe ningún índice sobre payment_method en customer_payments.
CREATE INDEX IF NOT EXISTS idx_customer_payments_method
    ON public.customer_payments (payment_method, created_at DESC);

COMMENT ON INDEX public.idx_customer_payments_method IS
    'Optimiza el análisis de abonos a cuenta corriente por método de pago: '
    'SELECT SUM(amount) FROM customer_payments WHERE payment_method = ''EFECTIVO''';

-- ---------------------------------------------------------------------------
-- MÓDULO: AUDITORÍA
-- ---------------------------------------------------------------------------

-- audit_log.entity_id sin índice dedicado (V12 tiene idx_audit_entity sobre entity_type+entity_id,
-- pero no hay índice solo sobre entity_id para búsquedas por entidad sin conocer el tipo).
-- Consulta: SELECT * FROM audit_log WHERE entity_id = $product_id (historial de un producto)
-- Se optimiza con un índice simple para búsquedas directas por entidad.
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_id
    ON public.audit_log (entity_id, created_at DESC)
    WHERE entity_id IS NOT NULL;

COMMENT ON INDEX public.idx_audit_log_entity_id IS
    'Optimiza la consulta de historial de auditoría de una entidad específica '
    '(sin conocer el entity_type a priori): '
    'SELECT * FROM audit_log WHERE entity_id = $uuid ORDER BY created_at DESC';

-- ---------------------------------------------------------------------------
-- MÓDULO: ALERTAS
-- ---------------------------------------------------------------------------

-- alert_history.acknowledged_by: sin índice para auditoría de acuses.
-- Consulta: SELECT * FROM alert_history WHERE acknowledged_by = $user_id
CREATE INDEX IF NOT EXISTS idx_alert_history_acknowledged_by
    ON public.alert_history (acknowledged_by, acknowledged_at DESC)
    WHERE acknowledged_by IS NOT NULL;

COMMENT ON INDEX public.idx_alert_history_acknowledged_by IS
    'Optimiza la auditoría de alertas acusadas por usuario supervisor: '
    'SELECT * FROM alert_history WHERE acknowledged_by = $user_id';

-- alert_rules.created_by: sin índice para saber qué reglas creó cada ADMIN.
-- Consulta: SELECT * FROM alert_rules WHERE created_by = $admin_id
CREATE INDEX IF NOT EXISTS idx_alert_rules_created_by
    ON public.alert_rules (created_by)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX public.idx_alert_rules_created_by IS
    'Optimiza el listado de reglas de alerta creadas por un usuario ADMIN: '
    'SELECT * FROM alert_rules WHERE created_by = $admin_id AND deleted_at IS NULL';

-- alert_rules.recipient_role: scheduler y panel filtran por rol destinatario.
-- Consulta: SELECT * FROM alert_rules WHERE recipient_role = 'SUPERVISOR' AND active = TRUE
CREATE INDEX IF NOT EXISTS idx_alert_rules_recipient_role
    ON public.alert_rules (recipient_role, active)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX public.idx_alert_rules_recipient_role IS
    'Optimiza la entrega de alertas SSE por rol destinatario: '
    'SELECT * FROM alert_rules WHERE recipient_role = $role AND active = TRUE AND deleted_at IS NULL';

-- ---------------------------------------------------------------------------
-- MÓDULO: PROMOCIONES
-- ---------------------------------------------------------------------------

-- promotions.created_by: sin índice para listar promociones creadas por un usuario.
-- Consulta: SELECT * FROM promotions WHERE created_by = $user_id
CREATE INDEX IF NOT EXISTS idx_promotions_created_by
    ON public.promotions (created_by)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX public.idx_promotions_created_by IS
    'Optimiza el listado de promociones por creador (auditoría de precios dinámicos): '
    'SELECT * FROM promotions WHERE created_by = $user_id AND deleted_at IS NULL';

-- promotions.type + active: POS filtra por tipo de promoción activa antes de evaluar.
-- Consulta: SELECT * FROM promotions WHERE type = 'TWO_FOR_ONE' AND active = TRUE
-- El índice idx_promotions_applies_to cubre applies_to pero no type.
CREATE INDEX IF NOT EXISTS idx_promotions_type_active
    ON public.promotions (type, active, starts_at, ends_at)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX public.idx_promotions_type_active IS
    'Optimiza la evaluación de promociones activas por tipo en el POS: '
    'SELECT * FROM promotions WHERE type = ''TWO_FOR_ONE'' AND active = TRUE '
    'AND starts_at <= NOW() AND ends_at > NOW() AND deleted_at IS NULL';

-- ---------------------------------------------------------------------------
-- MÓDULO: PEDIDOS ESPECIALES (V35 / V36 / V37)
-- ---------------------------------------------------------------------------

-- orders.created_by: sin índice. Lista de pedidos creados por un cajero.
-- Consulta: SELECT * FROM orders WHERE created_by = $user_id
CREATE INDEX IF NOT EXISTS idx_orders_created_by
    ON public.orders (created_by, created_at DESC);

COMMENT ON INDEX public.idx_orders_created_by IS
    'Optimiza el listado de pedidos especiales creados por un usuario: '
    'SELECT * FROM orders WHERE created_by = $user_id ORDER BY created_at DESC';

-- orders.payment_status: dashboard de pedidos con pago pendiente.
-- Consulta: SELECT * FROM orders WHERE payment_status = 'UNPAID' AND status != 'CANCELLED'
CREATE INDEX IF NOT EXISTS idx_orders_payment_status
    ON public.orders (payment_status, status, delivery_date)
    WHERE payment_status IN ('UNPAID', 'PARTIAL') AND status != 'CANCELLED';

COMMENT ON INDEX public.idx_orders_payment_status IS
    'Optimiza el listado de pedidos con pago pendiente o parcial: '
    'SELECT * FROM orders WHERE payment_status = ''UNPAID'' AND status != ''CANCELLED'' '
    'ORDER BY delivery_date';

-- orders.reminder_sent + delivery_date: el scheduler de recordatorios busca
-- pedidos próximos a vencer sin notificación enviada.
-- Consulta: SELECT * FROM orders WHERE reminder_sent = FALSE AND delivery_date < NOW() + INTERVAL '1 day'
CREATE INDEX IF NOT EXISTS idx_orders_reminder_pending
    ON public.orders (delivery_date, reminder_sent)
    WHERE reminder_sent = FALSE AND status NOT IN ('DELIVERED', 'CANCELLED');

COMMENT ON INDEX public.idx_orders_reminder_pending IS
    'Optimiza el scheduler de recordatorios de pedidos próximos a vencer: '
    'SELECT id FROM orders WHERE reminder_sent = FALSE AND delivery_date <= NOW() + INTERVAL ''24 hours'' '
    'AND status NOT IN (''DELIVERED'', ''CANCELLED'')';

-- orders.created_at: listado de pedidos por fecha de creación (paginación).
-- Solo tiene índice en status, customer_id y delivery_date. Falta created_at.
CREATE INDEX IF NOT EXISTS idx_orders_created_at
    ON public.orders (created_at DESC);

COMMENT ON INDEX public.idx_orders_created_at IS
    'Optimiza la paginación del listado de pedidos especiales por fecha de creación: '
    'SELECT * FROM orders ORDER BY created_at DESC LIMIT $n OFFSET $m';

-- order_payments.paid_by: auditoría de quién registró cada abono.
-- Consulta: SELECT * FROM order_payments WHERE paid_by = $user_id
CREATE INDEX IF NOT EXISTS idx_order_payments_paid_by
    ON public.order_payments (paid_by, paid_at DESC);

COMMENT ON INDEX public.idx_order_payments_paid_by IS
    'Optimiza la auditoría de abonos a pedidos por usuario cajero: '
    'SELECT * FROM order_payments WHERE paid_by = $user_id ORDER BY paid_at DESC';

-- order_payments.paid_at: agregados de abonos por período.
-- Consulta: SELECT SUM(amount) FROM order_payments WHERE paid_at BETWEEN $1 AND $2
CREATE INDEX IF NOT EXISTS idx_order_payments_paid_at
    ON public.order_payments (paid_at DESC);

COMMENT ON INDEX public.idx_order_payments_paid_at IS
    'Optimiza el reporte de abonos a pedidos especiales por período: '
    'SELECT SUM(amount) FROM order_payments WHERE paid_at BETWEEN $start AND $end';

-- ---------------------------------------------------------------------------
-- MÓDULO: CIERRES DE PERÍODO
-- ---------------------------------------------------------------------------

-- period_closes.closed_by: sin índice. Auditoría de quién cerró cada período.
-- Consulta: SELECT * FROM period_closes WHERE closed_by = $admin_id
CREATE INDEX IF NOT EXISTS idx_period_closes_closed_by
    ON public.period_closes (closed_by)
    WHERE closed_by IS NOT NULL;

COMMENT ON INDEX public.idx_period_closes_closed_by IS
    'Optimiza la auditoría de cierres contables por usuario administrador: '
    'SELECT * FROM period_closes WHERE closed_by = $admin_id';

-- ---------------------------------------------------------------------------
-- MÓDULO: SUCURSALES
-- ---------------------------------------------------------------------------

-- branches.is_active: filtrado de sucursales activas en listados.
-- La tabla branches solo tiene PK. No hay índice sobre is_active.
-- Consulta: SELECT * FROM branches WHERE is_active = TRUE ORDER BY name
CREATE INDEX IF NOT EXISTS idx_branches_is_active
    ON public.branches (is_active, name);

COMMENT ON INDEX public.idx_branches_is_active IS
    'Optimiza el listado de sucursales activas (selector de sucursal, panel de administración): '
    'SELECT * FROM branches WHERE is_active = TRUE ORDER BY name';

-- ---------------------------------------------------------------------------
-- ESTADÍSTICAS EXTENDIDAS — tablas nuevas
-- Ayudan al query planner a estimar cardinalidad en columnas correlacionadas.
-- ---------------------------------------------------------------------------

-- orders: status y payment_status están fuertemente correlacionados.
-- Un pedido DELIVERED casi siempre está PAID; uno CANCELLED suele estar UNPAID o PARTIAL.
CREATE STATISTICS IF NOT EXISTS stat_orders_status_payment_status
    ON status, payment_status
    FROM public.orders;

-- purchases: payment_status y status están correlacionados.
-- Un DRAFT rara vez está PAID; un CONFIRMED generalmente tiene pago.
CREATE STATISTICS IF NOT EXISTS stat_purchases_payment_status
    ON payment_status, status
    FROM public.purchases;

-- ---------------------------------------------------------------------------
-- ANALYZE: actualizar estadísticas del query planner
-- Incluye todas las tablas que recibieron índices nuevos en esta migración.
-- ---------------------------------------------------------------------------
ANALYZE public.user_roles;
ANALYZE public.permissions;
ANALYZE public.products;
ANALYZE public.payments;
ANALYZE public.sales;
ANALYZE public.purchases;
ANALYZE public.purchase_payments;
ANALYZE public.cash_registers;
ANALYZE public.cash_movements;
ANALYZE public.customer_payments;
ANALYZE public.audit_log;
ANALYZE public.alert_rules;
ANALYZE public.alert_history;
ANALYZE public.promotions;
ANALYZE public.orders;
ANALYZE public.order_payments;
ANALYZE public.period_closes;
ANALYZE public.branches;

COMMIT;

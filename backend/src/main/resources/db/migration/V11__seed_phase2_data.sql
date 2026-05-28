-- =============================================================================
-- V11__seed_phase2_data.sql
-- Minimarket Platform - Fase 2
-- Datos iniciales para módulos de Compras, Caja, Clientes/Crédito y Reportes
--
-- Incluye:
--   1. 3 proveedores de ejemplo
--   2. 2 clientes con crédito habilitado
--   3. Nuevos permisos de Fase 2 (PURCHASES, CASH, REPORTS módulos)
--   4. Asignación de permisos a roles según matriz definida
--
-- UUIDs fijos para referencia desde la aplicación:
--   Proveedores:
--     f0000000-0000-0000-0000-000000000001  Distribuidora Norte
--     f0000000-0000-0000-0000-000000000002  Alimentos del Sur
--     f0000000-0000-0000-0000-000000000003  Bebidas Express
--   Clientes con crédito:
--     f1000000-0000-0000-0000-000000000001  María González
--     f1000000-0000-0000-0000-000000000002  Carlos Rodríguez
--
-- Convenio de permisos Fase 2: {MODULO}_{ACCION}
--   Módulo PURCHASES: PURCHASE_*
--   Módulo CASH:      CASH_*
--   Módulo REPORTS:   REPORT_*
--   Módulo SUPPLIERS: SUPPLIER_*
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- PROVEEDORES DE EJEMPLO
-- ---------------------------------------------------------------------------
INSERT INTO public.suppliers (
    id, name, rut, contact_name, phone, email, address, is_active
) VALUES
    (
        'f0000000-0000-0000-0000-000000000001',
        'Distribuidora Norte SpA',
        '76.543.210-K',
        'Roberto Fuentes',
        '+56 9 8765 4321',
        'ventas@distribuidoranorte.cl',
        'Av. Industrial 1234, Bodega 5, Santiago',
        TRUE
    ),
    (
        'f0000000-0000-0000-0000-000000000002',
        'Alimentos del Sur Ltda.',
        '77.123.456-3',
        'Patricia Morales',
        '+56 9 7654 3210',
        'pedidos@alimentosdelsur.cl',
        'Ruta 5 Sur Km 340, Temuco',
        TRUE
    ),
    (
        'f0000000-0000-0000-0000-000000000003',
        'Bebidas Express S.A.',
        '96.789.012-5',
        'Andrés Castillo',
        '+56 2 2345 6789',
        'comercial@bebidasexpress.cl',
        'Parque Industrial Pudahuel, Nave 23, Santiago',
        TRUE
    )
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- CLIENTES CON CRÉDITO HABILITADO
-- Se insertan con ON CONFLICT DO UPDATE para actualizar si ya existen por RUT.
-- ---------------------------------------------------------------------------
INSERT INTO public.customers (
    id, rut, first_name, last_name, phone, email,
    credit_limit, credit_used, is_active, notes
) VALUES
    (
        'f1000000-0000-0000-0000-000000000001',
        '12.345.678-9',
        'María',
        'González López',
        '+56 9 1234 5678',
        'maria.gonzalez@email.com',
        150000.00,   -- límite: $150.000
        0.00,
        TRUE,
        'Cliente preferente. Crédito aprobado por administración.'
    ),
    (
        'f1000000-0000-0000-0000-000000000002',
        '9.876.543-2',
        'Carlos',
        'Rodríguez Soto',
        '+56 9 8765 4321',
        NULL,
        80000.00,    -- límite: $80.000
        0.00,
        TRUE,
        'Cliente habitual del barrio. Crédito quincenal.'
    )
ON CONFLICT (id) DO UPDATE
    SET credit_limit = EXCLUDED.credit_limit,
        notes        = EXCLUDED.notes,
        updated_at   = NOW();

-- Manejar conflicto por RUT si los clientes ya existen con otro UUID
INSERT INTO public.customers (
    id, rut, first_name, last_name, phone, email,
    credit_limit, credit_used, is_active, notes
) VALUES
    (
        'f1000000-0000-0000-0000-000000000001',
        '12.345.678-9',
        'María',
        'González López',
        '+56 9 1234 5678',
        'maria.gonzalez@email.com',
        150000.00,
        0.00,
        TRUE,
        'Cliente preferente. Crédito aprobado por administración.'
    ),
    (
        'f1000000-0000-0000-0000-000000000002',
        '9.876.543-2',
        'Carlos',
        'Rodríguez Soto',
        '+56 9 8765 4321',
        NULL,
        80000.00,
        0.00,
        TRUE,
        'Cliente habitual del barrio. Crédito quincenal.'
    )
ON CONFLICT (rut) DO UPDATE
    SET credit_limit = EXCLUDED.credit_limit,
        notes        = EXCLUDED.notes,
        updated_at   = NOW();

-- ---------------------------------------------------------------------------
-- PERMISOS DE FASE 2
-- Nuevos módulos: PURCHASES, SUPPLIERS, CASH, REPORTS
-- Convenio: {MODULO}_{ACCION}
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (id, code, module, description) VALUES

    -- Módulo: PURCHASES (Compras)
    ('60000000-0000-0000-0000-000000000001', 'PURCHASE_CREATE',     'PURCHASES', 'Crear órdenes de compra en estado DRAFT'),
    ('60000000-0000-0000-0000-000000000002', 'PURCHASE_READ',       'PURCHASES', 'Consultar órdenes de compra y su historial'),
    ('60000000-0000-0000-0000-000000000003', 'PURCHASE_CONFIRM',    'PURCHASES', 'Confirmar una compra DRAFT e ingresar stock'),
    ('60000000-0000-0000-0000-000000000004', 'PURCHASE_CANCEL',     'PURCHASES', 'Cancelar una compra (no revierte stock)'),
    ('60000000-0000-0000-0000-000000000005', 'PURCHASE_EDIT',       'PURCHASES', 'Editar una compra en estado DRAFT'),

    -- Módulo: SUPPLIERS (Proveedores)
    ('60000000-0000-0000-0000-000000000011', 'SUPPLIER_VIEW',       'SUPPLIERS', 'Consultar listado y detalle de proveedores'),
    ('60000000-0000-0000-0000-000000000012', 'SUPPLIER_CREATE',     'SUPPLIERS', 'Crear nuevos proveedores'),
    ('60000000-0000-0000-0000-000000000013', 'SUPPLIER_EDIT',       'SUPPLIERS', 'Editar datos de proveedores existentes'),
    ('60000000-0000-0000-0000-000000000014', 'SUPPLIER_DELETE',     'SUPPLIERS', 'Dar de baja (soft delete) proveedores'),

    -- Módulo: CASH (Caja)
    ('70000000-0000-0000-0000-000000000001', 'CASH_OPEN',           'CASH', 'Abrir turno de caja'),
    ('70000000-0000-0000-0000-000000000002', 'CASH_CLOSE',          'CASH', 'Cerrar turno de caja y registrar conteo'),
    ('70000000-0000-0000-0000-000000000003', 'CASH_READ',           'CASH', 'Consultar estado y movimientos de caja'),
    ('70000000-0000-0000-0000-000000000004', 'CASH_MOVEMENTS',      'CASH', 'Registrar ingresos y egresos manuales de caja'),
    ('70000000-0000-0000-0000-000000000005', 'CASH_ADMIN',          'CASH', 'Administrar todas las cajas (vista gerencial)'),

    -- Módulo: REPORTS (Reportes)
    ('80000000-0000-0000-0000-000000000001', 'REPORT_SALES',        'REPORTS', 'Acceder a reportes de ventas por período'),
    ('80000000-0000-0000-0000-000000000002', 'REPORT_PURCHASES',    'REPORTS', 'Acceder a reportes de compras por período'),
    ('80000000-0000-0000-0000-000000000003', 'REPORT_STOCK',        'REPORTS', 'Acceder a reportes de inventario y movimientos'),
    ('80000000-0000-0000-0000-000000000004', 'REPORT_CASH',         'REPORTS', 'Acceder a reportes de cierres de caja'),
    ('80000000-0000-0000-0000-000000000005', 'REPORT_PROFIT',       'REPORTS', 'Acceder a reporte de utilidades y margen'),
    ('80000000-0000-0000-0000-000000000006', 'REPORT_CUSTOMERS',    'REPORTS', 'Acceder a reporte de deudores y cuenta corriente'),
    ('80000000-0000-0000-0000-000000000007', 'REPORT_EXPORT',       'REPORTS', 'Exportar reportes a CSV/Excel/PDF')

ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- ASIGNACIÓN DE PERMISOS A ROLES - Fase 2
--
-- Matriz de permisos:
--
--   BODEGA:
--     - purchases: PURCHASE_CREATE, PURCHASE_READ, PURCHASE_CONFIRM, PURCHASE_EDIT
--     - suppliers: SUPPLIER_VIEW, SUPPLIER_CREATE, SUPPLIER_EDIT
--     - stock:     STOCK_VIEW (ya asignado en V6)
--     - reports:   REPORT_STOCK
--
--   CAJERO:
--     - cash:      CASH_OPEN, CASH_CLOSE, CASH_READ, CASH_MOVEMENTS
--     - customers: CUSTOMER_VIEW (ya asignado), CUSTOMER_CREATE (ya asignado)
--     - reports:   REPORT_CASH (solo su propia caja — enforcar en app)
--
--   SUPERVISOR:
--     - reports:   REPORT_SALES, REPORT_PURCHASES, REPORT_STOCK, REPORT_CASH,
--                  REPORT_PROFIT, REPORT_CUSTOMERS, REPORT_EXPORT
--     - customers: CUSTOMER_CREDIT (ya asignado en V6)
--     - purchases: PURCHASE_READ
--     - cash:      CASH_READ, CASH_ADMIN
--
--   ADMIN:
--     - todos los permisos nuevos (INSERT SELECT de todos)
-- ---------------------------------------------------------------------------

-- ADMIN: agregar todos los permisos nuevos de Fase 2
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000001', id
FROM   public.permissions
WHERE  module IN ('PURCHASES', 'SUPPLIERS', 'CASH', 'REPORTS')
ON CONFLICT DO NOTHING;

-- BODEGA: compras, proveedores y reporte de stock
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000003', p.id
FROM   public.permissions p
WHERE  p.code IN (
    -- Compras
    'PURCHASE_CREATE',
    'PURCHASE_READ',
    'PURCHASE_CONFIRM',
    'PURCHASE_EDIT',
    -- Proveedores
    'SUPPLIER_VIEW',
    'SUPPLIER_CREATE',
    'SUPPLIER_EDIT',
    -- Reportes de bodega
    'REPORT_STOCK'
)
ON CONFLICT DO NOTHING;

-- CAJERO: apertura/cierre de caja, movimientos y reporte de caja propia
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000002', p.id
FROM   public.permissions p
WHERE  p.code IN (
    -- Caja
    'CASH_OPEN',
    'CASH_CLOSE',
    'CASH_READ',
    'CASH_MOVEMENTS',
    -- Reporte de caja (su propio turno — restricción en capa de aplicación)
    'REPORT_CASH'
)
ON CONFLICT DO NOTHING;

-- SUPERVISOR: reportes completos, crédito de clientes, compras (lectura), caja (admin)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000004', p.id
FROM   public.permissions p
WHERE  p.code IN (
    -- Reportes completos
    'REPORT_SALES',
    'REPORT_PURCHASES',
    'REPORT_STOCK',
    'REPORT_CASH',
    'REPORT_PROFIT',
    'REPORT_CUSTOMERS',
    'REPORT_EXPORT',
    -- Compras (solo lectura)
    'PURCHASE_READ',
    -- Caja (lectura y vista gerencial)
    'CASH_READ',
    'CASH_ADMIN',
    -- Proveedores (solo lectura)
    'SUPPLIER_VIEW'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- ANALYZE: actualizar estadísticas después de insertar datos
-- ---------------------------------------------------------------------------
ANALYZE public.suppliers;
ANALYZE public.customers;
ANALYZE public.permissions;
ANALYZE public.role_permissions;

COMMIT;

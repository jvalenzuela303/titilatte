-- =============================================================================
-- V6__seed_initial_data.sql
-- Minimarket Platform - Fase 1
-- Datos iniciales del sistema
--
-- Incluye:
--   - Roles del sistema (ADMIN, CAJERO, BODEGA, SUPERVISOR)
--   - Permisos por módulo
--   - Asignación de permisos a roles
--   - Usuario administrador por defecto
--   - Impuestos base (IVA 19%, Exento)
--   - Unidades de medida (Unidad, Kilogramo, Litro, Caja)
--   - Familias y categorías de productos de ejemplo
--
-- IMPORTANTE: Cambiar la contraseña del admin en el primer despliegue.
-- El hash corresponde a: Admin1234! (BCrypt $2a$12$)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- ROLES
-- ---------------------------------------------------------------------------
INSERT INTO public.roles (id, name, description) VALUES
    ('00000000-0000-0000-0000-000000000001', 'ADMIN',
     'Acceso total al sistema. Gestión de usuarios, precios, configuración y reportes.'),
    ('00000000-0000-0000-0000-000000000002', 'CAJERO',
     'Operación de POS, registro de ventas y pagos. Sin acceso a precios ni configuración.'),
    ('00000000-0000-0000-0000-000000000003', 'BODEGA',
     'Gestión de stock, recepción de compras y registro de movimientos de inventario.'),
    ('00000000-0000-0000-0000-000000000004', 'SUPERVISOR',
     'Aprobación de descuentos, anulaciones, ajustes de stock y acceso a reportes.')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- PERMISOS
-- Convenio de código: {MÓDULO}_{ACCIÓN}
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (id, code, module, description) VALUES
    -- Módulo: AUTH
    ('10000000-0000-0000-0000-000000000001', 'AUTH_USER_CREATE',    'AUTH', 'Crear usuarios en el sistema'),
    ('10000000-0000-0000-0000-000000000002', 'AUTH_USER_EDIT',      'AUTH', 'Editar datos de usuarios existentes'),
    ('10000000-0000-0000-0000-000000000003', 'AUTH_USER_DELETE',    'AUTH', 'Eliminar (soft) usuarios del sistema'),
    ('10000000-0000-0000-0000-000000000004', 'AUTH_ROLE_ASSIGN',    'AUTH', 'Asignar roles a usuarios'),
    ('10000000-0000-0000-0000-000000000005', 'AUTH_USER_VIEW',      'AUTH', 'Visualizar listado y detalle de usuarios'),

    -- Módulo: PRODUCTS
    ('20000000-0000-0000-0000-000000000001', 'PRODUCT_VIEW',        'PRODUCTS', 'Consultar catálogo de productos'),
    ('20000000-0000-0000-0000-000000000002', 'PRODUCT_CREATE',      'PRODUCTS', 'Crear nuevos productos en el catálogo'),
    ('20000000-0000-0000-0000-000000000003', 'PRODUCT_EDIT',        'PRODUCTS', 'Editar datos de productos (excepto precios)'),
    ('20000000-0000-0000-0000-000000000004', 'PRODUCT_DELETE',      'PRODUCTS', 'Dar de baja (soft delete) productos'),
    ('20000000-0000-0000-0000-000000000005', 'PRODUCT_PRICE_EDIT',  'PRODUCTS', 'Modificar precios de compra y venta. Solo ADMIN.'),

    -- Módulo: SALES
    ('30000000-0000-0000-0000-000000000001', 'SALE_CREATE',         'SALES', 'Registrar nuevas ventas en POS'),
    ('30000000-0000-0000-0000-000000000002', 'SALE_VIEW',           'SALES', 'Consultar historial de ventas'),
    ('30000000-0000-0000-0000-000000000003', 'SALE_CANCEL',         'SALES', 'Anular ventas confirmadas'),
    ('30000000-0000-0000-0000-000000000004', 'SALE_DISCOUNT',       'SALES', 'Aplicar descuentos en ventas'),
    ('30000000-0000-0000-0000-000000000005', 'SALE_REPORT',         'SALES', 'Acceder a reportes de ventas y cierres'),

    -- Módulo: STOCK
    ('40000000-0000-0000-0000-000000000001', 'STOCK_VIEW',          'STOCK', 'Consultar niveles de stock y movimientos'),
    ('40000000-0000-0000-0000-000000000002', 'STOCK_ADJUST',        'STOCK', 'Registrar ajustes manuales de stock (requiere autorización)'),
    ('40000000-0000-0000-0000-000000000003', 'STOCK_PURCHASE',      'STOCK', 'Registrar ingreso de mercadería por compra'),
    ('40000000-0000-0000-0000-000000000004', 'STOCK_WASTE',         'STOCK', 'Registrar mermas (requiere autorización)'),

    -- Módulo: CUSTOMERS
    ('50000000-0000-0000-0000-000000000001', 'CUSTOMER_VIEW',       'CUSTOMERS', 'Consultar clientes'),
    ('50000000-0000-0000-0000-000000000002', 'CUSTOMER_CREATE',     'CUSTOMERS', 'Crear nuevos clientes'),
    ('50000000-0000-0000-0000-000000000003', 'CUSTOMER_EDIT',       'CUSTOMERS', 'Editar datos de clientes'),
    ('50000000-0000-0000-0000-000000000004', 'CUSTOMER_CREDIT',     'CUSTOMERS', 'Gestionar límites de crédito de clientes')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- ASIGNACIÓN DE PERMISOS A ROLES
-- ADMIN: todos los permisos
-- CAJERO: ventas + consulta básica
-- BODEGA: stock + productos (sin precio)
-- SUPERVISOR: ventas + ajustes + reportes
-- ---------------------------------------------------------------------------

-- ADMIN: todos los permisos
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000001', id
FROM   public.permissions
ON CONFLICT DO NOTHING;

-- CAJERO: POS, consulta catálogo, clientes básicos
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000002', id
FROM   public.permissions
WHERE  code IN (
    'PRODUCT_VIEW',
    'SALE_CREATE', 'SALE_VIEW',
    'CUSTOMER_VIEW', 'CUSTOMER_CREATE',
    'STOCK_VIEW'
)
ON CONFLICT DO NOTHING;

-- BODEGA: gestión de stock e inventario
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000003', id
FROM   public.permissions
WHERE  code IN (
    'PRODUCT_VIEW', 'PRODUCT_CREATE', 'PRODUCT_EDIT',
    'STOCK_VIEW', 'STOCK_ADJUST', 'STOCK_PURCHASE', 'STOCK_WASTE'
)
ON CONFLICT DO NOTHING;

-- SUPERVISOR: reportes, anulaciones, descuentos, ajustes autorizados
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000004', id
FROM   public.permissions
WHERE  code IN (
    'PRODUCT_VIEW',
    'SALE_VIEW', 'SALE_CANCEL', 'SALE_DISCOUNT', 'SALE_REPORT',
    'STOCK_VIEW', 'STOCK_ADJUST', 'STOCK_WASTE',
    'CUSTOMER_VIEW', 'CUSTOMER_EDIT', 'CUSTOMER_CREDIT'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- USUARIO ADMINISTRADOR POR DEFECTO
-- Email:    admin@minimarket.local
-- Password: Admin1234!  (BCrypt $2a$12$ — cambiar en primer despliegue)
-- ---------------------------------------------------------------------------
INSERT INTO public.users (
    id, email, password_hash, first_name, last_name, is_active
) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'admin@minimarket.local',
    -- BCrypt hash de 'Admin1234!' — REEMPLAZAR antes de producción
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiLXCJAFRbTK',
    'Administrador',
    'Sistema',
    TRUE
)
ON CONFLICT (email) DO NOTHING;

-- Asignar rol ADMIN al usuario administrador
INSERT INTO public.user_roles (user_id, role_id, assigned_by)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001'
)
ON CONFLICT DO NOTHING;

-- Usuario de sistema (usado internamente por triggers y jobs)
INSERT INTO public.users (
    id, email, password_hash, first_name, last_name, is_active
) VALUES (
    'a0000000-0000-0000-0000-000000000000',
    'system@minimarket.local',
    -- Contraseña bloqueada (hash imposible de revertir, 60 chars de X)
    '$2a$12$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'Sistema',
    'Interno',
    FALSE
)
ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------------------
-- IMPUESTOS BASE
-- ---------------------------------------------------------------------------
INSERT INTO public.taxes (id, code, name, type, rate, is_active) VALUES
    ('b0000000-0000-0000-0000-000000000001', 'IVA19',   'IVA 19%',            'IVA',    0.19, TRUE),
    ('b0000000-0000-0000-0000-000000000002', 'EXENTO',  'Exento de Impuesto', 'EXENTO', 0.00, TRUE),
    ('b0000000-0000-0000-0000-000000000003', 'IVA10',   'IVA 10% Reducido',   'IVA',    0.10, TRUE)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- UNIDADES DE MEDIDA BASE
-- ---------------------------------------------------------------------------
INSERT INTO public.units (id, code, name, abbreviation, is_active) VALUES
    ('c0000000-0000-0000-0000-000000000001', 'UN',    'Unidad',     'un',  TRUE),
    ('c0000000-0000-0000-0000-000000000002', 'KG',    'Kilogramo',  'kg',  TRUE),
    ('c0000000-0000-0000-0000-000000000003', 'LT',    'Litro',      'lt',  TRUE),
    ('c0000000-0000-0000-0000-000000000004', 'CJ',    'Caja',       'cj',  TRUE),
    ('c0000000-0000-0000-0000-000000000005', 'GR',    'Gramo',      'gr',  TRUE),
    ('c0000000-0000-0000-0000-000000000006', 'ML',    'Mililitro',  'ml',  TRUE),
    ('c0000000-0000-0000-0000-000000000007', 'MT',    'Metro',      'mt',  TRUE),
    ('c0000000-0000-0000-0000-000000000008', 'PK',    'Pack',       'pk',  TRUE)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- FAMILIAS DE PRODUCTOS (nivel superior de clasificación)
-- ---------------------------------------------------------------------------
INSERT INTO public.product_families (id, code, name, description, is_active) VALUES
    ('d0000000-0000-0000-0000-000000000001', 'ALI', 'Alimentos',
     'Productos alimenticios no perecederos y perecederos.', TRUE),
    ('d0000000-0000-0000-0000-000000000002', 'BEB', 'Bebidas',
     'Bebidas alcohólicas y no alcohólicas.', TRUE),
    ('d0000000-0000-0000-0000-000000000003', 'LIM', 'Limpieza y Aseo',
     'Productos de limpieza del hogar y aseo personal.', TRUE),
    ('d0000000-0000-0000-0000-000000000004', 'CON', 'Confites y Snacks',
     'Dulces, chocolates, papas fritas y snacks varios.', TRUE),
    ('d0000000-0000-0000-0000-000000000005', 'CON_GEL', 'Congelados',
     'Alimentos congelados, helados y refrigerados.', TRUE),
    ('d0000000-0000-0000-0000-000000000006', 'TAB', 'Tabaco',
     'Cigarrillos y productos de tabaco.', TRUE)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- CATEGORÍAS DE PRODUCTOS
-- ---------------------------------------------------------------------------
INSERT INTO public.product_categories (id, family_id, code, name, description, is_active) VALUES
    -- Familia: Alimentos
    ('e0000000-0000-0000-0000-000000000001',
     'd0000000-0000-0000-0000-000000000001', 'LAC', 'Lácteos',
     'Leche, yogur, queso, mantequilla y derivados.', TRUE),
    ('e0000000-0000-0000-0000-000000000002',
     'd0000000-0000-0000-0000-000000000001', 'CER', 'Cereales y Pastas',
     'Arroz, fideos, avena, harina y cereales de desayuno.', TRUE),
    ('e0000000-0000-0000-0000-000000000003',
     'd0000000-0000-0000-0000-000000000001', 'CON_ALI', 'Conservas y Enlatados',
     'Atún, sardinas, tomate, legumbres en conserva.', TRUE),
    ('e0000000-0000-0000-0000-000000000004',
     'd0000000-0000-0000-0000-000000000001', 'PAN', 'Panadería',
     'Pan de molde, tostadas, galletas y masas.', TRUE),
    ('e0000000-0000-0000-0000-000000000005',
     'd0000000-0000-0000-0000-000000000001', 'ACE', 'Aceites y Aderezos',
     'Aceite vegetal, vinagre, mayonesa, salsas.', TRUE),

    -- Familia: Bebidas
    ('e0000000-0000-0000-0000-000000000011',
     'd0000000-0000-0000-0000-000000000002', 'GAS', 'Bebidas Gaseosas',
     'Refrescos carbonatados de todas las marcas.', TRUE),
    ('e0000000-0000-0000-0000-000000000012',
     'd0000000-0000-0000-0000-000000000002', 'AGU', 'Aguas y Jugos',
     'Agua mineral, jugos naturales y néctar.', TRUE),
    ('e0000000-0000-0000-0000-000000000013',
     'd0000000-0000-0000-0000-000000000002', 'CER_BEB', 'Cervezas',
     'Cervezas nacionales e importadas.', TRUE),
    ('e0000000-0000-0000-0000-000000000014',
     'd0000000-0000-0000-0000-000000000002', 'VIN', 'Vinos y Licores',
     'Vinos, espumantes y licores.', TRUE),

    -- Familia: Limpieza y Aseo
    ('e0000000-0000-0000-0000-000000000021',
     'd0000000-0000-0000-0000-000000000003', 'LIM_HOG', 'Limpieza del Hogar',
     'Detergentes, cloro, desengrasantes y esponjas.', TRUE),
    ('e0000000-0000-0000-0000-000000000022',
     'd0000000-0000-0000-0000-000000000003', 'HIG', 'Higiene Personal',
     'Shampoo, jabón, pasta dental, desodorante.', TRUE),
    ('e0000000-0000-0000-0000-000000000023',
     'd0000000-0000-0000-0000-000000000003', 'PAP', 'Papel y Desechables',
     'Papel higiénico, toalla nova, pañuelos y servilletas.', TRUE),

    -- Familia: Confites y Snacks
    ('e0000000-0000-0000-0000-000000000031',
     'd0000000-0000-0000-0000-000000000004', 'CHO', 'Chocolates y Dulces',
     'Chocolates, caramelos, gomas y confites.', TRUE),
    ('e0000000-0000-0000-0000-000000000032',
     'd0000000-0000-0000-0000-000000000004', 'SNK', 'Snacks y Papas',
     'Papas fritas, ramitas, palitos y snacks salados.', TRUE)

ON CONFLICT (code) DO NOTHING;

COMMIT;

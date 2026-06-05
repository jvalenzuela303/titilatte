-- =============================================================================
-- V20__seed_test_data.sql
-- Minimarket Platform — Datos de prueba
--
-- Propósito: Poblar el sistema con datos realistas para desarrollo, QA y demos.
--
-- Contenido:
--   1. Sucursal adicional (Sucursal Centro)
--   2. 5 usuarios de prueba (2 cajeros + 1 supervisor + 1 bodega en Principal,
--      1 cajero en Centro)
--   3. 35 productos (Sucursal Principal) con stock ajustado al estado post-ventas
--   4. 3 clientes adicionales
--   5. 20 ventas CONFIRMED con detalles y pagos (últimos 30 días)
--   6. Actualización de crédito utilizado
--
-- UUIDs fijos para referencia determinista:
--   Sucursal Centro:    fafafafa-0000-0000-0000-000000000002
--   Cajero Juan:        ababab01-0000-0000-0000-000000000001
--   Cajero Ana:         ababab02-0000-0000-0000-000000000001
--   Supervisor Luis:    ababab03-0000-0000-0000-000000000001
--   Bodega Carmen:      ababab04-0000-0000-0000-000000000001
--   Cajero Diego (Ctr): ababab05-0000-0000-0000-000000000001
--   Productos p01-p35:  cdcdcd00-0000-0000-0000-0000000000XX  (XX = 01..35 hex)
--   Ventas s01-s20:     dddddd00-0000-0000-0000-0000000000XX  (XX = 01..20 hex)
--   Clientes c03-c05:   eeeeee00-0000-0000-0000-0000000000XX  (XX = 03..05 hex)
--
-- Contraseña de todos los usuarios de prueba: Admin1234!
--
-- NOTA: Las ventas se insertan directamente como CONFIRMED (sin pasar por PENDING
-- para evitar disparar el trigger de stock). El campo stock_current en productos
-- ya refleja el inventario post-ventas. Los movimientos de stock quedan pendientes
-- de sincronizar si se requiere historial completo de auditoría.
-- =============================================================================

BEGIN;

-- ============================================================
-- 1. SUCURSAL ADICIONAL
-- ============================================================
INSERT INTO public.branches (id, name, address, phone, rut, is_active)
VALUES (
    'fafafafa-0000-0000-0000-000000000002',
    'Sucursal Centro',
    'Av. Libertador Bernardo O''Higgins 1234, Local 5',
    '+56 2 2234 5678',
    '76.543.210-9',
    TRUE
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. USUARIOS DE PRUEBA
--    Contraseña: Admin1234! (mismo hash BCrypt del admin por defecto)
-- ============================================================
INSERT INTO public.users (id, email, password_hash, first_name, last_name, is_active, branch_id)
VALUES
    (
        'ababab01-0000-0000-0000-000000000001',
        'cajero1@minimarket.local',
        '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiLXCJAFRbTK',
        'Juan', 'Pérez Soto', TRUE,
        '00000000-0000-0000-0000-000000000001'
    ),
    (
        'ababab02-0000-0000-0000-000000000001',
        'cajero2@minimarket.local',
        '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiLXCJAFRbTK',
        'Ana', 'Martínez López', TRUE,
        '00000000-0000-0000-0000-000000000001'
    ),
    (
        'ababab03-0000-0000-0000-000000000001',
        'supervisor1@minimarket.local',
        '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiLXCJAFRbTK',
        'Luis', 'Torres Rojas', TRUE,
        '00000000-0000-0000-0000-000000000001'
    ),
    (
        'ababab04-0000-0000-0000-000000000001',
        'bodega1@minimarket.local',
        '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiLXCJAFRbTK',
        'Carmen', 'Vargas Díaz', TRUE,
        '00000000-0000-0000-0000-000000000001'
    ),
    (
        'ababab05-0000-0000-0000-000000000001',
        'cajero.centro@minimarket.local',
        '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiLXCJAFRbTK',
        'Diego', 'Ramos Fuentes', TRUE,
        'fafafafa-0000-0000-0000-000000000002'
    )
ON CONFLICT (email) DO NOTHING;

-- Asignación de roles
INSERT INTO public.user_roles (user_id, role_id, assigned_by)
VALUES
    -- CAJERO: Juan y Ana (Sucursal Principal)
    ('ababab01-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001'),
    ('ababab02-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001'),
    -- CAJERO: Diego (Sucursal Centro)
    ('ababab05-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001'),
    -- SUPERVISOR: Luis (Sucursal Principal)
    ('ababab03-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001'),
    -- BODEGA: Carmen (Sucursal Principal)
    ('ababab04-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. PRODUCTOS — Sucursal Principal
--
-- Impuestos:  IVA19  = b0000000-0000-0000-0000-000000000001 (0.19)
--             EXENTO = b0000000-0000-0000-0000-000000000002 (0.00)
--
-- Unidades:   UN = c0000000-0000-0000-0000-000000000001
--             KG = c0000000-0000-0000-0000-000000000002
--             LT = c0000000-0000-0000-0000-000000000003
--             PK = c0000000-0000-0000-0000-000000000008
--
-- Categorías: LAC     = e0000000-0000-0000-0000-000000000001
--             CER     = e0000000-0000-0000-0000-000000000002
--             CON_ALI = e0000000-0000-0000-0000-000000000003
--             PAN     = e0000000-0000-0000-0000-000000000004
--             ACE     = e0000000-0000-0000-0000-000000000005
--             GAS     = e0000000-0000-0000-0000-000000000011
--             AGU     = e0000000-0000-0000-0000-000000000012
--             CER_BEB = e0000000-0000-0000-0000-000000000013
--             VIN     = e0000000-0000-0000-0000-000000000014
--             LIM_HOG = e0000000-0000-0000-0000-000000000021
--             HIG     = e0000000-0000-0000-0000-000000000022
--             PAP     = e0000000-0000-0000-0000-000000000023
--             CHO     = e0000000-0000-0000-0000-000000000031
--             SNK     = e0000000-0000-0000-0000-000000000032
--
-- stock_current refleja inventario actual (post-ventas del seed).
-- ============================================================
INSERT INTO public.products (
    id, barcode, name,
    purchase_price, sale_price,
    stock_current, stock_minimum, stock_maximum,
    is_active, category_id, tax_id, unit_id, branch_id
) VALUES

-- ── LÁCTEOS (IVA exento en Chile para leche y yogur) ────────────────────────
(
    'cdcdcd00-0000-0000-0000-000000000001',
    '7801000001001', 'Leche Entera Soprole 1 Lt',
    850.00, 990.00, 35, 10, 200,
    TRUE, 'e0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',  -- EXENTO
    'c0000000-0000-0000-0000-000000000001',  -- UN
    '00000000-0000-0000-0000-000000000001'
),
(
    'cdcdcd00-0000-0000-0000-000000000002',
    '7801000001002', 'Leche Semidescremada Colun 1 Lt',
    820.00, 990.00, 28, 10, 200,
    TRUE, 'e0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'cdcdcd00-0000-0000-0000-000000000003',
    '7801000001003', 'Yogur Batido Soprole Frutilla 500 g',
    650.00, 790.00, 27, 5, 100,
    TRUE, 'e0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'cdcdcd00-0000-0000-0000-000000000004',
    '7801000001004', 'Mantequilla Colun 250 g',
    1200.00, 1490.00, 22, 5, 80,
    TRUE, 'e0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',  -- IVA 19%
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'cdcdcd00-0000-0000-0000-000000000005',
    '7801000001005', 'Queso Gauda Laminado 150 g',
    1800.00, 2190.00, 18, 5, 60,
    TRUE, 'e0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',  -- EXENTO
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),

-- ── CEREALES Y PASTAS (exentos) ──────────────────────────────────────────────
(
    'cdcdcd00-0000-0000-0000-000000000006',
    '7801000002001', 'Arroz Grado 1 El Rancho 1 kg',
    750.00, 890.00, 44, 10, 300,
    TRUE, 'e0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000002',  -- KG
    '00000000-0000-0000-0000-000000000001'
),
(
    'cdcdcd00-0000-0000-0000-000000000007',
    '7801000002002', 'Fideos Espagueti Carozzi 400 g',
    450.00, 590.00, 46, 10, 300,
    TRUE, 'e0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'cdcdcd00-0000-0000-0000-000000000008',
    '7801000002003', 'Avena Quaker Tradicional 200 g',
    590.00, 790.00, 38, 5, 150,
    TRUE, 'e0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'cdcdcd00-0000-0000-0000-000000000009',
    '7801000002004', 'Harina Sin Polvos de Hornear 1 kg',
    580.00, 690.00, 32, 5, 200,
    TRUE, 'e0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001'
),

-- ── CONSERVAS Y ENLATADOS ────────────────────────────────────────────────────
(
    'cdcdcd00-0000-0000-0000-000000000010',
    '7801000003001', 'Atún Claro en Agua Coa 190 g',
    620.00, 790.00, 36, 10, 200,
    TRUE, 'e0000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'cdcdcd00-0000-0000-0000-000000000011',
    '7801000003002', 'Tomate Triturado Gino 400 g',
    450.00, 590.00, 42, 5, 150,
    TRUE, 'e0000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'cdcdcd00-0000-0000-0000-000000000012',
    '7801000003003', 'Maíz en Conserva Arcor 300 g',
    450.00, 590.00, 35, 5, 120,
    TRUE, 'e0000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),

-- ── PANADERÍA ────────────────────────────────────────────────────────────────
(
    'cdcdcd00-0000-0000-0000-000000000013',
    '7801000004001', 'Pan de Molde Ideal 500 g',
    980.00, 1190.00, 30, 5, 120,
    TRUE, 'e0000000-0000-0000-0000-000000000004',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'cdcdcd00-0000-0000-0000-000000000014',
    '7801000004002', 'Tostadas Wasa Fibra 275 g',
    1590.00, 1990.00, 15, 3, 60,
    TRUE, 'e0000000-0000-0000-0000-000000000004',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'cdcdcd00-0000-0000-0000-000000000015',
    '7801000004003', 'Galletas Oreo 119 g',
    650.00, 790.00, 44, 10, 200,
    TRUE, 'e0000000-0000-0000-0000-000000000004',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),

-- ── ACEITES Y ADEREZOS ───────────────────────────────────────────────────────
(
    'cdcdcd00-0000-0000-0000-000000000016',
    '7801000005001', 'Aceite Vegetal Chef 1 Lt',
    1290.00, 1590.00, 25, 5, 100,
    TRUE, 'e0000000-0000-0000-0000-000000000005',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000003',  -- LT
    '00000000-0000-0000-0000-000000000001'
),
(
    'cdcdcd00-0000-0000-0000-000000000017',
    '7801000005002', 'Mayonesa Hellmann''s 400 g',
    1190.00, 1490.00, 28, 5, 100,
    TRUE, 'e0000000-0000-0000-0000-000000000005',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'cdcdcd00-0000-0000-0000-000000000018',
    '7801000005003', 'Vinagre de Vino Möller 500 ml',
    480.00, 690.00, 20, 3, 80,
    TRUE, 'e0000000-0000-0000-0000-000000000005',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),

-- ── BEBIDAS GASEOSAS ─────────────────────────────────────────────────────────
(
    'cdcdcd00-0000-0000-0000-000000000019',
    '7801000006001', 'Coca-Cola 1.5 Lt',
    890.00, 1090.00, 36, 10, 200,
    TRUE, 'e0000000-0000-0000-0000-000000000011',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'cdcdcd00-0000-0000-0000-000000000020',
    '7801000006002', 'Pepsi 1.5 Lt',
    820.00, 990.00, 30, 5, 150,
    TRUE, 'e0000000-0000-0000-0000-000000000011',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'cdcdcd00-0000-0000-0000-000000000021',
    '7801000006003', 'Bebida Fanta Naranja 1.5 Lt',
    750.00, 990.00, 28, 5, 150,
    TRUE, 'e0000000-0000-0000-0000-000000000011',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),

-- ── AGUAS Y JUGOS ────────────────────────────────────────────────────────────
(
    'cdcdcd00-0000-0000-0000-000000000022',
    '7801000007001', 'Agua Mineral Cachantun 1.5 Lt',
    290.00, 390.00, 52, 12, 300,
    TRUE, 'e0000000-0000-0000-0000-000000000012',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'cdcdcd00-0000-0000-0000-000000000023',
    '7801000007002', 'Jugo Natural Valle Naranja 1 Lt',
    580.00, 790.00, 30, 5, 120,
    TRUE, 'e0000000-0000-0000-0000-000000000012',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001'
),

-- ── CERVEZAS ─────────────────────────────────────────────────────────────────
(
    'cdcdcd00-0000-0000-0000-000000000024',
    '7801000008001', 'Cerveza Escudo 330 ml',
    590.00, 790.00, 38, 12, 300,
    TRUE, 'e0000000-0000-0000-0000-000000000013',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'cdcdcd00-0000-0000-0000-000000000025',
    '7801000008002', 'Cerveza Cristal 500 ml',
    720.00, 990.00, 32, 12, 240,
    TRUE, 'e0000000-0000-0000-0000-000000000013',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),

-- ── VINOS Y LICORES ──────────────────────────────────────────────────────────
(
    'cdcdcd00-0000-0000-0000-000000000026',
    '7801000009001', 'Vino Tinto Casillero del Diablo 750 ml',
    3200.00, 4290.00, 18, 3, 60,
    TRUE, 'e0000000-0000-0000-0000-000000000014',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),

-- ── LIMPIEZA DEL HOGAR ───────────────────────────────────────────────────────
(
    'cdcdcd00-0000-0000-0000-000000000027',
    '7801000010001', 'Detergente Omo Matic 1 kg',
    2800.00, 3490.00, 19, 5, 80,
    TRUE, 'e0000000-0000-0000-0000-000000000021',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001'
),
(
    'cdcdcd00-0000-0000-0000-000000000028',
    '7801000010002', 'Cloro Clorox Multiusos 900 ml',
    590.00, 790.00, 28, 5, 120,
    TRUE, 'e0000000-0000-0000-0000-000000000021',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),

-- ── HIGIENE PERSONAL ─────────────────────────────────────────────────────────
(
    'cdcdcd00-0000-0000-0000-000000000029',
    '7801000011001', 'Shampoo Head & Shoulders 375 ml',
    2900.00, 3590.00, 16, 3, 60,
    TRUE, 'e0000000-0000-0000-0000-000000000022',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'cdcdcd00-0000-0000-0000-000000000030',
    '7801000011002', 'Jabón en Barra Dove 90 g',
    780.00, 990.00, 35, 10, 150,
    TRUE, 'e0000000-0000-0000-0000-000000000022',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'cdcdcd00-0000-0000-0000-000000000031',
    '7801000011003', 'Pasta Dental Colgate Triple Acción 75 ml',
    990.00, 1290.00, 22, 5, 100,
    TRUE, 'e0000000-0000-0000-0000-000000000022',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'cdcdcd00-0000-0000-0000-000000000032',
    '7801000011004', 'Desodorante Rexona Men 150 ml',
    1590.00, 1990.00, 18, 3, 72,
    TRUE, 'e0000000-0000-0000-0000-000000000022',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),

-- ── PAPEL Y DESECHABLES ──────────────────────────────────────────────────────
(
    'cdcdcd00-0000-0000-0000-000000000033',
    '7801000012001', 'Papel Higiénico Elite 4 Rollos',
    1800.00, 2190.00, 18, 6, 96,
    TRUE, 'e0000000-0000-0000-0000-000000000023',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000008',  -- PK
    '00000000-0000-0000-0000-000000000001'
),

-- ── CHOCOLATES Y DULCES ──────────────────────────────────────────────────────
(
    'cdcdcd00-0000-0000-0000-000000000034',
    '7801000013001', 'Chocolate Sahne Nuss Nestlé 100 g',
    820.00, 990.00, 46, 10, 200,
    TRUE, 'e0000000-0000-0000-0000-000000000031',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),

-- ── SNACKS Y PAPAS ───────────────────────────────────────────────────────────
(
    'cdcdcd00-0000-0000-0000-000000000035',
    '7801000014001', 'Papas Fritas Lays Original 145 g',
    780.00, 990.00, 43, 10, 200,
    TRUE, 'e0000000-0000-0000-0000-000000000032',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),

-- ── CAFÉ ─────────────────────────────────────────────────────────────────────
(
    'cdcdcd00-0000-0000-0000-000000000036',
    '7801000015001', 'Café Instantáneo Nescafé Gold 200 g',
    3200.00, 3990.00, 14, 3, 48,
    TRUE, 'e0000000-0000-0000-0000-000000000002',  -- categoría Cereales (no existe café específica)
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
)

ON CONFLICT (barcode) DO NOTHING;

-- ============================================================
-- 4. CLIENTES ADICIONALES
-- ============================================================
INSERT INTO public.customers (
    id, rut, first_name, last_name, phone, email,
    credit_limit, credit_used, is_active, notes, branch_id
) VALUES
    (
        'eeeeee00-0000-0000-0000-000000000003',
        '15.234.567-8',
        'Pedro', 'Soto Morales',
        '+56 9 3456 7890', NULL,
        0.00, 0.00, TRUE,
        'Cliente habitual, paga siempre al contado.',
        '00000000-0000-0000-0000-000000000001'
    ),
    (
        'eeeeee00-0000-0000-0000-000000000004',
        '18.765.432-1',
        'Ana', 'Muñoz Castillo',
        '+56 9 5678 9012', 'ana.munoz@email.com',
        50000.00, 0.00, TRUE,
        'Cliente nueva con crédito aprobado hasta $50.000.',
        '00000000-0000-0000-0000-000000000001'
    ),
    (
        'eeeeee00-0000-0000-0000-000000000005',
        '22.111.333-5',
        'Roberto', 'Fernández Pizarro',
        '+56 9 7890 1234', NULL,
        0.00, 0.00, TRUE,
        NULL,
        '00000000-0000-0000-0000-000000000001'
    )
ON CONFLICT (rut) DO UPDATE
    SET first_name = EXCLUDED.first_name,
        last_name  = EXCLUDED.last_name,
        branch_id  = EXCLUDED.branch_id,
        updated_at = NOW();

-- ============================================================
-- 5. VENTAS — Sucursal Principal (últimos 30 días)
--
-- Las ventas se insertan directamente como CONFIRMED.
-- El campo stock_current en productos ya refleja el estado post-ventas.
--
-- Leyenda de productos referenciados:
--   p01 = cdcd..01  Leche Entera Soprole 1 Lt     (sale=990,  iva=EXENTO)
--   p06 = cdcd..06  Arroz Grado 1 El Rancho 1 kg  (sale=890,  iva=EXENTO)
--   p07 = cdcd..07  Fideos Espagueti Carozzi 400 g (sale=590,  iva=EXENTO)
--   p13 = cdcd..13  Pan de Molde Ideal 500 g       (sale=1190, iva=EXENTO)
--   p03 = cdcd..03  Yogur Batido Soprole 500 g     (sale=790,  iva=EXENTO)
--   p10 = cdcd..10  Atún Coa 190 g                 (sale=790,  iva=0.19)
--   p19 = cdcd..19  Coca-Cola 1.5 Lt               (sale=1090, iva=0.19)
--   p22 = cdcd..22  Agua Mineral Cachantun 1.5 Lt  (sale=390,  iva=0.19)
--   p24 = cdcd..24  Cerveza Escudo 330 ml           (sale=790,  iva=0.19)
--   p27 = cdcd..27  Detergente Omo 1 kg            (sale=3490, iva=0.19)
--   p29 = cdcd..29  Shampoo H&S 375 ml             (sale=3590, iva=0.19)
--   p33 = cdcd..33  Papel Higiénico Elite 4R       (sale=2190, iva=0.19)
--   p34 = cdcd..34  Chocolate Sahne Nuss 100 g     (sale=990,  iva=0.19)
--   p35 = cdcd..35  Papas Fritas Lays 145 g        (sale=990,  iva=0.19)
--   p36 = cdcd..36  Café Nescafé Gold 200 g        (sale=3990, iva=0.19)
-- ============================================================

-- ────────────────────────────────────────────────────────────────────────────
-- VENTA 01 — hace 28 días | Cajero: Juan | CONTADO / EFECTIVO
-- Coca-Cola 2u + Pan 1u
-- net=3370  tax=414.20  total=3784.20  cost=2760
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.sales (
    id, type, status,
    total_amount, discount_amount, tax_amount, net_amount, total_cost,
    seller_id, customer_id, branch_id, created_at
) VALUES (
    'dddddd00-0000-0000-0000-000000000001',
    'CONTADO', 'CONFIRMED',
    3784.20, 0.00, 414.20, 3370.00, 2760.00,
    'ababab01-0000-0000-0000-000000000001',
    NULL,
    '00000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '28 days'
);
INSERT INTO public.sale_details (id, sale_id, product_id, quantity, unit_price, discount, subtotal, tax_rate, tax_amount)
VALUES
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000001', 'cdcdcd00-0000-0000-0000-000000000019', 2, 1090.00, 0, 2180.00, 0.19, 414.20),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000001', 'cdcdcd00-0000-0000-0000-000000000013', 1, 1190.00, 0, 1190.00, 0.00,   0.00);
INSERT INTO public.payments (id, sale_id, method, amount, change_amount)
VALUES (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000001', 'EFECTIVO', 4000.00, 215.80);

-- ────────────────────────────────────────────────────────────────────────────
-- VENTA 02 — hace 27 días | Cajero: Juan | CONTADO / TARJETA
-- Cerveza Escudo 3u + Papas Fritas 1u
-- net=3360  tax=638.40  total=3998.40  cost=2550
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.sales (
    id, type, status,
    total_amount, discount_amount, tax_amount, net_amount, total_cost,
    seller_id, customer_id, branch_id, created_at
) VALUES (
    'dddddd00-0000-0000-0000-000000000002',
    'CONTADO', 'CONFIRMED',
    3998.40, 0.00, 638.40, 3360.00, 2550.00,
    'ababab01-0000-0000-0000-000000000001',
    NULL,
    '00000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '27 days'
);
INSERT INTO public.sale_details (id, sale_id, product_id, quantity, unit_price, discount, subtotal, tax_rate, tax_amount)
VALUES
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000002', 'cdcdcd00-0000-0000-0000-000000000024', 3, 790.00, 0, 2370.00, 0.19, 450.30),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000002', 'cdcdcd00-0000-0000-0000-000000000035', 1, 990.00, 0,  990.00, 0.19, 188.10);
INSERT INTO public.payments (id, sale_id, method, amount, change_amount)
VALUES (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000002', 'TARJETA', 3998.40, 0.00);

-- ────────────────────────────────────────────────────────────────────────────
-- VENTA 03 — hace 27 días | Cajero: Ana | CONTADO / EFECTIVO
-- Leche 5u + Arroz 2u
-- net=6730  tax=0  total=6730  cost=5750
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.sales (
    id, type, status,
    total_amount, discount_amount, tax_amount, net_amount, total_cost,
    seller_id, customer_id, branch_id, created_at
) VALUES (
    'dddddd00-0000-0000-0000-000000000003',
    'CONTADO', 'CONFIRMED',
    6730.00, 0.00, 0.00, 6730.00, 5750.00,
    'ababab02-0000-0000-0000-000000000001',
    NULL,
    '00000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '27 days' + INTERVAL '3 hours'
);
INSERT INTO public.sale_details (id, sale_id, product_id, quantity, unit_price, discount, subtotal, tax_rate, tax_amount)
VALUES
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000003', 'cdcdcd00-0000-0000-0000-000000000001', 5, 990.00, 0, 4950.00, 0.00, 0.00),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000003', 'cdcdcd00-0000-0000-0000-000000000006', 2, 890.00, 0, 1780.00, 0.00, 0.00);
INSERT INTO public.payments (id, sale_id, method, amount, change_amount)
VALUES (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000003', 'EFECTIVO', 7000.00, 270.00);

-- ────────────────────────────────────────────────────────────────────────────
-- VENTA 04 — hace 26 días | Cajero: Juan | CONTADO / TARJETA | Cliente: María González
-- Detergente 1u + Papel Higiénico 2u + Shampoo 1u
-- net=11460  tax=2177.40  total=13637.40  cost=9300
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.sales (
    id, type, status,
    total_amount, discount_amount, tax_amount, net_amount, total_cost,
    seller_id, customer_id, branch_id, created_at
) VALUES (
    'dddddd00-0000-0000-0000-000000000004',
    'CONTADO', 'CONFIRMED',
    13637.40, 0.00, 2177.40, 11460.00, 9300.00,
    'ababab01-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '26 days'
);
INSERT INTO public.sale_details (id, sale_id, product_id, quantity, unit_price, discount, subtotal, tax_rate, tax_amount)
VALUES
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000004', 'cdcdcd00-0000-0000-0000-000000000027', 1, 3490.00, 0, 3490.00, 0.19,  663.10),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000004', 'cdcdcd00-0000-0000-0000-000000000033', 2, 2190.00, 0, 4380.00, 0.19,  832.20),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000004', 'cdcdcd00-0000-0000-0000-000000000029', 1, 3590.00, 0, 3590.00, 0.19,  682.10);
INSERT INTO public.payments (id, sale_id, method, amount, change_amount)
VALUES (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000004', 'TARJETA', 13637.40, 0.00);

-- ────────────────────────────────────────────────────────────────────────────
-- VENTA 05 — hace 25 días | Cajero: Ana | CONTADO / EFECTIVO
-- Chocolate 1u + Papas Fritas 1u + Agua Cachantun 2u
-- net=2760  tax=524.40  total=3284.40  cost=2180
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.sales (
    id, type, status,
    total_amount, discount_amount, tax_amount, net_amount, total_cost,
    seller_id, customer_id, branch_id, created_at
) VALUES (
    'dddddd00-0000-0000-0000-000000000005',
    'CONTADO', 'CONFIRMED',
    3284.40, 0.00, 524.40, 2760.00, 2180.00,
    'ababab02-0000-0000-0000-000000000001',
    NULL,
    '00000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '25 days'
);
INSERT INTO public.sale_details (id, sale_id, product_id, quantity, unit_price, discount, subtotal, tax_rate, tax_amount)
VALUES
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000005', 'cdcdcd00-0000-0000-0000-000000000034', 1, 990.00, 0,  990.00, 0.19, 188.10),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000005', 'cdcdcd00-0000-0000-0000-000000000035', 1, 990.00, 0,  990.00, 0.19, 188.10),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000005', 'cdcdcd00-0000-0000-0000-000000000022', 2, 390.00, 0,  780.00, 0.19, 148.20);
INSERT INTO public.payments (id, sale_id, method, amount, change_amount)
VALUES (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000005', 'EFECTIVO', 3500.00, 215.60);

-- ────────────────────────────────────────────────────────────────────────────
-- VENTA 06 — hace 24 días | Cajero: Ana | CRÉDITO / CRÉDITO | Cliente: Carlos Rodríguez
-- Atún 2u + Fideos 1u + Leche 3u
-- net=5140  tax=300.20  total=5440.20  cost=4240
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.sales (
    id, type, status,
    total_amount, discount_amount, tax_amount, net_amount, total_cost,
    seller_id, customer_id, branch_id, created_at
) VALUES (
    'dddddd00-0000-0000-0000-000000000006',
    'CREDITO', 'CONFIRMED',
    5440.20, 0.00, 300.20, 5140.00, 4240.00,
    'ababab02-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '24 days'
);
INSERT INTO public.sale_details (id, sale_id, product_id, quantity, unit_price, discount, subtotal, tax_rate, tax_amount)
VALUES
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000006', 'cdcdcd00-0000-0000-0000-000000000010', 2, 790.00, 0, 1580.00, 0.19, 300.20),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000006', 'cdcdcd00-0000-0000-0000-000000000007', 1, 590.00, 0,  590.00, 0.00,   0.00),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000006', 'cdcdcd00-0000-0000-0000-000000000001', 3, 990.00, 0, 2970.00, 0.00,   0.00);
INSERT INTO public.payments (id, sale_id, method, amount, change_amount)
VALUES (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000006', 'CREDITO', 5440.20, 0.00);

-- ────────────────────────────────────────────────────────────────────────────
-- VENTA 07 — hace 22 días | Cajero: Ana | CONTADO / EFECTIVO
-- Café Nescafé 1u + Yogur 2u + Pan 1u
-- net=6760  tax=758.10  total=7518.10  cost=5480
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.sales (
    id, type, status,
    total_amount, discount_amount, tax_amount, net_amount, total_cost,
    seller_id, customer_id, branch_id, created_at
) VALUES (
    'dddddd00-0000-0000-0000-000000000007',
    'CONTADO', 'CONFIRMED',
    7518.10, 0.00, 758.10, 6760.00, 5480.00,
    'ababab02-0000-0000-0000-000000000001',
    NULL,
    '00000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '22 days'
);
INSERT INTO public.sale_details (id, sale_id, product_id, quantity, unit_price, discount, subtotal, tax_rate, tax_amount)
VALUES
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000007', 'cdcdcd00-0000-0000-0000-000000000036', 1, 3990.00, 0, 3990.00, 0.19, 758.10),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000007', 'cdcdcd00-0000-0000-0000-000000000003', 2,  790.00, 0, 1580.00, 0.00,   0.00),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000007', 'cdcdcd00-0000-0000-0000-000000000013', 1, 1190.00, 0, 1190.00, 0.00,   0.00);
INSERT INTO public.payments (id, sale_id, method, amount, change_amount)
VALUES (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000007', 'EFECTIVO', 8000.00, 481.90);

-- ────────────────────────────────────────────────────────────────────────────
-- VENTA 08 — hace 20 días | Cajero: Juan | CONTADO / TARJETA
-- Coca-Cola 4u + Cerveza Escudo 4u
-- net=7520  tax=1428.80  total=8948.80  cost=5920
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.sales (
    id, type, status,
    total_amount, discount_amount, tax_amount, net_amount, total_cost,
    seller_id, customer_id, branch_id, created_at
) VALUES (
    'dddddd00-0000-0000-0000-000000000008',
    'CONTADO', 'CONFIRMED',
    8948.80, 0.00, 1428.80, 7520.00, 5920.00,
    'ababab01-0000-0000-0000-000000000001',
    NULL,
    '00000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '20 days'
);
INSERT INTO public.sale_details (id, sale_id, product_id, quantity, unit_price, discount, subtotal, tax_rate, tax_amount)
VALUES
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000008', 'cdcdcd00-0000-0000-0000-000000000019', 4, 1090.00, 0, 4360.00, 0.19, 828.40),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000008', 'cdcdcd00-0000-0000-0000-000000000024', 4,  790.00, 0, 3160.00, 0.19, 600.40);
INSERT INTO public.payments (id, sale_id, method, amount, change_amount)
VALUES (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000008', 'TARJETA', 8948.80, 0.00);

-- ────────────────────────────────────────────────────────────────────────────
-- VENTA 09 — hace 18 días | Cajero: Juan | CONTADO / EFECTIVO (con descuento)
-- Detergente Omo 2u con descuento $200
-- net=6780  tax=1288.20  total=8068.20  discount=200  cost=5600
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.sales (
    id, type, status,
    total_amount, discount_amount, tax_amount, net_amount, total_cost,
    seller_id, customer_id, branch_id, created_at
) VALUES (
    'dddddd00-0000-0000-0000-000000000009',
    'CONTADO', 'CONFIRMED',
    8068.20, 200.00, 1288.20, 6780.00, 5600.00,
    'ababab01-0000-0000-0000-000000000001',
    NULL,
    '00000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '18 days'
);
INSERT INTO public.sale_details (id, sale_id, product_id, quantity, unit_price, discount, subtotal, tax_rate, tax_amount)
VALUES
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000009', 'cdcdcd00-0000-0000-0000-000000000027', 2, 3490.00, 200, 6780.00, 0.19, 1288.20);
INSERT INTO public.payments (id, sale_id, method, amount, change_amount)
VALUES (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000009', 'EFECTIVO', 8100.00, 31.80);

-- ────────────────────────────────────────────────────────────────────────────
-- VENTA 10 — hace 15 días | Cajero: Ana | MIXTO / EFECTIVO + TARJETA
-- Shampoo 1u + Papel Higiénico 2u + Café Nescafé 1u
-- net=11960  tax=2272.40  total=14232.40  cost=9700
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.sales (
    id, type, status,
    total_amount, discount_amount, tax_amount, net_amount, total_cost,
    seller_id, customer_id, branch_id, created_at
) VALUES (
    'dddddd00-0000-0000-0000-000000000010',
    'MIXTO', 'CONFIRMED',
    14232.40, 0.00, 2272.40, 11960.00, 9700.00,
    'ababab02-0000-0000-0000-000000000001',
    NULL,
    '00000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '15 days'
);
INSERT INTO public.sale_details (id, sale_id, product_id, quantity, unit_price, discount, subtotal, tax_rate, tax_amount)
VALUES
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000010', 'cdcdcd00-0000-0000-0000-000000000029', 1, 3590.00, 0, 3590.00, 0.19,  682.10),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000010', 'cdcdcd00-0000-0000-0000-000000000033', 2, 2190.00, 0, 4380.00, 0.19,  832.20),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000010', 'cdcdcd00-0000-0000-0000-000000000036', 1, 3990.00, 0, 3990.00, 0.19,  758.10);
INSERT INTO public.payments (id, sale_id, method, amount, change_amount)
VALUES
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000010', 'EFECTIVO',  5000.00, 0.00),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000010', 'TARJETA',   9232.40, 0.00);

-- ────────────────────────────────────────────────────────────────────────────
-- VENTA 11 — hace 14 días | Cajero: Ana | CONTADO / EFECTIVO
-- Leche 3u + Fideos 2u + Arroz 1u
-- net=5040  tax=0  total=5040  cost=4200
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.sales (
    id, type, status,
    total_amount, discount_amount, tax_amount, net_amount, total_cost,
    seller_id, customer_id, branch_id, created_at
) VALUES (
    'dddddd00-0000-0000-0000-000000000011',
    'CONTADO', 'CONFIRMED',
    5040.00, 0.00, 0.00, 5040.00, 4200.00,
    'ababab02-0000-0000-0000-000000000001',
    NULL,
    '00000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '14 days'
);
INSERT INTO public.sale_details (id, sale_id, product_id, quantity, unit_price, discount, subtotal, tax_rate, tax_amount)
VALUES
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000011', 'cdcdcd00-0000-0000-0000-000000000001', 3, 990.00, 0, 2970.00, 0.00, 0.00),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000011', 'cdcdcd00-0000-0000-0000-000000000007', 2, 590.00, 0, 1180.00, 0.00, 0.00),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000011', 'cdcdcd00-0000-0000-0000-000000000006', 1, 890.00, 0,  890.00, 0.00, 0.00);
INSERT INTO public.payments (id, sale_id, method, amount, change_amount)
VALUES (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000011', 'EFECTIVO', 5040.00, 0.00);

-- ────────────────────────────────────────────────────────────────────────────
-- VENTA 12 — hace 12 días | Cajero: Juan | CONTADO / TRANSFERENCIA | Cliente: María González
-- Detergente 1u + Shampoo 1u + Papel Higiénico 2u
-- net=11460  tax=2177.40  total=13637.40  cost=9300
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.sales (
    id, type, status,
    total_amount, discount_amount, tax_amount, net_amount, total_cost,
    seller_id, customer_id, branch_id, created_at
) VALUES (
    'dddddd00-0000-0000-0000-000000000012',
    'CONTADO', 'CONFIRMED',
    13637.40, 0.00, 2177.40, 11460.00, 9300.00,
    'ababab01-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '12 days'
);
INSERT INTO public.sale_details (id, sale_id, product_id, quantity, unit_price, discount, subtotal, tax_rate, tax_amount)
VALUES
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000012', 'cdcdcd00-0000-0000-0000-000000000027', 1, 3490.00, 0, 3490.00, 0.19,  663.10),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000012', 'cdcdcd00-0000-0000-0000-000000000029', 1, 3590.00, 0, 3590.00, 0.19,  682.10),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000012', 'cdcdcd00-0000-0000-0000-000000000033', 2, 2190.00, 0, 4380.00, 0.19,  832.20);
INSERT INTO public.payments (id, sale_id, method, amount, change_amount, reference)
VALUES (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000012', 'TRANSFERENCIA', 13637.40, 0.00, 'TRF-20260518-001');

-- ────────────────────────────────────────────────────────────────────────────
-- VENTA 13 — hace 10 días | Cajero: Ana | CONTADO / EFECTIVO
-- Chocolate 2u + Papas Fritas 3u + Agua 2u
-- net=5730  tax=1088.70  total=6818.70  cost=4560
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.sales (
    id, type, status,
    total_amount, discount_amount, tax_amount, net_amount, total_cost,
    seller_id, customer_id, branch_id, created_at
) VALUES (
    'dddddd00-0000-0000-0000-000000000013',
    'CONTADO', 'CONFIRMED',
    6818.70, 0.00, 1088.70, 5730.00, 4560.00,
    'ababab02-0000-0000-0000-000000000001',
    NULL,
    '00000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '10 days'
);
INSERT INTO public.sale_details (id, sale_id, product_id, quantity, unit_price, discount, subtotal, tax_rate, tax_amount)
VALUES
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000013', 'cdcdcd00-0000-0000-0000-000000000034', 2, 990.00, 0, 1980.00, 0.19, 376.20),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000013', 'cdcdcd00-0000-0000-0000-000000000035', 3, 990.00, 0, 2970.00, 0.19, 564.30),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000013', 'cdcdcd00-0000-0000-0000-000000000022', 2, 390.00, 0,  780.00, 0.19, 148.20);
INSERT INTO public.payments (id, sale_id, method, amount, change_amount)
VALUES (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000013', 'EFECTIVO', 7000.00, 181.30);

-- ────────────────────────────────────────────────────────────────────────────
-- VENTA 14 — hace 7 días | Cajero: Juan | CONTADO / TARJETA
-- Café Nescafé 1u + Atún 2u + Coca-Cola 3u
-- net=8840  tax=1679.60  total=10519.60  cost=7110
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.sales (
    id, type, status,
    total_amount, discount_amount, tax_amount, net_amount, total_cost,
    seller_id, customer_id, branch_id, created_at
) VALUES (
    'dddddd00-0000-0000-0000-000000000014',
    'CONTADO', 'CONFIRMED',
    10519.60, 0.00, 1679.60, 8840.00, 7110.00,
    'ababab01-0000-0000-0000-000000000001',
    NULL,
    '00000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '7 days'
);
INSERT INTO public.sale_details (id, sale_id, product_id, quantity, unit_price, discount, subtotal, tax_rate, tax_amount)
VALUES
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000014', 'cdcdcd00-0000-0000-0000-000000000036', 1, 3990.00, 0, 3990.00, 0.19, 758.10),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000014', 'cdcdcd00-0000-0000-0000-000000000010', 2,  790.00, 0, 1580.00, 0.19, 300.20),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000014', 'cdcdcd00-0000-0000-0000-000000000019', 3, 1090.00, 0, 3270.00, 0.19, 621.30);
INSERT INTO public.payments (id, sale_id, method, amount, change_amount)
VALUES (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000014', 'TARJETA', 10519.60, 0.00);

-- ────────────────────────────────────────────────────────────────────────────
-- VENTA 15 — hace 5 días | Cajero: Ana | CONTADO / EFECTIVO | Cliente: María González
-- Leche 5u + Arroz 3u + Pan 2u + Yogur 1u
-- net=10790  tax=0  total=10790  cost=9110
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.sales (
    id, type, status,
    total_amount, discount_amount, tax_amount, net_amount, total_cost,
    seller_id, customer_id, branch_id, created_at
) VALUES (
    'dddddd00-0000-0000-0000-000000000015',
    'CONTADO', 'CONFIRMED',
    10790.00, 0.00, 0.00, 10790.00, 9110.00,
    'ababab02-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '5 days'
);
INSERT INTO public.sale_details (id, sale_id, product_id, quantity, unit_price, discount, subtotal, tax_rate, tax_amount)
VALUES
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000015', 'cdcdcd00-0000-0000-0000-000000000001', 5, 990.00, 0, 4950.00, 0.00, 0.00),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000015', 'cdcdcd00-0000-0000-0000-000000000006', 3, 890.00, 0, 2670.00, 0.00, 0.00),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000015', 'cdcdcd00-0000-0000-0000-000000000013', 2, 1190.00, 0, 2380.00, 0.00, 0.00),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000015', 'cdcdcd00-0000-0000-0000-000000000003', 1,  790.00, 0,  790.00, 0.00, 0.00);
INSERT INTO public.payments (id, sale_id, method, amount, change_amount)
VALUES (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000015', 'EFECTIVO', 11000.00, 210.00);

-- ────────────────────────────────────────────────────────────────────────────
-- VENTA 16 — hace 3 días | Cajero: Juan | CONTADO / EFECTIVO
-- Cerveza Escudo 2u + Papas Fritas 1u + Chocolate 1u
-- net=3560  tax=676.40  total=4236.40  cost=2780
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.sales (
    id, type, status,
    total_amount, discount_amount, tax_amount, net_amount, total_cost,
    seller_id, customer_id, branch_id, created_at
) VALUES (
    'dddddd00-0000-0000-0000-000000000016',
    'CONTADO', 'CONFIRMED',
    4236.40, 0.00, 676.40, 3560.00, 2780.00,
    'ababab01-0000-0000-0000-000000000001',
    NULL,
    '00000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '3 days'
);
INSERT INTO public.sale_details (id, sale_id, product_id, quantity, unit_price, discount, subtotal, tax_rate, tax_amount)
VALUES
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000016', 'cdcdcd00-0000-0000-0000-000000000024', 2, 790.00, 0, 1580.00, 0.19, 300.20),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000016', 'cdcdcd00-0000-0000-0000-000000000035', 1, 990.00, 0,  990.00, 0.19, 188.10),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000016', 'cdcdcd00-0000-0000-0000-000000000034', 1, 990.00, 0,  990.00, 0.19, 188.10);
INSERT INTO public.payments (id, sale_id, method, amount, change_amount)
VALUES (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000016', 'EFECTIVO', 4500.00, 263.60);

-- ────────────────────────────────────────────────────────────────────────────
-- VENTA 17 — hace 2 días | Cajero: Ana | CONTADO / TARJETA
-- Detergente 1u + Agua 2u + Fideos 1u
-- net=4860  tax=811.30  total=5671.30  cost=3830
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.sales (
    id, type, status,
    total_amount, discount_amount, tax_amount, net_amount, total_cost,
    seller_id, customer_id, branch_id, created_at
) VALUES (
    'dddddd00-0000-0000-0000-000000000017',
    'CONTADO', 'CONFIRMED',
    5671.30, 0.00, 811.30, 4860.00, 3830.00,
    'ababab02-0000-0000-0000-000000000001',
    NULL,
    '00000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '2 days'
);
INSERT INTO public.sale_details (id, sale_id, product_id, quantity, unit_price, discount, subtotal, tax_rate, tax_amount)
VALUES
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000017', 'cdcdcd00-0000-0000-0000-000000000027', 1, 3490.00, 0, 3490.00, 0.19, 663.10),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000017', 'cdcdcd00-0000-0000-0000-000000000022', 2,  390.00, 0,  780.00, 0.19, 148.20),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000017', 'cdcdcd00-0000-0000-0000-000000000007', 1,  590.00, 0,  590.00, 0.00,   0.00);
INSERT INTO public.payments (id, sale_id, method, amount, change_amount)
VALUES (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000017', 'TARJETA', 5671.30, 0.00);

-- ────────────────────────────────────────────────────────────────────────────
-- VENTA 18 — hace 1 día | Cajero: Juan | CONTADO / EFECTIVO
-- Coca-Cola 1u + Cerveza Escudo 1u + Papas Fritas 2u
-- net=3860  tax=733.40  total=4593.40  cost=3040
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.sales (
    id, type, status,
    total_amount, discount_amount, tax_amount, net_amount, total_cost,
    seller_id, customer_id, branch_id, created_at
) VALUES (
    'dddddd00-0000-0000-0000-000000000018',
    'CONTADO', 'CONFIRMED',
    4593.40, 0.00, 733.40, 3860.00, 3040.00,
    'ababab01-0000-0000-0000-000000000001',
    NULL,
    '00000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '1 day'
);
INSERT INTO public.sale_details (id, sale_id, product_id, quantity, unit_price, discount, subtotal, tax_rate, tax_amount)
VALUES
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000018', 'cdcdcd00-0000-0000-0000-000000000019', 1, 1090.00, 0, 1090.00, 0.19, 207.10),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000018', 'cdcdcd00-0000-0000-0000-000000000024', 1,  790.00, 0,  790.00, 0.19, 150.10),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000018', 'cdcdcd00-0000-0000-0000-000000000035', 2,  990.00, 0, 1980.00, 0.19, 376.20);
INSERT INTO public.payments (id, sale_id, method, amount, change_amount)
VALUES (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000018', 'EFECTIVO', 5000.00, 406.60);

-- ────────────────────────────────────────────────────────────────────────────
-- VENTA 19 — hoy, turno mañana | Cajero: Ana | CONTADO / EFECTIVO
-- Leche 3u + Pan 1u + Agua 2u
-- net=4940  tax=148.20  total=5088.20  cost=4110
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.sales (
    id, type, status,
    total_amount, discount_amount, tax_amount, net_amount, total_cost,
    seller_id, customer_id, branch_id, created_at
) VALUES (
    'dddddd00-0000-0000-0000-000000000019',
    'CONTADO', 'CONFIRMED',
    5088.20, 0.00, 148.20, 4940.00, 4110.00,
    'ababab02-0000-0000-0000-000000000001',
    NULL,
    '00000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '3 hours'
);
INSERT INTO public.sale_details (id, sale_id, product_id, quantity, unit_price, discount, subtotal, tax_rate, tax_amount)
VALUES
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000019', 'cdcdcd00-0000-0000-0000-000000000001', 3, 990.00, 0, 2970.00, 0.00,   0.00),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000019', 'cdcdcd00-0000-0000-0000-000000000013', 1, 1190.00, 0, 1190.00, 0.00,   0.00),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000019', 'cdcdcd00-0000-0000-0000-000000000022', 2,  390.00, 0,  780.00, 0.19, 148.20);
INSERT INTO public.payments (id, sale_id, method, amount, change_amount)
VALUES (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000019', 'EFECTIVO', 5100.00, 11.80);

-- ────────────────────────────────────────────────────────────────────────────
-- VENTA 20 — hoy, turno tarde | Cajero: Juan | CONTADO / TARJETA
-- Café Nescafé 1u + Shampoo H&S 1u
-- net=7580  tax=1440.20  total=9020.20  cost=6100
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.sales (
    id, type, status,
    total_amount, discount_amount, tax_amount, net_amount, total_cost,
    seller_id, customer_id, branch_id, created_at
) VALUES (
    'dddddd00-0000-0000-0000-000000000020',
    'CONTADO', 'CONFIRMED',
    9020.20, 0.00, 1440.20, 7580.00, 6100.00,
    'ababab01-0000-0000-0000-000000000001',
    NULL,
    '00000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '1 hour'
);
INSERT INTO public.sale_details (id, sale_id, product_id, quantity, unit_price, discount, subtotal, tax_rate, tax_amount)
VALUES
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000020', 'cdcdcd00-0000-0000-0000-000000000036', 1, 3990.00, 0, 3990.00, 0.19, 758.10),
    (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000020', 'cdcdcd00-0000-0000-0000-000000000029', 1, 3590.00, 0, 3590.00, 0.19, 682.10);
INSERT INTO public.payments (id, sale_id, method, amount, change_amount)
VALUES (gen_random_uuid(), 'dddddd00-0000-0000-0000-000000000020', 'TARJETA', 9020.20, 0.00);

-- ============================================================
-- 6. ACTUALIZACIÓN DE CRÉDITO UTILIZADO
--    Venta 06 (CRÉDITO) cargó $5.440,20 a Carlos Rodríguez
-- ============================================================
UPDATE public.customers
   SET credit_used = 5440.20,
       updated_at  = NOW()
 WHERE id = 'f1000000-0000-0000-0000-000000000002'
   AND credit_limit >= 5440.20;

-- ============================================================
-- RESUMEN
-- ============================================================
-- Sucursales:  2  (Principal + Centro)
-- Usuarios:    5  (2 cajeros Principal + 1 supervisor + 1 bodega + 1 cajero Centro)
-- Productos:  36  (Sucursal Principal, stock ajustado al estado post-ventas)
-- Clientes:    5  (2 existentes V11 + 3 nuevos)
-- Ventas:     20  (últimos 28 días, status CONFIRMED)
-- Detalles:   ~45 líneas
-- Pagos:      ~21 (incl. 2 pagos en venta MIXTO)
-- Crédito:     Carlos Rodríguez → credit_used = $5.440,20
-- ============================================================

COMMIT;

-- =============================================================================
-- V30__elaboracion_propia.sql
--
-- Agrega la familia "Elaboración Propia", sus categorías y productos iniciales
-- para tortas, pasteles, empanadas y otros elaborados en el local.
--
-- Familia  ELA  : d0000000-0000-0000-0000-000000000007
-- Categorías     : e0000000-0000-0000-0000-00000000005X
-- Impuesto EXENTO: b0000000-0000-0000-0000-000000000002
-- Unidad UN      : c0000000-0000-0000-0000-000000000001
-- Unidad KG      : c0000000-0000-0000-0000-000000000002
-- Sucursal       : 00000000-0000-0000-0000-000000000001
-- =============================================================================

BEGIN;

-- ── 1. Familia ────────────────────────────────────────────────────────────────
INSERT INTO public.product_families (id, code, name, description, is_active)
VALUES (
    'd0000000-0000-0000-0000-000000000007',
    'ELA',
    'Elaboración Propia',
    'Productos elaborados en el local: tortas, pasteles, empanadas y otros.',
    TRUE
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Categorías ─────────────────────────────────────────────────────────────
INSERT INTO public.product_categories (id, family_id, code, name, description, is_active)
VALUES
(
    'e0000000-0000-0000-0000-000000000051',
    'd0000000-0000-0000-0000-000000000007',
    'TOR', 'Tortas y Pasteles',
    'Tortas enteras, porciones y pasteles elaborados en el local.',
    TRUE
),
(
    'e0000000-0000-0000-0000-000000000052',
    'd0000000-0000-0000-0000-000000000007',
    'EMP', 'Empanadas y Salados',
    'Empanadas horneadas o fritas y otros preparados salados.',
    TRUE
),
(
    'e0000000-0000-0000-0000-000000000053',
    'd0000000-0000-0000-0000-000000000007',
    'DUL', 'Dulces y Galletas',
    'Alfajores, galletas, queques y otros dulces caseros.',
    TRUE
)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Productos ──────────────────────────────────────────────────────────────
-- Todos exentos de IVA (alimentos de elaboración propia en minimarket).
-- Los precios son de referencia; ajustar en el módulo de Productos.
-- track_stock = FALSE → se venden sin descontar stock automático
--   (el comerciante controla la producción manualmente).

INSERT INTO public.products (
    id, barcode, name, description,
    purchase_price, sale_price,
    stock_current, stock_minimum, stock_maximum,
    is_active, track_stock,
    category_id, tax_id, unit_id, branch_id
) VALUES

-- TORTAS Y PASTELES ──────────────────────────────────────────────────────────
(
    'ba300000-0000-0000-0000-000000000001',
    'ELA-TOR-CHOC', 'Torta de Chocolate',
    'Torta entera de chocolate elaborada en el local.',
    4500.0000, 9000.0000,
    0, 0, NULL,
    TRUE, FALSE,
    'e0000000-0000-0000-0000-000000000051',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'ba300000-0000-0000-0000-000000000002',
    'ELA-TOR-MAN', 'Torta de Manjar',
    'Torta entera de manjar elaborada en el local.',
    4500.0000, 9000.0000,
    0, 0, NULL,
    TRUE, FALSE,
    'e0000000-0000-0000-0000-000000000051',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'ba300000-0000-0000-0000-000000000003',
    'ELA-TOR-FRES', 'Torta de Frutilla',
    'Torta entera de frutilla con crema elaborada en el local.',
    5000.0000, 10000.0000,
    0, 0, NULL,
    TRUE, FALSE,
    'e0000000-0000-0000-0000-000000000051',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'ba300000-0000-0000-0000-000000000004',
    'ELA-POR-TORTA', 'Porción de Torta',
    'Porción individual de torta (sabor según disponibilidad).',
    700.0000, 1500.0000,
    0, 0, NULL,
    TRUE, FALSE,
    'e0000000-0000-0000-0000-000000000051',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'ba300000-0000-0000-0000-000000000005',
    'ELA-KUC-MAN', 'Kuchen de Manjar',
    'Kuchen casero de manjar.',
    2500.0000, 5000.0000,
    0, 0, NULL,
    TRUE, FALSE,
    'e0000000-0000-0000-0000-000000000051',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'ba300000-0000-0000-0000-000000000006',
    'ELA-KUC-FRU', 'Kuchen de Fruta',
    'Kuchen casero de fruta de temporada.',
    2500.0000, 5000.0000,
    0, 0, NULL,
    TRUE, FALSE,
    'e0000000-0000-0000-0000-000000000051',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),

-- EMPANADAS Y SALADOS ────────────────────────────────────────────────────────
(
    'ba300000-0000-0000-0000-000000000011',
    'ELA-EMP-PINO', 'Empanada de Pino',
    'Empanada horneada de carne con pino tradicional.',
    500.0000, 1200.0000,
    0, 0, NULL,
    TRUE, FALSE,
    'e0000000-0000-0000-0000-000000000052',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'ba300000-0000-0000-0000-000000000012',
    'ELA-EMP-QUE', 'Empanada de Queso',
    'Empanada horneada de queso.',
    450.0000, 1000.0000,
    0, 0, NULL,
    TRUE, FALSE,
    'e0000000-0000-0000-0000-000000000052',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'ba300000-0000-0000-0000-000000000013',
    'ELA-SOP', 'Sopaipilla',
    'Sopaipilla frita casera.',
    50.0000, 200.0000,
    0, 0, NULL,
    TRUE, FALSE,
    'e0000000-0000-0000-0000-000000000052',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),

-- DULCES Y GALLETAS ──────────────────────────────────────────────────────────
(
    'ba300000-0000-0000-0000-000000000021',
    'ELA-ALF', 'Alfajor',
    'Alfajor casero de maicena con manjar.',
    150.0000, 400.0000,
    0, 0, NULL,
    TRUE, FALSE,
    'e0000000-0000-0000-0000-000000000053',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'ba300000-0000-0000-0000-000000000022',
    'ELA-QUE', 'Queque',
    'Queque esponjoso casero (sabor según disponibilidad).',
    1500.0000, 3500.0000,
    0, 0, NULL,
    TRUE, FALSE,
    'e0000000-0000-0000-0000-000000000053',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
),
(
    'ba300000-0000-0000-0000-000000000023',
    'ELA-GAL-MAN', 'Galletas de Mantequilla',
    'Galletas caseras de mantequilla.',
    100.0000, 300.0000,
    0, 0, NULL,
    TRUE, FALSE,
    'e0000000-0000-0000-0000-000000000053',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (barcode) DO NOTHING;

COMMIT;

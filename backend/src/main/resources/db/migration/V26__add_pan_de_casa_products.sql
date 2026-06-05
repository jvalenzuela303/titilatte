-- =============================================================================
-- V26__add_pan_de_casa_products.sql
-- Agrega categoría "Pan de Casa" y productos marraqueta y hallulla
--
-- Categoría: e0000000-0000-0000-0000-00000000002a
-- Marraqueta: cdcdcd00-0000-0000-0000-000000000024
-- Hallulla:   cdcdcd00-0000-0000-0000-000000000025
-- =============================================================================

BEGIN;

-- ── Categoría Pan de Casa (familia Alimentos) ──────────────────────────────
INSERT INTO public.product_categories (id, family_id, code, name, description, is_active)
VALUES (
    'e0000000-0000-0000-0000-00000000002a',
    'd0000000-0000-0000-0000-000000000001',  -- ALI (Alimentos)
    'PCZ',
    'Pan de Casa',
    'Pan artesanal elaborado en el local: marraqueta, hallulla y similares.',
    TRUE
)
ON CONFLICT (id) DO NOTHING;

-- ── Productos ──────────────────────────────────────────────────────────────
INSERT INTO public.products (
    id, barcode, name,
    purchase_price, sale_price,
    stock_current, stock_minimum, stock_maximum,
    is_active, category_id, tax_id, unit_id, branch_id
) VALUES
(
    'cdcdcd00-0000-0000-0000-000000000024',
    'PCZ-MARR-001', 'Marraqueta',
    60.00, 100.00,
    0, 10, 500,
    TRUE,
    'e0000000-0000-0000-0000-00000000002a',  -- Pan de Casa
    'b0000000-0000-0000-0000-000000000002',  -- EXENTO
    'c0000000-0000-0000-0000-000000000001',  -- UN
    '00000000-0000-0000-0000-000000000001'   -- Sucursal Principal
),
(
    'cdcdcd00-0000-0000-0000-000000000025',
    'PCZ-HALL-001', 'Hallulla',
    60.00, 100.00,
    0, 10, 500,
    TRUE,
    'e0000000-0000-0000-0000-00000000002a',  -- Pan de Casa
    'b0000000-0000-0000-0000-000000000002',  -- EXENTO
    'c0000000-0000-0000-0000-000000000001',  -- UN
    '00000000-0000-0000-0000-000000000001'   -- Sucursal Principal
)
ON CONFLICT (id) DO NOTHING;

COMMIT;

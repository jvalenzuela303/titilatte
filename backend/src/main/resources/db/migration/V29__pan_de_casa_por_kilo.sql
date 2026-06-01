-- =============================================================================
-- V29__pan_de_casa_por_kilo.sql
--
-- Convierte la venta de pan de casa a precio por kilogramo.
--
-- Cambios:
--   1. Desactiva Marraqueta y Hallulla (vendidos por unidad).
--   2. Crea el producto "Pan de Casa" con unidad KG.
--      El cajero ingresa el peso en el POS y el precio se calcula por kg.
--
-- Unidad KG : c0000000-0000-0000-0000-000000000002
-- Categoría  : e0000000-0000-0000-0000-00000000002a  (Pan de Casa)
-- Impuesto   : b0000000-0000-0000-0000-000000000002  (EXENTO)
-- Sucursal   : 00000000-0000-0000-0000-000000000001  (Principal)
-- =============================================================================

BEGIN;

-- 1. Desactivar productos por unidad ─────────────────────────────────────────
UPDATE public.products
SET is_active = FALSE
WHERE barcode IN ('PCZ-MARR-001', 'PCZ-HALL-001');

-- 2. Crear producto "Pan de Casa" por kilogramo ───────────────────────────────
INSERT INTO public.products (
    id, barcode, name, description,
    purchase_price, sale_price,
    stock_current, stock_minimum, stock_maximum,
    is_active, track_stock,
    category_id, tax_id, unit_id, branch_id
) VALUES (
    'ba290000-0000-0000-0000-000000000001',
    'PCZ-PAN-KG',
    'Pan de Casa',
    'Hallulla y/o Marraqueta. Se cobra por kilo — mezcla libre.',
    700.0000,
    1200.0000,
    20.0000,   -- stock inicial: 20 kg
    1.0000,    -- mínimo: 1 kg
    200.0000,  -- máximo: 200 kg
    TRUE, TRUE,
    'e0000000-0000-0000-0000-00000000002a',
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (barcode) DO NOTHING;

COMMIT;

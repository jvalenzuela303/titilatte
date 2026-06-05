-- =============================================================================
-- V28: Inserta marraqueta y hallulla con UUIDs que no colisionan
--
-- V26 usó IDs que ya existían en el seed (cervezas), quedando ignorados por
-- ON CONFLICT. Esta migración usa UUIDs nuevos y marca track_stock = FALSE.
-- =============================================================================

BEGIN;

INSERT INTO public.products (
    id, barcode, name,
    purchase_price, sale_price,
    stock_current, stock_minimum, stock_maximum,
    is_active, track_stock, category_id, tax_id, unit_id, branch_id
) VALUES
(
    'ba110000-0000-0000-0000-000000000001',
    'PCZ-MARR-001', 'Marraqueta',
    60.00, 100.00,
    0, 10, 500,
    TRUE, FALSE,
    'e0000000-0000-0000-0000-00000000002a',  -- Pan de Casa
    'b0000000-0000-0000-0000-000000000002',  -- EXENTO
    'c0000000-0000-0000-0000-000000000001',  -- UN
    '00000000-0000-0000-0000-000000000001'   -- Sucursal Principal
),
(
    'ba110000-0000-0000-0000-000000000002',
    'PCZ-HALL-001', 'Hallulla',
    60.00, 100.00,
    0, 10, 500,
    TRUE, FALSE,
    'e0000000-0000-0000-0000-00000000002a',  -- Pan de Casa
    'b0000000-0000-0000-0000-000000000002',  -- EXENTO
    'c0000000-0000-0000-0000-000000000001',  -- UN
    '00000000-0000-0000-0000-000000000001'   -- Sucursal Principal
)
ON CONFLICT (barcode) DO NOTHING;

COMMIT;

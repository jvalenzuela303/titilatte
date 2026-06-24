-- =============================================================================
-- V33__pan_de_casa_precio_libre.sql
--
-- Habilita "precio libre" para Pan de Casa:
--   - El cajero ingresa el monto total a cobrar (no el peso).
--   - Se agrega la columna allow_custom_price a la tabla products.
--   - Pan de Casa cambia de unidad KG → UN (ya no se pesa en caja).
--   - Se relaja la constraint de margen para productos con precio libre.
-- =============================================================================

BEGIN;

-- 1. Agregar columna allow_custom_price ───────────────────────────────────────
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS allow_custom_price BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Relajar constraint de margen de precio ──────────────────────────────────
--    Productos con allow_custom_price=TRUE tienen sale_price=0 (placeholder);
--    el precio real lo ingresa el vendedor en cada transacción.
ALTER TABLE public.products
    DROP CONSTRAINT IF EXISTS chk_products_price_margin;

ALTER TABLE public.products
    ADD CONSTRAINT chk_products_price_margin
        CHECK (allow_custom_price = TRUE OR sale_price >= purchase_price);

-- 3. Identificar al usuario sistema para el trigger de auditoría de precios ──
--    El trigger fn_audit_product_price lee esta variable de sesión.
--    Se usa el usuario "system" (a0000000-0000-0000-0000-000000000000).
SET LOCAL app.current_user_id = 'a0000000-0000-0000-0000-000000000000';

-- 4. Actualizar Pan de Casa ────────────────────────────────────────────────────
--    - allow_custom_price = TRUE  → el POS pedirá monto en lugar de peso
--    - unit_id = UN              → ya no se vende por kilo
--    - sale_price = 0             → el precio real lo ingresa el vendedor
UPDATE public.products
SET
    allow_custom_price = TRUE,
    unit_id            = 'c0000000-0000-0000-0000-000000000001',  -- UN
    sale_price         = 0.0000,
    description        = 'Hallulla y/o Marraqueta. El vendedor ingresa el monto a cobrar.'
WHERE barcode = 'PCZ-PAN-KG';

COMMIT;

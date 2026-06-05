-- =============================================================================
-- V32__desactivar_alcohol_y_fix_ela_track_stock.sql
--
-- 1. Desactiva todos los productos de alcohol (cervezas, vinos, licores).
--    El local no vende alcohol, por lo que estos productos no deben estar
--    disponibles en el catálogo ni en el POS.
--
-- 2. Garantiza que todos los productos de elaboración propia (barcode ELA-*)
--    tengan track_stock = FALSE, por coherencia con la política del local.
--
-- Categorías de alcohol:
--   CER_BEB  e0000000-0000-0000-0000-000000000013  Cervezas
--   VIN      e0000000-0000-0000-0000-000000000014  Vinos y Licores
-- =============================================================================

BEGIN;

-- ── 1. Desactivar productos de alcohol ────────────────────────────────────────
UPDATE public.products
   SET is_active   = FALSE,
       updated_at  = NOW()
 WHERE category_id IN (
     'e0000000-0000-0000-0000-000000000013',  -- Cervezas
     'e0000000-0000-0000-0000-000000000014'   -- Vinos y Licores
 )
   AND is_active = TRUE;

-- ── 2. Desactivar también las categorías de alcohol ───────────────────────────
UPDATE public.product_categories
   SET is_active  = FALSE
 WHERE id IN (
     'e0000000-0000-0000-0000-000000000013',
     'e0000000-0000-0000-0000-000000000014'
 );

-- ── 3. Salvaguarda: todos los productos ELA-* sin control de stock ─────────────
UPDATE public.products
   SET track_stock = FALSE,
       updated_at  = NOW()
 WHERE barcode LIKE 'ELA-%'
   AND track_stock = TRUE;

COMMIT;

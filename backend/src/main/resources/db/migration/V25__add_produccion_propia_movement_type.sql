-- =============================================================================
-- V25__add_produccion_propia_movement_type.sql
-- Agrega el tipo PRODUCCION_PROPIA al enum stock_movement_type.
--
-- ADD VALUE no puede usarse en la misma transacción que DDL que lo referencie.
-- Se usan dos bloques BEGIN/COMMIT separados igual que V24.
-- =============================================================================

BEGIN;
ALTER TYPE public.stock_movement_type ADD VALUE IF NOT EXISTS 'PRODUCCION_PROPIA';
COMMIT;

BEGIN;

ALTER TABLE public.stock_movements
    DROP CONSTRAINT IF EXISTS chk_stock_movements_authorization_required;

ALTER TABLE public.stock_movements
    ADD CONSTRAINT chk_stock_movements_authorization_required
        CHECK (
            movement_type NOT IN ('AJUSTE', 'MERMA', 'PRODUCCION_PROPIA') OR
            authorized_by IS NOT NULL
        );

COMMIT;

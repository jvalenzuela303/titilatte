-- V34__purchase_payments.sql
-- Agrega soporte de abonos/pagos a compras de proveedores

-- 1. Nuevos campos de pago en la tabla purchases
ALTER TABLE purchases
    ADD COLUMN IF NOT EXISTS amount_paid    NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20)    NOT NULL DEFAULT 'UNPAID';

-- 2. Tabla de pagos individuales a proveedores por compra
CREATE TABLE IF NOT EXISTS purchase_payments (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id    UUID          NOT NULL REFERENCES purchases(id),
    amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(20)   NOT NULL,
    notes          TEXT,
    paid_by        UUID          NOT NULL REFERENCES users(id),
    paid_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_payments_purchase ON purchase_payments(purchase_id);

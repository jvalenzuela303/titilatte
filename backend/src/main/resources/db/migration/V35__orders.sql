-- V35__orders.sql
-- Pedidos especiales: encargos personalizados con sistema de abonos parciales

CREATE TABLE IF NOT EXISTS orders (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number   BIGINT        GENERATED ALWAYS AS IDENTITY,
    customer_id    UUID          REFERENCES customers(id) ON DELETE SET NULL,
    customer_name  VARCHAR(200)  NOT NULL,
    customer_phone VARCHAR(50),
    description    TEXT          NOT NULL,
    total_amount   NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
    amount_paid    NUMERIC(12,2) NOT NULL DEFAULT 0,
    status         VARCHAR(30)   NOT NULL DEFAULT 'PENDING',
    -- Valid values: PENDING, IN_PROGRESS, READY, DELIVERED, CANCELLED
    payment_status VARCHAR(20)   NOT NULL DEFAULT 'UNPAID',
    -- Valid values: UNPAID, PARTIAL, PAID
    delivery_date  DATE          NOT NULL,
    notes          TEXT,
    created_by     UUID          NOT NULL REFERENCES users(id),
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_status        ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id   ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON orders(delivery_date);

-- Abonos a pedidos especiales
CREATE TABLE IF NOT EXISTS order_payments (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id       UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(20)   NOT NULL,
    notes          TEXT,
    paid_by        UUID          NOT NULL REFERENCES users(id),
    paid_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_payments_order ON order_payments(order_id);

-- V36__order_items.sql
-- Reemplaza campo descripción por lista de ítems en pedidos especiales

-- La descripción ya no es obligatoria (se migra a order_items)
ALTER TABLE orders ALTER COLUMN description DROP NOT NULL;

-- Tabla de ítems por pedido (producto, cantidad, costo unitario)
CREATE TABLE order_items (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id     UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_name VARCHAR(200)  NOT NULL,
    quantity     NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    unit_cost    NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

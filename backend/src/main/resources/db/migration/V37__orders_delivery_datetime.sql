-- V37__orders_delivery_datetime.sql
-- Cambia delivery_date de DATE a TIMESTAMPTZ para soporte de hora en entrega
-- Agrega columna reminder_sent para rastrear notificaciones enviadas

ALTER TABLE orders
    ALTER COLUMN delivery_date TYPE TIMESTAMPTZ USING delivery_date::TIMESTAMPTZ;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;

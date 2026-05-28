-- =============================================================================
-- V16: Multi-sucursal — tabla branches + branch_id en tablas transaccionales
-- Migra todos los datos existentes a "Sucursal Principal" (UUID fijo).
-- REQUIERE VENTANA DE MANTENIMIENTO — no ejecutar en caliente.
-- =============================================================================

-- 1. Tabla de sucursales
CREATE TABLE branches (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100) NOT NULL,
    address    VARCHAR(200),
    phone      VARCHAR(20),
    rut        VARCHAR(12),        -- RUT contribuyente (ej: 76543210-9)
    is_active  BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Insertar sucursal principal (UUID fijo para referencias deterministas)
INSERT INTO branches (id, name, address, rut, is_active)
VALUES ('00000000-0000-0000-0000-000000000001',
        'Sucursal Principal', 'Dirección Principal', NULL, true);

-- 3. branch_id en users
--    ADMIN global → branch_id = NULL (acceso cross-sucursal)
--    Resto de roles → sucursal principal
ALTER TABLE users ADD COLUMN branch_id UUID REFERENCES branches(id);

UPDATE users
   SET branch_id = '00000000-0000-0000-0000-000000000001'
 WHERE branch_id IS NULL
   AND id NOT IN (
       SELECT ur.user_id
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
        WHERE r.name = 'ADMIN'
   );

-- 4. branch_id en tablas transaccionales
--    Se agrega con DEFAULT para que los registros existentes queden asignados;
--    el DEFAULT se elimina al final para que filas nuevas lo exijan explícitamente.

ALTER TABLE products
    ADD COLUMN branch_id UUID NOT NULL
        DEFAULT '00000000-0000-0000-0000-000000000001'
        REFERENCES branches(id);

ALTER TABLE sales
    ADD COLUMN branch_id UUID NOT NULL
        DEFAULT '00000000-0000-0000-0000-000000000001'
        REFERENCES branches(id);

ALTER TABLE stock_movements
    ADD COLUMN branch_id UUID NOT NULL
        DEFAULT '00000000-0000-0000-0000-000000000001'
        REFERENCES branches(id);

ALTER TABLE cash_registers
    ADD COLUMN branch_id UUID NOT NULL
        DEFAULT '00000000-0000-0000-0000-000000000001'
        REFERENCES branches(id);

ALTER TABLE purchases
    ADD COLUMN branch_id UUID NOT NULL
        DEFAULT '00000000-0000-0000-0000-000000000001'
        REFERENCES branches(id);

ALTER TABLE customers
    ADD COLUMN branch_id UUID NOT NULL
        DEFAULT '00000000-0000-0000-0000-000000000001'
        REFERENCES branches(id);

-- audit_log: nullable — eventos de sistema no pertenecen a ninguna sucursal
ALTER TABLE audit_log
    ADD COLUMN branch_id UUID REFERENCES branches(id);

-- 5. Quitar DEFAULT para que inserciones futuras requieran branch_id explícito
ALTER TABLE products        ALTER COLUMN branch_id DROP DEFAULT;
ALTER TABLE sales           ALTER COLUMN branch_id DROP DEFAULT;
ALTER TABLE stock_movements ALTER COLUMN branch_id DROP DEFAULT;
ALTER TABLE cash_registers  ALTER COLUMN branch_id DROP DEFAULT;
ALTER TABLE purchases       ALTER COLUMN branch_id DROP DEFAULT;
ALTER TABLE customers       ALTER COLUMN branch_id DROP DEFAULT;

-- 6. Reescribir trigger de stock con validación multi-sucursal
CREATE OR REPLACE FUNCTION fn_confirm_sale_stock()
RETURNS TRIGGER AS $$
DECLARE
    v_detail RECORD;
    v_stock  INTEGER;
BEGIN
    IF NEW.status = 'CONFIRMED' AND OLD.status = 'PENDING' THEN
        FOR v_detail IN
            SELECT sd.product_id, sd.quantity
              FROM sale_details sd
             WHERE sd.sale_id = NEW.id
        LOOP
            -- Bloquea el producto de la misma sucursal que la venta
            SELECT stock_current INTO v_stock
              FROM products
             WHERE id = v_detail.product_id
               AND branch_id = NEW.branch_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Producto % no pertenece a la sucursal %',
                    v_detail.product_id, NEW.branch_id;
            END IF;

            IF v_stock < v_detail.quantity THEN
                RAISE EXCEPTION 'Stock insuficiente para producto %', v_detail.product_id;
            END IF;

            UPDATE products
               SET stock_current = stock_current - v_detail.quantity,
                   updated_at    = now()
             WHERE id = v_detail.product_id
               AND branch_id = NEW.branch_id;

            INSERT INTO stock_movements
                   (product_id, branch_id, movement_type, quantity, reference_id, reference_type, notes)
            VALUES (v_detail.product_id, NEW.branch_id,
                    'SALE_OUT', -v_detail.quantity, NEW.id, 'SALE',
                    'Venta confirmada sucursal ' || NEW.branch_id::text);
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Permisos multi-sucursal
INSERT INTO permissions (code, description, module) VALUES
    ('BRANCH_READ',   'Ver listado de sucursales',                    'BRANCH'),
    ('BRANCH_WRITE',  'Crear y modificar sucursales',                 'BRANCH'),
    ('BRANCH_SWITCH', 'Cambiar sucursal activa (solo ADMIN global)',  'BRANCH')
ON CONFLICT (code) DO NOTHING;

-- ADMIN obtiene todos los permisos de sucursal
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r CROSS JOIN permissions p
 WHERE r.name = 'ADMIN'
   AND p.code IN ('BRANCH_READ', 'BRANCH_WRITE', 'BRANCH_SWITCH')
ON CONFLICT DO NOTHING;

-- SUPERVISOR puede ver sucursales
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r CROSS JOIN permissions p
 WHERE r.name = 'SUPERVISOR'
   AND p.code = 'BRANCH_READ'
ON CONFLICT DO NOTHING;

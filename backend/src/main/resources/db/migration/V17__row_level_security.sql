-- =============================================================================
-- V17: Row-Level Security (RLS) — aislamiento de datos por sucursal
-- El backend setea: SET LOCAL app.current_branch_id = '<uuid>' | 'ALL'
-- Valor 'ALL' → visible para todos (ADMIN global).
-- Función auxiliar con SECURITY DEFINER para acceder al setting de sesión.
-- =============================================================================

-- Función auxiliar: devuelve el branch_id de la sesión actual
-- Si el setting no existe o está vacío, devuelve '' → RLS bloquea todo (fail-safe)
CREATE OR REPLACE FUNCTION current_branch_id() RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(current_setting('app.current_branch_id', true), '');
EXCEPTION WHEN OTHERS THEN
    RETURN '';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Activar RLS en todas las tablas transaccionales
ALTER TABLE products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_details      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases         ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_details  ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log         ENABLE ROW LEVEL SECURITY;

-- Policies de aislamiento por sucursal -----------------------------------

-- products
CREATE POLICY branch_isolation ON products
    USING (branch_id::text = current_branch_id()
        OR current_branch_id() = 'ALL');

-- sales
CREATE POLICY branch_isolation ON sales
    USING (branch_id::text = current_branch_id()
        OR current_branch_id() = 'ALL');

-- sale_details: sin branch_id propio — hereda visibilidad de la venta padre
CREATE POLICY branch_isolation ON sale_details
    USING (EXISTS (
        SELECT 1 FROM sales s
         WHERE s.id = sale_details.sale_id
           AND (s.branch_id::text = current_branch_id()
                OR current_branch_id() = 'ALL')
    ));

-- stock_movements
CREATE POLICY branch_isolation ON stock_movements
    USING (branch_id::text = current_branch_id()
        OR current_branch_id() = 'ALL');

-- cash_registers
CREATE POLICY branch_isolation ON cash_registers
    USING (branch_id::text = current_branch_id()
        OR current_branch_id() = 'ALL');

-- purchases
CREATE POLICY branch_isolation ON purchases
    USING (branch_id::text = current_branch_id()
        OR current_branch_id() = 'ALL');

-- purchase_details: hereda visibilidad de la compra padre
CREATE POLICY branch_isolation ON purchase_details
    USING (EXISTS (
        SELECT 1 FROM purchases p
         WHERE p.id = purchase_details.purchase_id
           AND (p.branch_id::text = current_branch_id()
                OR current_branch_id() = 'ALL')
    ));

-- customers
CREATE POLICY branch_isolation ON customers
    USING (branch_id::text = current_branch_id()
        OR current_branch_id() = 'ALL');

-- audit_log: branch_id nullable — eventos de sistema (branch_id NULL) son visibles para todos
CREATE POLICY branch_isolation ON audit_log
    USING (
        branch_id IS NULL
        OR branch_id::text = current_branch_id()
        OR current_branch_id() = 'ALL'
    );

-- =============================================================================
-- NOTA DE SEGURIDAD (ADR-013):
-- El usuario de la aplicación debe tener NOBYPASSRLS para que las policies apliquen.
-- El usuario de Flyway (owner de las tablas / superuser) bypasea RLS por definición,
-- lo que permite que esta migración se ejecute sin conflictos.
--
-- Para forzar RLS al usuario de la app en producción:
--   ALTER ROLE <app_user> NOBYPASSRLS;
--
-- El BranchContextFilter del backend (orden -200) ejecuta:
--   SET LOCAL app.current_branch_id = '<uuid>'   -- usuario de sucursal específica
--   SET LOCAL app.current_branch_id = 'ALL'      -- ADMIN global (branch_id NULL en JWT)
-- =============================================================================

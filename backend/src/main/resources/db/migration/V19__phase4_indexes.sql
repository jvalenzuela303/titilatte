-- =============================================================================
-- V19: Índices de performance — Fase 4 (Multi-sucursal)
-- =============================================================================

-- Índices multi-sucursal en tablas de usuarios y productos
CREATE INDEX IF NOT EXISTS idx_users_branch
    ON users (branch_id);

CREATE INDEX IF NOT EXISTS idx_products_branch
    ON products (branch_id, is_active)
    WHERE deleted_at IS NULL;

-- Ventas confirmadas por sucursal (consultas de dashboard y reportes)
CREATE INDEX IF NOT EXISTS idx_sales_branch_date
    ON sales (branch_id, created_at DESC)
    WHERE status = 'CONFIRMED';

-- Reporte consolidado cross-sucursal (ADMIN con current_branch_id = 'ALL')
CREATE INDEX IF NOT EXISTS idx_sales_consolidated
    ON sales (branch_id, status, created_at);

-- Clientes activos por sucursal
CREATE INDEX IF NOT EXISTS idx_customers_branch
    ON customers (branch_id, is_active)
    WHERE deleted_at IS NULL;

-- Caja registradora por sucursal y estado
CREATE INDEX IF NOT EXISTS idx_cash_branch
    ON cash_registers (branch_id, status);

-- Compras por sucursal
CREATE INDEX IF NOT EXISTS idx_purchases_branch
    ON purchases (branch_id, created_at DESC);

-- Movimientos de stock por sucursal, producto y fecha (consultas de trazabilidad)
CREATE INDEX IF NOT EXISTS idx_stock_mov_branch
    ON stock_movements (branch_id, product_id, created_at DESC);

-- Audit log por sucursal (consultas del módulo de auditoría filtradas por sucursal)
CREATE INDEX IF NOT EXISTS idx_audit_branch_date
    ON audit_log (branch_id, created_at DESC)
    WHERE branch_id IS NOT NULL;

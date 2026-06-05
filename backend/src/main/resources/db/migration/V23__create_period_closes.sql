-- =============================================================================
-- V23__create_period_closes.sql
-- Minimarket Platform - Fase 5
-- Módulo: Cierres Contables de Período
--
-- Tablas: period_closes
--
-- Propósito:
--   Registra el cierre contable mensual por sucursal (o global si branch_id IS NULL).
--   Consolida los agregados financieros calculados al momento del cierre:
--   ventas, costos, márgenes, créditos, movimientos de caja y stock.
--   Incluye datos de comparación con el período anterior desnormalizados para
--   recuperación rápida sin re-agregación (consultas de dashboard y exportación).
--
-- Estados del ciclo de vida:
--   DRAFT  — período en preparación, valores aún modificables
--   CLOSED — período cerrado y ratificado; no se permiten modificaciones
--
-- Reglas de negocio:
--   - Solo puede existir un cierre por (period_year, period_month, branch_id)
--   - branch_id NULL representa un cierre global que consolida todas las sucursales
--   - Un período CLOSED no debe actualizarse (enforced a nivel de aplicación)
--   - summary_json almacena el detalle completo para generación de PDF/Excel sin
--     necesidad de re-consultar las tablas transaccionales
--   - Los campos prev_* y revenue_change_pct se calculan en la aplicación al cerrar
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- TABLE: period_closes
-- Cierre contable mensual por sucursal o global (branch_id IS NULL).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.period_closes (
    id             UUID           NOT NULL DEFAULT gen_random_uuid(),

    -- Período contable (año y mes)
    period_year    INTEGER        NOT NULL,
    period_month   INTEGER        NOT NULL,

    -- DRAFT = en preparación, valores editables.
    -- CLOSED = ratificado, no se permiten cambios.
    status         VARCHAR(20)    NOT NULL DEFAULT 'DRAFT',

    -- NULL = cierre global (consolida todas las sucursales)
    -- NOT NULL = cierre específico de una sucursal
    branch_id      UUID,

    -- -----------------------------------------------------------------------
    -- Agregados de ventas
    -- -----------------------------------------------------------------------

    -- Ingresos brutos totales del período (suma de sales.total_amount CONFIRMED)
    total_revenue          NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- Costo total de los productos vendidos (suma de sales.total_cost CONFIRMED)
    total_cost             NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- Ganancia bruta: total_revenue - total_cost
    total_profit           NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- Margen de ganancia como decimal (ej: 0.2345 = 23.45%)
    profit_margin          NUMERIC(8, 4)  NOT NULL DEFAULT 0,

    -- Total de descuentos aplicados en ventas del período
    total_discount_given   NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- Cantidad total de ventas CONFIRMED en el período
    sale_count             INTEGER        NOT NULL DEFAULT 0,

    -- -----------------------------------------------------------------------
    -- Crédito y cuentas por cobrar
    -- -----------------------------------------------------------------------

    -- Monto total de ventas realizadas a crédito (type = 'CREDITO' o 'MIXTO')
    total_credit_sales     NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- Pagos recibidos de clientes durante el período (abonos a cuenta corriente)
    total_payments_received NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- Saldo pendiente de cobro al cierre del período
    outstanding_receivables NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- -----------------------------------------------------------------------
    -- Movimientos de caja
    -- -----------------------------------------------------------------------

    -- Suma de opening_amount de todos los turnos de caja del período
    total_cash_openings    NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- Suma de counted_amount de todos los turnos de caja cerrados del período
    total_cash_closings    NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- Diferencia acumulada (sobrante/faltante): sum(difference_amount) de cajas cerradas
    total_cash_difference  NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- -----------------------------------------------------------------------
    -- Inventario
    -- -----------------------------------------------------------------------

    -- Cantidad de ajustes de stock manuales realizados en el período
    total_stock_adjustments INTEGER        NOT NULL DEFAULT 0,

    -- Monto total de compras confirmadas (CONFIRMED) en el período
    total_purchase_amount  NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- -----------------------------------------------------------------------
    -- Comparación con período anterior (desnormalizado)
    -- Calculado por la aplicación al cerrar el período.
    -- NULL si no existe período anterior o no se calculó aún (DRAFT).
    -- -----------------------------------------------------------------------

    -- total_revenue del período anterior
    prev_revenue           NUMERIC(15, 2),

    -- total_profit del período anterior
    prev_profit            NUMERIC(15, 2),

    -- Variación porcentual de ingresos: (total_revenue - prev_revenue) / prev_revenue
    -- Ej: 0.15 = +15%, -0.08 = -8%
    revenue_change_pct     NUMERIC(8, 4),

    -- -----------------------------------------------------------------------
    -- Documentos y metadatos
    -- -----------------------------------------------------------------------

    -- Dump completo de datos para generación de reportes PDF/Excel sin re-consulta
    summary_json           JSONB,

    -- Observaciones del ADMIN al cerrar el período
    notes                  TEXT,

    -- Auditoría de cierre
    closed_at              TIMESTAMPTZ,
    closed_by              UUID,

    created_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    -- -----------------------------------------------------------------------
    -- PRIMARY KEY
    -- -----------------------------------------------------------------------
    CONSTRAINT pk_period_closes PRIMARY KEY (id),

    -- -----------------------------------------------------------------------
    -- UNIQUE: un solo cierre por mes por sucursal (o por cierre global)
    -- La combinación (period_year, period_month, branch_id) debe ser única,
    -- incluyendo el caso branch_id IS NULL (cierre global).
    -- NULLS NOT DISTINCT requiere PostgreSQL 15+; se usa índice único parcial
    -- para compatibilidad con versiones anteriores (ver índice al final).
    -- -----------------------------------------------------------------------

    -- -----------------------------------------------------------------------
    -- FOREIGN KEYS
    -- -----------------------------------------------------------------------
    CONSTRAINT fk_period_closes_branch
        FOREIGN KEY (branch_id)
        REFERENCES public.branches (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_period_closes_closed_by
        FOREIGN KEY (closed_by)
        REFERENCES public.users (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    -- -----------------------------------------------------------------------
    -- CHECK CONSTRAINTS
    -- -----------------------------------------------------------------------

    -- Estados de ciclo de vida válidos
    CONSTRAINT chk_period_closes_status
        CHECK (status IN ('DRAFT', 'CLOSED')),

    -- El mes debe estar entre 1 y 12
    CONSTRAINT chk_period_closes_period_month
        CHECK (period_month BETWEEN 1 AND 12),

    -- El año debe ser razonable (minimarket fundado > 2000, nada en el futuro lejano)
    CONSTRAINT chk_period_closes_period_year
        CHECK (period_year BETWEEN 2000 AND 2100),

    -- Los agregados monetarios no pueden ser negativos
    CONSTRAINT chk_period_closes_total_revenue
        CHECK (total_revenue >= 0),
    CONSTRAINT chk_period_closes_total_cost
        CHECK (total_cost >= 0),
    CONSTRAINT chk_period_closes_total_profit
        CHECK (total_profit >= 0),
    CONSTRAINT chk_period_closes_total_discount
        CHECK (total_discount_given >= 0),
    CONSTRAINT chk_period_closes_sale_count
        CHECK (sale_count >= 0),
    CONSTRAINT chk_period_closes_credit_sales
        CHECK (total_credit_sales >= 0),
    CONSTRAINT chk_period_closes_payments_received
        CHECK (total_payments_received >= 0),
    CONSTRAINT chk_period_closes_outstanding
        CHECK (outstanding_receivables >= 0),
    CONSTRAINT chk_period_closes_cash_openings
        CHECK (total_cash_openings >= 0),
    CONSTRAINT chk_period_closes_cash_closings
        CHECK (total_cash_closings >= 0),
    CONSTRAINT chk_period_closes_stock_adjustments
        CHECK (total_stock_adjustments >= 0),
    CONSTRAINT chk_period_closes_purchase_amount
        CHECK (total_purchase_amount >= 0),

    -- El cierre requiere usuario y timestamp, o ninguno de los dos
    CONSTRAINT chk_period_closes_closed_consistency
        CHECK (
            (status = 'DRAFT'  AND closed_at IS NULL  AND closed_by IS NULL) OR
            (status = 'CLOSED' AND closed_at IS NOT NULL AND closed_by IS NOT NULL)
        )
);

COMMENT ON TABLE  public.period_closes                       IS 'Cierre contable mensual del minimarket. Consolida agregados de ventas, costos, caja e inventario para reportes y auditoría.';
COMMENT ON COLUMN public.period_closes.id                    IS 'Identificador único del cierre de período (UUID v4).';
COMMENT ON COLUMN public.period_closes.period_year           IS 'Año del período contable (ej: 2025).';
COMMENT ON COLUMN public.period_closes.period_month          IS 'Mes del período contable (1..12).';
COMMENT ON COLUMN public.period_closes.status                IS 'Estado del ciclo de vida: DRAFT en preparación, CLOSED ratificado e inmutable.';
COMMENT ON COLUMN public.period_closes.branch_id             IS 'Sucursal del cierre. NULL indica un cierre global que consolida todas las sucursales.';
COMMENT ON COLUMN public.period_closes.total_revenue         IS 'Ingresos brutos del período: suma de sales.total_amount con status = CONFIRMED.';
COMMENT ON COLUMN public.period_closes.total_cost            IS 'Costo total de ventas del período: suma de sales.total_cost con status = CONFIRMED.';
COMMENT ON COLUMN public.period_closes.total_profit          IS 'Ganancia bruta del período: total_revenue - total_cost.';
COMMENT ON COLUMN public.period_closes.profit_margin         IS 'Margen de ganancia como decimal (ej: 0.2345 = 23.45%). Calculado por la aplicación.';
COMMENT ON COLUMN public.period_closes.total_discount_given  IS 'Suma de descuentos aplicados en todas las ventas del período.';
COMMENT ON COLUMN public.period_closes.sale_count            IS 'Número de ventas CONFIRMED en el período.';
COMMENT ON COLUMN public.period_closes.total_credit_sales    IS 'Monto de ventas a crédito (type CREDITO o MIXTO) del período.';
COMMENT ON COLUMN public.period_closes.total_payments_received IS 'Abonos a cuenta corriente recibidos durante el período.';
COMMENT ON COLUMN public.period_closes.outstanding_receivables IS 'Saldo total pendiente de cobro al cierre del período.';
COMMENT ON COLUMN public.period_closes.total_cash_openings   IS 'Suma de los fondos iniciales de todos los turnos de caja del período.';
COMMENT ON COLUMN public.period_closes.total_cash_closings   IS 'Suma de los montos contados al cierre de todos los turnos del período.';
COMMENT ON COLUMN public.period_closes.total_cash_difference IS 'Diferencia acumulada entre counted_amount y expected_closing_amount de todos los turnos.';
COMMENT ON COLUMN public.period_closes.total_stock_adjustments IS 'Cantidad de ajustes manuales de inventario realizados en el período.';
COMMENT ON COLUMN public.period_closes.total_purchase_amount IS 'Monto total de compras CONFIRMED durante el período.';
COMMENT ON COLUMN public.period_closes.prev_revenue          IS 'total_revenue del período anterior. Desnormalizado para comparación rápida.';
COMMENT ON COLUMN public.period_closes.prev_profit           IS 'total_profit del período anterior. Desnormalizado para comparación rápida.';
COMMENT ON COLUMN public.period_closes.revenue_change_pct    IS 'Variación porcentual de ingresos respecto al período anterior: (revenue - prev_revenue) / prev_revenue.';
COMMENT ON COLUMN public.period_closes.summary_json          IS 'Dump completo del detalle del período en JSONB. Usado para generación de PDF/Excel sin re-consultar tablas transaccionales.';
COMMENT ON COLUMN public.period_closes.notes                 IS 'Observaciones del administrador al ratificar el cierre.';
COMMENT ON COLUMN public.period_closes.closed_at             IS 'Timestamp en que el período fue ratificado como CLOSED (UTC).';
COMMENT ON COLUMN public.period_closes.closed_by             IS 'FK al usuario ADMIN que ratificó el cierre.';
COMMENT ON COLUMN public.period_closes.created_at            IS 'Timestamp de creación del registro (UTC).';
COMMENT ON COLUMN public.period_closes.updated_at            IS 'Timestamp de última modificación del registro (UTC).';

-- ---------------------------------------------------------------------------
-- TRIGGER: updated_at en period_closes
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_period_closes_updated_at
    BEFORE UPDATE ON public.period_closes
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- INDEXES — Módulo cierres de período
-- ---------------------------------------------------------------------------

-- Consulta principal de reportes: "dame el cierre de marzo 2025"
-- Cubre ORDER BY period_year DESC, period_month DESC en listado histórico
CREATE INDEX IF NOT EXISTS idx_period_closes_year_month
    ON public.period_closes (period_year DESC, period_month DESC);

-- Filtro por estado: dashboard lista cierres DRAFT pendientes de ratificación
CREATE INDEX IF NOT EXISTS idx_period_closes_status
    ON public.period_closes (status, period_year DESC, period_month DESC);

-- Filtro por sucursal: ADMIN global lista cierres de cada sucursal
CREATE INDEX IF NOT EXISTS idx_period_closes_branch_id
    ON public.period_closes (branch_id, period_year DESC, period_month DESC)
    WHERE branch_id IS NOT NULL;

-- Cierres globales (branch_id IS NULL): índice parcial para el caso de cierre consolidado
CREATE INDEX IF NOT EXISTS idx_period_closes_global
    ON public.period_closes (period_year DESC, period_month DESC)
    WHERE branch_id IS NULL;

-- Índice GIN sobre summary_json: habilita búsquedas dentro del JSON de resumen
-- Útil para queries como: "cierres donde summary_json contiene cierta sucursal o métrica"
CREATE INDEX IF NOT EXISTS idx_period_closes_summary_json
    ON public.period_closes USING GIN (summary_json)
    WHERE summary_json IS NOT NULL;

-- ---------------------------------------------------------------------------
-- UNIQUE: un solo cierre por (period_year, period_month, branch_id)
-- Se implementa con DOS índices únicos parciales para manejar correctamente
-- el caso branch_id IS NULL (cierre global), ya que los valores NULL no se
-- comparan como iguales en índices UNIQUE estándar de PostgreSQL < 15.
--
--   1. Registros con branch_id NOT NULL (cierres de sucursal)
--   2. Registros con branch_id IS NULL  (cierres globales)
-- ---------------------------------------------------------------------------

-- Unicidad para cierres de sucursal específica
CREATE UNIQUE INDEX IF NOT EXISTS uq_period_closes_branch
    ON public.period_closes (period_year, period_month, branch_id)
    WHERE branch_id IS NOT NULL;

-- Unicidad para cierres globales (solo uno por (year, month) sin sucursal)
CREATE UNIQUE INDEX IF NOT EXISTS uq_period_closes_global
    ON public.period_closes (period_year, period_month)
    WHERE branch_id IS NULL;

COMMIT;

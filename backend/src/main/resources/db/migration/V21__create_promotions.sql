-- =============================================================================
-- V21__create_promotions.sql
-- Minimarket Platform - Fase 5
-- Módulo: Promociones y Precios Dinámicos
--
-- Tablas: promotions, promotion_products
-- Alter:  sale_details.applied_promotion_id (traza la promoción aplicada por línea)
--
-- Tipos de promoción soportados:
--   PERCENTAGE       — descuento porcentual (value = 0.10 → 10%)
--   FIXED_PRICE      — precio final fijo (value = precio de venta)
--   TWO_FOR_ONE      — lleva min_quantity paga (min_quantity - bonus_quantity)
--   QUANTITY_DISCOUNT — descuento escalonado al superar min_quantity
--
-- Reglas de negocio:
--   - ends_at siempre posterior a starts_at (CHECK)
--   - category_id solo es relevante cuando applies_to = 'CATEGORY'
--   - promotion_products solo se usa cuando applies_to = 'SPECIFIC_PRODUCTS'
--   - branch_id NULL = promoción válida en todas las sucursales
--   - Soft delete via deleted_at (patrón estándar del proyecto)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- TABLE: promotions
-- Maestro de promociones y reglas de precio dinámico.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.promotions (
    id             UUID           NOT NULL DEFAULT gen_random_uuid(),
    name           VARCHAR(100)   NOT NULL,
    description    TEXT,

    -- Tipo de promoción: determina cómo se interpreta value/min_quantity/bonus_quantity
    type           VARCHAR(30)    NOT NULL,

    -- Para PERCENTAGE: fracción decimal (0.10 = 10%). Para FIXED_PRICE: precio final.
    -- NULL para TWO_FOR_ONE (la lógica es puramente qty-based).
    value          NUMERIC(10, 4),

    -- Cantidad mínima para activar la promoción
    min_quantity   INTEGER        NOT NULL DEFAULT 1,

    -- Unidades adicionales gratuitas. Para TWO_FOR_ONE: compra min_quantity, lleva bonus_quantity gratis.
    bonus_quantity INTEGER,

    -- Alcance de la promoción
    applies_to     VARCHAR(20)    NOT NULL DEFAULT 'SPECIFIC_PRODUCTS',

    -- FK a categoría; relevante solo cuando applies_to = 'CATEGORY'
    category_id    UUID,

    -- Ventana temporal de vigencia
    starts_at      TIMESTAMPTZ    NOT NULL,
    ends_at        TIMESTAMPTZ    NOT NULL,

    active         BOOLEAN        NOT NULL DEFAULT TRUE,

    -- NULL = todas las sucursales; NOT NULL = sucursal específica
    branch_id      UUID,

    created_by     UUID           NOT NULL,
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    deleted_at     TIMESTAMPTZ,

    -- -----------------------------------------------------------------------
    -- PRIMARY KEY
    -- -----------------------------------------------------------------------
    CONSTRAINT pk_promotions PRIMARY KEY (id),

    -- -----------------------------------------------------------------------
    -- FOREIGN KEYS
    -- -----------------------------------------------------------------------
    CONSTRAINT fk_promotions_category
        FOREIGN KEY (category_id)
        REFERENCES public.product_categories (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_promotions_branch
        FOREIGN KEY (branch_id)
        REFERENCES public.branches (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_promotions_created_by
        FOREIGN KEY (created_by)
        REFERENCES public.users (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    -- -----------------------------------------------------------------------
    -- CHECK CONSTRAINTS
    -- -----------------------------------------------------------------------

    -- Tipos de promoción válidos
    CONSTRAINT chk_promotions_type
        CHECK (type IN ('PERCENTAGE', 'FIXED_PRICE', 'TWO_FOR_ONE', 'QUANTITY_DISCOUNT')),

    -- Alcances válidos
    CONSTRAINT chk_promotions_applies_to
        CHECK (applies_to IN ('SPECIFIC_PRODUCTS', 'ALL_PRODUCTS', 'CATEGORY')),

    -- La fecha de fin siempre debe ser posterior a la de inicio
    CONSTRAINT chk_promotions_date_range
        CHECK (ends_at > starts_at),

    -- El porcentaje o descuento no puede ser negativo ni superar el 100%
    CONSTRAINT chk_promotions_value_positive
        CHECK (value IS NULL OR value >= 0),

    CONSTRAINT chk_promotions_percentage_max
        CHECK (type <> 'PERCENTAGE' OR value IS NULL OR value <= 1),

    -- Cantidad mínima debe ser al menos 1
    CONSTRAINT chk_promotions_min_quantity
        CHECK (min_quantity >= 1),

    -- bonus_quantity, si se usa, debe ser positivo
    CONSTRAINT chk_promotions_bonus_quantity
        CHECK (bonus_quantity IS NULL OR bonus_quantity >= 1),

    -- CATEGORY requiere category_id; otros alcances no lo admiten
    CONSTRAINT chk_promotions_category_consistency
        CHECK (
            (applies_to = 'CATEGORY'  AND category_id IS NOT NULL) OR
            (applies_to <> 'CATEGORY' AND category_id IS NULL)
        )
);

COMMENT ON TABLE  public.promotions               IS 'Maestro de promociones y precios dinámicos del minimarket. Soporta descuentos porcentuales, precios fijos, 2x1 y descuentos por cantidad.';
COMMENT ON COLUMN public.promotions.id            IS 'Identificador único de la promoción (UUID v4).';
COMMENT ON COLUMN public.promotions.name          IS 'Nombre descriptivo de la promoción. Visible en el POS y en reportes.';
COMMENT ON COLUMN public.promotions.description   IS 'Descripción extendida de la promoción. Opcional.';
COMMENT ON COLUMN public.promotions.type          IS 'Tipo de promoción: PERCENTAGE, FIXED_PRICE, TWO_FOR_ONE o QUANTITY_DISCOUNT.';
COMMENT ON COLUMN public.promotions.value         IS 'Valor de la promoción. Para PERCENTAGE: fracción decimal (0.10 = 10%). Para FIXED_PRICE: precio final. NULL para TWO_FOR_ONE.';
COMMENT ON COLUMN public.promotions.min_quantity  IS 'Cantidad mínima de unidades para activar la promoción. Por defecto 1.';
COMMENT ON COLUMN public.promotions.bonus_quantity IS 'Unidades adicionales gratuitas. Para TWO_FOR_ONE: comprando min_quantity se reciben bonus_quantity unidades gratis.';
COMMENT ON COLUMN public.promotions.applies_to    IS 'Alcance de la promoción: SPECIFIC_PRODUCTS, ALL_PRODUCTS o CATEGORY.';
COMMENT ON COLUMN public.promotions.category_id   IS 'FK a la categoría de productos. Usado solo cuando applies_to = CATEGORY.';
COMMENT ON COLUMN public.promotions.starts_at     IS 'Inicio de la vigencia de la promoción (UTC).';
COMMENT ON COLUMN public.promotions.ends_at       IS 'Fin de la vigencia de la promoción (UTC). Siempre posterior a starts_at.';
COMMENT ON COLUMN public.promotions.active        IS 'FALSE desactiva la promoción sin eliminarla. POS ignora promociones inactivas.';
COMMENT ON COLUMN public.promotions.branch_id     IS 'Sucursal a la que aplica la promoción. NULL = aplica a todas las sucursales.';
COMMENT ON COLUMN public.promotions.created_by    IS 'FK al usuario (ADMIN o SUPERVISOR) que creó la promoción.';
COMMENT ON COLUMN public.promotions.created_at    IS 'Timestamp de creación del registro (UTC).';
COMMENT ON COLUMN public.promotions.updated_at    IS 'Timestamp de última modificación del registro (UTC).';
COMMENT ON COLUMN public.promotions.deleted_at    IS 'Soft delete: NULL = activa, NOT NULL = eliminada lógicamente.';

-- ---------------------------------------------------------------------------
-- TABLE: promotion_products
-- Tabla de unión entre promociones y productos específicos.
-- Solo aplica cuando promotions.applies_to = 'SPECIFIC_PRODUCTS'.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.promotion_products (
    promotion_id UUID NOT NULL,
    product_id   UUID NOT NULL,

    CONSTRAINT pk_promotion_products PRIMARY KEY (promotion_id, product_id),

    CONSTRAINT fk_promotion_products_promotion
        FOREIGN KEY (promotion_id)
        REFERENCES public.promotions (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_promotion_products_product
        FOREIGN KEY (product_id)
        REFERENCES public.products (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

COMMENT ON TABLE  public.promotion_products              IS 'Tabla de unión promociones ↔ productos (M:N). Solo relevante cuando applies_to = SPECIFIC_PRODUCTS.';
COMMENT ON COLUMN public.promotion_products.promotion_id IS 'FK a la promoción que aplica al producto.';
COMMENT ON COLUMN public.promotion_products.product_id   IS 'FK al producto incluido en la promoción.';

-- ---------------------------------------------------------------------------
-- ALTER: sale_details — columna applied_promotion_id
-- Registra qué promoción fue aplicada en cada línea de detalle de venta.
-- NULL = sin promoción aplicada. NOT NULL = precio o descuento afectado por la promo.
-- ---------------------------------------------------------------------------
ALTER TABLE public.sale_details
    ADD COLUMN IF NOT EXISTS applied_promotion_id UUID;

ALTER TABLE public.sale_details
    ADD CONSTRAINT fk_sale_details_promotion
        FOREIGN KEY (applied_promotion_id)
        REFERENCES public.promotions (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;

COMMENT ON COLUMN public.sale_details.applied_promotion_id IS
    'FK a la promoción que modificó el precio o descuento de esta línea. '
    'NULL si no se aplicó ninguna promoción. '
    'ON DELETE SET NULL preserva el historial de ventas aunque la promo sea eliminada.';

-- ---------------------------------------------------------------------------
-- TRIGGER: updated_at en promotions
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_promotions_updated_at
    BEFORE UPDATE ON public.promotions
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- INDEXES — Módulo promociones
-- ---------------------------------------------------------------------------

-- Consulta principal del POS: "¿qué promociones están activas ahora?"
-- Se evalúa en cada venta para aplicar precios dinámicos.
-- Columnas en orden de selectividad: active filtra la mayoría, luego el rango temporal.
CREATE INDEX IF NOT EXISTS idx_promotions_active_dates
    ON public.promotions (active, starts_at, ends_at)
    WHERE deleted_at IS NULL;

-- Filtro por sucursal: POS consulta primero promos de su sucursal, luego las globales (NULL)
CREATE INDEX IF NOT EXISTS idx_promotions_branch_id
    ON public.promotions (branch_id)
    WHERE deleted_at IS NULL AND active = TRUE;

-- Filtro por alcance: separa promos de categoría de las de producto específico
CREATE INDEX IF NOT EXISTS idx_promotions_applies_to
    ON public.promotions (applies_to)
    WHERE deleted_at IS NULL AND active = TRUE;

-- Promos por categoría: usado cuando applies_to = 'CATEGORY' para resolver qué productos aplican
CREATE INDEX IF NOT EXISTS idx_promotions_category_id
    ON public.promotions (category_id)
    WHERE deleted_at IS NULL AND active = TRUE AND category_id IS NOT NULL;

-- Lookup de producto en promotion_products: "¿tiene este producto alguna promo activa?"
CREATE INDEX IF NOT EXISTS idx_promotion_products_product_id
    ON public.promotion_products (product_id);

-- Lookup de líneas de venta que usaron una promoción (reportes de efectividad)
CREATE INDEX IF NOT EXISTS idx_sale_details_applied_promotion
    ON public.sale_details (applied_promotion_id)
    WHERE applied_promotion_id IS NOT NULL;

COMMIT;

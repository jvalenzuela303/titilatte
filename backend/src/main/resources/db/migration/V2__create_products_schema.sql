-- =============================================================================
-- V2__create_products_schema.sql
-- Minimarket Platform - Fase 1
-- Módulo: Catálogo de Productos
--
-- Tablas: taxes, units, product_categories, product_families, products
-- Trigger: auditoría de cambios de precio (regla de negocio: solo ADMIN)
-- FK diferida: price_audit_log.product_id añadida al final
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- ENUM: Tipos de impuesto
-- ---------------------------------------------------------------------------
CREATE TYPE public.tax_type AS ENUM (
    'IVA',
    'EXENTO',
    'OTRO'
);

COMMENT ON TYPE public.tax_type IS
    'Clasificación del tipo de impuesto aplicable a un producto.';

-- ---------------------------------------------------------------------------
-- TABLE: taxes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.taxes (
    id          UUID           NOT NULL DEFAULT gen_random_uuid(),
    code        VARCHAR(20)    NOT NULL,
    name        VARCHAR(100)   NOT NULL,
    type        public.tax_type NOT NULL DEFAULT 'IVA',
    rate        NUMERIC(5, 4)  NOT NULL,
    is_active   BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_taxes      PRIMARY KEY (id),
    CONSTRAINT uq_taxes_code UNIQUE (code),
    CONSTRAINT chk_taxes_rate
        CHECK (rate >= 0 AND rate <= 1)
);

COMMENT ON TABLE  public.taxes            IS 'Tasas de impuestos aplicables a productos. Ej: IVA 19%.';
COMMENT ON COLUMN public.taxes.id         IS 'Identificador único del impuesto (UUID v4).';
COMMENT ON COLUMN public.taxes.code       IS 'Código corto único del impuesto. Ej: IVA19, EXENTO.';
COMMENT ON COLUMN public.taxes.name       IS 'Nombre descriptivo del impuesto.';
COMMENT ON COLUMN public.taxes.type       IS 'Tipo de impuesto según clasificación fiscal.';
COMMENT ON COLUMN public.taxes.rate       IS 'Tasa como decimal (0..1). Ej: 0.19 para IVA 19%.';
COMMENT ON COLUMN public.taxes.is_active  IS 'FALSE desactiva el impuesto sin eliminarlo.';
COMMENT ON COLUMN public.taxes.created_at IS 'Timestamp de creación (UTC).';
COMMENT ON COLUMN public.taxes.updated_at IS 'Timestamp de última modificación (UTC).';

-- ---------------------------------------------------------------------------
-- TABLE: units
-- Unidades de medida para productos (unidad, kilo, litro, caja, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.units (
    id           UUID         NOT NULL DEFAULT gen_random_uuid(),
    code         VARCHAR(20)  NOT NULL,
    name         VARCHAR(100) NOT NULL,
    abbreviation VARCHAR(10)  NOT NULL,
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_units      PRIMARY KEY (id),
    CONSTRAINT uq_units_code UNIQUE (code)
);

COMMENT ON TABLE  public.units              IS 'Unidades de medida para cuantificar productos en ventas y stock.';
COMMENT ON COLUMN public.units.id           IS 'Identificador único de la unidad (UUID v4).';
COMMENT ON COLUMN public.units.code         IS 'Código único de la unidad. Ej: UN, KG, LT, CJ.';
COMMENT ON COLUMN public.units.name         IS 'Nombre completo de la unidad. Ej: Unidad, Kilogramo.';
COMMENT ON COLUMN public.units.abbreviation IS 'Abreviación para mostrar en ticket/POS. Ej: un, kg, lt.';
COMMENT ON COLUMN public.units.is_active    IS 'FALSE desactiva la unidad sin eliminarla.';
COMMENT ON COLUMN public.units.created_at   IS 'Timestamp de creación (UTC).';
COMMENT ON COLUMN public.units.updated_at   IS 'Timestamp de última modificación (UTC).';

-- ---------------------------------------------------------------------------
-- TABLE: product_families
-- Nivel superior de clasificación (ej: Alimentos, Bebidas, Limpieza)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_families (
    id          UUID         NOT NULL DEFAULT gen_random_uuid(),
    code        VARCHAR(20)  NOT NULL,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_product_families      PRIMARY KEY (id),
    CONSTRAINT uq_product_families_code UNIQUE (code)
);

COMMENT ON TABLE  public.product_families             IS 'Familias de productos: agrupación de nivel superior. Ej: Alimentos, Bebidas.';
COMMENT ON COLUMN public.product_families.id          IS 'Identificador único de la familia (UUID v4).';
COMMENT ON COLUMN public.product_families.code        IS 'Código único de la familia. Ej: ALI, BEB, LIM.';
COMMENT ON COLUMN public.product_families.name        IS 'Nombre de la familia de productos.';
COMMENT ON COLUMN public.product_families.description IS 'Descripción extendida de la familia.';
COMMENT ON COLUMN public.product_families.is_active   IS 'FALSE oculta la familia en la UI sin eliminarla.';
COMMENT ON COLUMN public.product_families.created_at  IS 'Timestamp de creación (UTC).';
COMMENT ON COLUMN public.product_families.updated_at  IS 'Timestamp de última modificación (UTC).';

-- ---------------------------------------------------------------------------
-- TABLE: product_categories
-- Nivel de categoría dentro de una familia (ej: Lácteos dentro de Alimentos)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_categories (
    id          UUID         NOT NULL DEFAULT gen_random_uuid(),
    family_id   UUID         NOT NULL,
    code        VARCHAR(20)  NOT NULL,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_product_categories      PRIMARY KEY (id),
    CONSTRAINT uq_product_categories_code UNIQUE (code),
    CONSTRAINT fk_product_categories_family
        FOREIGN KEY (family_id)
        REFERENCES public.product_families (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

COMMENT ON TABLE  public.product_categories             IS 'Categorías de productos agrupadas bajo una familia. Ej: Lácteos bajo Alimentos.';
COMMENT ON COLUMN public.product_categories.id          IS 'Identificador único de la categoría (UUID v4).';
COMMENT ON COLUMN public.product_categories.family_id   IS 'FK a la familia a la que pertenece esta categoría.';
COMMENT ON COLUMN public.product_categories.code        IS 'Código único de la categoría. Ej: LAC, CER, GAS.';
COMMENT ON COLUMN public.product_categories.name        IS 'Nombre de la categoría.';
COMMENT ON COLUMN public.product_categories.description IS 'Descripción extendida de la categoría.';
COMMENT ON COLUMN public.product_categories.is_active   IS 'FALSE oculta la categoría en la UI sin eliminarla.';
COMMENT ON COLUMN public.product_categories.created_at  IS 'Timestamp de creación (UTC).';
COMMENT ON COLUMN public.product_categories.updated_at  IS 'Timestamp de última modificación (UTC).';

-- ---------------------------------------------------------------------------
-- TABLE: products
-- Catálogo maestro de productos. Stock gestionado como columna desnormalizada
-- para rendimiento en POS (evitar JOIN a stock_movements en cada escaneo).
-- El valor autoritativo es siempre el resultado de aplicar stock_movements.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    id             UUID           NOT NULL DEFAULT gen_random_uuid(),
    barcode        VARCHAR(50)    NOT NULL,
    name           VARCHAR(255)   NOT NULL,
    description    TEXT,
    purchase_price NUMERIC(12, 4) NOT NULL,
    sale_price     NUMERIC(12, 4) NOT NULL,
    stock_current  NUMERIC(12, 4) NOT NULL DEFAULT 0,
    stock_minimum  NUMERIC(12, 4) NOT NULL DEFAULT 0,
    stock_maximum  NUMERIC(12, 4),
    is_active      BOOLEAN        NOT NULL DEFAULT TRUE,
    category_id    UUID           NOT NULL,
    tax_id         UUID           NOT NULL,
    unit_id        UUID           NOT NULL,
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    deleted_at     TIMESTAMPTZ,

    CONSTRAINT pk_products          PRIMARY KEY (id),
    CONSTRAINT uq_products_barcode  UNIQUE (barcode),
    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id)
        REFERENCES public.product_categories (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_products_tax
        FOREIGN KEY (tax_id)
        REFERENCES public.taxes (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_products_unit
        FOREIGN KEY (unit_id)
        REFERENCES public.units (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    -- Precios siempre positivos
    CONSTRAINT chk_products_purchase_price
        CHECK (purchase_price >= 0),
    CONSTRAINT chk_products_sale_price
        CHECK (sale_price >= 0),
    -- Regla de negocio: precio de venta >= precio de compra
    CONSTRAINT chk_products_price_margin
        CHECK (sale_price >= purchase_price),
    -- Stock nunca negativo
    CONSTRAINT chk_products_stock_current
        CHECK (stock_current >= 0),
    CONSTRAINT chk_products_stock_minimum
        CHECK (stock_minimum >= 0),
    -- Si hay máximo, debe ser mayor o igual al mínimo
    CONSTRAINT chk_products_stock_range
        CHECK (stock_maximum IS NULL OR stock_maximum >= stock_minimum)
);

COMMENT ON TABLE  public.products                IS 'Catálogo maestro de productos del minimarket. stock_current es campo desnormalizado para performance del POS.';
COMMENT ON COLUMN public.products.id             IS 'Identificador único del producto (UUID v4).';
COMMENT ON COLUMN public.products.barcode        IS 'Código de barras EAN-13 / UPC o código interno. Único en el sistema.';
COMMENT ON COLUMN public.products.name           IS 'Nombre comercial del producto. Búsqueda frecuente en POS.';
COMMENT ON COLUMN public.products.description    IS 'Descripción extendida del producto. Opcional.';
COMMENT ON COLUMN public.products.purchase_price IS 'Precio de compra neto (sin impuesto). Solo ADMIN puede modificar. Ver price_audit_log.';
COMMENT ON COLUMN public.products.sale_price     IS 'Precio de venta neto (sin impuesto). Solo ADMIN puede modificar. Ver price_audit_log.';
COMMENT ON COLUMN public.products.stock_current  IS 'Cantidad en stock. Actualizado atómicamente por trigger al confirmar venta o registrar movimiento.';
COMMENT ON COLUMN public.products.stock_minimum  IS 'Stock mínimo para alerta de reposición. Si stock_current <= stock_minimum se genera alerta.';
COMMENT ON COLUMN public.products.stock_maximum  IS 'Stock máximo de almacenamiento. NULL = sin límite superior.';
COMMENT ON COLUMN public.products.is_active      IS 'FALSE oculta el producto en POS sin eliminarlo. No vende productos inactivos.';
COMMENT ON COLUMN public.products.category_id    IS 'FK a la categoría del producto.';
COMMENT ON COLUMN public.products.tax_id         IS 'FK al impuesto aplicable al precio de venta.';
COMMENT ON COLUMN public.products.unit_id        IS 'FK a la unidad de medida de venta (unidad, kilo, litro).';
COMMENT ON COLUMN public.products.created_at     IS 'Timestamp de creación (UTC).';
COMMENT ON COLUMN public.products.updated_at     IS 'Timestamp de última modificación (UTC).';
COMMENT ON COLUMN public.products.deleted_at     IS 'Soft delete: NULL = activo, NOT NULL = eliminado lógicamente.';

-- ---------------------------------------------------------------------------
-- FK diferida: price_audit_log.product_id -> products.id
-- La tabla price_audit_log fue creada en V1 sin esta FK para evitar
-- dependencia circular. Se añade aquí con productos ya definidos.
-- ---------------------------------------------------------------------------
ALTER TABLE public.price_audit_log
    ADD CONSTRAINT fk_price_audit_log_product
        FOREIGN KEY (product_id)
        REFERENCES public.products (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- TRIGGER: auditoría de cambios de precio en products
-- Regla de negocio: cualquier modificación a purchase_price o sale_price
-- debe quedar registrada en price_audit_log. La aplicación debe pasar
-- el usuario en la variable de sesión app.current_user_id.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_audit_product_price()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Leer el usuario activo desde variable de sesión (establecida por la app)
    BEGIN
        v_user_id := current_setting('app.current_user_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    IF OLD.purchase_price IS DISTINCT FROM NEW.purchase_price THEN
        INSERT INTO public.price_audit_log
            (product_id, changed_by, field_name, old_value, new_value)
        VALUES
            (NEW.id, v_user_id, 'purchase_price', OLD.purchase_price, NEW.purchase_price);
    END IF;

    IF OLD.sale_price IS DISTINCT FROM NEW.sale_price THEN
        INSERT INTO public.price_audit_log
            (product_id, changed_by, field_name, old_value, new_value)
        VALUES
            (NEW.id, v_user_id, 'sale_price', OLD.sale_price, NEW.sale_price);
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_audit_product_price() IS
    'Registra en price_audit_log cualquier cambio de purchase_price o sale_price. '
    'La app debe SET LOCAL app.current_user_id = <uuid> en la transacción.';

CREATE TRIGGER trg_products_price_audit
    AFTER UPDATE ON public.products
    FOR EACH ROW
    WHEN (
        OLD.purchase_price IS DISTINCT FROM NEW.purchase_price OR
        OLD.sale_price     IS DISTINCT FROM NEW.sale_price
    )
    EXECUTE FUNCTION public.fn_audit_product_price();

-- ---------------------------------------------------------------------------
-- TRIGGER: updated_at en products y tablas de catálogo
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER trg_taxes_updated_at
    BEFORE UPDATE ON public.taxes
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER trg_units_updated_at
    BEFORE UPDATE ON public.units
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER trg_product_families_updated_at
    BEFORE UPDATE ON public.product_families
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER trg_product_categories_updated_at
    BEFORE UPDATE ON public.product_categories
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- INDEXES - Módulo productos
-- (Índices de performance críticos para SLA 300ms en POS)
-- ---------------------------------------------------------------------------

-- Búsqueda por código de barras en POS (única consulta más frecuente del sistema)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode
    ON public.products (barcode)
    WHERE deleted_at IS NULL;

-- Búsqueda por nombre en POS con ILIKE (trigram requiere pg_trgm en V5)
CREATE INDEX IF NOT EXISTS idx_products_name
    ON public.products (name)
    WHERE deleted_at IS NULL AND is_active = TRUE;

-- Filtro de productos activos para listados en POS
CREATE INDEX IF NOT EXISTS idx_products_is_active
    ON public.products (is_active)
    WHERE deleted_at IS NULL;

-- Filtro por categoría (listados de catálogo)
CREATE INDEX IF NOT EXISTS idx_products_category_id
    ON public.products (category_id)
    WHERE deleted_at IS NULL;

-- Alertas de stock bajo (dashboard de reposición)
CREATE INDEX IF NOT EXISTS idx_products_stock_alert
    ON public.products (stock_current, stock_minimum)
    WHERE deleted_at IS NULL AND is_active = TRUE;

-- Índices en tablas de catálogo
CREATE INDEX IF NOT EXISTS idx_product_categories_family_id
    ON public.product_categories (family_id);

COMMIT;

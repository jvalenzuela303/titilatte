BEGIN;

-- Tabla audit_log inmutable
CREATE TABLE IF NOT EXISTS public.audit_log (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type   VARCHAR(50) NOT NULL,
    entity_id     UUID,
    action        VARCHAR(50) NOT NULL,
    old_value     JSONB,
    new_value     JSONB,
    reason        VARCHAR(500),
    performed_by  UUID        REFERENCES public.users(id) ON DELETE SET NULL,
    ip_address    INET,
    user_agent    VARCHAR(500),
    created_at    TIMESTAMP   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_log IS 'Registro inmutable de auditoría. No se permite UPDATE ni DELETE.';
COMMENT ON COLUMN public.audit_log.entity_type IS 'SALE, PRODUCT, STOCK, CASH, USER, AUTH';
COMMENT ON COLUMN public.audit_log.action IS 'CREATE, UPDATE, DELETE, CANCEL, LOGIN_FAILED, PASSWORD_CHANGE, PRICE_CHANGE, ADJUSTMENT';

-- Revocar modificación directa (inmutabilidad)
REVOKE UPDATE, DELETE ON public.audit_log FROM PUBLIC;

-- Índices
CREATE INDEX IF NOT EXISTS idx_audit_entity       ON public.audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user         ON public.audit_log (performed_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action       ON public.audit_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created      ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_new_value    ON public.audit_log USING GIN (new_value);
CREATE INDEX IF NOT EXISTS idx_audit_export       ON public.audit_log (created_at DESC, entity_type, action)
    INCLUDE (performed_by, entity_id, reason);

-- Vista de cambios de precio
CREATE OR REPLACE VIEW public.v_audit_price_changes AS
SELECT
    al.id,
    al.entity_id                                      AS product_id,
    p.name                                            AS product_name,
    (al.old_value->>'salePrice')::NUMERIC             AS old_sale_price,
    (al.new_value->>'salePrice')::NUMERIC             AS new_sale_price,
    (al.old_value->>'purchasePrice')::NUMERIC         AS old_purchase_price,
    (al.new_value->>'purchasePrice')::NUMERIC         AS new_purchase_price,
    u.email                                           AS changed_by,
    al.ip_address,
    al.created_at
FROM public.audit_log al
JOIN public.products p ON p.id = al.entity_id
JOIN public.users    u ON u.id = al.performed_by
WHERE al.entity_type = 'PRODUCT'
  AND al.action = 'PRICE_CHANGE';

COMMIT;

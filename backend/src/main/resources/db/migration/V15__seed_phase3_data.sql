BEGIN;

-- Permisos nuevos de Fase 3
INSERT INTO public.permissions (id, code, description, module) VALUES
    (gen_random_uuid(), 'AUDIT_READ',            'Ver log de auditoría',          'AUDIT'),
    (gen_random_uuid(), 'AUDIT_EXPORT',           'Exportar auditoría a Excel',    'AUDIT'),
    (gen_random_uuid(), 'DASHBOARD_ADMIN',        'Dashboard administrador',       'DASHBOARD'),
    (gen_random_uuid(), 'DASHBOARD_SUPERVISOR',   'Dashboard supervisor',          'DASHBOARD'),
    (gen_random_uuid(), 'DASHBOARD_CAJERO',       'Dashboard cajero',              'DASHBOARD'),
    (gen_random_uuid(), 'SSE_CONNECT',            'Conectar al stream SSE',        'SSE')
ON CONFLICT (code) DO NOTHING;

-- ADMIN: auditoría completa + dashboard + SSE
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r
CROSS  JOIN public.permissions p
WHERE  r.name = 'ADMIN'
  AND  p.code IN ('AUDIT_READ','AUDIT_EXPORT','DASHBOARD_ADMIN','SSE_CONNECT')
ON CONFLICT DO NOTHING;

-- SUPERVISOR: dashboard supervisor + SSE
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r
CROSS  JOIN public.permissions p
WHERE  r.name = 'SUPERVISOR'
  AND  p.code IN ('DASHBOARD_SUPERVISOR','SSE_CONNECT')
ON CONFLICT DO NOTHING;

-- CAJERO: dashboard cajero + SSE
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r
CROSS  JOIN public.permissions p
WHERE  r.name = 'CAJERO'
  AND  p.code IN ('DASHBOARD_CAJERO','SSE_CONNECT')
ON CONFLICT DO NOTHING;

-- BODEGA: solo SSE
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r
CROSS  JOIN public.permissions p
WHERE  r.name = 'BODEGA'
  AND  p.code IN ('SSE_CONNECT')
ON CONFLICT DO NOTHING;

COMMIT;

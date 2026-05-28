-- V10__create_audit_log.sql
-- Audit log table for tracking entity mutations, auth failures, and manual adjustments.
-- Uses JSONB for flexible old/new value storage and inet for IP address type safety.

CREATE TABLE IF NOT EXISTS audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50)  NOT NULL,
    entity_id   UUID,
    action      VARCHAR(50)  NOT NULL,
    old_value   JSONB,
    new_value   JSONB,
    reason      VARCHAR(500),
    performed_by UUID,
    ip_address  INET,
    user_agent  VARCHAR(500),
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_entity_type  ON audit_log (entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_performed_by ON audit_log (performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_created_at   ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action        ON audit_log (action);

package com.minimarket.audit.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record AuditLogResponse(
        UUID id,
        String entityType,
        UUID entityId,
        String action,
        String oldValue,
        String newValue,
        String reason,
        String performedByEmail,
        String ipAddress,
        LocalDateTime createdAt
) {}

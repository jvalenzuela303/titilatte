package com.minimarket.modules.alerts.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AlertHistoryResponse(
        UUID id,
        UUID ruleId,
        String ruleName,
        String type,
        String severity,
        String message,
        OffsetDateTime triggeredAt,
        boolean acknowledged,
        String acknowledgedByEmail,
        OffsetDateTime acknowledgedAt
) {}

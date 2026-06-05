package com.minimarket.modules.alerts.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AlertRuleResponse(
        UUID id,
        String name,
        String description,
        String type,
        BigDecimal thresholdValue,
        Integer thresholdMinutes,
        int checkIntervalMinutes,
        String recipientRole,
        boolean active,
        OffsetDateTime lastCheckedAt,
        OffsetDateTime lastTriggeredAt,
        OffsetDateTime createdAt
) {}

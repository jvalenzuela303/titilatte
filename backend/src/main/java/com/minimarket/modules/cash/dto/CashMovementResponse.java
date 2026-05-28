package com.minimarket.modules.cash.dto;

import com.minimarket.modules.cash.domain.CashMovementType;
import com.minimarket.modules.cash.domain.MovementCategory;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record CashMovementResponse(
        UUID id,
        UUID cashRegisterId,
        CashMovementType movementType,
        MovementCategory category,
        BigDecimal amount,
        String description,
        UUID referenceId,
        String referenceType,
        UUID createdBy,
        OffsetDateTime createdAt
) {}

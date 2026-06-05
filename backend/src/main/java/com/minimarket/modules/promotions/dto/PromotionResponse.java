package com.minimarket.modules.promotions.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record PromotionResponse(
        UUID id,
        String name,
        String description,
        String type,
        BigDecimal value,
        int minQuantity,
        Integer bonusQuantity,
        String appliesTo,
        UUID categoryId,
        String categoryName,
        OffsetDateTime startsAt,
        OffsetDateTime endsAt,
        boolean active,
        UUID branchId,
        List<UUID> productIds,
        OffsetDateTime createdAt
) {}

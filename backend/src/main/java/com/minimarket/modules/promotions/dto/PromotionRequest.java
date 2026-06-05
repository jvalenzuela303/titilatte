package com.minimarket.modules.promotions.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record PromotionRequest(
        @NotBlank String name,
        String description,
        @NotNull String type,
        BigDecimal value,
        int minQuantity,
        Integer bonusQuantity,
        @NotBlank String appliesTo,
        UUID categoryId,
        @NotNull OffsetDateTime startsAt,
        @NotNull OffsetDateTime endsAt,
        boolean active,
        UUID branchId,
        List<UUID> productIds
) {}

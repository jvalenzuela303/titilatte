package com.minimarket.modules.promotions.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record ApplyPromotionRequest(
        @NotNull UUID productId,
        @Min(1) int quantity,
        UUID branchId
) {}

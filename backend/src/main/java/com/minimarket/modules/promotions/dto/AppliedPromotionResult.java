package com.minimarket.modules.promotions.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record AppliedPromotionResult(
        UUID promotionId,
        String promotionName,
        String type,
        BigDecimal originalPrice,
        BigDecimal finalPrice,
        BigDecimal discountAmount,
        BigDecimal discountPercent,
        int effectiveQuantity,
        int bonusQuantity,
        String description
) {}

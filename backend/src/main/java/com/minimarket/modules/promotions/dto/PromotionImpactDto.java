package com.minimarket.modules.promotions.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record PromotionImpactDto(
        UUID promotionId,
        String promotionName,
        String type,
        long timesApplied,
        BigDecimal totalDiscountGiven
) {}

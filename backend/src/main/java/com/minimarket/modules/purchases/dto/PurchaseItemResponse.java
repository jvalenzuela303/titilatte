package com.minimarket.modules.purchases.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record PurchaseItemResponse(
        UUID id,
        UUID productId,
        String productName,
        BigDecimal quantity,
        BigDecimal unitCost,
        BigDecimal subtotal,
        BigDecimal previousCost,
        BigDecimal newAvgCost
) {}

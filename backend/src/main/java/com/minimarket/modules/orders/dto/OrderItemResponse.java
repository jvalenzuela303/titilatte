package com.minimarket.modules.orders.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record OrderItemResponse(
        UUID id,
        String productName,
        BigDecimal quantity,
        BigDecimal unitCost,
        BigDecimal lineTotal
) {}

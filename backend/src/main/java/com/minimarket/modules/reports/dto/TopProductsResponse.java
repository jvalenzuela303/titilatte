package com.minimarket.modules.reports.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record TopProductsResponse(
        int rank,
        UUID productId,
        String productName,
        BigDecimal totalQuantity,
        BigDecimal totalAmount
) {}

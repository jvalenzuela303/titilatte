package com.minimarket.modules.reports.dto;

import java.math.BigDecimal;

public record SalesByCategoryResponse(
        String categoryName,
        long saleCount,
        BigDecimal totalQuantity,
        BigDecimal totalAmount,
        BigDecimal totalProfit
) {}

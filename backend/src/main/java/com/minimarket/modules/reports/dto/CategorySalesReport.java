package com.minimarket.modules.reports.dto;

import java.math.BigDecimal;

public record CategorySalesReport(
        String categoryId,
        String categoryName,
        String familyId,
        String familyName,
        long totalUnits,
        BigDecimal totalAmount,
        BigDecimal totalDiscount,
        long productCount
) {}

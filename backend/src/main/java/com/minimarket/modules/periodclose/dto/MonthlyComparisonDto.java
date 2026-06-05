package com.minimarket.modules.periodclose.dto;

import java.math.BigDecimal;

public record MonthlyComparisonDto(
        int year,
        int month,
        String periodLabel,
        BigDecimal totalRevenue,
        BigDecimal totalProfit,
        BigDecimal profitMarginPct,
        int saleCount,
        boolean isClosed
) {}

package com.minimarket.modules.reports.dto;

import java.math.BigDecimal;

public record ProfitReportResponse(
        BigDecimal totalRevenue,
        BigDecimal totalCost,
        BigDecimal totalProfit,
        BigDecimal profitMargin
) {}

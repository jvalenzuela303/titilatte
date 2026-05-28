package com.minimarket.modules.reports.dto;

import java.math.BigDecimal;
import java.util.List;

public record SalesReportResponse(
        long totalSales,
        BigDecimal totalAmount,
        BigDecimal totalDiscount,
        List<DailySalesDto> dailyBreakdown
) {}

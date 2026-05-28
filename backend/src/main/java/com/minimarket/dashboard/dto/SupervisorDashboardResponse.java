package com.minimarket.dashboard.dto;

import java.math.BigDecimal;
import java.util.List;

public record SupervisorDashboardResponse(
        List<CashSummaryDto> openCashRegisters,
        List<SellerStatsDto> sellerStatsToday,
        int lowStockCount,
        BigDecimal salesToday,
        long saleCountToday,
        String dashboardType
) {
    public SupervisorDashboardResponse(
            List<CashSummaryDto> openCashRegisters,
            List<SellerStatsDto> sellerStatsToday,
            int lowStockCount,
            BigDecimal salesToday,
            long saleCountToday
    ) {
        this(openCashRegisters, sellerStatsToday, lowStockCount, salesToday, saleCountToday, "SUPERVISOR");
    }
}

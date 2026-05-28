package com.minimarket.dashboard.dto;

import java.math.BigDecimal;
import java.util.List;

public record AdminDashboardResponse(
        BigDecimal salesToday,
        long saleCountToday,
        BigDecimal profitToday,
        BigDecimal profitMarginToday,
        int lowStockCount,
        int debtorCount,
        BigDecimal totalDebt,
        List<DailySalesDto> last7Days,
        List<DailySalesDto> last30Days,
        String dashboardType
) {
    public AdminDashboardResponse(
            BigDecimal salesToday,
            long saleCountToday,
            BigDecimal profitToday,
            BigDecimal profitMarginToday,
            int lowStockCount,
            int debtorCount,
            BigDecimal totalDebt,
            List<DailySalesDto> last7Days,
            List<DailySalesDto> last30Days
    ) {
        this(salesToday, saleCountToday, profitToday, profitMarginToday,
                lowStockCount, debtorCount, totalDebt, last7Days, last30Days, "ADMIN");
    }
}

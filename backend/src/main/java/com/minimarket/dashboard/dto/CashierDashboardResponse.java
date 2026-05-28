package com.minimarket.dashboard.dto;

import java.math.BigDecimal;

public record CashierDashboardResponse(
        CashSummaryDto currentCash,
        BigDecimal myTotalSalesToday,
        long mySaleCountToday,
        BigDecimal myTotalCash,
        String dashboardType
) {
    public CashierDashboardResponse(
            CashSummaryDto currentCash,
            BigDecimal myTotalSalesToday,
            long mySaleCountToday,
            BigDecimal myTotalCash
    ) {
        this(currentCash, myTotalSalesToday, mySaleCountToday, myTotalCash, "CASHIER");
    }
}

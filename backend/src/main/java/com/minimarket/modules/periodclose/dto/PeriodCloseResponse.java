package com.minimarket.modules.periodclose.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record PeriodCloseResponse(
        UUID id,
        int periodYear,
        int periodMonth,
        String periodLabel,
        String status,
        UUID branchId,
        BigDecimal totalRevenue,
        BigDecimal totalCost,
        BigDecimal totalProfit,
        BigDecimal profitMarginPct,
        BigDecimal totalDiscountGiven,
        int saleCount,
        BigDecimal totalCreditSales,
        BigDecimal totalPaymentsReceived,
        BigDecimal outstandingReceivables,
        BigDecimal totalCashOpenings,
        BigDecimal totalPurchaseAmount,
        BigDecimal prevRevenue,
        BigDecimal prevProfit,
        BigDecimal revenueChangePct,
        String notes,
        OffsetDateTime closedAt,
        String closedByEmail,
        OffsetDateTime createdAt
) {

    private static final String[] MONTH_NAMES_ES = {
            "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    };

    public static String buildPeriodLabel(int year, int month) {
        if (month < 1 || month > 12) {
            return month + "/" + year;
        }
        return MONTH_NAMES_ES[month] + " " + year;
    }
}

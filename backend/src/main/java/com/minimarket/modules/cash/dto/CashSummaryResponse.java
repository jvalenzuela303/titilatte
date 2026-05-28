package com.minimarket.modules.cash.dto;

import com.minimarket.modules.cash.domain.CashStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record CashSummaryResponse(
        Long registerNumber,
        String cashierName,
        BigDecimal openingAmount,
        BigDecimal totalSales,
        BigDecimal totalIncome,
        BigDecimal totalExpense,
        BigDecimal expectedAmount,
        BigDecimal countedAmount,
        BigDecimal difference,
        CashStatus status,
        OffsetDateTime openedAt,
        OffsetDateTime closedAt
) {}

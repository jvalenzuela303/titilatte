package com.minimarket.dashboard.dto;

import com.minimarket.modules.cash.domain.CashStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record CashSummaryDto(
        UUID registerId,
        Long registerNumber,
        UUID cashierId,
        String cashierName,
        BigDecimal openingAmount,
        BigDecimal expectedAmount,
        CashStatus status,
        OffsetDateTime openedAt
) {}

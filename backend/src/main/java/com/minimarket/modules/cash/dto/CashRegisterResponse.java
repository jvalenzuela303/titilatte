package com.minimarket.modules.cash.dto;

import com.minimarket.modules.cash.domain.CashStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record CashRegisterResponse(
        UUID id,
        Long registerNumber,
        UUID cashierId,
        String cashierName,
        BigDecimal openingAmount,
        BigDecimal expectedClosingAmount,
        BigDecimal countedAmount,
        BigDecimal differenceAmount,
        CashStatus status,
        OffsetDateTime openedAt,
        OffsetDateTime closedAt,
        String notes,
        OffsetDateTime createdAt
) {}

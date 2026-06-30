package com.minimarket.modules.reports.dto;

import java.math.BigDecimal;

public record PaymentMethodSummary(
        String method,
        BigDecimal totalAmount,
        long transactionCount
) {}

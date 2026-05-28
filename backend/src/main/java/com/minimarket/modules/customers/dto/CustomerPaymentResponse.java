package com.minimarket.modules.customers.dto;

import com.minimarket.modules.sales.domain.PaymentMethod;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record CustomerPaymentResponse(
        UUID id,
        UUID customerId,
        BigDecimal amount,
        PaymentMethod paymentMethod,
        String notes,
        UUID cashRegisterId,
        UUID receivedBy,
        OffsetDateTime createdAt
) {}

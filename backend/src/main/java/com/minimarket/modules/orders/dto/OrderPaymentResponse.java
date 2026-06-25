package com.minimarket.modules.orders.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record OrderPaymentResponse(
        UUID id,
        UUID orderId,
        BigDecimal amount,
        String paymentMethod,
        String notes,
        String paidByEmail,
        OffsetDateTime paidAt,
        OffsetDateTime createdAt
) {}

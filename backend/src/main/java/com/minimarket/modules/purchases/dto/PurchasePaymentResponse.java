package com.minimarket.modules.purchases.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record PurchasePaymentResponse(
        UUID id,
        UUID purchaseId,
        BigDecimal amount,
        String paymentMethod,
        String notes,
        String paidByEmail,
        OffsetDateTime paidAt,
        OffsetDateTime createdAt
) {}

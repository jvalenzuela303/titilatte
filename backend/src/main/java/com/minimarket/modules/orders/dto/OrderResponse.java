package com.minimarket.modules.orders.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record OrderResponse(
        UUID id,
        Long orderNumber,
        UUID customerId,
        String customerName,
        String customerPhone,
        String description,
        BigDecimal totalAmount,
        BigDecimal amountPaid,
        BigDecimal pendingAmount,
        String status,
        String paymentStatus,
        LocalDate deliveryDate,
        String notes,
        String createdByEmail,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}

package com.minimarket.modules.sales.dto;

import com.minimarket.modules.sales.domain.PaymentMethod;
import com.minimarket.modules.sales.domain.SaleStatus;
import com.minimarket.modules.sales.domain.SaleType;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record SaleResponse(
        UUID id,
        Long saleNumber,
        SaleType type,
        SaleStatus status,
        BigDecimal totalAmount,
        BigDecimal discountAmount,
        BigDecimal taxAmount,
        BigDecimal netAmount,
        SellerDto seller,
        UUID customerId,
        String notes,
        String cancellationReason,
        OffsetDateTime cancelledAt,
        List<SaleDetailDto> details,
        List<PaymentDto> payments,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public record SellerDto(UUID id, String email, String firstName, String lastName) {}

    public record SaleDetailDto(
            UUID id,
            UUID productId,
            String productName,
            String productBarcode,
            BigDecimal quantity,
            BigDecimal unitPrice,
            BigDecimal discount,
            BigDecimal subtotal,
            BigDecimal taxRate,
            BigDecimal taxAmount
    ) {}

    public record PaymentDto(
            UUID id,
            PaymentMethod method,
            BigDecimal amount,
            BigDecimal changeAmount,
            String reference,
            OffsetDateTime createdAt
    ) {}
}

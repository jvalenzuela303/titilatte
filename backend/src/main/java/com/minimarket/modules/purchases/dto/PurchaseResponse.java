package com.minimarket.modules.purchases.dto;

import com.minimarket.modules.purchases.domain.DocumentType;
import com.minimarket.modules.purchases.domain.PurchaseStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record PurchaseResponse(
        UUID id,
        Long purchaseNumber,
        String supplierName,
        DocumentType documentType,
        String documentNumber,
        BigDecimal totalAmount,
        PurchaseStatus status,
        String notes,
        String purchasedByEmail,
        OffsetDateTime purchaseDate,
        OffsetDateTime createdAt,
        List<PurchaseItemResponse> items
) {}

package com.minimarket.modules.purchases.dto;

import com.minimarket.modules.purchases.domain.DocumentType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record CreatePurchaseRequest(
        UUID supplierId,
        @NotNull DocumentType documentType,
        String documentNumber,
        @NotEmpty @Valid List<PurchaseItemRequest> items,
        String notes,
        OffsetDateTime purchaseDate
) {}

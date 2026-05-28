package com.minimarket.modules.stock.dto;

import com.minimarket.modules.stock.domain.MovementType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record StockAdjustmentRequest(
        @NotNull(message = "Product ID is required")
        UUID productId,

        @NotNull(message = "Movement type is required")
        MovementType movementType,

        @NotNull(message = "Quantity is required")
        BigDecimal quantity,

        @NotBlank(message = "Notes are required for stock adjustments")
        String notes
) {}

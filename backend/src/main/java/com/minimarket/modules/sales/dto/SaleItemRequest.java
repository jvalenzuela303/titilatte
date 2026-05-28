package com.minimarket.modules.sales.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record SaleItemRequest(
        @NotNull(message = "Product ID is required")
        UUID productId,

        @NotNull @DecimalMin(value = "0.0001", message = "Quantity must be greater than 0")
        BigDecimal quantity,

        @DecimalMin(value = "0.0", message = "Discount must be >= 0")
        BigDecimal discount
) {}

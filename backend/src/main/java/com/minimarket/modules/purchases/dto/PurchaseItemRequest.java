package com.minimarket.modules.purchases.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record PurchaseItemRequest(
        @NotNull UUID productId,
        @NotNull
        @DecimalMin(value = "0.001", message = "Quantity must be greater than 0")
        @DecimalMax(value = "99999.999", message = "Quantity cannot exceed 99,999.999 units per line")
        BigDecimal quantity,
        @NotNull
        @DecimalMin(value = "0.0001", message = "Unit cost must be greater than 0")
        @DecimalMax(value = "9999999.9999", message = "Unit cost cannot exceed 9,999,999.9999")
        BigDecimal unitCost
) {}

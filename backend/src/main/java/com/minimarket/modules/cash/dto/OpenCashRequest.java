package com.minimarket.modules.cash.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record OpenCashRequest(
        @NotNull @DecimalMin(value = "0.0", message = "Opening amount cannot be negative") BigDecimal openingAmount,
        String notes
) {}

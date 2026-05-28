package com.minimarket.modules.cash.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record CloseCashRequest(
        @NotNull @DecimalMin(value = "0.0", message = "Counted amount cannot be negative") BigDecimal countedAmount,
        String notes
) {}

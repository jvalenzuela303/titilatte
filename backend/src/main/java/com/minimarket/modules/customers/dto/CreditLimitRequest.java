package com.minimarket.modules.customers.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record CreditLimitRequest(
        @NotNull @DecimalMin(value = "0.0", message = "Credit limit cannot be negative") BigDecimal newLimit,
        @NotBlank String reason
) {}

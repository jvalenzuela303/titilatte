package com.minimarket.modules.cash.dto;

import com.minimarket.modules.cash.domain.CashMovementType;
import com.minimarket.modules.cash.domain.MovementCategory;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record CashMovementRequest(
        @NotNull CashMovementType movementType,
        MovementCategory category,
        @NotNull @DecimalMin(value = "0.01", message = "Amount must be greater than 0") BigDecimal amount,
        @NotBlank String description
) {}

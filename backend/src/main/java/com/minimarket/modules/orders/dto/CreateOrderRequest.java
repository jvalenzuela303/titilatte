package com.minimarket.modules.orders.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record CreateOrderRequest(
        @NotBlank String customerName,
        String customerPhone,
        UUID customerId,
        @NotBlank String description,
        @NotNull @DecimalMin("0.01") BigDecimal totalAmount,
        @NotNull LocalDate deliveryDate,
        String notes
) {}

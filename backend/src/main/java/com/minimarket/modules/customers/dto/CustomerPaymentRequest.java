package com.minimarket.modules.customers.dto;

import com.minimarket.modules.sales.domain.PaymentMethod;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record CustomerPaymentRequest(
        @NotNull @DecimalMin(value = "0.01", message = "Amount must be greater than 0") BigDecimal amount,
        @NotNull PaymentMethod paymentMethod,
        String notes,
        UUID cashRegisterId
) {}

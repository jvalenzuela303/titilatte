package com.minimarket.modules.sales.dto;

import com.minimarket.modules.sales.domain.PaymentMethod;
import com.minimarket.modules.sales.domain.SaleType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CreateSaleRequest(
        @NotNull(message = "Sale type is required")
        SaleType type,

        @NotEmpty(message = "Sale must have at least one item")
        @Valid
        List<SaleItemRequest> items,

        @NotNull(message = "Payment method is required")
        PaymentMethod paymentMethod,

        @NotNull @DecimalMin(value = "0.01", message = "Payment amount must be greater than 0")
        BigDecimal paymentAmount,

        @DecimalMin(value = "0.0", message = "Change amount must be >= 0")
        BigDecimal changeAmount,

        String paymentReference,

        UUID customerId,

        String notes
) {}

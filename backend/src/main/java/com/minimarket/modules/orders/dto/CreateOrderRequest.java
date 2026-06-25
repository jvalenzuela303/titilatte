package com.minimarket.modules.orders.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record CreateOrderRequest(
        @NotBlank String customerName,
        String customerPhone,
        UUID customerId,
        @NotNull @Size(min = 1, message = "El pedido debe tener al menos un producto") List<@Valid OrderItemRequest> items,
        @NotNull OffsetDateTime deliveryDate,
        String notes
) {}

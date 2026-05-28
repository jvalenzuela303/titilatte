package com.minimarket.modules.stock.dto;

import com.minimarket.modules.stock.domain.MovementType;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record StockMovementResponse(
        UUID id,
        ProductDto product,
        MovementType movementType,
        BigDecimal quantity,
        BigDecimal quantityBefore,
        BigDecimal quantityAfter,
        UUID referenceId,
        String referenceType,
        UserDto authorizedBy,
        String notes,
        UserDto createdBy,
        OffsetDateTime createdAt
) {
    public record ProductDto(UUID id, String barcode, String name, BigDecimal stockCurrent) {}
    public record UserDto(UUID id, String email, String firstName, String lastName) {}
}

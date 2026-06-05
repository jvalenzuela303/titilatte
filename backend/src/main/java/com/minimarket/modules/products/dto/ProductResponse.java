package com.minimarket.modules.products.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record ProductResponse(
        UUID id,
        String barcode,
        String name,
        String description,
        BigDecimal purchasePrice,
        BigDecimal salePrice,
        BigDecimal stockCurrent,
        BigDecimal stockMinimum,
        BigDecimal stockMaximum,
        boolean active,
        boolean trackStock,
        CategoryDto category,
        TaxDto tax,
        UnitDto unit,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public record CategoryDto(UUID id, String code, String name) {}
    public record TaxDto(UUID id, String code, String name, BigDecimal rate) {}
    public record UnitDto(UUID id, String code, String name, String abbreviation) {}
}

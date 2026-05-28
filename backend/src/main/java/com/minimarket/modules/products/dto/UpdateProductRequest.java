package com.minimarket.modules.products.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record UpdateProductRequest(
        @Size(max = 50) String barcode,

        @Size(max = 255) String name,

        String description,

        @DecimalMin(value = "0.0", message = "Purchase price must be >= 0")
        BigDecimal purchasePrice,

        @DecimalMin(value = "0.0", message = "Sale price must be >= 0")
        BigDecimal salePrice,

        @DecimalMin(value = "0.0", message = "Stock minimum must be >= 0")
        BigDecimal stockMinimum,

        @DecimalMin(value = "0.0", message = "Stock maximum must be >= 0")
        BigDecimal stockMaximum,

        Boolean active,

        UUID categoryId,

        UUID taxId,

        UUID unitId
) {}

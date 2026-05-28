package com.minimarket.modules.products.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.UUID;

public record CreateProductRequest(
        @NotBlank @Size(max = 50, message = "Barcode must not exceed 50 characters")
        String barcode,

        @NotBlank @Size(max = 255, message = "Name must not exceed 255 characters")
        String name,

        String description,

        @NotNull @DecimalMin(value = "0.0", message = "Purchase price must be >= 0")
        BigDecimal purchasePrice,

        @NotNull @DecimalMin(value = "0.0", message = "Sale price must be >= 0")
        BigDecimal salePrice,

        @DecimalMin(value = "0.0", message = "Stock minimum must be >= 0")
        BigDecimal stockMinimum,

        @DecimalMin(value = "0.0", message = "Stock maximum must be >= 0")
        BigDecimal stockMaximum,

        @NotNull(message = "Category ID is required")
        UUID categoryId,

        @NotNull(message = "Tax ID is required")
        UUID taxId,

        @NotNull(message = "Unit ID is required")
        UUID unitId
) {}

package com.minimarket.modules.purchases.dto;

import jakarta.validation.constraints.NotBlank;

public record SupplierRequest(
        @NotBlank String name,
        String rut,
        String contactName,
        String phone,
        String email,
        String address
) {}

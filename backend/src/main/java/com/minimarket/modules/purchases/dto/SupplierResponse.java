package com.minimarket.modules.purchases.dto;

import java.util.UUID;

public record SupplierResponse(
        UUID id,
        String name,
        String rut,
        String contactName,
        String phone,
        String email,
        String address,
        boolean active
) {}

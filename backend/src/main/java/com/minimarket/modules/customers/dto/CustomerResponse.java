package com.minimarket.modules.customers.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record CustomerResponse(
        UUID id,
        String firstName,
        String lastName,
        String fullName,
        String rut,
        String phone,
        String email,
        String address,
        BigDecimal creditLimit,
        BigDecimal creditUsed,
        BigDecimal availableCredit,
        boolean active,
        OffsetDateTime createdAt
) {}

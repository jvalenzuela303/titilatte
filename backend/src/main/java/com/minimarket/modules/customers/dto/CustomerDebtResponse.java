package com.minimarket.modules.customers.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record CustomerDebtResponse(
        UUID customerId,
        String fullName,
        String rut,
        BigDecimal creditLimit,
        BigDecimal creditUsed,
        BigDecimal available,
        OffsetDateTime lastPaymentDate
) {}

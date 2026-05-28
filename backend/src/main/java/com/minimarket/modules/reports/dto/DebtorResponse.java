package com.minimarket.modules.reports.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record DebtorResponse(
        UUID customerId,
        String fullName,
        String rut,
        BigDecimal creditLimit,
        BigDecimal creditUsed,
        BigDecimal available
) {}

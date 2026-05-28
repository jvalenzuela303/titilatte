package com.minimarket.audit.dto;

import java.time.LocalDate;

public record AuditFilterRequest(
        String entityType,
        String action,
        LocalDate startDate,
        LocalDate endDate
) {}

package com.minimarket.modules.periodclose.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record PeriodCloseRequest(
        @NotNull @Min(2000) @Max(2100) int year,
        @NotNull @Min(1) @Max(12) int month,
        UUID branchId,
        String notes
) {}

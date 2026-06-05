package com.minimarket.modules.alerts.dto;

import com.minimarket.modules.alerts.domain.AlertType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record AlertRuleRequest(
        @NotBlank String name,
        String description,
        @NotNull AlertType type,
        BigDecimal thresholdValue,
        Integer thresholdMinutes,
        @Min(1) int checkIntervalMinutes,
        @NotBlank String recipientRole,
        boolean active
) {

    /**
     * Validates that:
     * - CASH_OPEN_TOO_LONG rules must have thresholdMinutes
     * - All other rules must have thresholdValue
     */
    public boolean isThresholdValid() {
        if (type == null) {
            return true; // let @NotNull on type handle that
        }
        if (type == AlertType.CASH_OPEN_TOO_LONG) {
            return thresholdMinutes != null && thresholdMinutes > 0;
        }
        return thresholdValue != null && thresholdValue.compareTo(BigDecimal.ZERO) > 0;
    }
}

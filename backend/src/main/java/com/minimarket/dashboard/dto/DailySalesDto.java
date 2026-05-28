package com.minimarket.dashboard.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record DailySalesDto(
        LocalDate date,
        long saleCount,
        BigDecimal totalAmount
) {}

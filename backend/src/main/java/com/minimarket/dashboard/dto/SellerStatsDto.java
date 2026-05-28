package com.minimarket.dashboard.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record SellerStatsDto(
        UUID sellerId,
        String sellerEmail,
        long saleCount,
        BigDecimal totalAmount
) {}

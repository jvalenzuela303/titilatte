package com.minimarket.modules.reports.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record SalesBySellerResponse(
        UUID sellerId,
        String sellerEmail,
        long saleCount,
        BigDecimal totalAmount
) {}

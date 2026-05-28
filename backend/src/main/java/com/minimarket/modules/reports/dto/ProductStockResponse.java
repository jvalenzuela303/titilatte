package com.minimarket.modules.reports.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record ProductStockResponse(
        UUID productId,
        String barcode,
        String productName,
        String categoryName,
        BigDecimal stockCurrent,
        BigDecimal stockMinimum,
        BigDecimal stockMaximum
) {}

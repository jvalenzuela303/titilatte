package com.minimarket.modules.reports.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record CategorySalesReportResponse(
        LocalDate startDate,
        LocalDate endDate,
        BigDecimal grandTotal,
        List<CategorySalesReport> categories
) {}

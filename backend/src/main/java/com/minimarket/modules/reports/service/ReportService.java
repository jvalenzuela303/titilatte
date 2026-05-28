package com.minimarket.modules.reports.service;

import com.minimarket.modules.reports.dto.*;

import java.time.LocalDate;
import java.util.List;

public interface ReportService {

    SalesReportResponse getSalesReport(LocalDate start, LocalDate end);

    List<SalesBySellerResponse> getSalesBySeller(LocalDate start, LocalDate end);

    List<SalesByCategoryResponse> getSalesByCategory(LocalDate start, LocalDate end);

    List<TopProductsResponse> getTopProducts(LocalDate start, LocalDate end, int limit);

    ProfitReportResponse getProfitReport(LocalDate start, LocalDate end);

    List<DebtorResponse> getDebtors();

    List<ProductStockResponse> getCriticalStock();
}

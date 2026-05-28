package com.minimarket.modules.reports.controller;

import com.minimarket.modules.reports.dto.*;
import com.minimarket.modules.reports.service.ExcelExportService;
import com.minimarket.modules.reports.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.springframework.format.annotation.DateTimeFormat.ISO.DATE;

@RestController
@RequestMapping("/reports")
@RequiredArgsConstructor
@Tag(name = "Reports", description = "Reportes operacionales y financieros")
public class ReportController {

    private final ReportService reportService;
    private final ExcelExportService excelExportService;

    @GetMapping("/sales")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Operation(summary = "Reporte de ventas en rango de fechas")
    public ResponseEntity<SalesReportResponse> getSalesReport(
            @RequestParam @DateTimeFormat(iso = DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DATE) LocalDate endDate) {
        return ResponseEntity.ok(reportService.getSalesReport(startDate, endDate));
    }

    @GetMapping("/sales/by-seller")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Operation(summary = "Ventas agrupadas por vendedor")
    public ResponseEntity<List<SalesBySellerResponse>> getBySeller(
            @RequestParam @DateTimeFormat(iso = DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DATE) LocalDate endDate) {
        return ResponseEntity.ok(reportService.getSalesBySeller(startDate, endDate));
    }

    @GetMapping("/sales/by-category")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Operation(summary = "Ventas agrupadas por categoría de producto")
    public ResponseEntity<List<SalesByCategoryResponse>> getByCategory(
            @RequestParam @DateTimeFormat(iso = DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DATE) LocalDate endDate) {
        return ResponseEntity.ok(reportService.getSalesByCategory(startDate, endDate));
    }

    @GetMapping("/top-products")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Operation(summary = "Top N productos más vendidos por volumen")
    public ResponseEntity<List<TopProductsResponse>> getTopProducts(
            @RequestParam @DateTimeFormat(iso = DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DATE) LocalDate endDate,
            @RequestParam(defaultValue = "10") int limit) {
        // SECURITY: clamp limit to prevent resource exhaustion via large LIMIT in native query
        int safeLimit = Math.max(1, Math.min(limit, 100));
        return ResponseEntity.ok(reportService.getTopProducts(startDate, endDate, safeLimit));
    }

    @GetMapping("/profit")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Operation(summary = "Reporte de rentabilidad: ingresos, costos y margen")
    public ResponseEntity<ProfitReportResponse> getProfitReport(
            @RequestParam @DateTimeFormat(iso = DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DATE) LocalDate endDate) {
        return ResponseEntity.ok(reportService.getProfitReport(startDate, endDate));
    }

    @GetMapping("/debtors")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Operation(summary = "Clientes con saldo de crédito pendiente")
    public ResponseEntity<List<DebtorResponse>> getDebtors() {
        return ResponseEntity.ok(reportService.getDebtors());
    }

    @GetMapping("/stock-critical")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR','BODEGA')")
    @Operation(summary = "Productos con stock en o por debajo del mínimo")
    public ResponseEntity<List<ProductStockResponse>> getStockCritical() {
        return ResponseEntity.ok(reportService.getCriticalStock());
    }

    @GetMapping("/export/excel")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Operation(summary = "Exportar reporte a Excel (reportType: sales | debtors | profit)")
    public ResponseEntity<byte[]> exportExcel(
            @RequestParam String reportType,
            @RequestParam(required = false) @DateTimeFormat(iso = DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DATE) LocalDate endDate) {

        LocalDate start = startDate != null ? startDate : LocalDate.now().withDayOfMonth(1);
        LocalDate end = endDate != null ? endDate : LocalDate.now();

        // SECURITY: prevent DoS via unreasonably large date ranges.
        // A 366-day window is sufficient for any annual report; larger ranges can exhaust
        // DB I/O and generate multi-MB files that stall the thread pool.
        if (ChronoUnit.DAYS.between(start, end) > 366) {
            throw new com.minimarket.exception.BusinessException(
                    "Date range cannot exceed 366 days for export.");
        }
        if (end.isBefore(start)) {
            throw new com.minimarket.exception.BusinessException(
                    "endDate must be on or after startDate.");
        }

        String dateTag = DateTimeFormatter.ofPattern("yyyyMMdd").format(LocalDate.now());
        byte[] content;
        String filename;

        switch (reportType.toLowerCase()) {
            case "sales" -> {
                SalesReportResponse report = reportService.getSalesReport(start, end);
                content = excelExportService.generateSalesExcel(report, start, end);
                filename = "ventas_" + dateTag + ".xlsx";
            }
            case "debtors" -> {
                List<DebtorResponse> debtors = reportService.getDebtors();
                content = excelExportService.generateDebtorsExcel(debtors);
                filename = "deudores_" + dateTag + ".xlsx";
            }
            case "profit" -> {
                // For profit, generate sales report data and export similarly
                SalesReportResponse salesData = reportService.getSalesReport(start, end);
                content = excelExportService.generateSalesExcel(salesData, start, end);
                filename = "rentabilidad_" + dateTag + ".xlsx";
            }
            default -> throw new com.minimarket.exception.BusinessException(
                    "Unknown reportType '" + reportType + "'. Valid values: sales, debtors, profit");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        headers.setContentLength(content.length);

        return ResponseEntity.ok().headers(headers).body(content);
    }
}

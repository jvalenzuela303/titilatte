package com.minimarket.modules.reports;

import com.minimarket.modules.reports.dto.DailySalesDto;
import com.minimarket.modules.reports.dto.DebtorResponse;
import com.minimarket.modules.reports.dto.SalesReportResponse;
import com.minimarket.modules.reports.service.ExcelExportService;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link ExcelExportService}.
 *
 * <p>The service is a pure-function class with no Spring dependencies, so it
 * can be instantiated directly without mocking. Tests validate the byte output
 * by re-reading the workbook via Apache POI.
 */
@DisplayName("ExcelExportService - Unit Tests")
class ExcelExportServiceTest {

    private ExcelExportService excelExportService;

    // ── Fixtures ───────────────────────────────────────────────────────────────

    private SalesReportResponse salesReport;
    private List<DebtorResponse> debtors;

    @BeforeEach
    void setUp() {
        excelExportService = new ExcelExportService();

        salesReport = new SalesReportResponse(
                15L,
                new BigDecimal("750000.00"),
                new BigDecimal("25000.00"),
                List.of(
                        new DailySalesDto(LocalDate.of(2026, 5, 10), 5L, new BigDecimal("250000.00")),
                        new DailySalesDto(LocalDate.of(2026, 5, 11), 6L, new BigDecimal("300000.00")),
                        new DailySalesDto(LocalDate.of(2026, 5, 12), 4L, new BigDecimal("200000.00"))
                )
        );

        debtors = List.of(
                new DebtorResponse(
                        UUID.randomUUID(), "Ana López", "12.345.678-9",
                        new BigDecimal("100000"), new BigDecimal("40000"), new BigDecimal("60000")
                ),
                new DebtorResponse(
                        UUID.randomUUID(), "Juan Pérez", null,
                        new BigDecimal("50000"), new BigDecimal("15000"), new BigDecimal("35000")
                )
        );
    }

    // ── generateSalesExcel ─────────────────────────────────────────────────────

    @Test
    @DisplayName("generateSalesExcel_ShouldReturnNonEmptyBytes")
    void generateSalesExcel_ShouldReturnNonEmptyBytes() {
        // Act
        byte[] result = excelExportService.generateSalesExcel(
                salesReport,
                LocalDate.of(2026, 5, 10),
                LocalDate.of(2026, 5, 12)
        );

        // Assert
        assertThat(result).isNotNull().isNotEmpty();
    }

    @Test
    @DisplayName("generateSalesExcel_ShouldHaveCorrectSheetName")
    void generateSalesExcel_ShouldHaveCorrectSheetName() throws Exception {
        // Act
        byte[] result = excelExportService.generateSalesExcel(
                salesReport,
                LocalDate.of(2026, 5, 10),
                LocalDate.of(2026, 5, 12)
        );

        // Assert — parse the workbook and check the sheet name
        try (Workbook wb = new XSSFWorkbook(new ByteArrayInputStream(result))) {
            assertThat(wb.getNumberOfSheets()).isEqualTo(1);
            Sheet sheet = wb.getSheetAt(0);
            assertThat(sheet.getSheetName()).isEqualTo("Ventas");
        }
    }

    @Test
    @DisplayName("generateSalesExcel_ShouldContainAllDailyRows")
    void generateSalesExcel_ShouldContainAllDailyRows() throws Exception {
        // Act
        byte[] result = excelExportService.generateSalesExcel(
                salesReport,
                LocalDate.of(2026, 5, 10),
                LocalDate.of(2026, 5, 12)
        );

        // Assert — sheet must have enough rows for title + summary + headers + 3 daily rows + footer
        try (Workbook wb = new XSSFWorkbook(new ByteArrayInputStream(result))) {
            Sheet sheet = wb.getSheetAt(0);
            // title=row0, blank=row1, summary=rows2-4, blank=row5, headers=row6, data=rows7-9, footer=row10
            assertThat(sheet.getPhysicalNumberOfRows()).isGreaterThanOrEqualTo(8);
        }
    }

    @Test
    @DisplayName("generateSalesExcel_WhenEmptyBreakdown_ShouldReturnValidWorkbook")
    void generateSalesExcel_WhenEmptyBreakdown_ShouldReturnValidWorkbook() throws Exception {
        // Arrange — report with no daily breakdown
        SalesReportResponse emptyReport = new SalesReportResponse(
                0L, BigDecimal.ZERO, BigDecimal.ZERO, List.of()
        );

        // Act
        byte[] result = excelExportService.generateSalesExcel(
                emptyReport, LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31)
        );

        // Assert — must not throw; workbook is still readable
        try (Workbook wb = new XSSFWorkbook(new ByteArrayInputStream(result))) {
            assertThat(wb.getSheetAt(0).getSheetName()).isEqualTo("Ventas");
        }
    }

    // ── generateDebtorsExcel ───────────────────────────────────────────────────

    @Test
    @DisplayName("generateDebtorsExcel_ShouldHaveCorrectColumns")
    void generateDebtorsExcel_ShouldHaveCorrectColumns() throws Exception {
        // Act
        byte[] result = excelExportService.generateDebtorsExcel(debtors);

        // Assert — verify header row contains the expected column labels
        try (Workbook wb = new XSSFWorkbook(new ByteArrayInputStream(result))) {
            Sheet sheet = wb.getSheetAt(0);
            assertThat(sheet.getSheetName()).isEqualTo("Deudores");

            var headerRow = sheet.getRow(0);
            assertThat(headerRow).isNotNull();
            assertThat(headerRow.getCell(0).getStringCellValue()).isEqualTo("Nombre Completo");
            assertThat(headerRow.getCell(1).getStringCellValue()).isEqualTo("RUT");
            assertThat(headerRow.getCell(2).getStringCellValue()).isEqualTo("Límite Crédito ($)");
            assertThat(headerRow.getCell(3).getStringCellValue()).isEqualTo("Crédito Usado ($)");
            assertThat(headerRow.getCell(4).getStringCellValue()).isEqualTo("Disponible ($)");
        }
    }

    @Test
    @DisplayName("generateDebtorsExcel_ShouldContainCorrectDebtorData")
    void generateDebtorsExcel_ShouldContainCorrectDebtorData() throws Exception {
        // Act
        byte[] result = excelExportService.generateDebtorsExcel(debtors);

        // Assert — data rows start at index 1 (after header)
        try (Workbook wb = new XSSFWorkbook(new ByteArrayInputStream(result))) {
            Sheet sheet = wb.getSheetAt(0);
            // 2 debtors + 1 header
            assertThat(sheet.getPhysicalNumberOfRows()).isEqualTo(3);

            var firstDataRow = sheet.getRow(1);
            assertThat(firstDataRow.getCell(0).getStringCellValue()).isEqualTo("Ana López");
            assertThat(firstDataRow.getCell(1).getStringCellValue()).isEqualTo("12.345.678-9");
        }
    }

    @Test
    @DisplayName("generateDebtorsExcel_WhenNullRut_ShouldRenderEmptyString")
    void generateDebtorsExcel_WhenNullRut_ShouldRenderEmptyString() throws Exception {
        // Arrange — only the debtor with null RUT
        List<DebtorResponse> nullRutList = List.of(
                new DebtorResponse(UUID.randomUUID(), "Sin RUT", null,
                        new BigDecimal("20000"), new BigDecimal("5000"), new BigDecimal("15000"))
        );

        // Act
        byte[] result = excelExportService.generateDebtorsExcel(nullRutList);

        // Assert — RUT cell must be an empty string, not null or error
        try (Workbook wb = new XSSFWorkbook(new ByteArrayInputStream(result))) {
            Sheet sheet = wb.getSheetAt(0);
            var dataRow = sheet.getRow(1);
            assertThat(dataRow.getCell(1).getStringCellValue()).isEmpty();
        }
    }

    @Test
    @DisplayName("generateDebtorsExcel_ShouldReturnNonEmptyBytes")
    void generateDebtorsExcel_ShouldReturnNonEmptyBytes() {
        // Act
        byte[] result = excelExportService.generateDebtorsExcel(debtors);

        // Assert
        assertThat(result).isNotNull().isNotEmpty();
    }
}

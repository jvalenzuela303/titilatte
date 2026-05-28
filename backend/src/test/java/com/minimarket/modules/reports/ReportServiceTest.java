package com.minimarket.modules.reports;

import com.minimarket.modules.reports.dto.*;
import com.minimarket.modules.reports.service.ReportServiceImpl;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ReportService - Unit Tests")
class ReportServiceTest {

    @Mock private EntityManager entityManager;
    @Mock private Query mockQuery;

    @InjectMocks
    private ReportServiceImpl reportService;

    @BeforeEach
    void injectEntityManager() {
        // @PersistenceContext fields need manual injection in unit tests
        ReflectionTestUtils.setField(reportService, "em", entityManager);
    }

    // ── getSalesReport ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getSalesReport()")
    class GetSalesReport {

        @Test
        @DisplayName("getSalesReport_WhenValidDateRange_ShouldReturnReport")
        void getSalesReport_WhenValidDateRange_ShouldReturnReport() {
            // Arrange
            LocalDate start = LocalDate.of(2026, 5, 1);
            LocalDate end   = LocalDate.of(2026, 5, 31);

            // totals query returns: [count=10, totalAmount=500000, totalDiscount=5000]
            Object[] totalsRow = { 10L, new BigDecimal("500000.00"), new BigDecimal("5000.00") };

            // daily query returns one row for 2026-05-15
            Object[] dailyRow = { java.sql.Date.valueOf("2026-05-15"), 3L, new BigDecimal("150000.00") };

            when(entityManager.createNativeQuery(contains("COUNT(id)"))).thenReturn(mockQuery);
            when(entityManager.createNativeQuery(contains("DATE(created_at)"))).thenReturn(mockQuery);
            when(mockQuery.setParameter(anyString(), any())).thenReturn(mockQuery);
            when(mockQuery.getSingleResult()).thenReturn(totalsRow);
            when(mockQuery.getResultList()).thenReturn(List.of(dailyRow));

            // Act
            SalesReportResponse result = reportService.getSalesReport(start, end);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.totalSales()).isEqualTo(10L);
            assertThat(result.totalAmount()).isEqualByComparingTo(new BigDecimal("500000.00"));
            assertThat(result.totalDiscount()).isEqualByComparingTo(new BigDecimal("5000.00"));
            assertThat(result.dailyBreakdown()).hasSize(1);
            assertThat(result.dailyBreakdown().get(0).saleCount()).isEqualTo(3L);
        }

        @Test
        @DisplayName("getSalesReport_WhenNoSalesInRange_ShouldReturnZeroTotals")
        void getSalesReport_WhenNoSalesInRange_ShouldReturnZeroTotals() {
            // Arrange
            Object[] totalsRow = { 0L, new BigDecimal("0"), new BigDecimal("0") };

            when(entityManager.createNativeQuery(contains("COUNT(id)"))).thenReturn(mockQuery);
            when(entityManager.createNativeQuery(contains("DATE(created_at)"))).thenReturn(mockQuery);
            when(mockQuery.setParameter(anyString(), any())).thenReturn(mockQuery);
            when(mockQuery.getSingleResult()).thenReturn(totalsRow);
            when(mockQuery.getResultList()).thenReturn(List.of());

            // Act
            SalesReportResponse result = reportService.getSalesReport(
                    LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31));

            // Assert
            assertThat(result.totalSales()).isZero();
            assertThat(result.dailyBreakdown()).isEmpty();
        }
    }

    // ── getProfitReport ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getProfitReport()")
    class GetProfitReport {

        @Test
        @DisplayName("getProfitReport_ShouldCalculateMarginCorrectly")
        void getProfitReport_ShouldCalculateMarginCorrectly() {
            // Arrange — revenue=200000, cost=150000, profit=50000, margin=25%
            Object[] row = {
                new BigDecimal("200000"),
                new BigDecimal("150000")
            };

            when(entityManager.createNativeQuery(contains("revenue"))).thenReturn(mockQuery);
            when(mockQuery.setParameter(anyString(), any())).thenReturn(mockQuery);
            when(mockQuery.getSingleResult()).thenReturn(row);

            // Act
            ProfitReportResponse result = reportService.getProfitReport(
                    LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31));

            // Assert
            assertThat(result.totalRevenue()).isEqualByComparingTo(new BigDecimal("200000.00"));
            assertThat(result.totalCost()).isEqualByComparingTo(new BigDecimal("150000.00"));
            assertThat(result.totalProfit()).isEqualByComparingTo(new BigDecimal("50000.00"));
            // margin = (50000 / 200000) * 100 = 25.00
            assertThat(result.profitMargin()).isEqualByComparingTo(new BigDecimal("25.00"));
        }

        @Test
        @DisplayName("getProfitReport_WhenZeroRevenue_ShouldReturnZeroMargin")
        void getProfitReport_WhenZeroRevenue_ShouldReturnZeroMargin() {
            // Arrange — no sales yet, divison by zero must be guarded
            Object[] row = { new BigDecimal("0"), new BigDecimal("0") };

            when(entityManager.createNativeQuery(contains("revenue"))).thenReturn(mockQuery);
            when(mockQuery.setParameter(anyString(), any())).thenReturn(mockQuery);
            when(mockQuery.getSingleResult()).thenReturn(row);

            // Act
            ProfitReportResponse result = reportService.getProfitReport(
                    LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31));

            // Assert — margin must be 0, not NaN/exception
            assertThat(result.profitMargin()).isEqualByComparingTo(BigDecimal.ZERO);
        }
    }

    // ── getTopProducts ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getTopProducts()")
    class GetTopProducts {

        @Test
        @DisplayName("getTopProducts_WhenLimitProvided_ShouldRespectLimit")
        void getTopProducts_WhenLimitProvided_ShouldRespectLimit() {
            // Arrange — mock returns exactly 5 rows (limit requested = 5)
            UUID p1 = UUID.randomUUID();
            UUID p2 = UUID.randomUUID();
            UUID p3 = UUID.randomUUID();
            UUID p4 = UUID.randomUUID();
            UUID p5 = UUID.randomUUID();

            List<Object[]> rows = List.of(
                    new Object[]{ p1.toString(), "Arroz 1kg",    new BigDecimal("50"), new BigDecimal("60000") },
                    new Object[]{ p2.toString(), "Aceite 1L",    new BigDecimal("40"), new BigDecimal("48000") },
                    new Object[]{ p3.toString(), "Azucar 1kg",   new BigDecimal("30"), new BigDecimal("36000") },
                    new Object[]{ p4.toString(), "Fideos 500g",  new BigDecimal("20"), new BigDecimal("20000") },
                    new Object[]{ p5.toString(), "Sal 1kg",      new BigDecimal("15"), new BigDecimal("12000") }
            );

            when(entityManager.createNativeQuery(contains("LIMIT"))).thenReturn(mockQuery);
            when(mockQuery.setParameter(anyString(), any())).thenReturn(mockQuery);
            when(mockQuery.getResultList()).thenReturn(rows);

            // Act
            List<TopProductsResponse> result = reportService.getTopProducts(
                    LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31), 5);

            // Assert
            assertThat(result).hasSize(5);
            // Ranks are assigned sequentially starting at 1
            assertThat(result.get(0).rank()).isEqualTo(1);
            assertThat(result.get(4).rank()).isEqualTo(5);
            // Product names match
            assertThat(result.get(0).productName()).isEqualTo("Arroz 1kg");
        }
    }

    // ── getDebtors ─────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getDebtors()")
    class GetDebtors {

        @Test
        @DisplayName("getDebtors_ShouldReturnOnlyCustomersWithDebt")
        void getDebtors_ShouldReturnOnlyCustomersWithDebt() {
            // Arrange — two customers with credit_used > 0
            UUID c1 = UUID.randomUUID();
            UUID c2 = UUID.randomUUID();

            List<Object[]> rows = List.of(
                    new Object[]{ c1.toString(), "Ana López",  "12.345.678-9",
                            new BigDecimal("100000"), new BigDecimal("40000"), new BigDecimal("60000") },
                    new Object[]{ c2.toString(), "Juan Pérez", null,
                            new BigDecimal("50000"),  new BigDecimal("10000"), new BigDecimal("40000") }
            );

            when(entityManager.createNativeQuery(contains("credit_used > 0"))).thenReturn(mockQuery);
            when(mockQuery.getResultList()).thenReturn(rows);

            // Act
            List<DebtorResponse> result = reportService.getDebtors();

            // Assert
            assertThat(result).hasSize(2);
            assertThat(result.get(0).creditUsed()).isEqualByComparingTo(new BigDecimal("40000"));
            assertThat(result.get(1).rut()).isNull(); // customer without RUT
        }
    }
}

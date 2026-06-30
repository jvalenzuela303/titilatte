package com.minimarket.modules.reports.service;

import com.minimarket.modules.reports.dto.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
public class ReportServiceImpl implements ReportService {

    @PersistenceContext
    private EntityManager em;

    @Override
    @Transactional(readOnly = true)
    public SalesReportResponse getSalesReport(LocalDate start, LocalDate end) {
        Query totalQuery = em.createNativeQuery("""
                SELECT COUNT(id), COALESCE(SUM(total_amount), 0), COALESCE(SUM(discount_amount), 0)
                FROM sales
                WHERE status = 'CONFIRMED'
                  AND created_at >= :start AND created_at < :end
                """);
        totalQuery.setParameter("start", start.atStartOfDay());
        totalQuery.setParameter("end", end.plusDays(1).atStartOfDay());

        Object[] totals = (Object[]) totalQuery.getSingleResult();
        long totalSales = ((Number) totals[0]).longValue();
        BigDecimal totalAmount = new BigDecimal(totals[1].toString());
        BigDecimal totalDiscount = new BigDecimal(totals[2].toString());

        Query dailyQuery = em.createNativeQuery("""
                SELECT DATE(created_at), COUNT(id), COALESCE(SUM(total_amount), 0)
                FROM sales
                WHERE status = 'CONFIRMED'
                  AND created_at >= :start AND created_at < :end
                GROUP BY DATE(created_at)
                ORDER BY 1
                """);
        dailyQuery.setParameter("start", start.atStartOfDay());
        dailyQuery.setParameter("end", end.plusDays(1).atStartOfDay());

        @SuppressWarnings("unchecked")
        List<Object[]> dailyRows = dailyQuery.getResultList();
        List<DailySalesDto> dailyBreakdown = dailyRows.stream()
                .map(row -> new DailySalesDto(
                        toLocalDate(row[0]),
                        ((Number) row[1]).longValue(),
                        new BigDecimal(row[2].toString())
                ))
                .toList();

        Query paymentQuery = em.createNativeQuery("""
                SELECT p.method,
                       SUM(p.amount) AS total_amount,
                       COUNT(p.id) AS transaction_count
                FROM payments p
                JOIN sales s ON s.id = p.sale_id
                WHERE s.status = 'CONFIRMED'
                  AND s.created_at >= :start AND s.created_at < :end
                GROUP BY p.method
                ORDER BY total_amount DESC
                """);
        paymentQuery.setParameter("start", start.atStartOfDay());
        paymentQuery.setParameter("end", end.plusDays(1).atStartOfDay());

        @SuppressWarnings("unchecked")
        List<Object[]> paymentRows = paymentQuery.getResultList();
        List<PaymentMethodSummary> paymentMethodBreakdown = paymentRows.stream()
                .map(row -> new PaymentMethodSummary(
                        (String) row[0],
                        new BigDecimal(row[1].toString()),
                        ((Number) row[2]).longValue()
                ))
                .toList();

        return new SalesReportResponse(totalSales, totalAmount, totalDiscount, dailyBreakdown, paymentMethodBreakdown);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SalesBySellerResponse> getSalesBySeller(LocalDate start, LocalDate end) {
        Query query = em.createNativeQuery("""
                SELECT s.seller_id, u.email, COUNT(s.id), COALESCE(SUM(s.total_amount), 0)
                FROM sales s
                JOIN users u ON u.id = s.seller_id
                WHERE s.status = 'CONFIRMED'
                  AND s.created_at >= :start AND s.created_at < :end
                GROUP BY s.seller_id, u.email
                ORDER BY 3 DESC
                """);
        query.setParameter("start", start.atStartOfDay());
        query.setParameter("end", end.plusDays(1).atStartOfDay());

        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();
        return rows.stream()
                .map(row -> new SalesBySellerResponse(
                        UUID.fromString(row[0].toString()),
                        (String) row[1],
                        ((Number) row[2]).longValue(),
                        new BigDecimal(row[3].toString())
                ))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<SalesByCategoryResponse> getSalesByCategory(LocalDate start, LocalDate end) {
        Query query = em.createNativeQuery("""
                SELECT pc.name AS category_name,
                       COUNT(DISTINCT s.id),
                       COALESCE(SUM(sd.quantity), 0),
                       COALESCE(SUM(sd.subtotal), 0),
                       COALESCE(SUM(sd.subtotal - sd.quantity * p.purchase_price), 0)
                FROM sales s
                JOIN sale_details sd ON sd.sale_id = s.id
                JOIN products p ON p.id = sd.product_id
                JOIN product_categories pc ON pc.id = p.category_id
                WHERE s.status = 'CONFIRMED'
                  AND s.created_at >= :start AND s.created_at < :end
                GROUP BY pc.name
                ORDER BY 4 DESC
                """);
        query.setParameter("start", start.atStartOfDay());
        query.setParameter("end", end.plusDays(1).atStartOfDay());

        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();
        return rows.stream()
                .map(row -> new SalesByCategoryResponse(
                        (String) row[0],
                        ((Number) row[1]).longValue(),
                        new BigDecimal(row[2].toString()),
                        new BigDecimal(row[3].toString()),
                        new BigDecimal(row[4].toString())
                ))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public CategorySalesReportResponse getCategorySalesReport(LocalDate start, LocalDate end) {
        Query query = em.createNativeQuery("""
                SELECT pc.id AS category_id,
                       pc.name AS category_name,
                       pf.id AS family_id,
                       pf.name AS family_name,
                       COALESCE(SUM(sd.quantity), 0) AS total_units,
                       COALESCE(SUM(sd.subtotal), 0) AS total_amount,
                       COALESCE(SUM(sd.discount_amount), 0) AS total_discount,
                       COUNT(DISTINCT sd.product_id) AS product_count
                FROM sale_details sd
                JOIN products pr ON pr.id = sd.product_id
                JOIN product_categories pc ON pc.id = pr.category_id
                JOIN product_families pf ON pf.id = pc.family_id
                JOIN sales s ON s.id = sd.sale_id
                WHERE s.status = 'CONFIRMED'
                  AND s.created_at >= :start AND s.created_at < :end
                GROUP BY pc.id, pc.name, pf.id, pf.name
                ORDER BY total_amount DESC
                """);
        query.setParameter("start", start.atStartOfDay());
        query.setParameter("end", end.plusDays(1).atStartOfDay());

        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();
        List<CategorySalesReport> categories = rows.stream()
                .map(row -> new CategorySalesReport(
                        row[0].toString(),
                        (String) row[1],
                        row[2].toString(),
                        (String) row[3],
                        ((Number) row[4]).longValue(),
                        new BigDecimal(row[5].toString()),
                        new BigDecimal(row[6].toString()),
                        ((Number) row[7]).longValue()
                ))
                .toList();

        BigDecimal grandTotal = categories.stream()
                .map(CategorySalesReport::totalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new CategorySalesReportResponse(start, end, grandTotal, categories);
    }

    @Override
    @Transactional(readOnly = true)
    public List<TopProductsResponse> getTopProducts(LocalDate start, LocalDate end, int limit) {
        Query query = em.createNativeQuery("""
                SELECT p.id, p.name,
                       COALESCE(SUM(sd.quantity), 0),
                       COALESCE(SUM(sd.subtotal), 0)
                FROM sale_details sd
                JOIN products p ON p.id = sd.product_id
                JOIN sales s ON s.id = sd.sale_id
                WHERE s.status = 'CONFIRMED'
                  AND s.created_at >= :start AND s.created_at < :end
                GROUP BY p.id, p.name
                ORDER BY 3 DESC
                LIMIT :lim
                """);
        query.setParameter("start", start.atStartOfDay());
        query.setParameter("end", end.plusDays(1).atStartOfDay());
        query.setParameter("lim", limit);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();
        AtomicInteger rank = new AtomicInteger(1);
        return rows.stream()
                .map(row -> new TopProductsResponse(
                        rank.getAndIncrement(),
                        UUID.fromString(row[0].toString()),
                        (String) row[1],
                        new BigDecimal(row[2].toString()),
                        new BigDecimal(row[3].toString())
                ))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ProfitReportResponse getProfitReport(LocalDate start, LocalDate end) {
        Query query = em.createNativeQuery("""
                SELECT
                    COALESCE(SUM(sd.subtotal), 0) AS revenue,
                    COALESCE(SUM(sd.quantity * p.purchase_price), 0) AS cost
                FROM sale_details sd
                JOIN products p ON p.id = sd.product_id
                JOIN sales s ON s.id = sd.sale_id
                WHERE s.status = 'CONFIRMED'
                  AND s.created_at >= :start AND s.created_at < :end
                """);
        query.setParameter("start", start.atStartOfDay());
        query.setParameter("end", end.plusDays(1).atStartOfDay());

        Object[] row = (Object[]) query.getSingleResult();
        BigDecimal revenue = new BigDecimal(row[0].toString()).setScale(2, RoundingMode.HALF_UP);
        BigDecimal cost = new BigDecimal(row[1].toString()).setScale(2, RoundingMode.HALF_UP);
        BigDecimal profit = revenue.subtract(cost).setScale(2, RoundingMode.HALF_UP);
        BigDecimal margin = revenue.compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.ZERO
                : profit.divide(revenue, 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100))
                        .setScale(2, RoundingMode.HALF_UP);

        return new ProfitReportResponse(revenue, cost, profit, margin);
    }

    @Override
    @Transactional(readOnly = true)
    public List<DebtorResponse> getDebtors() {
        Query query = em.createNativeQuery("""
                SELECT c.id, c.first_name || ' ' || c.last_name, c.rut,
                       c.credit_limit, c.credit_used,
                       c.credit_limit - c.credit_used
                FROM customers c
                WHERE c.deleted_at IS NULL
                  AND c.credit_used > 0
                ORDER BY c.credit_used DESC
                """);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();
        return rows.stream()
                .map(row -> new DebtorResponse(
                        UUID.fromString(row[0].toString()),
                        (String) row[1],
                        row[2] != null ? (String) row[2] : null,
                        new BigDecimal(row[3].toString()),
                        new BigDecimal(row[4].toString()),
                        new BigDecimal(row[5].toString())
                ))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductStockResponse> getCriticalStock() {
        Query query = em.createNativeQuery("""
                SELECT p.id, p.barcode, p.name, pc.name, p.stock_current, p.stock_minimum, p.stock_maximum
                FROM products p
                JOIN product_categories pc ON pc.id = p.category_id
                WHERE p.deleted_at IS NULL
                  AND p.is_active = true
                  AND p.track_stock = true
                  AND p.stock_current <= p.stock_minimum
                ORDER BY (p.stock_current - p.stock_minimum) ASC
                """);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();
        return rows.stream()
                .map(row -> new ProductStockResponse(
                        UUID.fromString(row[0].toString()),
                        (String) row[1],
                        (String) row[2],
                        (String) row[3],
                        new BigDecimal(row[4].toString()),
                        new BigDecimal(row[5].toString()),
                        row[6] != null ? new BigDecimal(row[6].toString()) : null
                ))
                .toList();
    }

    // ---- helpers ----

    private LocalDate toLocalDate(Object sqlDate) {
        if (sqlDate instanceof Date d) return d.toLocalDate();
        if (sqlDate instanceof LocalDate ld) return ld;
        return LocalDate.parse(sqlDate.toString());
    }
}

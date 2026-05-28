package com.minimarket.dashboard.service;

import com.minimarket.dashboard.dto.*;
import com.minimarket.modules.cash.domain.CashRegister;
import com.minimarket.modules.cash.domain.CashMovementType;
import com.minimarket.modules.cash.domain.CashStatus;
import com.minimarket.modules.cash.repository.CashMovementRepository;
import com.minimarket.modules.cash.repository.CashRegisterRepository;
import com.minimarket.modules.users.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class DashboardServiceImpl implements DashboardService {

    @PersistenceContext
    private EntityManager em;

    private final CashRegisterRepository cashRegisterRepository;
    private final CashMovementRepository cashMovementRepository;
    private final UserRepository userRepository;

    @Override
    @Cacheable(value = "dashboard-kpis", key = "'admin-today'")
    @Transactional(readOnly = true)
    public AdminDashboardResponse getAdminDashboard() {
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);

        // Sales totals for today
        Object[] totals = (Object[]) em.createNativeQuery("""
                SELECT COUNT(id), COALESCE(SUM(total_amount), 0), COALESCE(SUM(net_amount), 0)
                FROM sales
                WHERE status = 'CONFIRMED'
                  AND created_at >= :start AND created_at < :end
                """)
                .setParameter("start", startOfDay)
                .setParameter("end", endOfDay)
                .getSingleResult();

        long saleCount = ((Number) totals[0]).longValue();
        BigDecimal revenue = (BigDecimal) totals[1];
        BigDecimal netAmount = (BigDecimal) totals[2];

        // Profit = total_amount - net_amount (net_amount excludes tax, so profit ≈ revenue - cost)
        // Re-query for cost-based profit
        // getSingleResult() with a single-column SUM returns a scalar, not Object[].
        BigDecimal totalCost = toBigDecimal(em.createNativeQuery("""
                SELECT COALESCE(SUM(sd.quantity * p.purchase_price), 0) AS total_cost
                FROM sale_details sd
                JOIN sales s ON sd.sale_id = s.id
                JOIN products p ON sd.product_id = p.id
                WHERE s.status = 'CONFIRMED'
                  AND s.created_at >= :start AND s.created_at < :end
                """)
                .setParameter("start", startOfDay)
                .setParameter("end", endOfDay)
                .getSingleResult());

        BigDecimal profit = revenue.subtract(totalCost);
        BigDecimal margin = revenue.compareTo(BigDecimal.ZERO) > 0
                ? profit.divide(revenue, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100"))
                : BigDecimal.ZERO;

        // Low stock count
        int lowStock = ((Number) em.createNativeQuery(
                "SELECT COUNT(*) FROM products WHERE is_active = true AND deleted_at IS NULL AND stock_current <= stock_minimum"
        ).getSingleResult()).intValue();

        // Debtors
        Object[] debtors = (Object[]) em.createNativeQuery(
                "SELECT COUNT(*), COALESCE(SUM(credit_used), 0) FROM customers WHERE credit_used > 0 AND deleted_at IS NULL AND is_active = true"
        ).getSingleResult();

        List<DailySalesDto> last7 = getLast7Days();
        List<DailySalesDto> last30 = getLast30Days();

        return new AdminDashboardResponse(
                revenue,
                saleCount,
                profit,
                margin,
                lowStock,
                ((Number) debtors[0]).intValue(),
                toBigDecimal(debtors[1]),
                last7,
                last30
        );
    }

    @Override
    @Cacheable(value = "dashboard-history", key = "'last-7-days'")
    @Transactional(readOnly = true)
    public List<DailySalesDto> getLast7Days() {
        return queryDailyHistory(7);
    }

    @Override
    @Cacheable(value = "dashboard-history", key = "'last-30-days'")
    @Transactional(readOnly = true)
    public List<DailySalesDto> getLast30Days() {
        return queryDailyHistory(30);
    }

    @Override
    @Transactional(readOnly = true)
    public SupervisorDashboardResponse getSupervisorDashboard() {
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);

        // Open cash registers — uses JPA derived query by status
        List<CashRegister> openRegisters = cashRegisterRepository
                .findAllByStatus(CashStatus.OPEN);

        List<CashSummaryDto> cashSummaries = openRegisters.stream()
                .map(cr -> {
                    String cashierName = userRepository.findById(cr.getCashierId())
                            .map(u -> u.getFirstName() + " " + u.getLastName())
                            .orElse(null);

                    BigDecimal expected = computeExpectedAmount(cr);

                    return new CashSummaryDto(
                            cr.getId(),
                            cr.getRegisterNumber(),
                            cr.getCashierId(),
                            cashierName,
                            cr.getOpeningAmount(),
                            expected,
                            cr.getStatus(),
                            cr.getOpenedAt()
                    );
                })
                .collect(Collectors.toList());

        // Seller stats today
        @SuppressWarnings("unchecked")
        List<Object[]> sellerRows = em.createNativeQuery("""
                SELECT u.id, u.email, COUNT(s.id), COALESCE(SUM(s.total_amount), 0)
                FROM sales s
                JOIN users u ON s.seller_id = u.id
                WHERE s.status = 'CONFIRMED'
                  AND s.created_at >= :start AND s.created_at < :end
                GROUP BY u.id, u.email
                ORDER BY SUM(s.total_amount) DESC
                """)
                .setParameter("start", startOfDay)
                .setParameter("end", endOfDay)
                .getResultList();

        List<SellerStatsDto> sellerStats = sellerRows.stream()
                .map(row -> new SellerStatsDto(
                        UUID.fromString(row[0].toString()),
                        (String) row[1],
                        ((Number) row[2]).longValue(),
                        toBigDecimal(row[3])
                ))
                .collect(Collectors.toList());

        // Low stock count
        int lowStock = ((Number) em.createNativeQuery(
                "SELECT COUNT(*) FROM products WHERE is_active = true AND deleted_at IS NULL AND stock_current <= stock_minimum"
        ).getSingleResult()).intValue();

        // Today totals
        Object[] totals = (Object[]) em.createNativeQuery("""
                SELECT COUNT(id), COALESCE(SUM(total_amount), 0)
                FROM sales WHERE status = 'CONFIRMED'
                AND created_at >= :start AND created_at < :end
                """)
                .setParameter("start", startOfDay)
                .setParameter("end", endOfDay)
                .getSingleResult();

        return new SupervisorDashboardResponse(
                cashSummaries,
                sellerStats,
                lowStock,
                toBigDecimal(totals[1]),
                ((Number) totals[0]).longValue()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public CashierDashboardResponse getCashierDashboard(UUID userId) {
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);

        // Current open cash register for this cashier (nullable)
        CashSummaryDto currentCash = cashRegisterRepository
                .findByCashierIdAndStatus(userId, CashStatus.OPEN)
                .map(cr -> {
                    String cashierName = userRepository.findById(cr.getCashierId())
                            .map(u -> u.getFirstName() + " " + u.getLastName())
                            .orElse(null);
                    BigDecimal expected = computeExpectedAmount(cr);
                    return new CashSummaryDto(
                            cr.getId(),
                            cr.getRegisterNumber(),
                            cr.getCashierId(),
                            cashierName,
                            cr.getOpeningAmount(),
                            expected,
                            cr.getStatus(),
                            cr.getOpenedAt()
                    );
                })
                .orElse(null);

        // My sales today
        Object[] saleTotals = (Object[]) em.createNativeQuery("""
                SELECT COUNT(id), COALESCE(SUM(total_amount), 0)
                FROM sales
                WHERE status = 'CONFIRMED'
                  AND seller_id = :userId
                  AND created_at >= :start AND created_at < :end
                """)
                .setParameter("userId", userId)
                .setParameter("start", startOfDay)
                .setParameter("end", endOfDay)
                .getSingleResult();

        BigDecimal myTotalSalesToday = toBigDecimal(saleTotals[1]);
        long mySaleCountToday = ((Number) saleTotals[0]).longValue();

        // My total cash in open register
        BigDecimal myTotalCash = currentCash != null ? currentCash.expectedAmount() : BigDecimal.ZERO;

        return new CashierDashboardResponse(
                currentCash,
                myTotalSalesToday,
                mySaleCountToday,
                myTotalCash
        );
    }

    @Override
    public Object getDashboardForCurrentUser(Authentication auth) {
        if (hasRole(auth, "ROLE_ADMIN")) return getAdminDashboard();
        if (hasRole(auth, "ROLE_SUPERVISOR")) return getSupervisorDashboard();

        // For CAJERO and BODEGA, resolve user id
        String email = ((UserDetails) auth.getPrincipal()).getUsername();
        UUID userId = userRepository.findByEmailAndDeletedAtIsNull(email)
                .orElseThrow(() -> new IllegalStateException("User not found: " + email))
                .getId();
        return getCashierDashboard(userId);
    }

    // ---- private helpers ----

    private List<DailySalesDto> queryDailyHistory(int days) {
        LocalDate today = LocalDate.now();
        LocalDateTime start = today.minusDays(days - 1L).atStartOfDay();
        LocalDateTime end = today.plusDays(1).atStartOfDay();

        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT DATE(created_at) AS sale_date, COUNT(id), COALESCE(SUM(total_amount), 0)
                FROM sales
                WHERE status = 'CONFIRMED'
                  AND created_at >= :start AND created_at < :end
                GROUP BY DATE(created_at)
                ORDER BY sale_date ASC
                """)
                .setParameter("start", start)
                .setParameter("end", end)
                .getResultList();

        return rows.stream()
                .map(row -> {
                    LocalDate date = toLocalDate(row[0]);
                    long count = ((Number) row[1]).longValue();
                    BigDecimal amount = toBigDecimal(row[2]);
                    return new DailySalesDto(date, count, amount);
                })
                .collect(Collectors.toList());
    }

    private BigDecimal computeExpectedAmount(CashRegister register) {
        var movements = cashMovementRepository.findAllByCashRegisterId(register.getId());

        BigDecimal income = movements.stream()
                .filter(m -> m.getMovementType() == CashMovementType.INGRESO
                        || m.getMovementType() == CashMovementType.VENTA
                        || m.getMovementType() == CashMovementType.PAGO_CREDITO)
                .map(m -> m.getAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal expense = movements.stream()
                .filter(m -> m.getMovementType() == CashMovementType.EGRESO)
                .map(m -> m.getAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return register.getOpeningAmount().add(income).subtract(expense);
    }

    private boolean hasRole(Authentication auth, String role) {
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(role::equals);
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) return BigDecimal.ZERO;
        if (value instanceof BigDecimal bd) return bd;
        if (value instanceof Number n) return new BigDecimal(n.toString());
        return new BigDecimal(value.toString());
    }

    private LocalDate toLocalDate(Object value) {
        if (value instanceof Date sqlDate) return sqlDate.toLocalDate();
        if (value instanceof LocalDate ld) return ld;
        return LocalDate.parse(value.toString());
    }
}

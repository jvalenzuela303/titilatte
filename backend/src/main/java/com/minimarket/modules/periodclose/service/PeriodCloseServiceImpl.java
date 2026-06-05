package com.minimarket.modules.periodclose.service;

import com.minimarket.exception.BusinessException;
import com.minimarket.exception.EntityNotFoundException;
import com.minimarket.modules.periodclose.domain.PeriodClose;
import com.minimarket.modules.periodclose.domain.PeriodCloseStatus;
import com.minimarket.modules.periodclose.dto.MonthlyComparisonDto;
import com.minimarket.modules.periodclose.dto.PeriodCloseRequest;
import com.minimarket.modules.periodclose.dto.PeriodCloseResponse;
import com.minimarket.modules.periodclose.repository.PeriodCloseRepository;
import com.minimarket.modules.users.domain.User;
import com.minimarket.modules.users.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class PeriodCloseServiceImpl implements PeriodCloseService {

    private final PeriodCloseRepository periodCloseRepository;
    private final UserRepository userRepository;

    @PersistenceContext
    private EntityManager entityManager;

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public PeriodCloseResponse preview(int year, int month, UUID branchId) {
        Aggregates agg = calculateAggregates(year, month, branchId);

        // Look up prior period data from existing closed period if available
        int[] prevPeriod = previousPeriod(year, month);
        Optional<PeriodClose> prevClose =
                periodCloseRepository.findByPeriodYearAndPeriodMonthAndBranchId(prevPeriod[0], prevPeriod[1], branchId);

        BigDecimal prevRevenue = prevClose.map(PeriodClose::getTotalRevenue).orElse(null);
        BigDecimal prevProfit = prevClose.map(PeriodClose::getTotalProfit).orElse(null);
        BigDecimal revenueChangePct = computeChangePct(agg.totalRevenue, prevRevenue);

        // Build a transient response (no entity persisted)
        PeriodClose transient_ = PeriodClose.builder()
                .periodYear(year)
                .periodMonth(month)
                .status(PeriodCloseStatus.DRAFT)
                .branchId(branchId)
                .totalRevenue(agg.totalRevenue)
                .totalCost(agg.totalCost)
                .totalProfit(agg.totalProfit)
                .profitMargin(computeProfitMargin(agg.totalRevenue, agg.totalProfit))
                .totalDiscountGiven(agg.totalDiscountGiven)
                .saleCount((int) agg.saleCount)
                .totalCreditSales(agg.totalCreditSales)
                .totalPaymentsReceived(agg.totalPaymentsReceived)
                .outstandingReceivables(agg.outstandingReceivables)
                .totalCashOpenings(agg.totalCashOpenings)
                .totalPurchaseAmount(agg.totalPurchaseAmount)
                .prevRevenue(prevRevenue)
                .prevProfit(prevProfit)
                .revenueChangePct(revenueChangePct)
                .build();

        return toResponse(transient_, null);
    }

    @Override
    public PeriodCloseResponse closePeriod(PeriodCloseRequest req, String closedByEmail) {
        // Guard: only one close per (year, month, branchId)
        periodCloseRepository
                .findByPeriodYearAndPeriodMonthAndBranchId(req.year(), req.month(), req.branchId())
                .ifPresent(existing -> {
                    throw new BusinessException(
                            "Period " + req.year() + "/" + req.month() + " is already closed (id: " + existing.getId() + ")");
                });

        User closer = userRepository.findByEmailAndDeletedAtIsNull(closedByEmail)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + closedByEmail));

        Aggregates agg = calculateAggregates(req.year(), req.month(), req.branchId());

        // Fetch previous period for comparison
        int[] prev = previousPeriod(req.year(), req.month());
        Optional<PeriodClose> prevClose =
                periodCloseRepository.findByPeriodYearAndPeriodMonthAndBranchId(prev[0], prev[1], req.branchId());

        BigDecimal prevRevenue = prevClose.map(PeriodClose::getTotalRevenue).orElse(null);
        BigDecimal prevProfit = prevClose.map(PeriodClose::getTotalProfit).orElse(null);
        BigDecimal revenueChangePct = computeChangePct(agg.totalRevenue, prevRevenue);
        BigDecimal profitMargin = computeProfitMargin(agg.totalRevenue, agg.totalProfit);

        PeriodClose entity = PeriodClose.builder()
                .periodYear(req.year())
                .periodMonth(req.month())
                .status(PeriodCloseStatus.CLOSED)
                .branchId(req.branchId())
                .totalRevenue(agg.totalRevenue)
                .totalCost(agg.totalCost)
                .totalProfit(agg.totalProfit)
                .profitMargin(profitMargin)
                .totalDiscountGiven(agg.totalDiscountGiven)
                .saleCount((int) agg.saleCount)
                .totalCreditSales(agg.totalCreditSales)
                .totalPaymentsReceived(agg.totalPaymentsReceived)
                .outstandingReceivables(agg.outstandingReceivables)
                .totalCashOpenings(agg.totalCashOpenings)
                .totalPurchaseAmount(agg.totalPurchaseAmount)
                .prevRevenue(prevRevenue)
                .prevProfit(prevProfit)
                .revenueChangePct(revenueChangePct)
                .notes(req.notes())
                .closedAt(OffsetDateTime.now(ZoneOffset.UTC))
                .closedBy(closer)
                .build();

        PeriodClose saved = periodCloseRepository.save(entity);
        log.info("Period {}/{} closed by {} (id: {})", req.year(), req.month(), closedByEmail, saved.getId());

        return toResponse(saved, closer.getEmail());
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PeriodCloseResponse> findAll(Pageable pageable) {
        return periodCloseRepository.findAllByOrderByPeriodYearDescPeriodMonthDesc(pageable)
                .map(pc -> toResponse(pc, pc.getClosedBy() != null ? pc.getClosedBy().getEmail() : null));
    }

    @Override
    @Transactional(readOnly = true)
    public PeriodCloseResponse findById(UUID id) {
        PeriodClose pc = periodCloseRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("PeriodClose", id));
        return toResponse(pc, pc.getClosedBy() != null ? pc.getClosedBy().getEmail() : null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MonthlyComparisonDto> getComparison(int lastNMonths, UUID branchId) {
        // Determine start year based on lastNMonths from today
        LocalDate today = LocalDate.now();
        LocalDate startDate = today.minusMonths(lastNMonths - 1L).withDayOfMonth(1);
        int startYear = startDate.getYear();

        List<PeriodClose> closedPeriods =
                periodCloseRepository.findByPeriodYearGreaterThanEqualOrderByPeriodYearAscPeriodMonthAsc(startYear);

        // Build a lookup map for quick access
        java.util.Map<String, PeriodClose> closedMap = new java.util.HashMap<>();
        for (PeriodClose pc : closedPeriods) {
            closedMap.put(pc.getPeriodYear() + "-" + pc.getPeriodMonth(), pc);
        }

        List<MonthlyComparisonDto> result = new ArrayList<>();
        LocalDate cursor = startDate;

        for (int i = 0; i < lastNMonths; i++) {
            int year = cursor.getYear();
            int month = cursor.getMonthValue();
            String key = year + "-" + month;

            PeriodClose pc = closedMap.get(key);
            if (pc != null) {
                BigDecimal marginPct = pc.getProfitMargin() != null
                        ? pc.getProfitMargin().multiply(BigDecimal.valueOf(100))
                        : BigDecimal.ZERO;
                result.add(new MonthlyComparisonDto(
                        year, month,
                        PeriodCloseResponse.buildPeriodLabel(year, month),
                        pc.getTotalRevenue(),
                        pc.getTotalProfit(),
                        marginPct,
                        pc.getSaleCount(),
                        pc.getStatus() == PeriodCloseStatus.CLOSED
                ));
            } else {
                // Month not yet closed — compute live aggregates
                try {
                    Aggregates agg = calculateAggregates(year, month, branchId);
                    BigDecimal marginPct = computeProfitMargin(agg.totalRevenue, agg.totalProfit)
                            .multiply(BigDecimal.valueOf(100));
                    result.add(new MonthlyComparisonDto(
                            year, month,
                            PeriodCloseResponse.buildPeriodLabel(year, month),
                            agg.totalRevenue,
                            agg.totalProfit,
                            marginPct,
                            (int) agg.saleCount,
                            false
                    ));
                } catch (Exception ex) {
                    log.warn("Could not compute aggregates for {}/{}: {}", year, month, ex.getMessage());
                    result.add(new MonthlyComparisonDto(
                            year, month,
                            PeriodCloseResponse.buildPeriodLabel(year, month),
                            BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 0, false
                    ));
                }
            }
            cursor = cursor.plusMonths(1);
        }

        return result;
    }

    @Override
    public byte[] exportExcel(UUID id) {
        log.warn("Excel export requested for period close {} but Apache POI is not configured", id);
        // Verify record exists before rejecting
        periodCloseRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("PeriodClose", id));
        throw new UnsupportedOperationException("Export requires Apache POI dependency");
    }

    // -------------------------------------------------------------------------
    // Aggregate computation — all via native queries through EntityManager
    // -------------------------------------------------------------------------

    @SuppressWarnings("unchecked")
    private Aggregates calculateAggregates(int year, int month, UUID branchId) {
        Aggregates agg = new Aggregates();

        // 1. Total revenue (confirmed sales)
        List<Object> r1 = entityManager.createNativeQuery(
                "SELECT COALESCE(SUM(total_amount), 0) FROM sales " +
                "WHERE status = 'CONFIRMED' " +
                "AND EXTRACT(YEAR  FROM created_at) = :year " +
                "AND EXTRACT(MONTH FROM created_at) = :month")
                .setParameter("year", year)
                .setParameter("month", month)
                .getResultList();
        agg.totalRevenue = toBigDecimal(r1.isEmpty() ? BigDecimal.ZERO : r1.get(0));

        // 2. Total cost (confirmed sales — total_cost column added in V13)
        List<Object> r2 = entityManager.createNativeQuery(
                "SELECT COALESCE(SUM(total_cost), 0) FROM sales " +
                "WHERE status = 'CONFIRMED' " +
                "AND EXTRACT(YEAR  FROM created_at) = :year " +
                "AND EXTRACT(MONTH FROM created_at) = :month")
                .setParameter("year", year)
                .setParameter("month", month)
                .getResultList();
        agg.totalCost = toBigDecimal(r2.isEmpty() ? BigDecimal.ZERO : r2.get(0));

        // 3. Total discount given
        List<Object> r3 = entityManager.createNativeQuery(
                "SELECT COALESCE(SUM(discount_amount), 0) FROM sales " +
                "WHERE status = 'CONFIRMED' " +
                "AND EXTRACT(YEAR  FROM created_at) = :year " +
                "AND EXTRACT(MONTH FROM created_at) = :month")
                .setParameter("year", year)
                .setParameter("month", month)
                .getResultList();
        agg.totalDiscountGiven = toBigDecimal(r3.isEmpty() ? BigDecimal.ZERO : r3.get(0));

        // 4. Sale count
        List<Object> r4 = entityManager.createNativeQuery(
                "SELECT COUNT(*) FROM sales " +
                "WHERE status = 'CONFIRMED' " +
                "AND EXTRACT(YEAR  FROM created_at) = :year " +
                "AND EXTRACT(MONTH FROM created_at) = :month")
                .setParameter("year", year)
                .setParameter("month", month)
                .getResultList();
        agg.saleCount = toLong(r4.isEmpty() ? 0L : r4.get(0));

        // 5. Total credit sales (type = 'CREDITO')
        List<Object> r5 = entityManager.createNativeQuery(
                "SELECT COALESCE(SUM(total_amount), 0) FROM sales " +
                "WHERE type = 'CREDITO' AND status = 'CONFIRMED' " +
                "AND EXTRACT(YEAR  FROM created_at) = :year " +
                "AND EXTRACT(MONTH FROM created_at) = :month")
                .setParameter("year", year)
                .setParameter("month", month)
                .getResultList();
        agg.totalCreditSales = toBigDecimal(r5.isEmpty() ? BigDecimal.ZERO : r5.get(0));

        // 6. Total payments received (customer_payments table)
        List<Object> r6 = entityManager.createNativeQuery(
                "SELECT COALESCE(SUM(amount), 0) FROM customer_payments " +
                "WHERE EXTRACT(YEAR  FROM created_at) = :year " +
                "AND EXTRACT(MONTH FROM created_at) = :month")
                .setParameter("year", year)
                .setParameter("month", month)
                .getResultList();
        agg.totalPaymentsReceived = toBigDecimal(r6.isEmpty() ? BigDecimal.ZERO : r6.get(0));

        // 7. Outstanding receivables (current snapshot of all active customers' credit_used)
        List<Object> r7 = entityManager.createNativeQuery(
                "SELECT COALESCE(SUM(credit_used), 0) FROM customers " +
                "WHERE is_active = true AND deleted_at IS NULL")
                .getResultList();
        agg.outstandingReceivables = toBigDecimal(r7.isEmpty() ? BigDecimal.ZERO : r7.get(0));

        // 8. Total cash openings
        List<Object> r8 = entityManager.createNativeQuery(
                "SELECT COALESCE(SUM(opening_amount), 0) FROM cash_registers " +
                "WHERE EXTRACT(YEAR  FROM opened_at) = :year " +
                "AND EXTRACT(MONTH FROM opened_at) = :month")
                .setParameter("year", year)
                .setParameter("month", month)
                .getResultList();
        agg.totalCashOpenings = toBigDecimal(r8.isEmpty() ? BigDecimal.ZERO : r8.get(0));

        // 9. Total purchase amount (confirmed purchases)
        List<Object> r9 = entityManager.createNativeQuery(
                "SELECT COALESCE(SUM(total_amount), 0) FROM purchases " +
                "WHERE status = 'CONFIRMED' " +
                "AND EXTRACT(YEAR  FROM purchase_date) = :year " +
                "AND EXTRACT(MONTH FROM purchase_date) = :month")
                .setParameter("year", year)
                .setParameter("month", month)
                .getResultList();
        agg.totalPurchaseAmount = toBigDecimal(r9.isEmpty() ? BigDecimal.ZERO : r9.get(0));

        // Derived: totalProfit
        agg.totalProfit = agg.totalRevenue.subtract(agg.totalCost)
                .max(BigDecimal.ZERO);

        return agg;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private static class Aggregates {
        BigDecimal totalRevenue = BigDecimal.ZERO;
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalProfit = BigDecimal.ZERO;
        BigDecimal totalDiscountGiven = BigDecimal.ZERO;
        long saleCount = 0L;
        BigDecimal totalCreditSales = BigDecimal.ZERO;
        BigDecimal totalPaymentsReceived = BigDecimal.ZERO;
        BigDecimal outstandingReceivables = BigDecimal.ZERO;
        BigDecimal totalCashOpenings = BigDecimal.ZERO;
        BigDecimal totalPurchaseAmount = BigDecimal.ZERO;
    }

    private BigDecimal computeProfitMargin(BigDecimal revenue, BigDecimal profit) {
        if (revenue == null || revenue.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return profit.divide(revenue, 4, RoundingMode.HALF_UP);
    }

    private BigDecimal computeChangePct(BigDecimal current, BigDecimal previous) {
        if (previous == null || previous.compareTo(BigDecimal.ZERO) == 0) {
            return null;
        }
        return current.subtract(previous)
                .divide(previous, 4, RoundingMode.HALF_UP);
    }

    private int[] previousPeriod(int year, int month) {
        if (month == 1) {
            return new int[]{year - 1, 12};
        }
        return new int[]{year, month - 1};
    }

    private PeriodCloseResponse toResponse(PeriodClose pc, String closedByEmail) {
        BigDecimal profitMarginPct = pc.getProfitMargin() != null
                ? pc.getProfitMargin().multiply(BigDecimal.valueOf(100))
                : BigDecimal.ZERO;

        return new PeriodCloseResponse(
                pc.getId(),
                pc.getPeriodYear(),
                pc.getPeriodMonth(),
                PeriodCloseResponse.buildPeriodLabel(pc.getPeriodYear(), pc.getPeriodMonth()),
                pc.getStatus() != null ? pc.getStatus().name() : null,
                pc.getBranchId(),
                pc.getTotalRevenue(),
                pc.getTotalCost(),
                pc.getTotalProfit(),
                profitMarginPct,
                pc.getTotalDiscountGiven(),
                pc.getSaleCount(),
                pc.getTotalCreditSales(),
                pc.getTotalPaymentsReceived(),
                pc.getOutstandingReceivables(),
                pc.getTotalCashOpenings(),
                pc.getTotalPurchaseAmount(),
                pc.getPrevRevenue(),
                pc.getPrevProfit(),
                pc.getRevenueChangePct(),
                pc.getNotes(),
                pc.getClosedAt(),
                closedByEmail,
                pc.getCreatedAt()
        );
    }

    private BigDecimal toBigDecimal(Object obj) {
        if (obj == null) return BigDecimal.ZERO;
        if (obj instanceof BigDecimal bd) return bd;
        if (obj instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        return new BigDecimal(obj.toString());
    }

    private long toLong(Object obj) {
        if (obj == null) return 0L;
        if (obj instanceof Long l) return l;
        if (obj instanceof Number n) return n.longValue();
        return Long.parseLong(obj.toString());
    }
}

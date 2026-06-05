package com.minimarket.modules.periodclose.domain;

import com.minimarket.modules.users.domain.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "period_closes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PeriodClose {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "period_year", nullable = false)
    private int periodYear;

    @Column(name = "period_month", nullable = false)
    private int periodMonth;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private PeriodCloseStatus status = PeriodCloseStatus.DRAFT;

    @Column(name = "branch_id")
    private UUID branchId;

    // Sales aggregates
    @Column(name = "total_revenue", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalRevenue = BigDecimal.ZERO;

    @Column(name = "total_cost", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalCost = BigDecimal.ZERO;

    @Column(name = "total_profit", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalProfit = BigDecimal.ZERO;

    @Column(name = "profit_margin", nullable = false, precision = 8, scale = 4)
    @Builder.Default
    private BigDecimal profitMargin = BigDecimal.ZERO;

    @Column(name = "total_discount_given", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalDiscountGiven = BigDecimal.ZERO;

    @Column(name = "sale_count", nullable = false)
    @Builder.Default
    private int saleCount = 0;

    // Credit and receivables
    @Column(name = "total_credit_sales", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalCreditSales = BigDecimal.ZERO;

    @Column(name = "total_payments_received", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalPaymentsReceived = BigDecimal.ZERO;

    @Column(name = "outstanding_receivables", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal outstandingReceivables = BigDecimal.ZERO;

    // Cash movements
    @Column(name = "total_cash_openings", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalCashOpenings = BigDecimal.ZERO;

    @Column(name = "total_cash_closings", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalCashClosings = BigDecimal.ZERO;

    @Column(name = "total_cash_difference", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalCashDifference = BigDecimal.ZERO;

    // Inventory
    @Column(name = "total_stock_adjustments", nullable = false)
    @Builder.Default
    private int totalStockAdjustments = 0;

    @Column(name = "total_purchase_amount", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalPurchaseAmount = BigDecimal.ZERO;

    // Prior period comparison (denormalized)
    @Column(name = "prev_revenue", precision = 15, scale = 2)
    private BigDecimal prevRevenue;

    @Column(name = "prev_profit", precision = 15, scale = 2)
    private BigDecimal prevProfit;

    @Column(name = "revenue_change_pct", precision = 8, scale = 4)
    private BigDecimal revenueChangePct;

    // Documents / metadata
    @Column(name = "summary_json", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String summaryJson;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    // Close audit
    @Column(name = "closed_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime closedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "closed_by")
    private User closedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime updatedAt;
}

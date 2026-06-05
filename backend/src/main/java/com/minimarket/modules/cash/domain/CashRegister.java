package com.minimarket.modules.cash.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.generator.EventType;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "cash_registers")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CashRegister {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Generated(event = EventType.INSERT)
    @Column(name = "register_number", insertable = false, updatable = false)
    private Long registerNumber;

    @Column(name = "cashier_id", nullable = false)
    private UUID cashierId;

    @Column(name = "branch_id", nullable = false)
    private UUID branchId;

    @Column(name = "opening_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal openingAmount;

    @Column(name = "expected_closing_amount", precision = 12, scale = 2)
    private BigDecimal expectedClosingAmount;

    @Column(name = "counted_amount", precision = 12, scale = 2)
    private BigDecimal countedAmount;

    // differenceAmount is GENERATED ALWAYS AS (...) STORED in DB — Hibernate must re-read after write
    @Generated(event = {EventType.INSERT, EventType.UPDATE})
    @Column(name = "difference_amount", insertable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal differenceAmount;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "cash_register_status")
    @Builder.Default
    private CashStatus status = CashStatus.OPEN;

    @Column(name = "opened_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime openedAt;

    @Column(name = "closed_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime closedAt;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime updatedAt;
}

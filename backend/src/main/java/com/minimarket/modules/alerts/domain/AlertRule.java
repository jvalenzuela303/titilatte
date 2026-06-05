package com.minimarket.modules.alerts.domain;

import com.minimarket.modules.users.domain.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "alert_rules")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AlertRule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 50)
    private AlertType type;

    @Column(name = "threshold_value", precision = 15, scale = 2)
    private BigDecimal thresholdValue;

    @Column(name = "threshold_minutes")
    private Integer thresholdMinutes;

    @Column(name = "check_interval_minutes", nullable = false)
    private int checkIntervalMinutes = 60;

    @Column(name = "recipient_role", nullable = false, length = 20)
    private String recipientRole;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "last_checked_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime lastCheckedAt;

    @Column(name = "last_triggered_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime lastTriggeredAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime updatedAt;

    @Column(name = "deleted_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime deletedAt;
}

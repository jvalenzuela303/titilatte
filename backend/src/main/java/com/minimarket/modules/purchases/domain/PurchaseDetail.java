package com.minimarket.modules.purchases.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "purchase_details")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PurchaseDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "purchase_id", nullable = false)
    private UUID purchaseId;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "quantity", precision = 10, scale = 3, nullable = false)
    private BigDecimal quantity;

    @Column(name = "unit_cost", precision = 12, scale = 4, nullable = false)
    private BigDecimal unitCost;

    // subtotal is GENERATED in DB — read-only
    @Column(name = "subtotal", insertable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "previous_cost", precision = 12, scale = 4)
    private BigDecimal previousCost;

    @Column(name = "new_avg_cost", precision = 12, scale = 4)
    private BigDecimal newAvgCost;
}

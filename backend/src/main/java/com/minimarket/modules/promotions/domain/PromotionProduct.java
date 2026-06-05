package com.minimarket.modules.promotions.domain;

import com.minimarket.modules.products.domain.Product;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.domain.Persistable;

import java.io.Serializable;
import java.util.UUID;

@Entity
@Table(name = "promotion_products")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PromotionProduct implements Persistable<PromotionProduct.PromotionProductId> {

    @EmbeddedId
    private PromotionProductId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("promotionId")
    @JoinColumn(name = "promotion_id", nullable = false)
    private Promotion promotion;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("productId")
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    // Transient flag: true for brand-new instances (builder/constructor),
    // false after load from DB. Tells Spring Data to always call persist()
    // instead of merge() for newly created PromotionProduct instances.
    @Transient
    @Builder.Default
    private boolean isNew = true;

    @PostLoad
    @PostPersist
    void markNotNew() {
        this.isNew = false;
    }

    @Override
    public boolean isNew() {
        return isNew;
    }

    @Embeddable
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class PromotionProductId implements Serializable {
        @Column(name = "promotion_id")
        private UUID promotionId;

        @Column(name = "product_id")
        private UUID productId;
    }
}

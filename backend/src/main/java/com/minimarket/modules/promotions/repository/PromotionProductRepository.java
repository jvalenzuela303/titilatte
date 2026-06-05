package com.minimarket.modules.promotions.repository;

import com.minimarket.modules.promotions.domain.PromotionProduct;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface PromotionProductRepository extends JpaRepository<PromotionProduct, PromotionProduct.PromotionProductId> {

    @Modifying
    @Query("DELETE FROM PromotionProduct pp WHERE pp.promotion.id = :promotionId")
    void deleteByPromotionId(@Param("promotionId") UUID promotionId);
}

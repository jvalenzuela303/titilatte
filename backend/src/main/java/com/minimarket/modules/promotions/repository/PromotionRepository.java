package com.minimarket.modules.promotions.repository;

import com.minimarket.modules.promotions.domain.Promotion;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

// Note: getImpactRawData returns Object[] rows: [promotionId, name, type, count, totalDiscount]

@Repository
public interface PromotionRepository extends JpaRepository<Promotion, UUID> {

    @Query("SELECT p FROM Promotion p " +
           "LEFT JOIN FETCH p.category " +
           "LEFT JOIN FETCH p.branch " +
           "LEFT JOIN FETCH p.createdBy " +
           "LEFT JOIN FETCH p.promotionProducts pp " +
           "LEFT JOIN FETCH pp.product " +
           "WHERE p.id = :id AND p.deletedAt IS NULL")
    Optional<Promotion> findByIdAndDeletedAtIsNull(@Param("id") UUID id);

    @Query("SELECT p FROM Promotion p " +
           "LEFT JOIN FETCH p.category " +
           "LEFT JOIN FETCH p.branch " +
           "LEFT JOIN FETCH p.createdBy " +
           "WHERE p.deletedAt IS NULL " +
           "AND (:activeOnly = false OR p.active = true)")
    Page<Promotion> findAllWithFilter(@Param("activeOnly") boolean activeOnly, Pageable pageable);

    @Query("SELECT DISTINCT p FROM Promotion p " +
           "LEFT JOIN FETCH p.category " +
           "LEFT JOIN FETCH p.branch " +
           "LEFT JOIN FETCH p.createdBy " +
           "LEFT JOIN FETCH p.promotionProducts pp " +
           "LEFT JOIN FETCH pp.product " +
           "WHERE p.active = true " +
           "AND p.deletedAt IS NULL " +
           "AND p.startsAt <= :now " +
           "AND p.endsAt >= :now")
    List<Promotion> findActiveNow(@Param("now") OffsetDateTime now);

    @Query("SELECT DISTINCT p FROM Promotion p " +
           "LEFT JOIN FETCH p.promotionProducts pp " +
           "LEFT JOIN FETCH pp.product prod " +
           "LEFT JOIN FETCH p.category cat " +
           "WHERE p.active = true " +
           "AND p.deletedAt IS NULL " +
           "AND p.startsAt <= :now " +
           "AND p.endsAt >= :now " +
           "AND (:branchId IS NULL OR p.branch IS NULL OR p.branch.id = :branchId) " +
           "AND (" +
           "  p.appliesTo = 'ALL_PRODUCTS' " +
           "  OR (p.appliesTo = 'SPECIFIC_PRODUCTS' AND EXISTS (" +
           "    SELECT 1 FROM PromotionProduct pp2 WHERE pp2.promotion = p AND pp2.product.id = :productId" +
           "  )) " +
           "  OR (p.appliesTo = 'CATEGORY' AND EXISTS (" +
           "    SELECT 1 FROM Product prod2 WHERE prod2.id = :productId AND prod2.category = p.category" +
           "  ))" +
           ")")
    List<Promotion> findApplicablePromotions(
            @Param("productId") UUID productId,
            @Param("branchId") UUID branchId,
            @Param("now") OffsetDateTime now);

    @Query(value = """
            SELECT p.id, p.name, p.type,
                   COUNT(sd.id) AS times_applied,
                   COALESCE(SUM(sd.discount), 0) AS total_discount
            FROM promotions p
            INNER JOIN sale_details sd ON sd.applied_promotion_id = p.id
            INNER JOIN sales s ON s.id = sd.sale_id
            WHERE s.status = 'CONFIRMED'
              AND s.created_at >= :startDt
              AND s.created_at < :endDt
            GROUP BY p.id, p.name, p.type
            """, nativeQuery = true)
    List<Object[]> getImpactRawData(
            @Param("startDt") OffsetDateTime startDt,
            @Param("endDt") OffsetDateTime endDt);
}

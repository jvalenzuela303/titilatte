package com.minimarket.modules.stock.repository;

import com.minimarket.modules.stock.domain.StockMovement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface StockMovementRepository extends JpaRepository<StockMovement, UUID> {

    @Query("SELECT sm FROM StockMovement sm " +
           "JOIN FETCH sm.product " +
           "JOIN FETCH sm.createdBy " +
           "LEFT JOIN FETCH sm.authorizedBy " +
           "WHERE (:productId IS NULL OR sm.product.id = :productId) " +
           "ORDER BY sm.createdAt DESC")
    Page<StockMovement> findByProductId(
            @Param("productId") UUID productId,
            Pageable pageable);
}

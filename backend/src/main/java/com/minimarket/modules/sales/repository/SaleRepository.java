package com.minimarket.modules.sales.repository;

import com.minimarket.modules.sales.domain.Sale;
import com.minimarket.modules.sales.domain.SaleStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SaleRepository extends JpaRepository<Sale, UUID> {

    @Query("SELECT s FROM Sale s " +
           "LEFT JOIN FETCH s.seller " +
           "LEFT JOIN FETCH s.cancelledBy " +
           "LEFT JOIN FETCH s.details d " +
           "LEFT JOIN FETCH d.product " +
           "LEFT JOIN FETCH s.payments " +
           "WHERE s.id = :id")
    Optional<Sale> findWithDetailsById(@Param("id") UUID id);

    @Query("SELECT s FROM Sale s " +
           "JOIN FETCH s.seller " +
           "WHERE (:startDate IS NULL OR s.createdAt >= :startDate) " +
           "AND (:endDate IS NULL OR s.createdAt <= :endDate) " +
           "AND (:sellerId IS NULL OR s.seller.id = :sellerId) " +
           "AND (:status IS NULL OR s.status = :status)")
    Page<Sale> search(
            @Param("startDate") OffsetDateTime startDate,
            @Param("endDate") OffsetDateTime endDate,
            @Param("sellerId") UUID sellerId,
            @Param("status") SaleStatus status,
            Pageable pageable);
}

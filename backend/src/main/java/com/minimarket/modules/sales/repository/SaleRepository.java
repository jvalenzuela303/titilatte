package com.minimarket.modules.sales.repository;

import com.minimarket.modules.sales.domain.Sale;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface SaleRepository extends JpaRepository<Sale, UUID>, JpaSpecificationExecutor<Sale> {

    // Bag 1: sale + details. Separated from payments to avoid MultipleBagFetchException.
    @Query("SELECT s FROM Sale s " +
           "LEFT JOIN FETCH s.seller " +
           "LEFT JOIN FETCH s.cancelledBy " +
           "LEFT JOIN FETCH s.details d " +
           "LEFT JOIN FETCH d.product " +
           "WHERE s.id = :id")
    Optional<Sale> findWithDetailsById(@Param("id") UUID id);

    // Bag 2: payments only. Hibernate first-level cache merges result into the same entity.
    @Query("SELECT s FROM Sale s LEFT JOIN FETCH s.payments WHERE s.id = :id")
    Optional<Sale> findWithPaymentsById(@Param("id") UUID id);
}

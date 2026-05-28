package com.minimarket.modules.purchases.repository;

import com.minimarket.modules.purchases.domain.Purchase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PurchaseRepository extends JpaRepository<Purchase, UUID>, JpaSpecificationExecutor<Purchase> {

    @Query("SELECT p FROM Purchase p LEFT JOIN FETCH p.details WHERE p.id = :id")
    Optional<Purchase> findWithDetailsById(@Param("id") UUID id);
}

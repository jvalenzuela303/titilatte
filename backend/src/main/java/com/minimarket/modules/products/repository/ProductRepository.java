package com.minimarket.modules.products.repository;

import com.minimarket.modules.products.domain.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductRepository extends JpaRepository<Product, UUID>, JpaSpecificationExecutor<Product> {

    @EntityGraph(attributePaths = {"category", "tax", "unit"})
    Optional<Product> findByBarcodeAndDeletedAtIsNull(String barcode);

    @EntityGraph(attributePaths = {"category", "tax", "unit"})
    Optional<Product> findByIdAndDeletedAtIsNull(UUID id);

    @Query("SELECT p FROM Product p " +
           "JOIN FETCH p.category " +
           "JOIN FETCH p.tax " +
           "JOIN FETCH p.unit " +
           "WHERE p.deletedAt IS NULL " +
           "AND p.active = true " +
           "AND p.stockCurrent <= p.stockMinimum")
    Page<Product> findLowStock(Pageable pageable);
}

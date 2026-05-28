package com.minimarket.modules.purchases.repository;

import com.minimarket.modules.purchases.domain.Supplier;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface SupplierRepository extends JpaRepository<Supplier, UUID> {

    Optional<Supplier> findByRutAndDeletedAtIsNull(String rut);

    Page<Supplier> findAllByDeletedAtIsNull(Pageable pageable);
}

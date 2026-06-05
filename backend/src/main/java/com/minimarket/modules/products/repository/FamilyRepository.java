package com.minimarket.modules.products.repository;

import com.minimarket.modules.products.domain.ProductFamily;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FamilyRepository extends JpaRepository<ProductFamily, UUID> {
    List<ProductFamily> findAllByActiveTrueOrderByNameAsc();
}

package com.minimarket.modules.products.repository;

import com.minimarket.modules.products.domain.ProductCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface CategoryRepository extends JpaRepository<ProductCategory, UUID> {
}

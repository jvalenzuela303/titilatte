package com.minimarket.modules.customers.repository;

import com.minimarket.modules.customers.domain.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, UUID>, JpaSpecificationExecutor<Customer> {

    Optional<Customer> findByRutAndDeletedAtIsNull(String rut);

    List<Customer> findByCreditUsedGreaterThanAndDeletedAtIsNull(BigDecimal zero);
}

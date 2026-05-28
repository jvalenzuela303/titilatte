package com.minimarket.modules.customers.repository;

import com.minimarket.modules.customers.domain.CustomerPayment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface CustomerPaymentRepository extends JpaRepository<CustomerPayment, UUID> {

    Page<CustomerPayment> findAllByCustomerIdOrderByCreatedAtDesc(UUID customerId, Pageable pageable);

    Optional<CustomerPayment> findTopByCustomerIdOrderByCreatedAtDesc(UUID customerId);
}

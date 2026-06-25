package com.minimarket.modules.purchases.repository;

import com.minimarket.modules.purchases.domain.PurchasePayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PurchasePaymentRepository extends JpaRepository<PurchasePayment, UUID> {

    List<PurchasePayment> findByPurchaseIdOrderByCreatedAtDesc(UUID purchaseId);
}

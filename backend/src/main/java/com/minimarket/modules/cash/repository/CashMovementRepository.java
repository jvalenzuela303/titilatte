package com.minimarket.modules.cash.repository;

import com.minimarket.modules.cash.domain.CashMovement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CashMovementRepository extends JpaRepository<CashMovement, UUID> {

    Page<CashMovement> findAllByCashRegisterId(UUID registerId, Pageable pageable);

    List<CashMovement> findAllByCashRegisterId(UUID registerId);
}

package com.minimarket.modules.cash.repository;

import com.minimarket.modules.cash.domain.CashRegister;
import com.minimarket.modules.cash.domain.CashStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CashRegisterRepository extends JpaRepository<CashRegister, UUID> {

    Optional<CashRegister> findByCashierIdAndStatus(UUID cashierId, CashStatus status);

    Page<CashRegister> findAllByCashierId(UUID cashierId, Pageable pageable);

    List<CashRegister> findAllByStatus(CashStatus status);
}

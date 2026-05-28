package com.minimarket.modules.cash.service;

import com.minimarket.modules.cash.dto.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;
import java.util.UUID;

public interface CashRegisterService {

    CashRegisterResponse openCash(UUID userId, OpenCashRequest request);

    CashRegisterResponse closeCash(UUID registerId, UUID userId, CloseCashRequest request);

    Optional<CashRegisterResponse> getCurrentCash(UUID userId);

    CashRegisterResponse getCashById(UUID registerId);

    Page<CashRegisterResponse> getCashHistory(UUID userId, Pageable pageable);

    CashMovementResponse addMovement(UUID registerId, UUID userId, CashMovementRequest request);

    Page<CashMovementResponse> getMovements(UUID registerId, Pageable pageable);

    CashSummaryResponse getSummary(UUID registerId);
}

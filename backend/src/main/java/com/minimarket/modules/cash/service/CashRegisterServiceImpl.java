package com.minimarket.modules.cash.service;

import com.minimarket.exception.BusinessException;
import com.minimarket.exception.CashRegisterAlreadyOpenException;
import com.minimarket.exception.EntityNotFoundException;
import com.minimarket.modules.cash.domain.CashMovement;
import com.minimarket.modules.cash.domain.CashMovementType;
import com.minimarket.modules.cash.domain.CashRegister;
import com.minimarket.modules.cash.domain.CashStatus;
import com.minimarket.modules.cash.dto.*;
import com.minimarket.modules.cash.repository.CashMovementRepository;
import com.minimarket.modules.cash.repository.CashRegisterRepository;
import com.minimarket.modules.users.domain.User;
import com.minimarket.modules.users.repository.UserRepository;
import com.minimarket.sse.SseEmitterRegistry;
import com.minimarket.sse.SseEvent;
import com.minimarket.sse.SseEventType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CashRegisterServiceImpl implements CashRegisterService {

    private final CashRegisterRepository cashRegisterRepository;
    private final CashMovementRepository cashMovementRepository;
    private final UserRepository userRepository;
    private final SseEmitterRegistry sseRegistry;

    @Override
    @Transactional
    public CashRegisterResponse openCash(UUID userId, OpenCashRequest request) {
        // Verify no existing OPEN register for this cashier
        cashRegisterRepository.findByCashierIdAndStatus(userId, CashStatus.OPEN)
                .ifPresent(existing -> {
                    throw new CashRegisterAlreadyOpenException();
                });

        CashRegister register = CashRegister.builder()
                .cashierId(userId)
                .openingAmount(request.openingAmount())
                .status(CashStatus.OPEN)
                .openedAt(OffsetDateTime.now())
                .notes(request.notes())
                .build();

        CashRegister saved = cashRegisterRepository.save(register);
        log.info("Cash register opened: id={} cashierId={}", saved.getId(), userId);

        sseRegistry.broadcastToRoles(
                Set.of("ADMIN", "SUPERVISOR"),
                new SseEvent(
                        SseEventType.CAJA_ABIERTA,
                        Map.of(
                                "registerId", saved.getId(),
                                "registerNumber", saved.getRegisterNumber() != null ? saved.getRegisterNumber() : 0,
                                "cashierId", userId,
                                "openingAmount", saved.getOpeningAmount()
                        ),
                        LocalDateTime.now()
                )
        );

        String cashierName = resolveCashierName(userId);
        return toRegisterResponse(saved, cashierName);
    }

    @Override
    @Transactional
    public CashRegisterResponse closeCash(UUID registerId, UUID userId, CloseCashRequest request) {
        CashRegister register = cashRegisterRepository.findById(registerId)
                .orElseThrow(() -> new EntityNotFoundException("CashRegister", registerId));

        if (!register.getCashierId().equals(userId)) {
            throw new BusinessException("This cash register does not belong to you.");
        }
        if (register.getStatus() != CashStatus.OPEN) {
            throw new BusinessException("Cash register is not open.");
        }

        // Calculate expected closing amount
        List<CashMovement> movements = cashMovementRepository.findAllByCashRegisterId(registerId);
        BigDecimal totalIncome = movements.stream()
                .filter(m -> m.getMovementType() == CashMovementType.INGRESO
                        || m.getMovementType() == CashMovementType.VENTA
                        || m.getMovementType() == CashMovementType.PAGO_CREDITO)
                .map(CashMovement::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalExpense = movements.stream()
                .filter(m -> m.getMovementType() == CashMovementType.EGRESO)
                .map(CashMovement::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal expectedClosing = register.getOpeningAmount()
                .add(totalIncome)
                .subtract(totalExpense);

        register.setExpectedClosingAmount(expectedClosing);
        register.setCountedAmount(request.countedAmount());
        register.setStatus(CashStatus.CLOSED);
        register.setClosedAt(OffsetDateTime.now());
        if (request.notes() != null && !request.notes().isBlank()) {
            register.setNotes(request.notes());
        }

        CashRegister saved = cashRegisterRepository.save(register);
        log.info("Cash register closed: id={} expected={} counted={}",
                saved.getId(), expectedClosing, request.countedAmount());

        sseRegistry.broadcastToRoles(
                Set.of("ADMIN", "SUPERVISOR"),
                new SseEvent(
                        SseEventType.CAJA_CERRADA,
                        Map.of(
                                "registerId", saved.getId(),
                                "registerNumber", saved.getRegisterNumber() != null ? saved.getRegisterNumber() : 0,
                                "cashierId", userId,
                                "expectedAmount", expectedClosing,
                                "countedAmount", request.countedAmount()
                        ),
                        LocalDateTime.now()
                )
        );

        String cashierName = resolveCashierName(userId);
        return toRegisterResponse(saved, cashierName);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CashRegisterResponse> getCurrentCash(UUID userId) {
        return cashRegisterRepository.findByCashierIdAndStatus(userId, CashStatus.OPEN)
                .map(register -> toRegisterResponse(register, resolveCashierName(userId)));
    }

    @Override
    @Transactional(readOnly = true)
    public CashRegisterResponse getCashById(UUID registerId) {
        CashRegister register = cashRegisterRepository.findById(registerId)
                .orElseThrow(() -> new EntityNotFoundException("CashRegister", registerId));
        String cashierName = resolveCashierName(register.getCashierId());
        return toRegisterResponse(register, cashierName);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CashRegisterResponse> getCashHistory(UUID userId, Pageable pageable) {
        return cashRegisterRepository.findAllByCashierId(userId, pageable)
                .map(r -> toRegisterResponse(r, resolveCashierName(r.getCashierId())));
    }

    @Override
    @Transactional
    public CashMovementResponse addMovement(UUID registerId, UUID userId, CashMovementRequest request) {
        CashRegister register = cashRegisterRepository.findByCashierIdAndStatus(userId, CashStatus.OPEN)
                .orElseThrow(() -> new EntityNotFoundException("No open cash register for current user"));

        if (!register.getId().equals(registerId)) {
            throw new BusinessException("Cash register does not match the current user's open register.");
        }

        if (request.movementType() != CashMovementType.INGRESO
                && request.movementType() != CashMovementType.EGRESO) {
            throw new BusinessException("Only INGRESO or EGRESO movements are allowed through this endpoint.");
        }

        CashMovement movement = CashMovement.builder()
                .cashRegisterId(registerId)
                .movementType(request.movementType())
                .category(request.category())
                .amount(request.amount())
                .description(request.description())
                .createdBy(userId)
                .build();

        CashMovement saved = cashMovementRepository.save(movement);
        log.info("Cash movement added: registerId={} type={} amount={}",
                registerId, request.movementType(), request.amount());
        return toMovementResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CashMovementResponse> getMovements(UUID registerId, Pageable pageable) {
        cashRegisterRepository.findById(registerId)
                .orElseThrow(() -> new EntityNotFoundException("CashRegister", registerId));
        return cashMovementRepository.findAllByCashRegisterId(registerId, pageable)
                .map(this::toMovementResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public CashSummaryResponse getSummary(UUID registerId) {
        CashRegister register = cashRegisterRepository.findById(registerId)
                .orElseThrow(() -> new EntityNotFoundException("CashRegister", registerId));

        List<CashMovement> movements = cashMovementRepository.findAllByCashRegisterId(registerId);

        BigDecimal totalSales = movements.stream()
                .filter(m -> m.getMovementType() == CashMovementType.VENTA)
                .map(CashMovement::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalIncome = movements.stream()
                .filter(m -> m.getMovementType() == CashMovementType.INGRESO
                        || m.getMovementType() == CashMovementType.PAGO_CREDITO)
                .map(CashMovement::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalExpense = movements.stream()
                .filter(m -> m.getMovementType() == CashMovementType.EGRESO)
                .map(CashMovement::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal expectedAmount = register.getOpeningAmount()
                .add(totalSales)
                .add(totalIncome)
                .subtract(totalExpense);

        String cashierName = resolveCashierName(register.getCashierId());

        return new CashSummaryResponse(
                register.getRegisterNumber(),
                cashierName,
                register.getOpeningAmount(),
                totalSales,
                totalIncome,
                totalExpense,
                expectedAmount,
                register.getCountedAmount(),
                register.getDifferenceAmount(),
                register.getStatus(),
                register.getOpenedAt(),
                register.getClosedAt()
        );
    }

    // ---- private helpers ----

    private String resolveCashierName(UUID cashierId) {
        if (cashierId == null) return null;
        return userRepository.findById(cashierId)
                .map(u -> u.getFirstName() + " " + u.getLastName())
                .orElse(null);
    }

    private CashRegisterResponse toRegisterResponse(CashRegister register, String cashierName) {
        return new CashRegisterResponse(
                register.getId(),
                register.getRegisterNumber(),
                register.getCashierId(),
                cashierName,
                register.getOpeningAmount(),
                register.getExpectedClosingAmount(),
                register.getCountedAmount(),
                register.getDifferenceAmount(),
                register.getStatus(),
                register.getOpenedAt(),
                register.getClosedAt(),
                register.getNotes(),
                register.getCreatedAt()
        );
    }

    private CashMovementResponse toMovementResponse(CashMovement movement) {
        return new CashMovementResponse(
                movement.getId(),
                movement.getCashRegisterId(),
                movement.getMovementType(),
                movement.getCategory(),
                movement.getAmount(),
                movement.getDescription(),
                movement.getReferenceId(),
                movement.getReferenceType(),
                movement.getCreatedBy(),
                movement.getCreatedAt()
        );
    }
}

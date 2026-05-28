package com.minimarket.modules.cash;

import com.minimarket.exception.BusinessException;
import com.minimarket.exception.CashRegisterAlreadyOpenException;
import com.minimarket.exception.EntityNotFoundException;
import com.minimarket.modules.cash.domain.*;
import com.minimarket.modules.cash.dto.*;
import com.minimarket.modules.cash.repository.CashMovementRepository;
import com.minimarket.modules.cash.repository.CashRegisterRepository;
import com.minimarket.modules.cash.service.CashRegisterServiceImpl;
import com.minimarket.modules.users.domain.User;
import com.minimarket.modules.users.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("CashRegisterService - Unit Tests")
class CashRegisterServiceTest {

    @Mock private CashRegisterRepository cashRegisterRepository;
    @Mock private CashMovementRepository cashMovementRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks
    private CashRegisterServiceImpl cashRegisterService;

    // ── Fixtures ───────────────────────────────────────────────────────────────

    private UUID cashierId;
    private UUID registerId;
    private User cashier;
    private CashRegister openRegister;

    @BeforeEach
    void setUp() {
        cashierId  = UUID.randomUUID();
        registerId = UUID.randomUUID();

        cashier = User.builder()
                .id(cashierId)
                .email("cajero@minimarket.com")
                .firstName("Juan")
                .lastName("Cajero")
                .active(true)
                .build();

        openRegister = CashRegister.builder()
                .id(registerId)
                .cashierId(cashierId)
                .openingAmount(new BigDecimal("50000.00"))
                .status(CashStatus.OPEN)
                .openedAt(OffsetDateTime.now())
                .build();
    }

    // ── openCash ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("openCash()")
    class OpenCash {

        @Test
        @DisplayName("openCash_WhenNoCashOpen_ShouldCreateNewRegister")
        void openCash_WhenNoCashOpen_ShouldCreateNewRegister() {
            // Arrange
            OpenCashRequest request = new OpenCashRequest(new BigDecimal("50000.00"), "Apertura diaria");

            when(cashRegisterRepository.findByCashierIdAndStatus(cashierId, CashStatus.OPEN))
                    .thenReturn(Optional.empty());
            when(cashRegisterRepository.save(any(CashRegister.class))).thenReturn(openRegister);
            when(userRepository.findById(cashierId)).thenReturn(Optional.of(cashier));

            // Act
            CashRegisterResponse result = cashRegisterService.openCash(cashierId, request);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.status()).isEqualTo(CashStatus.OPEN);
            verify(cashRegisterRepository).save(argThat(r ->
                    r.getCashierId().equals(cashierId)
                    && r.getStatus() == CashStatus.OPEN
                    && r.getOpeningAmount().compareTo(new BigDecimal("50000.00")) == 0
            ));
        }

        @Test
        @DisplayName("openCash_WhenCashAlreadyOpen_ShouldThrowCashRegisterAlreadyOpenException")
        void openCash_WhenCashAlreadyOpen_ShouldThrowCashRegisterAlreadyOpenException() {
            // Arrange — cashier already has an open register
            OpenCashRequest request = new OpenCashRequest(new BigDecimal("30000.00"), null);

            when(cashRegisterRepository.findByCashierIdAndStatus(cashierId, CashStatus.OPEN))
                    .thenReturn(Optional.of(openRegister));

            // Act & Assert
            assertThatThrownBy(() -> cashRegisterService.openCash(cashierId, request))
                    .isInstanceOf(CashRegisterAlreadyOpenException.class);

            verify(cashRegisterRepository, never()).save(any());
        }
    }

    // ── closeCash ──────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("closeCash()")
    class CloseCash {

        @Test
        @DisplayName("closeCash_WhenOpen_ShouldCalculateExpectedAmount")
        void closeCash_WhenOpen_ShouldCalculateExpectedAmount() {
            // Arrange
            CloseCashRequest request = new CloseCashRequest(new BigDecimal("55000.00"), null);

            // 2 INGRESO movements (1000 + 4000 = 5000) and 1 EGRESO (2000)
            // expected = 50000 (opening) + 5000 (income) - 2000 (expense) = 53000
            CashMovement income1 = CashMovement.builder()
                    .cashRegisterId(registerId).movementType(CashMovementType.INGRESO)
                    .amount(new BigDecimal("1000.00")).build();
            CashMovement income2 = CashMovement.builder()
                    .cashRegisterId(registerId).movementType(CashMovementType.VENTA)
                    .amount(new BigDecimal("4000.00")).build();
            CashMovement expense = CashMovement.builder()
                    .cashRegisterId(registerId).movementType(CashMovementType.EGRESO)
                    .amount(new BigDecimal("2000.00")).build();

            CashRegister savedClosed = CashRegister.builder()
                    .id(registerId).cashierId(cashierId)
                    .openingAmount(new BigDecimal("50000.00"))
                    .expectedClosingAmount(new BigDecimal("53000.00"))
                    .countedAmount(new BigDecimal("55000.00"))
                    .status(CashStatus.CLOSED)
                    .openedAt(OffsetDateTime.now().minusHours(8))
                    .closedAt(OffsetDateTime.now())
                    .build();

            when(cashRegisterRepository.findById(registerId)).thenReturn(Optional.of(openRegister));
            when(cashMovementRepository.findAllByCashRegisterId(registerId))
                    .thenReturn(List.of(income1, income2, expense));
            when(cashRegisterRepository.save(any(CashRegister.class))).thenReturn(savedClosed);
            when(userRepository.findById(cashierId)).thenReturn(Optional.of(cashier));

            // Act
            CashRegisterResponse result = cashRegisterService.closeCash(registerId, cashierId, request);

            // Assert
            assertThat(result.status()).isEqualTo(CashStatus.CLOSED);
            // Verify the expected closing amount was computed correctly before save
            verify(cashRegisterRepository).save(argThat(r -> {
                BigDecimal expected = new BigDecimal("53000.00");
                return r.getExpectedClosingAmount().compareTo(expected) == 0
                        && r.getStatus() == CashStatus.CLOSED;
            }));
        }

        @Test
        @DisplayName("closeCash_WhenAlreadyClosed_ShouldThrowException")
        void closeCash_WhenAlreadyClosed_ShouldThrowException() {
            // Arrange
            CashRegister closedRegister = CashRegister.builder()
                    .id(registerId).cashierId(cashierId)
                    .status(CashStatus.CLOSED)
                    .openingAmount(BigDecimal.ZERO)
                    .build();
            CloseCashRequest request = new CloseCashRequest(BigDecimal.ZERO, null);

            when(cashRegisterRepository.findById(registerId)).thenReturn(Optional.of(closedRegister));

            // Act & Assert
            assertThatThrownBy(() -> cashRegisterService.closeCash(registerId, cashierId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("not open");

            verify(cashRegisterRepository, never()).save(any());
        }

        @Test
        @DisplayName("closeCash_WhenBelongsToOtherCashier_ShouldThrowException")
        void closeCash_WhenBelongsToOtherCashier_ShouldThrowException() {
            // Arrange — register belongs to a different cashier
            UUID otherCashierId = UUID.randomUUID();
            CloseCashRequest request = new CloseCashRequest(new BigDecimal("50000.00"), null);

            when(cashRegisterRepository.findById(registerId)).thenReturn(Optional.of(openRegister));

            // Act & Assert — otherCashierId does not own this register
            assertThatThrownBy(() -> cashRegisterService.closeCash(registerId, otherCashierId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("does not belong to you");

            verify(cashRegisterRepository, never()).save(any());
        }
    }

    // ── getCurrentCash ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getCurrentCash()")
    class GetCurrentCash {

        @Test
        @DisplayName("getCurrentCash_WhenNoCashOpen_ShouldReturnEmpty")
        void getCurrentCash_WhenNoCashOpen_ShouldReturnEmpty() {
            // Arrange
            when(cashRegisterRepository.findByCashierIdAndStatus(cashierId, CashStatus.OPEN))
                    .thenReturn(Optional.empty());

            // Act
            Optional<CashRegisterResponse> result = cashRegisterService.getCurrentCash(cashierId);

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("getCurrentCash_WhenCashOpen_ShouldReturnRegister")
        void getCurrentCash_WhenCashOpen_ShouldReturnRegister() {
            // Arrange
            when(cashRegisterRepository.findByCashierIdAndStatus(cashierId, CashStatus.OPEN))
                    .thenReturn(Optional.of(openRegister));
            when(userRepository.findById(cashierId)).thenReturn(Optional.of(cashier));

            // Act
            Optional<CashRegisterResponse> result = cashRegisterService.getCurrentCash(cashierId);

            // Assert
            assertThat(result).isPresent();
            assertThat(result.get().cashierId()).isEqualTo(cashierId);
            assertThat(result.get().status()).isEqualTo(CashStatus.OPEN);
        }
    }

    // ── addMovement ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("addMovement()")
    class AddMovement {

        @Test
        @DisplayName("addMovement_WhenCashOpen_ShouldPersistMovement")
        void addMovement_WhenCashOpen_ShouldPersistMovement() {
            // Arrange
            CashMovementRequest request = new CashMovementRequest(
                    CashMovementType.INGRESO,
                    MovementCategory.DEPOSITO,
                    new BigDecimal("5000.00"),
                    "Fondo para cambio"
            );

            CashMovement saved = CashMovement.builder()
                    .id(UUID.randomUUID())
                    .cashRegisterId(registerId)
                    .movementType(CashMovementType.INGRESO)
                    .amount(new BigDecimal("5000.00"))
                    .description("Fondo para cambio")
                    .createdBy(cashierId)
                    .build();

            when(cashRegisterRepository.findByCashierIdAndStatus(cashierId, CashStatus.OPEN))
                    .thenReturn(Optional.of(openRegister));
            when(cashMovementRepository.save(any(CashMovement.class))).thenReturn(saved);

            // Act
            CashMovementResponse result = cashRegisterService.addMovement(registerId, cashierId, request);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.movementType()).isEqualTo(CashMovementType.INGRESO);
            assertThat(result.amount()).isEqualByComparingTo(new BigDecimal("5000.00"));
            verify(cashMovementRepository).save(any(CashMovement.class));
        }

        @Test
        @DisplayName("addMovement_WhenMovementTypeIsVenta_ShouldThrowException")
        void addMovement_WhenMovementTypeIsVenta_ShouldThrowException() {
            // Arrange — VENTA type is not allowed through this endpoint (only INGRESO/EGRESO)
            CashMovementRequest request = new CashMovementRequest(
                    CashMovementType.VENTA,
                    null,
                    new BigDecimal("1000.00"),
                    "Venta manual"
            );

            when(cashRegisterRepository.findByCashierIdAndStatus(cashierId, CashStatus.OPEN))
                    .thenReturn(Optional.of(openRegister));

            // Act & Assert
            assertThatThrownBy(() -> cashRegisterService.addMovement(registerId, cashierId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Only INGRESO or EGRESO");

            verify(cashMovementRepository, never()).save(any());
        }

        @Test
        @DisplayName("addMovement_WhenNoCashOpen_ShouldThrowException")
        void addMovement_WhenNoCashOpen_ShouldThrowException() {
            // Arrange
            CashMovementRequest request = new CashMovementRequest(
                    CashMovementType.INGRESO, null,
                    new BigDecimal("1000.00"), "Sin caja"
            );

            when(cashRegisterRepository.findByCashierIdAndStatus(cashierId, CashStatus.OPEN))
                    .thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> cashRegisterService.addMovement(registerId, cashierId, request))
                    .isInstanceOf(EntityNotFoundException.class);
        }

        @Test
        @DisplayName("addMovement_WhenRegisterMismatch_ShouldThrowException")
        void addMovement_WhenRegisterMismatch_ShouldThrowException() {
            // Arrange — user's open register has a different id than the path parameter
            UUID differentRegisterId = UUID.randomUUID();
            CashMovementRequest request = new CashMovementRequest(
                    CashMovementType.EGRESO, null,
                    new BigDecimal("2000.00"), "Retiro"
            );

            when(cashRegisterRepository.findByCashierIdAndStatus(cashierId, CashStatus.OPEN))
                    .thenReturn(Optional.of(openRegister)); // openRegister.id = registerId

            // Act & Assert — path param differs from user's actual open register
            assertThatThrownBy(() -> cashRegisterService.addMovement(differentRegisterId, cashierId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("does not match");
        }
    }
}

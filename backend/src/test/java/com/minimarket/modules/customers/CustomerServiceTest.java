package com.minimarket.modules.customers;

import com.minimarket.exception.BusinessException;
import com.minimarket.exception.EntityNotFoundException;
import com.minimarket.modules.customers.domain.Customer;
import com.minimarket.modules.customers.domain.CustomerPayment;
import com.minimarket.modules.customers.dto.*;
import com.minimarket.modules.customers.repository.CustomerPaymentRepository;
import com.minimarket.modules.customers.repository.CustomerRepository;
import com.minimarket.modules.customers.service.CustomerServiceImpl;
import com.minimarket.modules.sales.domain.PaymentMethod;
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
@DisplayName("CustomerService - Unit Tests")
class CustomerServiceTest {

    @Mock private CustomerRepository customerRepository;
    @Mock private CustomerPaymentRepository customerPaymentRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks
    private CustomerServiceImpl customerService;

    // ── Fixtures ───────────────────────────────────────────────────────────────

    private UUID customerId;
    private UUID receiverId;
    private Customer customer;
    private User receiver;

    @BeforeEach
    void setUp() {
        customerId = UUID.randomUUID();
        receiverId = UUID.randomUUID();

        customer = Customer.builder()
                .id(customerId)
                .firstName("María")
                .lastName("González")
                .rut("12.345.678-9")
                .email("maria@email.com")
                .creditLimit(new BigDecimal("100000.00"))
                .creditUsed(new BigDecimal("30000.00"))
                .active(true)
                .build();

        receiver = User.builder()
                .id(receiverId)
                .email("cajero@minimarket.com")
                .firstName("Pedro")
                .lastName("Cajero")
                .active(true)
                .build();
    }

    // ── createCustomer ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("createCustomer()")
    class CreateCustomer {

        @Test
        @DisplayName("createCustomer_WhenValidData_ShouldReturnCustomer")
        void createCustomer_WhenValidData_ShouldReturnCustomer() {
            // Arrange
            CustomerRequest request = new CustomerRequest(
                    "Ana", "López", "22.222.222-2",
                    "+56912345678", "ana@email.com", "Calle Falsa 123",
                    new BigDecimal("50000.00")
            );

            Customer saved = Customer.builder()
                    .id(UUID.randomUUID())
                    .firstName("Ana").lastName("López")
                    .rut("22.222.222-2")
                    .creditLimit(new BigDecimal("50000.00"))
                    .creditUsed(BigDecimal.ZERO)
                    .active(true)
                    .build();

            when(customerRepository.findByRutAndDeletedAtIsNull("22.222.222-2"))
                    .thenReturn(Optional.empty());
            when(customerRepository.save(any(Customer.class))).thenReturn(saved);

            // Act
            CustomerResponse result = customerService.createCustomer(request);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.firstName()).isEqualTo("Ana");
            assertThat(result.creditUsed()).isEqualByComparingTo(BigDecimal.ZERO);
            verify(customerRepository).save(any(Customer.class));
        }

        @Test
        @DisplayName("createCustomer_WhenDuplicateRut_ShouldThrowException")
        void createCustomer_WhenDuplicateRut_ShouldThrowException() {
            // Arrange — RUT already registered
            CustomerRequest request = new CustomerRequest(
                    "Otro", "Cliente", "12.345.678-9",
                    null, null, null, BigDecimal.ZERO
            );

            when(customerRepository.findByRutAndDeletedAtIsNull("12.345.678-9"))
                    .thenReturn(Optional.of(customer));

            // Act & Assert
            assertThatThrownBy(() -> customerService.createCustomer(request))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("12.345.678-9");

            verify(customerRepository, never()).save(any());
        }

        @Test
        @DisplayName("createCustomer_WhenNullRut_ShouldSkipDuplicateCheck")
        void createCustomer_WhenNullRut_ShouldSkipDuplicateCheck() {
            // Arrange
            CustomerRequest request = new CustomerRequest(
                    "Sin", "RUT", null, null, null, null, null
            );

            Customer saved = Customer.builder()
                    .id(UUID.randomUUID()).firstName("Sin").lastName("RUT")
                    .creditLimit(BigDecimal.ZERO).creditUsed(BigDecimal.ZERO)
                    .active(true).build();

            when(customerRepository.save(any(Customer.class))).thenReturn(saved);

            // Act
            customerService.createCustomer(request);

            // Assert — no RUT uniqueness check
            verify(customerRepository, never()).findByRutAndDeletedAtIsNull(any());
        }
    }

    // ── updateCreditLimit ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("updateCreditLimit()")
    class UpdateCreditLimit {

        @Test
        @DisplayName("updateCreditLimit_WhenValidAmount_ShouldUpdate")
        void updateCreditLimit_WhenValidAmount_ShouldUpdate() {
            // Arrange
            CreditLimitRequest request = new CreditLimitRequest(
                    new BigDecimal("200000.00"), "Aumento por historial de pago"
            );

            Customer updated = Customer.builder()
                    .id(customerId).firstName("María").lastName("González")
                    .creditLimit(new BigDecimal("200000.00"))
                    .creditUsed(new BigDecimal("30000.00"))
                    .active(true).build();

            when(customerRepository.findById(customerId)).thenReturn(Optional.of(customer));
            when(customerRepository.save(any(Customer.class))).thenReturn(updated);

            // Act
            CustomerResponse result = customerService.updateCreditLimit(customerId, request);

            // Assert
            assertThat(result.creditLimit()).isEqualByComparingTo(new BigDecimal("200000.00"));
            verify(customerRepository).save(argThat(c ->
                    c.getCreditLimit().compareTo(new BigDecimal("200000.00")) == 0
            ));
        }

        @Test
        @DisplayName("updateCreditLimit_WhenCustomerNotFound_ShouldThrowException")
        void updateCreditLimit_WhenCustomerNotFound_ShouldThrowException() {
            // Arrange
            CreditLimitRequest request = new CreditLimitRequest(new BigDecimal("50000.00"), "Ajuste");
            when(customerRepository.findById(customerId)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> customerService.updateCreditLimit(customerId, request))
                    .isInstanceOf(EntityNotFoundException.class);
        }
    }

    // ── registerPayment ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("registerPayment()")
    class RegisterPayment {

        @Test
        @DisplayName("registerPayment_WhenValidAmount_ShouldPersistPayment")
        void registerPayment_WhenValidAmount_ShouldPersistPayment() {
            // Arrange — customer owes 30000, paying 10000
            CustomerPaymentRequest request = new CustomerPaymentRequest(
                    new BigDecimal("10000.00"),
                    PaymentMethod.EFECTIVO,
                    "Pago parcial",
                    null
            );

            CustomerPayment saved = CustomerPayment.builder()
                    .id(UUID.randomUUID())
                    .customerId(customerId)
                    .amount(new BigDecimal("10000.00"))
                    .paymentMethod(PaymentMethod.EFECTIVO)
                    .receivedBy(receiverId)
                    .createdAt(OffsetDateTime.now())
                    .build();

            when(customerRepository.findById(customerId)).thenReturn(Optional.of(customer));
            when(userRepository.findByEmailAndDeletedAtIsNull(receiver.getEmail()))
                    .thenReturn(Optional.of(receiver));
            when(customerPaymentRepository.save(any(CustomerPayment.class))).thenReturn(saved);

            // Act
            CustomerPaymentResponse result = customerService.registerPayment(
                    customerId, request, receiver.getEmail()
            );

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.amount()).isEqualByComparingTo(new BigDecimal("10000.00"));
            verify(customerPaymentRepository).save(any(CustomerPayment.class));
        }

        @Test
        @DisplayName("registerPayment_WhenAmountExceedsDebt_ShouldClampToDebt")
        void registerPayment_WhenAmountExceedsDebt_ShouldClampToDebt() {
            // Arrange — customer owes 30000, but we try to pay 99999 (clamped to debt)
            CustomerPaymentRequest request = new CustomerPaymentRequest(
                    new BigDecimal("99999.00"),
                    PaymentMethod.EFECTIVO,
                    "Pago completo",
                    null
            );

            // The service clamps to creditUsed (30000)
            CustomerPayment saved = CustomerPayment.builder()
                    .id(UUID.randomUUID()).customerId(customerId)
                    .amount(new BigDecimal("30000.00"))
                    .paymentMethod(PaymentMethod.EFECTIVO)
                    .receivedBy(receiverId)
                    .createdAt(OffsetDateTime.now()).build();

            when(customerRepository.findById(customerId)).thenReturn(Optional.of(customer));
            when(userRepository.findByEmailAndDeletedAtIsNull(receiver.getEmail()))
                    .thenReturn(Optional.of(receiver));
            when(customerPaymentRepository.save(any(CustomerPayment.class))).thenReturn(saved);

            // Act
            CustomerPaymentResponse result = customerService.registerPayment(
                    customerId, request, receiver.getEmail()
            );

            // Assert — payment amount was clamped to the actual debt
            assertThat(result.amount()).isEqualByComparingTo(new BigDecimal("30000.00"));
            // The saved entity should have amount = min(requested, creditUsed)
            verify(customerPaymentRepository).save(argThat(p ->
                    p.getAmount().compareTo(new BigDecimal("30000.00")) == 0
            ));
        }

        @Test
        @DisplayName("registerPayment_WhenCustomerHasNoDebt_ShouldThrowException")
        void registerPayment_WhenCustomerHasNoDebt_ShouldThrowException() {
            // Arrange — customer has no outstanding balance
            Customer zeroDebtCustomer = Customer.builder()
                    .id(customerId).firstName("María").lastName("González")
                    .creditLimit(new BigDecimal("100000.00"))
                    .creditUsed(BigDecimal.ZERO)    // no debt
                    .active(true).build();

            CustomerPaymentRequest request = new CustomerPaymentRequest(
                    new BigDecimal("1000.00"), PaymentMethod.EFECTIVO, null, null
            );

            when(customerRepository.findById(customerId)).thenReturn(Optional.of(zeroDebtCustomer));
            when(userRepository.findByEmailAndDeletedAtIsNull(receiver.getEmail()))
                    .thenReturn(Optional.of(receiver));

            // Act & Assert
            assertThatThrownBy(() -> customerService.registerPayment(
                    customerId, request, receiver.getEmail()))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("no outstanding credit balance");

            verify(customerPaymentRepository, never()).save(any());
        }

        @Test
        @DisplayName("registerPayment_WhenReceiverNotFound_ShouldThrowException")
        void registerPayment_WhenReceiverNotFound_ShouldThrowException() {
            // Arrange
            CustomerPaymentRequest request = new CustomerPaymentRequest(
                    new BigDecimal("5000.00"), PaymentMethod.EFECTIVO, null, null
            );

            when(customerRepository.findById(customerId)).thenReturn(Optional.of(customer));
            when(userRepository.findByEmailAndDeletedAtIsNull("unknown@email.com"))
                    .thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> customerService.registerPayment(
                    customerId, request, "unknown@email.com"))
                    .isInstanceOf(EntityNotFoundException.class);
        }
    }

    // ── getDebtors ─────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getDebtors()")
    class GetDebtors {

        @Test
        @DisplayName("getDebtors_ShouldReturnOnlyCustomersWithDebt")
        void getDebtors_ShouldReturnOnlyCustomersWithDebt() {
            // Arrange — only the customer with creditUsed > 0 is returned
            when(customerRepository.findByCreditUsedGreaterThanAndDeletedAtIsNull(BigDecimal.ZERO))
                    .thenReturn(List.of(customer));
            when(customerPaymentRepository.findTopByCustomerIdOrderByCreatedAtDesc(customerId))
                    .thenReturn(Optional.empty());

            // Act
            List<CustomerDebtResponse> result = customerService.getDebtors();

            // Assert
            assertThat(result).hasSize(1);
            assertThat(result.get(0).creditUsed())
                    .isEqualByComparingTo(new BigDecimal("30000.00"));
            assertThat(result.get(0).available())
                    .isEqualByComparingTo(new BigDecimal("70000.00")); // 100000 - 30000
        }

        @Test
        @DisplayName("getDebtors_WhenNoDebtors_ShouldReturnEmptyList")
        void getDebtors_WhenNoDebtors_ShouldReturnEmptyList() {
            // Arrange
            when(customerRepository.findByCreditUsedGreaterThanAndDeletedAtIsNull(BigDecimal.ZERO))
                    .thenReturn(List.of());

            // Act
            List<CustomerDebtResponse> result = customerService.getDebtors();

            // Assert
            assertThat(result).isEmpty();
        }
    }
}

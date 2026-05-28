package com.minimarket.modules.customers.service;

import com.minimarket.exception.BusinessException;
import com.minimarket.exception.EntityNotFoundException;
import com.minimarket.modules.customers.domain.Customer;
import com.minimarket.modules.customers.domain.CustomerPayment;
import com.minimarket.modules.customers.dto.*;
import com.minimarket.modules.customers.repository.CustomerPaymentRepository;
import com.minimarket.modules.customers.repository.CustomerRepository;
import com.minimarket.modules.users.domain.User;
import com.minimarket.modules.users.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomerServiceImpl implements CustomerService {

    private final CustomerRepository customerRepository;
    private final CustomerPaymentRepository customerPaymentRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional
    public CustomerResponse createCustomer(CustomerRequest request) {
        if (request.rut() != null && !request.rut().isBlank()) {
            customerRepository.findByRutAndDeletedAtIsNull(request.rut())
                    .ifPresent(existing -> {
                        throw new BusinessException("A customer with RUT '" + request.rut() + "' already exists.");
                    });
        }

        // SECURITY: creditLimit is always initialized to ZERO on creation regardless of the
        // value sent in the request. Only ADMIN/SUPERVISOR can set a credit limit via
        // PATCH /customers/{id}/credit-limit. Allowing the creation endpoint (accessible to
        // CAJERO) to set an arbitrary limit would bypass role-based credit controls.
        Customer customer = Customer.builder()
                .firstName(request.firstName())
                .lastName(request.lastName())
                .rut(request.rut())
                .phone(request.phone())
                .email(request.email())
                .address(request.address())
                .creditLimit(BigDecimal.ZERO)
                .creditUsed(BigDecimal.ZERO)
                .active(true)
                .build();

        Customer saved = customerRepository.save(customer);
        log.info("Customer created: {} {}", saved.getFirstName(), saved.getLastName());
        return toResponse(saved);
    }

    @Override
    @Transactional
    public CustomerResponse updateCustomer(UUID id, CustomerRequest request) {
        Customer customer = findActiveCustomer(id);

        if (request.rut() != null && !request.rut().isBlank()
                && !request.rut().equals(customer.getRut())) {
            customerRepository.findByRutAndDeletedAtIsNull(request.rut())
                    .ifPresent(existing -> {
                        throw new BusinessException("A customer with RUT '" + request.rut() + "' already exists.");
                    });
        }

        customer.setFirstName(request.firstName());
        customer.setLastName(request.lastName());
        if (request.rut() != null) customer.setRut(request.rut());
        if (request.phone() != null) customer.setPhone(request.phone());
        if (request.email() != null) customer.setEmail(request.email());
        if (request.address() != null) customer.setAddress(request.address());
        // SECURITY: creditLimit is intentionally NOT updated here.
        // Credit limit changes must go through PATCH /customers/{id}/credit-limit
        // which enforces ADMIN/SUPERVISOR role and records a mandatory audit reason.

        Customer saved = customerRepository.save(customer);
        log.info("Customer updated: id={}", id);
        return toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public CustomerResponse getCustomer(UUID id) {
        return toResponse(findActiveCustomer(id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CustomerResponse> getAllCustomers(String search, Pageable pageable) {
        Specification<Customer> spec = (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.isNull(root.get("deletedAt")));
            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("firstName")), pattern),
                        cb.like(cb.lower(root.get("lastName")), pattern),
                        cb.like(cb.lower(root.get("rut")), pattern),
                        cb.like(cb.lower(root.get("email")), pattern)
                ));
            }
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
        return customerRepository.findAll(spec, pageable).map(this::toResponse);
    }

    @Override
    @Transactional
    public void deleteCustomer(UUID id) {
        Customer customer = findActiveCustomer(id);
        if (customer.getCreditUsed().compareTo(BigDecimal.ZERO) > 0) {
            throw new BusinessException("Cannot delete customer with outstanding credit balance.");
        }
        customer.setActive(false);
        customer.setDeletedAt(OffsetDateTime.now());
        customerRepository.save(customer);
        log.info("Customer soft-deleted: id={}", id);
    }

    @Override
    @Retryable(
            retryFor = ObjectOptimisticLockingFailureException.class,
            maxAttempts = 3,
            backoff = @Backoff(delay = 100)
    )
    @Transactional
    public CustomerPaymentResponse registerPayment(UUID customerId, CustomerPaymentRequest request, String receiverEmail) {
        Customer customer = findActiveCustomer(customerId);
        User receiver = userRepository.findByEmailAndDeletedAtIsNull(receiverEmail)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + receiverEmail));

        if (customer.getCreditUsed().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("Customer " + customer.getFirstName() + " " + customer.getLastName()
                    + " has no outstanding credit balance.");
        }

        // Clamp payment to actual debt — do not allow overpayment
        BigDecimal paymentAmount = request.amount().min(customer.getCreditUsed());

        CustomerPayment payment = CustomerPayment.builder()
                .customerId(customerId)
                .cashRegisterId(request.cashRegisterId())
                .amount(paymentAmount)
                .paymentMethod(request.paymentMethod())
                .notes(request.notes())
                .receivedBy(receiver.getId())
                .build();

        CustomerPayment saved = customerPaymentRepository.save(payment);
        log.info("Customer payment registered: customerId={} amount={}", customerId, paymentAmount);

        return toPaymentResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CustomerPaymentResponse> getPayments(UUID customerId, Pageable pageable) {
        findActiveCustomer(customerId); // validate customer exists
        return customerPaymentRepository.findAllByCustomerIdOrderByCreatedAtDesc(customerId, pageable)
                .map(this::toPaymentResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CustomerDebtResponse> getDebtors() {
        return customerRepository.findByCreditUsedGreaterThanAndDeletedAtIsNull(BigDecimal.ZERO)
                .stream()
                .map(c -> {
                    OffsetDateTime lastPayment = customerPaymentRepository
                            .findTopByCustomerIdOrderByCreatedAtDesc(c.getId())
                            .map(CustomerPayment::getCreatedAt)
                            .orElse(null);

                    return new CustomerDebtResponse(
                            c.getId(),
                            c.getFirstName() + " " + c.getLastName(),
                            c.getRut(),
                            c.getCreditLimit(),
                            c.getCreditUsed(),
                            c.getCreditLimit().subtract(c.getCreditUsed()),
                            lastPayment
                    );
                })
                .toList();
    }

    @Override
    @Transactional
    public CustomerResponse updateCreditLimit(UUID id, CreditLimitRequest request) {
        Customer customer = findActiveCustomer(id);
        BigDecimal oldLimit = customer.getCreditLimit();
        customer.setCreditLimit(request.newLimit());
        Customer saved = customerRepository.save(customer);
        log.info("Credit limit updated for customer id={} from {} to {} reason='{}'",
                id, oldLimit, request.newLimit(), request.reason());
        return toResponse(saved);
    }

    // ---- private helpers ----

    private Customer findActiveCustomer(UUID id) {
        return customerRepository.findById(id)
                .filter(c -> c.getDeletedAt() == null)
                .orElseThrow(() -> new EntityNotFoundException("Customer", id));
    }

    private CustomerResponse toResponse(Customer c) {
        BigDecimal available = c.getCreditLimit().subtract(c.getCreditUsed())
                .max(BigDecimal.ZERO);
        return new CustomerResponse(
                c.getId(),
                c.getFirstName(),
                c.getLastName(),
                c.getFirstName() + " " + c.getLastName(),
                c.getRut(),
                c.getPhone(),
                c.getEmail(),
                c.getAddress(),
                c.getCreditLimit(),
                c.getCreditUsed(),
                available,
                c.isActive(),
                c.getCreatedAt()
        );
    }

    private CustomerPaymentResponse toPaymentResponse(CustomerPayment p) {
        return new CustomerPaymentResponse(
                p.getId(),
                p.getCustomerId(),
                p.getAmount(),
                p.getPaymentMethod(),
                p.getNotes(),
                p.getCashRegisterId(),
                p.getReceivedBy(),
                p.getCreatedAt()
        );
    }
}

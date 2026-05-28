package com.minimarket.modules.customers.controller;

import com.minimarket.modules.customers.dto.*;
import com.minimarket.modules.customers.service.CustomerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/customers")
@RequiredArgsConstructor
@Tag(name = "Customers", description = "Gestión de clientes y crédito")
public class CustomerController {

    private final CustomerService customerService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','CAJERO','SUPERVISOR')")
    @Operation(summary = "Registrar nuevo cliente")
    public ResponseEntity<CustomerResponse> create(@Valid @RequestBody CustomerRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(customerService.createCustomer(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Operation(summary = "Actualizar datos de cliente")
    public ResponseEntity<CustomerResponse> update(
            @PathVariable UUID id,
            @Valid @RequestBody CustomerRequest request) {
        return ResponseEntity.ok(customerService.updateCustomer(id, request));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','CAJERO','SUPERVISOR')")
    @Operation(summary = "Obtener cliente por ID")
    public ResponseEntity<CustomerResponse> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(customerService.getCustomer(id));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','CAJERO','SUPERVISOR')")
    @Operation(summary = "Listar clientes con filtro opcional por nombre/RUT/email")
    public ResponseEntity<Page<CustomerResponse>> findAll(
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "lastName", direction = Sort.Direction.ASC) Pageable pageable) {
        return ResponseEntity.ok(customerService.getAllCustomers(search, pageable));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Operation(summary = "Eliminar cliente (soft delete)")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        customerService.deleteCustomer(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/payments")
    @PreAuthorize("hasAnyRole('ADMIN','CAJERO','SUPERVISOR')")
    @Operation(summary = "Registrar pago de crédito de cliente")
    public ResponseEntity<CustomerPaymentResponse> registerPayment(
            @PathVariable UUID id,
            @Valid @RequestBody CustomerPaymentRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(customerService.registerPayment(id, request, userDetails.getUsername()));
    }

    @GetMapping("/{id}/payments")
    @PreAuthorize("hasAnyRole('ADMIN','CAJERO','SUPERVISOR')")
    @Operation(summary = "Historial de pagos de un cliente")
    public ResponseEntity<Page<CustomerPaymentResponse>> getPayments(
            @PathVariable UUID id,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(customerService.getPayments(id, pageable));
    }

    @GetMapping("/debtors")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Operation(summary = "Clientes con saldo de crédito pendiente")
    public ResponseEntity<List<CustomerDebtResponse>> getDebtors() {
        return ResponseEntity.ok(customerService.getDebtors());
    }

    @PatchMapping("/{id}/credit-limit")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Operation(summary = "Actualizar límite de crédito de cliente")
    public ResponseEntity<CustomerResponse> updateCreditLimit(
            @PathVariable UUID id,
            @Valid @RequestBody CreditLimitRequest request) {
        return ResponseEntity.ok(customerService.updateCreditLimit(id, request));
    }
}

package com.minimarket.modules.orders.controller;

import com.minimarket.modules.orders.dto.CreateOrderRequest;
import com.minimarket.modules.orders.dto.OrderPaymentRequest;
import com.minimarket.modules.orders.dto.OrderPaymentResponse;
import com.minimarket.modules.orders.dto.OrderResponse;
import com.minimarket.modules.orders.dto.UpdateOrderStatusRequest;
import com.minimarket.modules.orders.service.OrderService;
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
@RequestMapping("/orders")
@RequiredArgsConstructor
@Tag(name = "Orders", description = "Special orders (custom requests) management endpoints")
public class OrderController {

    private final OrderService orderService;

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Create a new special order")
    public ResponseEntity<OrderResponse> create(
            @Valid @RequestBody CreateOrderRequest request,
            @AuthenticationPrincipal UserDetails currentUser) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(orderService.create(request, currentUser.getUsername()));
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "List all orders, optionally filtered by status")
    public ResponseEntity<Page<OrderResponse>> findAll(
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20, sort = "deliveryDate", direction = Sort.Direction.ASC) Pageable pageable) {
        return ResponseEntity.ok(orderService.findAll(status, pageable));
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get order details by ID")
    public ResponseEntity<OrderResponse> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(orderService.findById(id));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN') or hasRole('SUPERVISOR')")
    @Operation(summary = "Update order status (ADMIN and SUPERVISOR only)")
    public ResponseEntity<OrderResponse> updateStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateOrderStatusRequest request) {
        return ResponseEntity.ok(orderService.updateStatus(id, request.status()));
    }

    @PostMapping("/{id}/payments")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Register a partial payment (abono) on an order")
    public ResponseEntity<OrderPaymentResponse> registerPayment(
            @PathVariable UUID id,
            @Valid @RequestBody OrderPaymentRequest request,
            @AuthenticationPrincipal UserDetails currentUser) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(orderService.registerPayment(id, request, currentUser.getUsername()));
    }

    @GetMapping("/{id}/payments")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "List payment history for an order")
    public ResponseEntity<List<OrderPaymentResponse>> getPayments(@PathVariable UUID id) {
        return ResponseEntity.ok(orderService.getPayments(id));
    }
}

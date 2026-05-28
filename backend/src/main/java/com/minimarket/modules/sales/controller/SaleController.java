package com.minimarket.modules.sales.controller;

import com.minimarket.modules.sales.domain.SaleStatus;
import com.minimarket.modules.sales.dto.CreateSaleRequest;
import com.minimarket.modules.sales.dto.SaleResponse;
import com.minimarket.modules.sales.service.SaleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/sales")
@RequiredArgsConstructor
@Tag(name = "Sales", description = "Sales management endpoints")
public class SaleController {

    private final SaleService saleService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('CAJERO')")
    @Operation(summary = "Create and confirm a new sale")
    public ResponseEntity<SaleResponse> create(
            @Valid @RequestBody CreateSaleRequest request,
            @AuthenticationPrincipal UserDetails currentUser) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(saleService.create(request, currentUser.getUsername()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('CAJERO') or hasRole('SUPERVISOR')")
    @Operation(summary = "Get sale by ID")
    public ResponseEntity<SaleResponse> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(saleService.findById(id));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('CAJERO') or hasRole('SUPERVISOR')")
    @Operation(summary = "List sales with optional filters")
    public ResponseEntity<Page<SaleResponse>> findAll(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime endDate,
            @RequestParam(required = false) UUID sellerId,
            @RequestParam(required = false) SaleStatus status,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(saleService.findAll(startDate, endDate, sellerId, status, pageable));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasRole('ADMIN') or hasRole('SUPERVISOR')")
    @Operation(summary = "Cancel a confirmed sale")
    public ResponseEntity<SaleResponse> cancel(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserDetails currentUser) {
        String reason = body.getOrDefault("reason", "No reason provided");
        return ResponseEntity.ok(saleService.cancel(id, reason, currentUser.getUsername()));
    }
}

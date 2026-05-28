package com.minimarket.modules.cash.controller;

import com.minimarket.modules.cash.dto.*;
import com.minimarket.modules.cash.service.CashRegisterService;
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

import java.util.UUID;

@RestController
@RequestMapping("/cash")
@RequiredArgsConstructor
@Tag(name = "Cash Register", description = "Gestión de caja registradora")
public class CashRegisterController {

    private final CashRegisterService cashRegisterService;
    private final com.minimarket.modules.users.repository.UserRepository userRepository;

    @PostMapping("/open")
    @PreAuthorize("hasAnyRole('ADMIN','CAJERO','SUPERVISOR')")
    @Operation(summary = "Abrir caja registradora")
    public ResponseEntity<CashRegisterResponse> open(
            @Valid @RequestBody OpenCashRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID userId = resolveUserId(userDetails.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(cashRegisterService.openCash(userId, request));
    }

    @PatchMapping("/{registerId}/close")
    @PreAuthorize("hasAnyRole('ADMIN','CAJERO','SUPERVISOR')")
    @Operation(summary = "Cerrar caja registradora")
    public ResponseEntity<CashRegisterResponse> close(
            @PathVariable UUID registerId,
            @Valid @RequestBody CloseCashRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID userId = resolveUserId(userDetails.getUsername());
        return ResponseEntity.ok(cashRegisterService.closeCash(registerId, userId, request));
    }

    @GetMapping("/current")
    @PreAuthorize("hasAnyRole('ADMIN','CAJERO','SUPERVISOR')")
    @Operation(summary = "Obtener caja abierta del usuario actual")
    public ResponseEntity<CashRegisterResponse> getCurrent(
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID userId = resolveUserId(userDetails.getUsername());
        return cashRegisterService.getCurrentCash(userId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/{registerId}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Operation(summary = "Obtener caja por ID")
    public ResponseEntity<CashRegisterResponse> getById(@PathVariable UUID registerId) {
        return ResponseEntity.ok(cashRegisterService.getCashById(registerId));
    }

    @GetMapping("/history")
    @PreAuthorize("hasAnyRole('ADMIN','CAJERO','SUPERVISOR')")
    @Operation(summary = "Historial de cajas del usuario actual")
    public ResponseEntity<Page<CashRegisterResponse>> getHistory(
            @AuthenticationPrincipal UserDetails userDetails,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        UUID userId = resolveUserId(userDetails.getUsername());
        return ResponseEntity.ok(cashRegisterService.getCashHistory(userId, pageable));
    }

    @PostMapping("/{registerId}/movements")
    @PreAuthorize("hasAnyRole('ADMIN','CAJERO','SUPERVISOR')")
    @Operation(summary = "Registrar movimiento de caja (INGRESO o EGRESO)")
    public ResponseEntity<CashMovementResponse> addMovement(
            @PathVariable UUID registerId,
            @Valid @RequestBody CashMovementRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID userId = resolveUserId(userDetails.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(cashRegisterService.addMovement(registerId, userId, request));
    }

    @GetMapping("/{registerId}/movements")
    @PreAuthorize("hasAnyRole('ADMIN','CAJERO','SUPERVISOR')")
    @Operation(summary = "Listar movimientos de una caja")
    public ResponseEntity<Page<CashMovementResponse>> getMovements(
            @PathVariable UUID registerId,
            @PageableDefault(size = 50, sort = "createdAt", direction = Sort.Direction.ASC) Pageable pageable) {
        return ResponseEntity.ok(cashRegisterService.getMovements(registerId, pageable));
    }

    @GetMapping("/{registerId}/summary")
    @PreAuthorize("hasAnyRole('ADMIN','CAJERO','SUPERVISOR')")
    @Operation(summary = "Resumen de caja: totales por tipo de movimiento")
    public ResponseEntity<CashSummaryResponse> getSummary(@PathVariable UUID registerId) {
        return ResponseEntity.ok(cashRegisterService.getSummary(registerId));
    }

    // ---- helpers ----

    private UUID resolveUserId(String email) {
        return userRepository.findByEmailAndDeletedAtIsNull(email)
                .orElseThrow(() -> new com.minimarket.exception.EntityNotFoundException("User not found: " + email))
                .getId();
    }
}

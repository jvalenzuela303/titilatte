package com.minimarket.modules.purchases.controller;

import com.minimarket.modules.purchases.dto.*;
import com.minimarket.modules.purchases.service.PurchaseService;
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
@RequestMapping("/purchases")
@RequiredArgsConstructor
@Tag(name = "Purchases", description = "Gestión de compras a proveedores")
public class PurchaseController {

    private final PurchaseService purchaseService;

    // ---- Purchases ----

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','BODEGA','SUPERVISOR')")
    @Operation(summary = "Crear una compra en estado DRAFT")
    public ResponseEntity<PurchaseResponse> create(
            @Valid @RequestBody CreatePurchaseRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(purchaseService.createPurchase(request, userDetails.getUsername()));
    }

    @PatchMapping("/{id}/confirm")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Operation(summary = "Confirmar una compra DRAFT — activa trigger de stock")
    public ResponseEntity<PurchaseResponse> confirm(@PathVariable UUID id) {
        return ResponseEntity.ok(purchaseService.confirmPurchase(id));
    }

    @PatchMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Operation(summary = "Cancelar una compra DRAFT")
    public ResponseEntity<PurchaseResponse> cancel(@PathVariable UUID id) {
        return ResponseEntity.ok(purchaseService.cancelPurchase(id));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','BODEGA','SUPERVISOR','CAJERO')")
    @Operation(summary = "Obtener compra por ID")
    public ResponseEntity<PurchaseResponse> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(purchaseService.getPurchase(id));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','BODEGA','SUPERVISOR')")
    @Operation(summary = "Listar todas las compras paginadas")
    public ResponseEntity<Page<PurchaseResponse>> findAll(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(purchaseService.getAllPurchases(pageable));
    }

    // ---- Suppliers ----

    @PostMapping("/suppliers")
    @PreAuthorize("hasAnyRole('ADMIN','BODEGA','SUPERVISOR')")
    @Operation(summary = "Crear proveedor")
    public ResponseEntity<SupplierResponse> createSupplier(@Valid @RequestBody SupplierRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(purchaseService.createSupplier(request));
    }

    @PutMapping("/suppliers/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','BODEGA','SUPERVISOR')")
    @Operation(summary = "Actualizar proveedor")
    public ResponseEntity<SupplierResponse> updateSupplier(
            @PathVariable UUID id,
            @Valid @RequestBody SupplierRequest request) {
        return ResponseEntity.ok(purchaseService.updateSupplier(id, request));
    }

    @GetMapping("/suppliers")
    @PreAuthorize("hasAnyRole('ADMIN','BODEGA','SUPERVISOR','CAJERO')")
    @Operation(summary = "Listar proveedores activos paginados")
    public ResponseEntity<Page<SupplierResponse>> findAllSuppliers(
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return ResponseEntity.ok(purchaseService.getAllSuppliers(pageable));
    }

    @GetMapping("/suppliers/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','BODEGA','SUPERVISOR','CAJERO')")
    @Operation(summary = "Obtener proveedor por ID")
    public ResponseEntity<SupplierResponse> findSupplierById(@PathVariable UUID id) {
        return ResponseEntity.ok(purchaseService.getSupplier(id));
    }
}

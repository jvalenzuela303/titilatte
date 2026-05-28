package com.minimarket.modules.stock.controller;

import com.minimarket.modules.products.dto.ProductResponse;
import com.minimarket.modules.stock.dto.StockAdjustmentRequest;
import com.minimarket.modules.stock.dto.StockMovementResponse;
import com.minimarket.modules.stock.service.StockService;
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
@RequestMapping("/stock")
@RequiredArgsConstructor
@Tag(name = "Stock", description = "Inventory management endpoints")
public class StockController {

    private final StockService stockService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('BODEGA') or hasRole('SUPERVISOR')")
    @Operation(summary = "List all active products with current stock")
    public ResponseEntity<Page<ProductResponse>> findAllStock(
            @PageableDefault(size = 20, sort = "name", direction = Sort.Direction.ASC) Pageable pageable) {
        return ResponseEntity.ok(stockService.findAllStock(pageable));
    }

    @GetMapping("/low")
    @PreAuthorize("hasRole('ADMIN') or hasRole('BODEGA') or hasRole('SUPERVISOR')")
    @Operation(summary = "List products with stock at or below minimum")
    public ResponseEntity<Page<ProductResponse>> findLowStock(
            @PageableDefault(size = 20, sort = "stockCurrent", direction = Sort.Direction.ASC) Pageable pageable) {
        return ResponseEntity.ok(stockService.findLowStock(pageable));
    }

    @PostMapping("/adjustment")
    @PreAuthorize("hasRole('SUPERVISOR') or hasRole('ADMIN')")
    @Operation(summary = "Register a manual stock adjustment")
    public ResponseEntity<StockMovementResponse> adjust(
            @Valid @RequestBody StockAdjustmentRequest request,
            @AuthenticationPrincipal UserDetails currentUser) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(stockService.adjust(request, currentUser.getUsername()));
    }

    @GetMapping("/movements")
    @PreAuthorize("hasRole('ADMIN') or hasRole('BODEGA') or hasRole('SUPERVISOR')")
    @Operation(summary = "Get stock movement history, optionally filtered by product")
    public ResponseEntity<Page<StockMovementResponse>> findMovements(
            @RequestParam(required = false) UUID productId,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(stockService.findMovements(productId, pageable));
    }
}

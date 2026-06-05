package com.minimarket.modules.promotions.controller;

import com.minimarket.modules.promotions.dto.AppliedPromotionResult;
import com.minimarket.modules.promotions.dto.ApplyPromotionRequest;
import com.minimarket.modules.promotions.dto.PromotionImpactDto;
import com.minimarket.modules.promotions.dto.PromotionRequest;
import com.minimarket.modules.promotions.dto.PromotionResponse;
import com.minimarket.modules.promotions.service.PromotionService;
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

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/promotions")
@RequiredArgsConstructor
@Tag(name = "Promotions", description = "Promotion management and POS pricing endpoints")
public class PromotionController {

    private final PromotionService promotionService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "List all promotions with optional active filter")
    public ResponseEntity<Page<PromotionResponse>> findAll(
            @RequestParam(defaultValue = "false") boolean active,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(promotionService.findAll(active, pageable));
    }

    @GetMapping("/active")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "List all currently active promotions — used by POS on load")
    public ResponseEntity<List<PromotionResponse>> findActiveNow() {
        return ResponseEntity.ok(promotionService.findActiveNow());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "Get promotion by ID")
    public ResponseEntity<PromotionResponse> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(promotionService.findById(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Create a new promotion")
    public ResponseEntity<PromotionResponse> create(
            @Valid @RequestBody PromotionRequest request,
            @AuthenticationPrincipal UserDetails currentUser) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(promotionService.create(request, currentUser.getUsername()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Update an existing promotion")
    public ResponseEntity<PromotionResponse> update(
            @PathVariable UUID id,
            @Valid @RequestBody PromotionRequest request) {
        return ResponseEntity.ok(promotionService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Deactivate (soft delete) a promotion")
    public ResponseEntity<Void> deactivate(@PathVariable UUID id) {
        promotionService.deactivate(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/apply")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Apply the best promotion for a product+quantity at POS")
    public ResponseEntity<AppliedPromotionResult> applyBestPromotion(
            @Valid @RequestBody ApplyPromotionRequest request) {
        Optional<AppliedPromotionResult> result = promotionService.applyBestPromotion(
                request.productId(), request.quantity(), request.branchId());
        return result.map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @GetMapping("/impact")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "Get promotion impact report for a date range")
    public ResponseEntity<Map<UUID, PromotionImpactDto>> getImpactReport(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(promotionService.getImpactReport(from, to));
    }
}

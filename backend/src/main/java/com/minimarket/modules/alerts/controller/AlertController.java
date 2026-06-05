package com.minimarket.modules.alerts.controller;

import com.minimarket.modules.alerts.dto.AlertHistoryResponse;
import com.minimarket.modules.alerts.dto.AlertRuleRequest;
import com.minimarket.modules.alerts.dto.AlertRuleResponse;
import com.minimarket.modules.alerts.service.AlertService;
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
@RequestMapping("/alerts")
@RequiredArgsConstructor
@Tag(name = "Alerts", description = "Configurable alert rules and history")
public class AlertController {

    private final AlertService alertService;

    // -------------------------------------------------------------------------
    // Rules
    // -------------------------------------------------------------------------

    @GetMapping("/rules")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "List all alert rules (non-deleted)")
    public ResponseEntity<Page<AlertRuleResponse>> findAllRules(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(alertService.findAllRules(pageable));
    }

    @PostMapping("/rules")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Create a new alert rule")
    public ResponseEntity<AlertRuleResponse> createRule(
            @Valid @RequestBody AlertRuleRequest request,
            @AuthenticationPrincipal UserDetails currentUser) {

        if (!request.isThresholdValid()) {
            return ResponseEntity.badRequest().build();
        }

        AlertRuleResponse response = alertService.createRule(request, currentUser.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/rules/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Update an existing alert rule")
    public ResponseEntity<AlertRuleResponse> updateRule(
            @PathVariable UUID id,
            @Valid @RequestBody AlertRuleRequest request) {

        if (!request.isThresholdValid()) {
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok(alertService.updateRule(id, request));
    }

    @DeleteMapping("/rules/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Soft-delete (deactivate) an alert rule")
    public ResponseEntity<Void> deactivateRule(@PathVariable UUID id) {
        alertService.deactivateRule(id);
        return ResponseEntity.noContent().build();
    }

    // -------------------------------------------------------------------------
    // History
    // -------------------------------------------------------------------------

    @GetMapping("/history")
    @PreAuthorize("hasRole('ADMIN') or hasRole('SUPERVISOR')")
    @Operation(summary = "Get alert history, ordered by most recent first")
    public ResponseEntity<Page<AlertHistoryResponse>> getHistory(
            @PageableDefault(size = 20, sort = "triggeredAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(alertService.getHistory(pageable));
    }

    @PatchMapping("/history/{id}/acknowledge")
    @PreAuthorize("hasRole('ADMIN') or hasRole('SUPERVISOR')")
    @Operation(summary = "Acknowledge an alert history entry")
    public ResponseEntity<AlertHistoryResponse> acknowledge(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails currentUser) {
        return ResponseEntity.ok(alertService.acknowledge(id, currentUser.getUsername()));
    }

    // -------------------------------------------------------------------------
    // Manual evaluation
    // -------------------------------------------------------------------------

    @PostMapping("/evaluate")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Trigger immediate evaluation of all active alert rules")
    public ResponseEntity<String> evaluate() {
        alertService.evaluateAllRules();
        return ResponseEntity.ok("Evaluation triggered");
    }
}

package com.minimarket.dashboard.controller;

import com.minimarket.dashboard.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    /**
     * Requires at least one known application role.
     * The service layer further segments the response by the caller's actual role —
     * CAJERO/BODEGA receive only their own data, SUPERVISOR sees open registers,
     * ADMIN sees global KPIs. The @PreAuthorize here acts as a first-level gate that
     * rejects tokens with no recognised role (e.g. a service account or a tampered JWT).
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'CAJERO', 'BODEGA')")
    public ResponseEntity<Object> getDashboard(Authentication authentication) {
        return ResponseEntity.ok(dashboardService.getDashboardForCurrentUser(authentication));
    }
}

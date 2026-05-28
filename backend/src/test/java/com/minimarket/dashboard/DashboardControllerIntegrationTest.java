package com.minimarket.dashboard;

import com.minimarket.BaseIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for DashboardController.
 *
 * Each role must receive a response with the correct dashboardType field.
 * The H2 database starts empty so KPI values are zero — only the structural
 * shape of the response is asserted here.
 */
@DisplayName("DashboardController - Integration Tests")
class DashboardControllerIntegrationTest extends BaseIntegrationTest {

    private static final String DASHBOARD_PATH = "/api/v1/dashboard";

    // ── Authentication ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("GET /dashboard sin auth → 401")
    void getDashboardWithoutToken_ShouldReturn401() throws Exception {
        mockMvc.perform(get(DASHBOARD_PATH))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /dashboard con token inválido → 401")
    void getDashboardWithInvalidToken_ShouldReturn401() throws Exception {
        mockMvc.perform(get(DASHBOARD_PATH)
                        .header("Authorization", "Bearer this.is.not.valid"))
                .andExpect(status().isUnauthorized());
    }

    // ── ADMIN ──────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("GET /dashboard con ADMIN → 200, dashboardType = 'ADMIN'")
    void getDashboardAsAdmin_ShouldReturnAdminResponse() throws Exception {
        mockMvc.perform(get(DASHBOARD_PATH)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dashboardType").value("ADMIN"))
                .andExpect(jsonPath("$.salesToday").exists())
                .andExpect(jsonPath("$.saleCountToday").exists())
                .andExpect(jsonPath("$.lowStockCount").exists())
                .andExpect(jsonPath("$.last7Days").isArray())
                .andExpect(jsonPath("$.last30Days").isArray());
    }

    // ── SUPERVISOR ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("GET /dashboard con SUPERVISOR → 200, dashboardType = 'SUPERVISOR'")
    void getDashboardAsSupervisor_ShouldReturnSupervisorResponse() throws Exception {
        mockMvc.perform(get(DASHBOARD_PATH)
                        .header("Authorization", "Bearer " + supervisorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dashboardType").value("SUPERVISOR"))
                .andExpect(jsonPath("$.openCashRegisters").isArray())
                .andExpect(jsonPath("$.sellerStatsToday").isArray())
                .andExpect(jsonPath("$.lowStockCount").exists());
    }

    // ── CAJERO ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("GET /dashboard con CAJERO → 200, dashboardType = 'CASHIER'")
    void getDashboardAsCajero_ShouldReturnCashierResponse() throws Exception {
        mockMvc.perform(get(DASHBOARD_PATH)
                        .header("Authorization", "Bearer " + cajeroToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dashboardType").value("CASHIER"))
                .andExpect(jsonPath("$.myTotalSalesToday").exists())
                .andExpect(jsonPath("$.mySaleCountToday").exists());
    }

    // ── BODEGA ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("GET /dashboard con BODEGA → 200, dashboardType = 'CASHIER'")
    void getDashboardAsBodega_ShouldReturnCashierResponse() throws Exception {
        // BODEGA does not have ADMIN/SUPERVISOR role — falls through to cashier branch
        mockMvc.perform(get(DASHBOARD_PATH)
                        .header("Authorization", "Bearer " + bodegaToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dashboardType").value("CASHIER"));
    }

    // ── Content-Type ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("GET /dashboard → Content-Type application/json")
    void getDashboard_ShouldReturnJsonContentType() throws Exception {
        mockMvc.perform(get(DASHBOARD_PATH)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(content().contentType(
                        org.springframework.http.MediaType.APPLICATION_JSON));
    }
}

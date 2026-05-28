package com.minimarket.modules.reports;

import com.minimarket.BaseIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("ReportController - Integration Tests")
class ReportControllerIntegrationTest extends BaseIntegrationTest {

    private static final String BASE_PATH = "/api/v1/reports";

    // ── GET /reports/sales ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("GET /reports/sales")
    class GetSalesReport {

        @Test
        @DisplayName("should return 200 when ADMIN requests the sales report")
        void getSalesReport_WithAdminRole_ShouldReturn200() throws Exception {
            mockMvc.perform(get(BASE_PATH + "/sales")
                            .header("Authorization", "Bearer " + adminToken)
                            .param("startDate", "2026-05-01")
                            .param("endDate", "2026-05-31"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalSales").exists());
        }

        @Test
        @DisplayName("should return 403 when CAJERO requests the sales report")
        void getSalesReport_WithCajeroRole_ShouldReturn403() throws Exception {
            mockMvc.perform(get(BASE_PATH + "/sales")
                            .header("Authorization", "Bearer " + cajeroToken)
                            .param("startDate", "2026-05-01")
                            .param("endDate", "2026-05-31"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("should return 200 when SUPERVISOR requests the sales report")
        void getSalesReport_WithSupervisorRole_ShouldReturn200() throws Exception {
            mockMvc.perform(get(BASE_PATH + "/sales")
                            .header("Authorization", "Bearer " + supervisorToken)
                            .param("startDate", "2026-05-01")
                            .param("endDate", "2026-05-31"))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("should return 400 when startDate parameter is missing")
        void getSalesReport_WithoutStartDate_ShouldReturn400() throws Exception {
            mockMvc.perform(get(BASE_PATH + "/sales")
                            .header("Authorization", "Bearer " + adminToken)
                            .param("endDate", "2026-05-31"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("should return 403 when BODEGA role requests the sales report")
        void getSalesReport_WithBodegaRole_ShouldReturn403() throws Exception {
            mockMvc.perform(get(BASE_PATH + "/sales")
                            .header("Authorization", "Bearer " + bodegaToken)
                            .param("startDate", "2026-05-01")
                            .param("endDate", "2026-05-31"))
                    .andExpect(status().isForbidden());
        }
    }

    // ── GET /reports/profit ────────────────────────────────────────────────────

    @Nested
    @DisplayName("GET /reports/profit")
    class GetProfitReport {

        @Test
        @DisplayName("should return 400 when startDate is missing")
        void getProfitReport_WithoutStartDate_ShouldReturn400() throws Exception {
            mockMvc.perform(get(BASE_PATH + "/profit")
                            .header("Authorization", "Bearer " + adminToken)
                            .param("endDate", "2026-05-31"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("should return 200 with profit data when ADMIN requests")
        void getProfitReport_WithAdminRole_ShouldReturn200() throws Exception {
            mockMvc.perform(get(BASE_PATH + "/profit")
                            .header("Authorization", "Bearer " + adminToken)
                            .param("startDate", "2026-05-01")
                            .param("endDate", "2026-05-31"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalRevenue").exists())
                    .andExpect(jsonPath("$.profitMargin").exists());
        }
    }

    // ── GET /reports/top-products ──────────────────────────────────────────────

    @Nested
    @DisplayName("GET /reports/top-products")
    class GetTopProducts {

        @Test
        @DisplayName("should return 200 with at most limit items when ADMIN requests top-products")
        void getTopProducts_WithLimit5_ShouldReturnMaxFiveItems() throws Exception {
            mockMvc.perform(get(BASE_PATH + "/top-products")
                            .header("Authorization", "Bearer " + adminToken)
                            .param("startDate", "2026-05-01")
                            .param("endDate", "2026-05-31")
                            .param("limit", "5"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$").isArray())
                    // result list must have at most 5 elements
                    .andExpect(jsonPath("$.length()").value(
                            org.hamcrest.Matchers.lessThanOrEqualTo(5)));
        }

        @Test
        @DisplayName("should return 403 when CAJERO requests top-products")
        void getTopProducts_WithCajeroRole_ShouldReturn403() throws Exception {
            mockMvc.perform(get(BASE_PATH + "/top-products")
                            .header("Authorization", "Bearer " + cajeroToken)
                            .param("startDate", "2026-05-01")
                            .param("endDate", "2026-05-31"))
                    .andExpect(status().isForbidden());
        }
    }

    // ── GET /reports/export/excel ──────────────────────────────────────────────

    @Nested
    @DisplayName("GET /reports/export/excel")
    class ExportExcel {

        @Test
        @DisplayName("should return 200 with correct Content-Type when ADMIN exports sales excel")
        void exportExcel_WithAdminRole_ShouldReturnXlsxContentType() throws Exception {
            mockMvc.perform(get(BASE_PATH + "/export/excel")
                            .header("Authorization", "Bearer " + adminToken)
                            .param("reportType", "sales")
                            .param("startDate", "2026-05-01")
                            .param("endDate", "2026-05-31"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Type",
                            org.hamcrest.Matchers.containsString(
                                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")));
        }

        @Test
        @DisplayName("should return 403 when CAJERO tries to export excel")
        void exportExcel_WithCajeroRole_ShouldReturn403() throws Exception {
            mockMvc.perform(get(BASE_PATH + "/export/excel")
                            .header("Authorization", "Bearer " + cajeroToken)
                            .param("reportType", "sales"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("should return 200 for debtors export with SUPERVISOR role")
        void exportExcel_Debtors_WithSupervisorRole_ShouldReturn200() throws Exception {
            mockMvc.perform(get(BASE_PATH + "/export/excel")
                            .header("Authorization", "Bearer " + supervisorToken)
                            .param("reportType", "debtors"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Type",
                            org.hamcrest.Matchers.containsString(
                                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")));
        }
    }

    // ── GET /reports/debtors ───────────────────────────────────────────────────

    @Nested
    @DisplayName("GET /reports/debtors")
    class GetDebtors {

        @Test
        @DisplayName("should return 403 when BODEGA requests debtors report")
        void getDebtors_WithBodegaRole_ShouldReturn403() throws Exception {
            mockMvc.perform(get(BASE_PATH + "/debtors")
                            .header("Authorization", "Bearer " + bodegaToken))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("should return 200 when ADMIN requests debtors report")
        void getDebtors_WithAdminRole_ShouldReturn200() throws Exception {
            mockMvc.perform(get(BASE_PATH + "/debtors")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$").isArray());
        }
    }
}

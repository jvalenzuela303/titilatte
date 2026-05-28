package com.minimarket.audit;

import com.minimarket.BaseIntegrationTest;
import com.minimarket.audit.domain.AuditLog;
import com.minimarket.audit.repository.AuditLogRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for AuditController.
 * All tests extend BaseIntegrationTest which provides JWT tokens for all roles
 * and rolls back after each test via @Transactional.
 */
@DisplayName("AuditController - Integration Tests")
class AuditControllerIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private AuditLogRepository auditLogRepository;

    private static final String AUDIT_PATH = "/api/v1/audit";
    private static final String EXPORT_PATH = "/api/v1/audit/export/excel";

    @Override
    protected void setUpModule() {
        // Seed two audit log entries for filter tests
        auditLogRepository.save(AuditLog.builder()
                .entityType("SALE")
                .entityId(UUID.randomUUID())
                .action("CANCEL")
                .reason("Producto defectuoso")
                .performedBy(null)
                .createdAt(LocalDateTime.now())
                .build());

        auditLogRepository.save(AuditLog.builder()
                .entityType("PRODUCT")
                .entityId(UUID.randomUUID())
                .action("PRICE_CHANGE")
                .performedBy(null)
                .createdAt(LocalDateTime.now())
                .build());
    }

    // ── Role-based access control ──────────────────────────────────────────────

    @Nested
    @DisplayName("GET /audit — access control")
    class AccessControl {

        @Test
        @DisplayName("GET /audit con ADMIN → 200")
        void getAuditLogsAsAdmin_ShouldReturn200() throws Exception {
            mockMvc.perform(get(AUDIT_PATH)
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content").isArray());
        }

        @Test
        @DisplayName("GET /audit con SUPERVISOR → 403")
        void getAuditLogsAsSupervisor_ShouldReturn403() throws Exception {
            mockMvc.perform(get(AUDIT_PATH)
                            .header("Authorization", "Bearer " + supervisorToken))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("GET /audit con CAJERO → 403")
        void getAuditLogsAsCajero_ShouldReturn403() throws Exception {
            mockMvc.perform(get(AUDIT_PATH)
                            .header("Authorization", "Bearer " + cajeroToken))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("GET /audit con BODEGA → 403")
        void getAuditLogsAsBodega_ShouldReturn403() throws Exception {
            mockMvc.perform(get(AUDIT_PATH)
                            .header("Authorization", "Bearer " + bodegaToken))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("GET /audit sin token → 401")
        void getAuditLogsWithoutToken_ShouldReturn401() throws Exception {
            mockMvc.perform(get(AUDIT_PATH))
                    .andExpect(status().isUnauthorized());
        }
    }

    // ── Filtering ──────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("GET /audit — filtering")
    class Filtering {

        @Test
        @DisplayName("GET /audit?entityType=SALE&action=CANCEL → filtra correctamente")
        void getAuditLogsWithFilters_ShouldReturnOnlyMatchingEntries() throws Exception {
            mockMvc.perform(get(AUDIT_PATH)
                            .header("Authorization", "Bearer " + adminToken)
                            .param("entityType", "SALE")
                            .param("action", "CANCEL"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content").isArray())
                    .andExpect(jsonPath("$.content[0].entityType").value("SALE"))
                    .andExpect(jsonPath("$.content[0].action").value("CANCEL"));
        }

        @Test
        @DisplayName("GET /audit?entityType=PRODUCT → retorna solo registros de PRODUCT")
        void getAuditLogsFilteredByEntityType_ShouldReturnOnlyProducts() throws Exception {
            mockMvc.perform(get(AUDIT_PATH)
                            .header("Authorization", "Bearer " + adminToken)
                            .param("entityType", "PRODUCT"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content").isArray())
                    .andExpect(jsonPath("$.content[0].entityType").value("PRODUCT"));
        }

        @Test
        @DisplayName("GET /audit con paginación → respeta page y size")
        void getAuditLogsWithPagination_ShouldRespectPageAndSize() throws Exception {
            mockMvc.perform(get(AUDIT_PATH)
                            .header("Authorization", "Bearer " + adminToken)
                            .param("page", "0")
                            .param("size", "1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.size").value(1))
                    .andExpect(jsonPath("$.totalElements").isNumber());
        }
    }

    // ── Excel export ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("GET /audit/export/excel")
    class ExcelExport {

        @Test
        @DisplayName("GET /audit/export/excel con ADMIN → 200, Content-Type correcto")
        void exportExcelAsAdmin_ShouldReturn200WithXlsxContentType() throws Exception {
            mockMvc.perform(get(EXPORT_PATH)
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Disposition",
                            org.hamcrest.Matchers.startsWith("attachment; filename=")))
                    .andExpect(content().contentType(
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        }

        @Test
        @DisplayName("GET /audit/export/excel con SUPERVISOR → 403")
        void exportExcelAsSupervisor_ShouldReturn403() throws Exception {
            mockMvc.perform(get(EXPORT_PATH)
                            .header("Authorization", "Bearer " + supervisorToken))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("GET /audit/export/excel retorna bytes XLSX válidos")
        void exportExcelAsAdmin_ShouldReturnValidXlsxBytes() throws Exception {
            byte[] body = mockMvc.perform(get(EXPORT_PATH)
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsByteArray();

            // Assert — XLSX magic bytes PK (ZIP container)
            assertThat(body).isNotEmpty();
            assertThat(body[0]).isEqualTo((byte) 0x50);
            assertThat(body[1]).isEqualTo((byte) 0x4B);
        }
    }

    // ── Audit log creation on sale cancellation ────────────────────────────────

    @Nested
    @DisplayName("Audit log created on business operations")
    class AuditLogCreation {

        @Test
        @DisplayName("Guardar audit log directamente → registro visible en /audit")
        void savedAuditLog_ShouldBeVisibleInAuditEndpoint() throws Exception {
            // Arrange — persist a known audit entry
            String knownEntityType = "CASH_REGISTER";
            auditLogRepository.save(AuditLog.builder()
                    .entityType(knownEntityType)
                    .entityId(UUID.randomUUID())
                    .action("CLOSE")
                    .performedBy(null)
                    .createdAt(LocalDateTime.now())
                    .build());

            // Act + Assert
            mockMvc.perform(get(AUDIT_PATH)
                            .header("Authorization", "Bearer " + adminToken)
                            .param("entityType", knownEntityType))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements").value(
                            org.hamcrest.Matchers.greaterThanOrEqualTo(1)));
        }
    }
}

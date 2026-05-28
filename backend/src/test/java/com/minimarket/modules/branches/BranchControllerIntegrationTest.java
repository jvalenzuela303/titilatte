package com.minimarket.modules.branches;

import com.minimarket.BaseIntegrationTest;
import com.minimarket.modules.branches.domain.Branch;
import com.minimarket.modules.branches.repository.BranchRepository;
import com.minimarket.modules.branches.dto.BranchRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("BranchController - Integration Tests")
class BranchControllerIntegrationTest extends BaseIntegrationTest {

    private static final String BASE_PATH = "/api/v1/branches";

    @Autowired
    private BranchRepository branchRepository;

    // ── Module fixtures ───────────────────────────────────────────────────────

    @Override
    protected void setUpModule() {
        // Seed at least one branch so GET /branches returns non-empty list
        branchRepository.save(Branch.builder()
                .name("Sucursal Test")
                .address("Av. Test 123")
                .phone("+56211111111")
                .rut("76.000.001-K")
                .isActive(true)
                .build());
    }

    // ── GET /api/v1/branches ──────────────────────────────────────────────────

    @Nested
    @DisplayName("GET /api/v1/branches")
    class GetAll {

        @Test
        @DisplayName("GET /branches — ADMIN → 200 con lista de branches")
        void getAll_adminRole_returns200() throws Exception {
            mockMvc.perform(get(BASE_PATH)
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$").isArray())
                    .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
        }

        @Test
        @DisplayName("GET /branches — SUPERVISOR → 200")
        void getAll_supervisorRole_returns200() throws Exception {
            mockMvc.perform(get(BASE_PATH)
                            .header("Authorization", "Bearer " + supervisorToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$").isArray());
        }

        @Test
        @DisplayName("GET /branches — CAJERO → 403 (solo ADMIN y SUPERVISOR)")
        void getAll_cajeroRole_returns403() throws Exception {
            mockMvc.perform(get(BASE_PATH)
                            .header("Authorization", "Bearer " + cajeroToken))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("GET /branches — sin autenticación → 401")
        void getAll_noAuth_returns401() throws Exception {
            mockMvc.perform(get(BASE_PATH))
                    .andExpect(status().isUnauthorized());
        }
    }

    // ── POST /api/v1/branches ─────────────────────────────────────────────────

    @Nested
    @DisplayName("POST /api/v1/branches")
    class Create {

        @Test
        @DisplayName("POST /branches — ADMIN, body válido → 201 con branch creado")
        void create_adminValidBody_returns201() throws Exception {
            BranchRequest request = new BranchRequest(
                    "Nueva Sucursal Este",
                    "Av. Este 777, Santiago",
                    "+56233334444",
                    "77.777.777-7"
            );

            mockMvc.perform(post(BASE_PATH)
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").exists())
                    .andExpect(jsonPath("$.name").value("Nueva Sucursal Este"))
                    .andExpect(jsonPath("$.isActive").value(true));
        }

        @Test
        @DisplayName("POST /branches — SUPERVISOR → 403")
        void create_supervisorRole_returns403() throws Exception {
            BranchRequest request = new BranchRequest("X", null, null, null);

            mockMvc.perform(post(BASE_PATH)
                            .header("Authorization", "Bearer " + supervisorToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("POST /branches — body sin nombre → 400 Bad Request")
        void create_missingName_returns400() throws Exception {
            // JSON con nombre en blanco — viola @NotBlank
            String bodyWithBlankName = "{\"name\":\"\",\"address\":\"Some Address\"}";

            mockMvc.perform(post(BASE_PATH)
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(bodyWithBlankName))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("POST /branches — body sin campo name → 400 Bad Request")
        void create_missingNameField_returns400() throws Exception {
            String bodyWithoutName = "{\"address\":\"Av. X 123\"}";

            mockMvc.perform(post(BASE_PATH)
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(bodyWithoutName))
                    .andExpect(status().isBadRequest());
        }
    }

    // ── DELETE /api/v1/branches/{id} ──────────────────────────────────────────

    @Nested
    @DisplayName("DELETE /api/v1/branches/{id}")
    class Deactivate {

        @Test
        @DisplayName("DELETE /branches/{id} — ADMIN → 204")
        void deactivate_adminRole_returns204() throws Exception {
            // Arrange — crear sucursal para desactivar
            Branch branch = branchRepository.save(Branch.builder()
                    .name("Sucursal Para Desactivar")
                    .isActive(true)
                    .build());

            mockMvc.perform(delete(BASE_PATH + "/" + branch.getId())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNoContent());
        }

        @Test
        @DisplayName("DELETE /branches/{id} — SUPERVISOR → 403")
        void deactivate_supervisorRole_returns403() throws Exception {
            Branch branch = branchRepository.save(Branch.builder()
                    .name("Sucursal No Tocar")
                    .isActive(true)
                    .build());

            mockMvc.perform(delete(BASE_PATH + "/" + branch.getId())
                            .header("Authorization", "Bearer " + supervisorToken))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("DELETE /branches/{id} — id inexistente → 404")
        void deactivate_nonExistingId_returns404() throws Exception {
            mockMvc.perform(delete(BASE_PATH + "/" + UUID.randomUUID())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNotFound());
        }
    }
}

package com.minimarket.modules.cash;

import com.minimarket.BaseIntegrationTest;
import com.minimarket.modules.cash.domain.CashMovementType;
import com.minimarket.modules.cash.domain.MovementCategory;
import com.minimarket.modules.cash.dto.CashMovementRequest;
import com.minimarket.modules.cash.dto.CloseCashRequest;
import com.minimarket.modules.cash.dto.OpenCashRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("CashRegisterController - Integration Tests")
class CashRegisterControllerIntegrationTest extends BaseIntegrationTest {

    private static final String BASE_PATH = "/api/v1/cash";

    // ── Helper ────────────────────────────────────────────────────────────────

    private UUID openCash(String authToken) throws Exception {
        OpenCashRequest request = new OpenCashRequest(new BigDecimal("50000.00"), "Apertura test");
        MvcResult result = mockMvc.perform(post(BASE_PATH + "/open")
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();
        return UUID.fromString(
                objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
    }

    // ── POST /cash/open ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("POST /cash/open")
    class OpenCash {

        @Test
        @DisplayName("should return 201 OPEN when CAJERO opens a cash register")
        void openCash_WithCajeroRole_ShouldReturn201Open() throws Exception {
            OpenCashRequest request = new OpenCashRequest(new BigDecimal("50000.00"), "Apertura diaria");

            mockMvc.perform(post(BASE_PATH + "/open")
                            .header("Authorization", "Bearer " + cajeroToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.status").value("OPEN"))
                    .andExpect(jsonPath("$.openingAmount").value(50000.0));
        }

        @Test
        @DisplayName("should return 409 when the same cashier opens a second cash register")
        void openCash_WhenAlreadyOpen_ShouldReturn409() throws Exception {
            OpenCashRequest request = new OpenCashRequest(new BigDecimal("50000.00"), null);

            // First open — succeeds
            mockMvc.perform(post(BASE_PATH + "/open")
                            .header("Authorization", "Bearer " + cajeroToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated());

            // Second open with same token — must return 409
            mockMvc.perform(post(BASE_PATH + "/open")
                            .header("Authorization", "Bearer " + cajeroToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isConflict());
        }
    }

    // ── GET /cash/current ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("GET /cash/current")
    class GetCurrentCash {

        @Test
        @DisplayName("should return 200 with cash details when a register is open")
        void getCurrentCash_WhenOpen_ShouldReturn200() throws Exception {
            openCash(cajeroToken); // make sure there is an open register

            mockMvc.perform(get(BASE_PATH + "/current")
                            .header("Authorization", "Bearer " + cajeroToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("OPEN"));
        }

        @Test
        @DisplayName("should return 404 when the cashier has no open register")
        void getCurrentCash_WhenNoCashOpen_ShouldReturn404() throws Exception {
            // supervisorToken user never opened a cash register in this test
            mockMvc.perform(get(BASE_PATH + "/current")
                            .header("Authorization", "Bearer " + supervisorToken))
                    .andExpect(status().isNotFound());
        }
    }

    // ── PATCH /cash/{id}/close ─────────────────────────────────────────────────

    @Nested
    @DisplayName("PATCH /cash/{id}/close")
    class CloseCash {

        @Test
        @DisplayName("should return 200 CLOSED when cashier closes their own register")
        void closeCash_WhenOpen_ShouldReturn200Closed() throws Exception {
            UUID registerId = openCash(cajeroToken);
            CloseCashRequest request = new CloseCashRequest(new BigDecimal("50000.00"), "Cierre test");

            mockMvc.perform(patch(BASE_PATH + "/" + registerId + "/close")
                            .header("Authorization", "Bearer " + cajeroToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("CLOSED"));
        }
    }

    // ── POST /cash/{id}/movements ──────────────────────────────────────────────

    @Nested
    @DisplayName("POST /cash/{id}/movements")
    class AddMovement {

        @Test
        @DisplayName("should return 201 when adding an INGRESO movement")
        void addMovement_Ingreso_ShouldReturn201() throws Exception {
            UUID registerId = openCash(cajeroToken);
            CashMovementRequest request = new CashMovementRequest(
                    CashMovementType.INGRESO,
                    MovementCategory.DEPOSITO,
                    new BigDecimal("5000.00"),
                    "Fondo para cambio"
            );

            mockMvc.perform(post(BASE_PATH + "/" + registerId + "/movements")
                            .header("Authorization", "Bearer " + cajeroToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.movementType").value("INGRESO"));
        }

        @Test
        @DisplayName("should return 422 when movementType is VENTA (not allowed via this endpoint)")
        void addMovement_WithVentaType_ShouldReturn422() throws Exception {
            UUID registerId = openCash(cajeroToken);
            CashMovementRequest request = new CashMovementRequest(
                    CashMovementType.VENTA,
                    null,
                    new BigDecimal("1000.00"),
                    "Venta manual inválida"
            );

            mockMvc.perform(post(BASE_PATH + "/" + registerId + "/movements")
                            .header("Authorization", "Bearer " + cajeroToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnprocessableEntity());
        }

        @Test
        @DisplayName("should return 201 when adding an EGRESO movement")
        void addMovement_Egreso_ShouldReturn201() throws Exception {
            UUID registerId = openCash(cajeroToken);
            CashMovementRequest request = new CashMovementRequest(
                    CashMovementType.EGRESO,
                    MovementCategory.RETIRO,
                    new BigDecimal("2000.00"),
                    "Retiro parcial"
            );

            mockMvc.perform(post(BASE_PATH + "/" + registerId + "/movements")
                            .header("Authorization", "Bearer " + cajeroToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.movementType").value("EGRESO"));
        }
    }
}

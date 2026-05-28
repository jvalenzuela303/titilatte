package com.minimarket.modules.customers;

import com.minimarket.BaseIntegrationTest;
import com.minimarket.modules.customers.domain.Customer;
import com.minimarket.modules.customers.dto.CreditLimitRequest;
import com.minimarket.modules.customers.dto.CustomerPaymentRequest;
import com.minimarket.modules.customers.dto.CustomerRequest;
import com.minimarket.modules.customers.repository.CustomerRepository;
import com.minimarket.modules.sales.domain.PaymentMethod;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("CustomerController - Integration Tests")
class CustomerControllerIntegrationTest extends BaseIntegrationTest {

    private static final String BASE_PATH = "/api/v1/customers";

    @Autowired
    private CustomerRepository customerRepository;

    // ── Helper ────────────────────────────────────────────────────────────────

    private UUID createCustomer(String rut) throws Exception {
        CustomerRequest request = new CustomerRequest(
                "Test", "Customer", rut,
                "+56900000001", "test@customer.cl", "Calle Test 1",
                new BigDecimal("50000.00")
        );
        MvcResult result = mockMvc.perform(post(BASE_PATH)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();
        return UUID.fromString(
                objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
    }

    private UUID createCustomerWithDebt() {
        Customer customer = Customer.builder()
                .firstName("Deudor").lastName("Test")
                .rut("55.555.555-5")
                .creditLimit(new BigDecimal("100000.00"))
                .creditUsed(new BigDecimal("30000.00"))
                .active(true).build();
        return customerRepository.save(customer).getId();
    }

    // ── POST /customers ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("POST /customers")
    class CreateCustomer {

        @Test
        @DisplayName("should return 201 when authenticated user creates a customer")
        void createCustomer_WithAuth_ShouldReturn201() throws Exception {
            CustomerRequest request = new CustomerRequest(
                    "Ana", "López", "11.111.111-1",
                    "+56912345678", "ana@test.cl", "Calle Test 123",
                    new BigDecimal("75000.00")
            );

            mockMvc.perform(post(BASE_PATH)
                            .header("Authorization", "Bearer " + cajeroToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.firstName").value("Ana"))
                    .andExpect(jsonPath("$.creditUsed").value(0));
        }

        @Test
        @DisplayName("should return 401 without authentication")
        void createCustomer_WithoutAuth_ShouldReturn401() throws Exception {
            CustomerRequest request = new CustomerRequest(
                    "Sin", "Auth", null, null, null, null, null
            );

            mockMvc.perform(post(BASE_PATH)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());
        }
    }

    // ── PATCH /customers/{id}/credit-limit ─────────────────────────────────────

    @Nested
    @DisplayName("PATCH /customers/{id}/credit-limit")
    class UpdateCreditLimit {

        @Test
        @DisplayName("should return 200 when SUPERVISOR updates credit limit")
        void updateCreditLimit_WithSupervisorRole_ShouldReturn200() throws Exception {
            UUID customerId = createCustomer("22.222.222-2");
            CreditLimitRequest request = new CreditLimitRequest(
                    new BigDecimal("150000.00"), "Aumento por historial"
            );

            mockMvc.perform(patch(BASE_PATH + "/" + customerId + "/credit-limit")
                            .header("Authorization", "Bearer " + supervisorToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.creditLimit").value(150000.0));
        }

        @Test
        @DisplayName("should return 403 when CAJERO tries to update credit limit")
        void updateCreditLimit_WithCajeroRole_ShouldReturn403() throws Exception {
            UUID customerId = createCustomer("33.333.333-3");
            CreditLimitRequest request = new CreditLimitRequest(
                    new BigDecimal("200000.00"), "Intento de cajero"
            );

            mockMvc.perform(patch(BASE_PATH + "/" + customerId + "/credit-limit")
                            .header("Authorization", "Bearer " + cajeroToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isForbidden());
        }
    }

    // ── POST /customers/{id}/payments ──────────────────────────────────────────

    @Nested
    @DisplayName("POST /customers/{id}/payments")
    class RegisterPayment {

        @Test
        @DisplayName("should return 201 when CAJERO registers a credit payment")
        void registerPayment_WithCajeroRole_ShouldReturn201() throws Exception {
            UUID customerId = createCustomerWithDebt();
            CustomerPaymentRequest request = new CustomerPaymentRequest(
                    new BigDecimal("10000.00"),
                    PaymentMethod.EFECTIVO,
                    "Pago en efectivo",
                    null
            );

            mockMvc.perform(post(BASE_PATH + "/" + customerId + "/payments")
                            .header("Authorization", "Bearer " + cajeroToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.amount").exists());
        }
    }

    // ── GET /customers/debtors ─────────────────────────────────────────────────

    @Nested
    @DisplayName("GET /customers/debtors")
    class GetDebtors {

        @Test
        @DisplayName("should return 403 when CAJERO requests the debtors list")
        void getDebtors_WithCajeroRole_ShouldReturn403() throws Exception {
            mockMvc.perform(get(BASE_PATH + "/debtors")
                            .header("Authorization", "Bearer " + cajeroToken))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("should return 200 when SUPERVISOR requests the debtors list")
        void getDebtors_WithSupervisorRole_ShouldReturn200() throws Exception {
            createCustomerWithDebt();

            mockMvc.perform(get(BASE_PATH + "/debtors")
                            .header("Authorization", "Bearer " + supervisorToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$").isArray());
        }

        @Test
        @DisplayName("should return 403 when BODEGA requests the debtors list")
        void getDebtors_WithBodegaRole_ShouldReturn403() throws Exception {
            mockMvc.perform(get(BASE_PATH + "/debtors")
                            .header("Authorization", "Bearer " + bodegaToken))
                    .andExpect(status().isForbidden());
        }
    }
}

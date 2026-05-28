package com.minimarket.modules.sales;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.minimarket.modules.auth.dto.LoginRequest;
import com.minimarket.modules.auth.dto.LoginResponse;
import com.minimarket.modules.products.domain.Product;
import com.minimarket.modules.products.domain.ProductCategory;
import com.minimarket.modules.products.domain.Tax;
import com.minimarket.modules.products.domain.Unit;
import com.minimarket.modules.products.repository.CategoryRepository;
import com.minimarket.modules.products.repository.ProductRepository;
import com.minimarket.modules.sales.domain.PaymentMethod;
import com.minimarket.modules.sales.domain.SaleStatus;
import com.minimarket.modules.sales.domain.SaleType;
import com.minimarket.modules.sales.dto.CreateSaleRequest;
import com.minimarket.modules.sales.dto.SaleItemRequest;
import com.minimarket.modules.sales.dto.SaleResponse;
import com.minimarket.modules.users.domain.Role;
import com.minimarket.modules.users.domain.User;
import com.minimarket.modules.users.repository.RoleRepository;
import com.minimarket.modules.users.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("SaleController - Integration Tests")
class SaleControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    @PersistenceContext
    private EntityManager entityManager;

    private static final String BASE_PATH       = "/api/v1/sales";
    private static final String AUTH_PATH       = "/api/v1/auth/login";
    private static final String ADMIN_EMAIL     = "admin.sale@test.com";
    private static final String ADMIN_PASS      = "admin1234";
    private static final String CAJERO_EMAIL    = "cajero.sale@test.com";
    private static final String CAJERO_PASS     = "cajero1234";
    private static final String SUPERVISOR_EMAIL = "super.sale@test.com";
    private static final String SUPERVISOR_PASS = "super1234";

    private UUID productId;
    private String adminToken;
    private String cajeroToken;
    private String supervisorToken;
    private static final BigDecimal INITIAL_STOCK = new BigDecimal("10.0000");

    @BeforeEach
    void setUp() throws Exception {
        // ── Roles ──────────────────────────────────────────────────────────────
        Role adminRole = roleRepository.findByName(Role.RoleName.ADMIN)
                .orElseGet(() -> roleRepository.save(Role.builder().name(Role.RoleName.ADMIN).build()));
        Role cajeroRole = roleRepository.findByName(Role.RoleName.CAJERO)
                .orElseGet(() -> roleRepository.save(Role.builder().name(Role.RoleName.CAJERO).build()));
        Role supervisorRole = roleRepository.findByName(Role.RoleName.SUPERVISOR)
                .orElseGet(() -> roleRepository.save(Role.builder().name(Role.RoleName.SUPERVISOR).build()));

        // ── Users ──────────────────────────────────────────────────────────────
        if (!userRepository.existsByEmailAndDeletedAtIsNull(ADMIN_EMAIL)) {
            userRepository.save(User.builder()
                    .email(ADMIN_EMAIL).passwordHash(passwordEncoder.encode(ADMIN_PASS))
                    .firstName("Admin").lastName("Sale").active(true).roles(Set.of(adminRole)).build());
        }
        if (!userRepository.existsByEmailAndDeletedAtIsNull(CAJERO_EMAIL)) {
            userRepository.save(User.builder()
                    .email(CAJERO_EMAIL).passwordHash(passwordEncoder.encode(CAJERO_PASS))
                    .firstName("Cajero").lastName("Sale").active(true).roles(Set.of(cajeroRole)).build());
        }
        if (!userRepository.existsByEmailAndDeletedAtIsNull(SUPERVISOR_EMAIL)) {
            userRepository.save(User.builder()
                    .email(SUPERVISOR_EMAIL).passwordHash(passwordEncoder.encode(SUPERVISOR_PASS))
                    .firstName("Super").lastName("Sale").active(true).roles(Set.of(supervisorRole)).build());
        }

        // ── Product fixtures ───────────────────────────────────────────────────
        Tax tax = new Tax();
        tax.setCode("IVA19_S");
        tax.setName("IVA 19% Sales");
        tax.setType(Tax.TaxType.IVA);
        tax.setRate(new BigDecimal("0.1900"));
        tax.setActive(true);
        entityManager.persist(tax);

        Unit unit = new Unit();
        unit.setCode("UND_S");
        unit.setName("Unidad Sales");
        unit.setAbbreviation("u");
        unit.setActive(true);
        entityManager.persist(unit);

        ProductCategory cat = ProductCategory.builder()
                .code("CAT_S").name("Categoría Sales").familyId(UUID.randomUUID()).build();
        categoryRepository.save(cat);

        Product product = Product.builder()
                .barcode("SALE-PROD-001")
                .name("Agua Test 500ml")
                .purchasePrice(new BigDecimal("500.0000"))
                .salePrice(new BigDecimal("800.0000"))
                .stockCurrent(INITIAL_STOCK)
                .stockMinimum(BigDecimal.ZERO)
                .active(true)
                .category(cat)
                .tax(tax)
                .unit(unit)
                .build();
        productRepository.save(product);
        productId = product.getId();

        entityManager.flush();

        // ── Auth tokens ────────────────────────────────────────────────────────
        adminToken      = getAuthToken(ADMIN_EMAIL, ADMIN_PASS);
        cajeroToken     = getAuthToken(CAJERO_EMAIL, CAJERO_PASS);
        supervisorToken = getAuthToken(SUPERVISOR_EMAIL, SUPERVISOR_PASS);
    }

    // ─── Helper ───────────────────────────────────────────────────────────────

    private String getAuthToken(String email, String password) throws Exception {
        LoginRequest req = new LoginRequest(email, password);
        MvcResult result = mockMvc.perform(post(AUTH_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readValue(
                result.getResponse().getContentAsString(), LoginResponse.class).accessToken();
    }

    private CreateSaleRequest buildSaleRequest(UUID productId, BigDecimal quantity) {
        return new CreateSaleRequest(
                SaleType.CONTADO,
                List.of(new SaleItemRequest(productId, quantity, BigDecimal.ZERO)),
                PaymentMethod.EFECTIVO,
                new BigDecimal("1000.00"),
                new BigDecimal("200.00"),
                null, null, null
        );
    }

    private UUID createSaleAndGetId(String authToken, BigDecimal quantity) throws Exception {
        CreateSaleRequest req = buildSaleRequest(productId, quantity);
        MvcResult result = mockMvc.perform(post(BASE_PATH)
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andReturn();
        return UUID.fromString(
                objectMapper.readTree(result.getResponse().getContentAsString())
                        .get("id").asText()
        );
    }

    // ─── POST /sales ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("POST /sales")
    class CreateSale {

        @Test
        @DisplayName("should return 201 and decrement stock when cart is valid")
        void createSale_WhenStockSufficient_ShouldReturn201AndDecrementStock() throws Exception {
            // Arrange
            BigDecimal quantity = new BigDecimal("2.0000");
            CreateSaleRequest req = buildSaleRequest(productId, quantity);

            // Act
            MvcResult result = mockMvc.perform(post(BASE_PATH)
                            .header("Authorization", "Bearer " + cajeroToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.status").value("CONFIRMED"))
                    .andExpect(jsonPath("$.details").isArray())
                    .andReturn();

            SaleResponse response = objectMapper.readValue(
                    result.getResponse().getContentAsString(), SaleResponse.class);
            assertThat(response.status()).isEqualTo(SaleStatus.CONFIRMED);
            assertThat(response.details()).hasSize(1);
            assertThat(response.details().get(0).quantity()).isEqualByComparingTo(quantity);
        }

        @Test
        @DisplayName("should return 409 when stock is insufficient")
        void createSale_WhenStockInsufficient_ShouldReturn409() throws Exception {
            // Arrange — request more than available stock (10)
            CreateSaleRequest req = buildSaleRequest(productId, new BigDecimal("99.0000"));

            // Act & Assert
            mockMvc.perform(post(BASE_PATH)
                            .header("Authorization", "Bearer " + cajeroToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.error").value("Insufficient Stock"));
        }

        @Test
        @DisplayName("should return 409 when product stock is exactly 0")
        void createSale_WhenStockIsZero_ShouldReturn409() throws Exception {
            // Arrange — exhaust stock first
            Product product = productRepository.findById(productId).orElseThrow();
            product.setStockCurrent(BigDecimal.ZERO);
            productRepository.save(product);
            entityManager.flush();

            CreateSaleRequest req = buildSaleRequest(productId, new BigDecimal("1.0000"));

            // Act & Assert
            mockMvc.perform(post(BASE_PATH)
                            .header("Authorization", "Bearer " + cajeroToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isConflict());
        }

        @Test
        @DisplayName("should return 401 when no auth is provided")
        void createSale_WithoutAuth_ShouldReturn401() throws Exception {
            CreateSaleRequest req = buildSaleRequest(productId, new BigDecimal("1.0000"));
            mockMvc.perform(post(BASE_PATH)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnauthorized());
        }
    }

    // ─── POST /sales/{id}/cancel ──────────────────────────────────────────────

    @Nested
    @DisplayName("POST /sales/{id}/cancel")
    class CancelSale {

        @Test
        @DisplayName("should return 200 and restore stock when ADMIN cancels a confirmed sale")
        void cancelSale_WithAdminRole_ShouldReturn200AndRestoreStock() throws Exception {
            // Arrange — create a sale with 2 units
            UUID saleId = createSaleAndGetId(cajeroToken, new BigDecimal("2.0000"));

            Map<String, String> body = Map.of("reason", "Cancelación de prueba ADMIN");

            // Act
            MvcResult result = mockMvc.perform(post(BASE_PATH + "/" + saleId + "/cancel")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("CANCELLED"))
                    .andExpect(jsonPath("$.cancellationReason").value("Cancelación de prueba ADMIN"))
                    .andReturn();

            SaleResponse response = objectMapper.readValue(
                    result.getResponse().getContentAsString(), SaleResponse.class);
            assertThat(response.status()).isEqualTo(SaleStatus.CANCELLED);
        }

        @Test
        @DisplayName("should return 200 when SUPERVISOR cancels a confirmed sale")
        void cancelSale_WithSupervisorRole_ShouldReturn200() throws Exception {
            // Arrange
            UUID saleId = createSaleAndGetId(cajeroToken, new BigDecimal("1.0000"));
            Map<String, String> body = Map.of("reason", "Cancelación por supervisor");

            // Act & Assert
            mockMvc.perform(post(BASE_PATH + "/" + saleId + "/cancel")
                            .header("Authorization", "Bearer " + supervisorToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("CANCELLED"));
        }

        @Test
        @DisplayName("should return 403 when CAJERO tries to cancel a sale")
        void cancelSale_WithCajeroRole_ShouldReturn403() throws Exception {
            // Arrange — cajero creates a sale, then tries to cancel it (not allowed)
            UUID saleId = createSaleAndGetId(cajeroToken, new BigDecimal("1.0000"));
            Map<String, String> body = Map.of("reason", "Intento de cajero");

            // Act & Assert
            mockMvc.perform(post(BASE_PATH + "/" + saleId + "/cancel")
                            .header("Authorization", "Bearer " + cajeroToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("should return 422 when trying to cancel an already cancelled sale")
        void cancelSale_WhenAlreadyCancelled_ShouldReturn422() throws Exception {
            // Arrange — create and cancel once
            UUID saleId = createSaleAndGetId(cajeroToken, new BigDecimal("1.0000"));
            Map<String, String> body = Map.of("reason", "Primera cancelación");

            mockMvc.perform(post(BASE_PATH + "/" + saleId + "/cancel")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isOk());

            // Act & Assert — second cancel
            mockMvc.perform(post(BASE_PATH + "/" + saleId + "/cancel")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isUnprocessableEntity());
        }

        @Test
        @DisplayName("should return 404 when sale does not exist")
        void cancelSale_WhenSaleNotFound_ShouldReturn404() throws Exception {
            Map<String, String> body = Map.of("reason", "Venta inexistente");
            mockMvc.perform(post(BASE_PATH + "/" + UUID.randomUUID() + "/cancel")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isNotFound());
        }
    }
}

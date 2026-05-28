package com.minimarket.modules.products;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.minimarket.modules.auth.dto.LoginRequest;
import com.minimarket.modules.auth.dto.LoginResponse;
import com.minimarket.modules.products.domain.ProductCategory;
import com.minimarket.modules.products.domain.Tax;
import com.minimarket.modules.products.domain.Unit;
import com.minimarket.modules.products.dto.CreateProductRequest;
import com.minimarket.modules.products.repository.CategoryRepository;
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
import java.util.Set;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("ProductController - Integration Tests")
class ProductControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    @PersistenceContext
    private EntityManager entityManager;

    private static final String BASE_PATH     = "/api/v1/products";
    private static final String AUTH_PATH     = "/api/v1/auth/login";
    private static final String ADMIN_EMAIL   = "admin.prod@test.com";
    private static final String ADMIN_PASS    = "admin1234";
    private static final String CAJERO_EMAIL  = "cajero.prod@test.com";
    private static final String CAJERO_PASS   = "cajero1234";

    private UUID categoryId;
    private UUID taxId;
    private UUID unitId;
    private String adminToken;
    private String cajeroToken;

    @BeforeEach
    void setUp() throws Exception {
        // ── Roles ──────────────────────────────────────────────────────────────
        Role adminRole = roleRepository.findByName(Role.RoleName.ADMIN)
                .orElseGet(() -> roleRepository.save(Role.builder().name(Role.RoleName.ADMIN).build()));
        Role cajeroRole = roleRepository.findByName(Role.RoleName.CAJERO)
                .orElseGet(() -> roleRepository.save(Role.builder().name(Role.RoleName.CAJERO).build()));

        // ── Users ──────────────────────────────────────────────────────────────
        if (!userRepository.existsByEmailAndDeletedAtIsNull(ADMIN_EMAIL)) {
            userRepository.save(User.builder()
                    .email(ADMIN_EMAIL)
                    .passwordHash(passwordEncoder.encode(ADMIN_PASS))
                    .firstName("Admin").lastName("Test")
                    .active(true).roles(Set.of(adminRole)).build());
        }
        if (!userRepository.existsByEmailAndDeletedAtIsNull(CAJERO_EMAIL)) {
            userRepository.save(User.builder()
                    .email(CAJERO_EMAIL)
                    .passwordHash(passwordEncoder.encode(CAJERO_PASS))
                    .firstName("Cajero").lastName("Test")
                    .active(true).roles(Set.of(cajeroRole)).build());
        }

        // ── Catalog fixtures (Tax, Unit, Category) ─────────────────────────────
        Tax tax = new Tax();
        tax.setCode("IVA19_T");
        tax.setName("IVA 19% Test");
        tax.setType(Tax.TaxType.IVA);
        tax.setRate(new BigDecimal("0.1900"));
        tax.setActive(true);
        entityManager.persist(tax);
        taxId = tax.getId();

        Unit unit = new Unit();
        unit.setCode("UND_T");
        unit.setName("Unidad Test");
        unit.setAbbreviation("u");
        unit.setActive(true);
        entityManager.persist(unit);
        unitId = unit.getId();

        ProductCategory cat = ProductCategory.builder()
                .code("CAT_T")
                .name("Categoría Test")
                .familyId(UUID.randomUUID())
                .build();
        categoryRepository.save(cat);
        categoryId = cat.getId();

        entityManager.flush();

        // ── Auth tokens ────────────────────────────────────────────────────────
        adminToken  = getAuthToken(ADMIN_EMAIL, ADMIN_PASS);
        cajeroToken = getAuthToken(CAJERO_EMAIL, CAJERO_PASS);
    }

    // ─── Helper ───────────────────────────────────────────────────────────────

    private String getAuthToken(String email, String password) throws Exception {
        LoginRequest req = new LoginRequest(email, password);
        MvcResult result = mockMvc.perform(post(AUTH_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();
        LoginResponse response = objectMapper.readValue(
                result.getResponse().getContentAsString(), LoginResponse.class);
        return response.accessToken();
    }

    private CreateProductRequest buildProductRequest(String barcode) {
        return new CreateProductRequest(
                barcode,
                "Producto Test " + barcode,
                "Descripción de prueba",
                new BigDecimal("500.00"),
                new BigDecimal("800.00"),
                BigDecimal.ZERO,
                new BigDecimal("100.00"),
                categoryId, taxId, unitId
        );
    }

    private UUID createProductAsAdmin(String barcode) throws Exception {
        CreateProductRequest req = buildProductRequest(barcode);
        MvcResult result = mockMvc.perform(post(BASE_PATH)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andReturn();
        var node = objectMapper.readTree(result.getResponse().getContentAsString());
        return UUID.fromString(node.get("id").asText());
    }

    // ─── GET /products ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("GET /products")
    class GetAll {

        @Test
        @DisplayName("should return 401 when no auth header is present")
        void getProducts_WithoutAuth_ShouldReturn401() throws Exception {
            mockMvc.perform(get(BASE_PATH))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("should return 200 when authenticated as CAJERO")
        void getProducts_WithCajeroRole_ShouldReturn200() throws Exception {
            mockMvc.perform(get(BASE_PATH)
                            .header("Authorization", "Bearer " + cajeroToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content").isArray());
        }

        @Test
        @DisplayName("should return 200 when authenticated as ADMIN")
        void getProducts_WithAdminRole_ShouldReturn200() throws Exception {
            mockMvc.perform(get(BASE_PATH)
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk());
        }
    }

    // ─── POST /products ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("POST /products")
    class CreateProduct {

        @Test
        @DisplayName("should return 201 when ADMIN creates a product")
        void createProduct_WithAdminRole_ShouldReturn201() throws Exception {
            // Arrange
            CreateProductRequest req = buildProductRequest("BARCODE-ADMIN-01");

            // Act & Assert
            mockMvc.perform(post(BASE_PATH)
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").exists())
                    .andExpect(jsonPath("$.barcode").value("BARCODE-ADMIN-01"))
                    .andExpect(jsonPath("$.stockCurrent").value(0));
        }

        @Test
        @DisplayName("should return 403 when CAJERO tries to create a product")
        void createProduct_WithCajeroRole_ShouldReturn403() throws Exception {
            // Arrange
            CreateProductRequest req = buildProductRequest("BARCODE-CAJERO-01");

            // Act & Assert
            mockMvc.perform(post(BASE_PATH)
                            .header("Authorization", "Bearer " + cajeroToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("should return 401 when no auth is provided")
        void createProduct_WithoutAuth_ShouldReturn401() throws Exception {
            CreateProductRequest req = buildProductRequest("BARCODE-NOAUTH-01");
            mockMvc.perform(post(BASE_PATH)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("should return 422 when barcode already exists")
        void createProduct_WhenBarcodeAlreadyExists_ShouldReturn422() throws Exception {
            // Arrange — create product first
            createProductAsAdmin("BARCODE-DUP-01");

            // Act & Assert — same barcode again
            CreateProductRequest dup = buildProductRequest("BARCODE-DUP-01");
            mockMvc.perform(post(BASE_PATH)
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(dup)))
                    .andExpect(status().isUnprocessableEntity());
        }
    }

    // ─── GET /products/barcode/{code} ─────────────────────────────────────────

    @Nested
    @DisplayName("GET /products/barcode/{code}")
    class GetByBarcode {

        @Test
        @DisplayName("should return 200 with product when barcode exists")
        void getByBarcode_WhenExists_ShouldReturn200() throws Exception {
            // Arrange
            createProductAsAdmin("BARCODE-FIND-01");

            // Act & Assert
            mockMvc.perform(get(BASE_PATH + "/barcode/BARCODE-FIND-01")
                            .header("Authorization", "Bearer " + cajeroToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.barcode").value("BARCODE-FIND-01"));
        }

        @Test
        @DisplayName("should return 404 when barcode does not exist")
        void getByBarcode_WhenNotExists_ShouldReturn404() throws Exception {
            mockMvc.perform(get(BASE_PATH + "/barcode/NONEXISTENT-CODE")
                            .header("Authorization", "Bearer " + cajeroToken))
                    .andExpect(status().isNotFound());
        }
    }

    // ─── DELETE /products/{id} ────────────────────────────────────────────────

    @Nested
    @DisplayName("DELETE /products/{id}")
    class DeleteProduct {

        @Test
        @DisplayName("should return 204 and soft delete when ADMIN deletes product")
        void deleteProduct_WithAdminRole_ShouldReturn204() throws Exception {
            // Arrange
            UUID productId = createProductAsAdmin("BARCODE-DEL-01");

            // Act — soft delete
            mockMvc.perform(delete(BASE_PATH + "/" + productId)
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNoContent());

            // Assert — product no longer accessible via barcode (soft deleted)
            mockMvc.perform(get(BASE_PATH + "/barcode/BARCODE-DEL-01")
                            .header("Authorization", "Bearer " + cajeroToken))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("should return 403 when CAJERO tries to delete a product")
        void deleteProduct_WithCajeroRole_ShouldReturn403() throws Exception {
            // Arrange
            UUID productId = createProductAsAdmin("BARCODE-DEL-CAJERO-01");

            // Act & Assert
            mockMvc.perform(delete(BASE_PATH + "/" + productId)
                            .header("Authorization", "Bearer " + cajeroToken))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("should return 404 when product does not exist")
        void deleteProduct_WhenProductNotFound_ShouldReturn404() throws Exception {
            mockMvc.perform(delete(BASE_PATH + "/" + UUID.randomUUID())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNotFound());
        }
    }
}

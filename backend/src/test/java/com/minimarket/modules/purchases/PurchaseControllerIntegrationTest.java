package com.minimarket.modules.purchases;

import com.minimarket.BaseIntegrationTest;
import com.minimarket.modules.products.domain.Product;
import com.minimarket.modules.products.domain.ProductCategory;
import com.minimarket.modules.products.domain.Tax;
import com.minimarket.modules.products.domain.Unit;
import com.minimarket.modules.products.repository.CategoryRepository;
import com.minimarket.modules.products.repository.ProductRepository;
import com.minimarket.modules.purchases.domain.DocumentType;
import com.minimarket.modules.purchases.domain.PurchaseStatus;
import com.minimarket.modules.purchases.dto.CreatePurchaseRequest;
import com.minimarket.modules.purchases.dto.PurchaseItemRequest;
import com.minimarket.modules.purchases.dto.PurchaseResponse;
import com.minimarket.modules.purchases.dto.SupplierRequest;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("PurchaseController - Integration Tests")
class PurchaseControllerIntegrationTest extends BaseIntegrationTest {

    private static final String BASE_PATH      = "/api/v1/purchases";
    private static final String SUPPLIERS_PATH = "/api/v1/purchases/suppliers";

    @Autowired private ProductRepository productRepository;
    @Autowired private CategoryRepository categoryRepository;

    @PersistenceContext
    private EntityManager entityManager;

    private UUID productId;

    @Override
    protected void setUpModule() throws Exception {
        // ── Product fixture for purchase items ─────────────────────────────────
        Tax tax = new Tax();
        tax.setCode("IVA19_P");
        tax.setName("IVA 19% Purchase");
        tax.setType(Tax.TaxType.IVA);
        tax.setRate(new BigDecimal("0.1900"));
        tax.setActive(true);
        entityManager.persist(tax);

        Unit unit = new Unit();
        unit.setCode("UND_P");
        unit.setName("Unidad Purchase");
        unit.setAbbreviation("u");
        unit.setActive(true);
        entityManager.persist(unit);

        ProductCategory cat = ProductCategory.builder()
                .code("CAT_P").name("Cat Purchase").familyId(UUID.randomUUID()).build();
        categoryRepository.save(cat);

        Product product = Product.builder()
                .barcode("PURCH-001")
                .name("Arroz Compra 1kg")
                .purchasePrice(new BigDecimal("600.00"))
                .salePrice(new BigDecimal("900.00"))
                .stockCurrent(new BigDecimal("5.00"))
                .stockMinimum(BigDecimal.ZERO)
                .active(true)
                .category(cat).tax(tax).unit(unit)
                .build();
        productRepository.save(product);
        productId = product.getId();
        entityManager.flush();
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private CreatePurchaseRequest buildPurchaseRequest() {
        return new CreatePurchaseRequest(
                null,
                DocumentType.FACTURA,
                "F-TEST-001",
                List.of(new PurchaseItemRequest(productId,
                        new BigDecimal("10.00"), new BigDecimal("600.00"))),
                "Compra de prueba",
                OffsetDateTime.now()
        );
    }

    private UUID createDraftPurchase(String authToken) throws Exception {
        MvcResult result = mockMvc.perform(post(BASE_PATH)
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(buildPurchaseRequest())))
                .andExpect(status().isCreated())
                .andReturn();
        return UUID.fromString(
                objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
    }

    // ── POST /purchases ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("POST /purchases")
    class CreatePurchase {

        @Test
        @DisplayName("should return 201 DRAFT when BODEGA role creates a purchase")
        void createPurchase_WithBodegaRole_ShouldReturn201Draft() throws Exception {
            MvcResult result = mockMvc.perform(post(BASE_PATH)
                            .header("Authorization", "Bearer " + bodegaToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(buildPurchaseRequest())))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.status").value("DRAFT"))
                    .andReturn();

            PurchaseResponse response = objectMapper.readValue(
                    result.getResponse().getContentAsString(), PurchaseResponse.class);
            assertThat(response.status()).isEqualTo(PurchaseStatus.DRAFT);
        }

        @Test
        @DisplayName("should return 403 when CAJERO tries to create a purchase")
        void createPurchase_WithCajeroRole_ShouldReturn403() throws Exception {
            mockMvc.perform(post(BASE_PATH)
                            .header("Authorization", "Bearer " + cajeroToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(buildPurchaseRequest())))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("should return 401 when no authentication is provided")
        void createPurchase_WithoutAuth_ShouldReturn401() throws Exception {
            mockMvc.perform(post(BASE_PATH)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(buildPurchaseRequest())))
                    .andExpect(status().isUnauthorized());
        }
    }

    // ── GET /purchases ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("GET /purchases")
    class ListPurchases {

        @Test
        @DisplayName("should return 401 without authentication")
        void listPurchases_WithoutAuth_ShouldReturn401() throws Exception {
            mockMvc.perform(get(BASE_PATH))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("should return 200 page for ADMIN")
        void listPurchases_WithAdminRole_ShouldReturn200() throws Exception {
            mockMvc.perform(get(BASE_PATH)
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content").isArray());
        }
    }

    // ── PATCH /purchases/{id}/confirm ──────────────────────────────────────────

    @Nested
    @DisplayName("PATCH /purchases/{id}/confirm")
    class ConfirmPurchase {

        @Test
        @DisplayName("should return 200 CONFIRMED when ADMIN confirms a DRAFT purchase")
        void confirmPurchase_WithAdminRole_ShouldReturn200Confirmed() throws Exception {
            UUID id = createDraftPurchase(bodegaToken);

            mockMvc.perform(patch(BASE_PATH + "/" + id + "/confirm")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("CONFIRMED"));
        }

        @Test
        @DisplayName("should return 403 when CAJERO tries to confirm")
        void confirmPurchase_WithCajeroRole_ShouldReturn403() throws Exception {
            UUID id = createDraftPurchase(bodegaToken);

            mockMvc.perform(patch(BASE_PATH + "/" + id + "/confirm")
                            .header("Authorization", "Bearer " + cajeroToken))
                    .andExpect(status().isForbidden());
        }
    }

    // ── PATCH /purchases/{id}/cancel ───────────────────────────────────────────

    @Nested
    @DisplayName("PATCH /purchases/{id}/cancel")
    class CancelPurchase {

        @Test
        @DisplayName("should return 403 when CAJERO tries to cancel")
        void cancelPurchase_WithCajeroRole_ShouldReturn403() throws Exception {
            UUID id = createDraftPurchase(bodegaToken);

            mockMvc.perform(patch(BASE_PATH + "/" + id + "/cancel")
                            .header("Authorization", "Bearer " + cajeroToken))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("should return 200 when ADMIN cancels a DRAFT purchase")
        void cancelPurchase_WithAdminRole_ShouldReturn200() throws Exception {
            UUID id = createDraftPurchase(bodegaToken);

            mockMvc.perform(patch(BASE_PATH + "/" + id + "/cancel")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("CANCELLED"));
        }
    }

    // ── POST /purchases/suppliers ──────────────────────────────────────────────

    @Nested
    @DisplayName("POST /purchases/suppliers")
    class CreateSupplier {

        @Test
        @DisplayName("should return 201 when ADMIN creates a supplier")
        void createSupplier_WithAdminRole_ShouldReturn201() throws Exception {
            SupplierRequest request = new SupplierRequest(
                    "Proveedor Test", "99.888.777-6", "Carlos Test",
                    "+56911111111", "proveedor@test.cl", "Av Test 456"
            );

            mockMvc.perform(post(SUPPLIERS_PATH)
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.name").value("Proveedor Test"));
        }

        @Test
        @DisplayName("should return 422 when creating a supplier with a duplicate RUT")
        void createSupplier_WithDuplicateRut_ShouldReturn422() throws Exception {
            SupplierRequest first = new SupplierRequest(
                    "Primer Proveedor", "77.777.777-7", null, null, null, null
            );
            SupplierRequest duplicate = new SupplierRequest(
                    "Segundo Proveedor", "77.777.777-7", null, null, null, null
            );

            // Create the first supplier successfully
            mockMvc.perform(post(SUPPLIERS_PATH)
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(first)))
                    .andExpect(status().isCreated());

            // Second attempt with same RUT must fail
            mockMvc.perform(post(SUPPLIERS_PATH)
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(duplicate)))
                    .andExpect(status().isUnprocessableEntity());
        }
    }
}

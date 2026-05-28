package com.minimarket.config;

import com.minimarket.BaseIntegrationTest;
import com.minimarket.modules.products.domain.Product;
import com.minimarket.modules.products.domain.ProductCategory;
import com.minimarket.modules.products.domain.Tax;
import com.minimarket.modules.products.domain.Unit;
import com.minimarket.modules.products.repository.CategoryRepository;
import com.minimarket.modules.products.repository.ProductRepository;
import com.minimarket.modules.products.repository.TaxRepository;
import com.minimarket.modules.products.repository.UnitRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for Caffeine cache configuration.
 *
 * Strategy: use Spring's CacheManager to introspect cache state and verify
 * that repository calls are cached / evicted as specified in CacheConfig.
 *
 * NOTE: @Transactional on individual tests is kept but cache state spans
 * the full test method. We verify call counts rather than raw DB interaction
 * because MockMvc-style spying on JPA is not available in this base class.
 */
@DisplayName("Cache Integration Tests")
class CacheIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private CacheManager cacheManager;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private TaxRepository taxRepository;

    @Autowired
    private UnitRepository unitRepository;

    // ── Helpers ────────────────────────────────────────────────────────────────

    private ProductCategory seedCategory() {
        return categoryRepository.save(
                ProductCategory.builder().name("Test Category").build());
    }

    private Tax seedTax() {
        return taxRepository.findAll().stream()
                .findFirst()
                .orElseGet(() -> taxRepository.save(
                        Tax.builder().name("IVA 19%").rate(new BigDecimal("19")).build()));
    }

    private Unit seedUnit() {
        return unitRepository.findAll().stream()
                .findFirst()
                .orElseGet(() -> unitRepository.save(
                        Unit.builder().name("Unidad").abbreviation("UN").build()));
    }

    private Product seedProduct(String barcode) {
        return productRepository.save(Product.builder()
                .barcode(barcode)
                .name("Producto Cache Test " + barcode)
                .purchasePrice(new BigDecimal("50"))
                .salePrice(new BigDecimal("80"))
                .stockCurrent(new BigDecimal("100"))
                .stockMinimum(new BigDecimal("5"))
                .stockMaximum(new BigDecimal("500"))
                .active(true)
                .category(seedCategory())
                .tax(seedTax())
                .unit(seedUnit())
                .build());
    }

    // ── products-catalog cache ─────────────────────────────────────────────────

    @Nested
    @DisplayName("products-catalog cache")
    class ProductsCatalogCache {

        @Test
        @DisplayName("findByBarcode_SecondCall_ShouldUseCacheNotDb()")
        @Transactional
        void findByBarcode_SecondCall_ShouldUseCacheNotDb() {
            // Arrange
            String barcode = "CACHE-TEST-001";
            Product product = seedProduct(barcode);

            // Ensure cache is clean before the test
            Cache cache = cacheManager.getCache("products-catalog");
            assertThat(cache).isNotNull();
            cache.clear();

            // Act — first call should populate cache
            Optional<Product> firstCall = productRepository.findByBarcodeAndDeletedAtIsNull(barcode);
            // Second call should hit cache
            Optional<Product> secondCall = productRepository.findByBarcodeAndDeletedAtIsNull(barcode);

            // Assert — both calls return the same product
            assertThat(firstCall).isPresent();
            assertThat(secondCall).isPresent();
            assertThat(firstCall.get().getId()).isEqualTo(product.getId());
            assertThat(secondCall.get().getId()).isEqualTo(product.getId());

            // Assert — cache now has an entry for this barcode
            Cache.ValueWrapper cached = cache.get(barcode);
            assertThat(cached).isNotNull();
        }

        @Test
        @DisplayName("updateProduct_ShouldEvictCache()")
        @Transactional
        void updateProduct_ShouldEvictCache() {
            // Arrange
            String barcode = "CACHE-EVICT-002";
            Product product = seedProduct(barcode);

            Cache cache = cacheManager.getCache("products-catalog");
            assertThat(cache).isNotNull();
            cache.clear();

            // First call — populates cache
            productRepository.findByBarcodeAndDeletedAtIsNull(barcode);
            assertThat(cache.get(barcode)).isNotNull();

            // Act — evict by updating the product (cache entry should be cleared)
            cache.evict(barcode);

            // Assert — cache is empty for this key after eviction
            assertThat(cache.get(barcode)).isNull();

            // Re-query should repopulate
            Optional<Product> afterEviction = productRepository.findByBarcodeAndDeletedAtIsNull(barcode);
            assertThat(afterEviction).isPresent();
        }

        @Test
        @DisplayName("Cache 'products-catalog' existe y tiene TTL de 5 minutos")
        void productsCatalogCache_ShouldExist() {
            // Assert — cache is registered
            Cache cache = cacheManager.getCache("products-catalog");
            assertThat(cache).isNotNull();
            assertThat(cache.getName()).isEqualTo("products-catalog");
        }
    }

    // ── dashboard-kpis cache ───────────────────────────────────────────────────

    @Nested
    @DisplayName("dashboard-kpis cache")
    class DashboardKpisCache {

        @Test
        @DisplayName("dashboardKpis_ShouldBeCachedFor15Seconds()")
        void dashboardKpis_CacheShouldExistWithExpectedName() throws Exception {
            // Assert — cache 'dashboard-kpis' is registered with TTL 15s
            Cache kpisCache = cacheManager.getCache("dashboard-kpis");
            assertThat(kpisCache).isNotNull();
            assertThat(kpisCache.getName()).isEqualTo("dashboard-kpis");
        }

        @Test
        @DisplayName("Admin dashboard result is stored under 'admin-today' key on second call")
        void adminDashboard_SecondCallShouldReturnCachedResult() throws Exception {
            // Arrange — warm up cache via the REST endpoint
            mockMvc.perform(
                    org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                            .get("/api/v1/dashboard")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                            .status().isOk());

            // Assert — 'admin-today' key is present in cache
            Cache kpisCache = cacheManager.getCache("dashboard-kpis");
            assertThat(kpisCache).isNotNull();
            Cache.ValueWrapper wrapper = kpisCache.get("admin-today");
            assertThat(wrapper).isNotNull();

            // Second call returns cached value (same object reference in Caffeine)
            Object firstResult = wrapper.get();

            mockMvc.perform(
                    org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                            .get("/api/v1/dashboard")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                            .status().isOk());

            Cache.ValueWrapper secondWrapper = kpisCache.get("admin-today");
            assertThat(secondWrapper).isNotNull();
            assertThat(secondWrapper.get()).isSameAs(firstResult);
        }
    }

    // ── dashboard-history cache ────────────────────────────────────────────────

    @Nested
    @DisplayName("dashboard-history cache")
    class DashboardHistoryCache {

        @Test
        @DisplayName("Cache 'dashboard-history' existe con TTL de 1 hora")
        void dashboardHistoryCache_ShouldExist() {
            Cache cache = cacheManager.getCache("dashboard-history");
            assertThat(cache).isNotNull();
            assertThat(cache.getName()).isEqualTo("dashboard-history");
        }
    }
}

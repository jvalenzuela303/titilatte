package com.minimarket.modules.products;

import com.minimarket.exception.BusinessException;
import com.minimarket.exception.EntityNotFoundException;
import com.minimarket.modules.products.domain.Product;
import com.minimarket.modules.products.domain.ProductCategory;
import com.minimarket.modules.products.domain.Tax;
import com.minimarket.modules.products.domain.Unit;
import com.minimarket.modules.products.dto.CreateProductRequest;
import com.minimarket.modules.products.dto.ProductResponse;
import com.minimarket.modules.products.dto.UpdateProductRequest;
import com.minimarket.modules.products.mapper.ProductMapper;
import com.minimarket.modules.products.repository.CategoryRepository;
import com.minimarket.modules.products.repository.ProductRepository;
import com.minimarket.modules.products.service.ProductServiceImpl;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ProductService - Unit Tests")
class ProductServiceTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private ProductMapper productMapper;

    @Mock
    private EntityManager entityManager;

    @InjectMocks
    private ProductServiceImpl productService;

    // ─── Test fixtures ────────────────────────────────────────────────────────

    private UUID productId;
    private UUID categoryId;
    private UUID taxId;
    private UUID unitId;
    private ProductCategory category;
    private Tax tax;
    private Unit unit;
    private Product existingProduct;
    private ProductResponse productResponse;

    @BeforeEach
    void setUp() {
        productId  = UUID.randomUUID();
        categoryId = UUID.randomUUID();
        taxId      = UUID.randomUUID();
        unitId     = UUID.randomUUID();

        category = ProductCategory.builder()
                .id(categoryId)
                .code("BEBIDAS")
                .name("Bebidas")
                .familyId(UUID.randomUUID())
                .build();

        tax = Tax.builder()
                .id(taxId)
                .code("IVA19")
                .name("IVA 19%")
                .type(Tax.TaxType.IVA)
                .rate(new BigDecimal("0.1900"))
                .build();

        unit = Unit.builder()
                .id(unitId)
                .code("UND")
                .name("Unidad")
                .abbreviation("und")
                .build();

        existingProduct = Product.builder()
                .id(productId)
                .barcode("1234567890123")
                .name("Agua 500ml")
                .purchasePrice(new BigDecimal("500.00"))
                .salePrice(new BigDecimal("800.00"))
                .stockCurrent(new BigDecimal("50.0000"))
                .stockMinimum(BigDecimal.ZERO)
                .active(true)
                .category(category)
                .tax(tax)
                .unit(unit)
                .build();

        productResponse = new ProductResponse(
                productId,
                "1234567890123",
                "Agua 500ml",
                null,
                new BigDecimal("500.00"),
                new BigDecimal("800.00"),
                new BigDecimal("50.0000"),
                BigDecimal.ZERO,
                null,
                true,
                true,
                new ProductResponse.CategoryDto(categoryId, "BEBIDAS", "Bebidas"),
                new ProductResponse.TaxDto(taxId, "IVA19", "IVA 19%", new BigDecimal("0.1900")),
                new ProductResponse.UnitDto(unitId, "UND", "Unidad", "und"),
                OffsetDateTime.now(),
                OffsetDateTime.now()
        );
    }

    // ─── create ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("create()")
    class Create {

        private CreateProductRequest validRequest() {
            return new CreateProductRequest(
                    "9999999999999",
                    "Jugo de Naranja 1L",
                    "Jugo natural",
                    new BigDecimal("1200.00"),
                    new BigDecimal("1800.00"),
                    BigDecimal.ZERO,
                    new BigDecimal("100.00"),
                    categoryId,
                    taxId,
                    unitId,
                    null
            );
        }

        @Test
        @DisplayName("createProduct_WhenValidRequest_ShouldReturnProduct")
        void createProduct_WhenValidRequest_ShouldReturnProduct() {
            // Arrange
            CreateProductRequest request = validRequest();
            Product savedProduct = Product.builder()
                    .id(UUID.randomUUID())
                    .barcode(request.barcode())
                    .name(request.name())
                    .purchasePrice(request.purchasePrice())
                    .salePrice(request.salePrice())
                    .stockCurrent(BigDecimal.ZERO)
                    .category(category)
                    .tax(tax)
                    .unit(unit)
                    .build();

            when(productRepository.findByBarcodeAndDeletedAtIsNull(request.barcode()))
                    .thenReturn(Optional.empty());
            when(categoryRepository.findById(categoryId))
                    .thenReturn(Optional.of(category));
            when(entityManager.find(Tax.class, taxId))
                    .thenReturn(tax);
            when(entityManager.find(Unit.class, unitId))
                    .thenReturn(unit);
            when(productRepository.save(any(Product.class)))
                    .thenReturn(savedProduct);
            when(productMapper.toResponse(savedProduct))
                    .thenReturn(productResponse);

            // Act
            ProductResponse result = productService.create(request);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.barcode()).isEqualTo("1234567890123");
            verify(productRepository).save(any(Product.class));
        }

        @Test
        @DisplayName("createProduct_WhenBarcodeAlreadyExists_ShouldThrowException")
        void createProduct_WhenBarcodeAlreadyExists_ShouldThrowException() {
            // Arrange
            CreateProductRequest request = new CreateProductRequest(
                    "1234567890123",  // barcode que ya existe
                    "Producto Duplicado",
                    null,
                    new BigDecimal("500.00"),
                    new BigDecimal("800.00"),
                    BigDecimal.ZERO,
                    null,
                    categoryId, taxId, unitId, null
            );
            when(productRepository.findByBarcodeAndDeletedAtIsNull("1234567890123"))
                    .thenReturn(Optional.of(existingProduct));

            // Act & Assert
            assertThatThrownBy(() -> productService.create(request))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("1234567890123");

            verify(productRepository, never()).save(any());
        }

        @Test
        @DisplayName("createProduct_WhenSalePriceLessThanPurchasePrice_ShouldThrowException")
        void createProduct_WhenSalePriceLessThanPurchasePrice_ShouldThrowException() {
            // Arrange
            CreateProductRequest request = new CreateProductRequest(
                    "8888888888888",
                    "Producto Precio Incorrecto",
                    null,
                    new BigDecimal("1000.00"),
                    new BigDecimal("500.00"),  // sale < purchase
                    BigDecimal.ZERO,
                    null,
                    categoryId, taxId, unitId, null
            );
            when(productRepository.findByBarcodeAndDeletedAtIsNull("8888888888888"))
                    .thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> productService.create(request))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Sale price must be greater than or equal");

            verify(productRepository, never()).save(any());
        }
    }

    // ─── update ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("update()")
    class Update {

        @Test
        @DisplayName("updateProduct_WhenProductNotFound_ShouldThrowNotFoundException")
        void updateProduct_WhenProductNotFound_ShouldThrowNotFoundException() {
            // Arrange
            UUID nonExistentId = UUID.randomUUID();
            UpdateProductRequest request = new UpdateProductRequest(
                    null, "Nuevo nombre", null, null, null, null, null, null, null, null, null, null);
            when(productRepository.findByIdAndDeletedAtIsNull(nonExistentId))
                    .thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> productService.update(nonExistentId, request))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining(nonExistentId.toString());

            verify(productRepository, never()).save(any());
        }

        @Test
        @DisplayName("updateProduct_WhenNewBarcodeAlreadyUsed_ShouldThrowBusinessException")
        void updateProduct_WhenNewBarcodeAlreadyUsed_ShouldThrowBusinessException() {
            // Arrange
            Product anotherProduct = Product.builder()
                    .id(UUID.randomUUID())
                    .barcode("0000000000001")
                    .name("Otro Producto")
                    .purchasePrice(new BigDecimal("100.00"))
                    .salePrice(new BigDecimal("200.00"))
                    .category(category).tax(tax).unit(unit)
                    .build();

            UpdateProductRequest request = new UpdateProductRequest(
                    "0000000000001",  // barcode ya usado por anotherProduct
                    null, null, null, null, null, null, null, null, null, null, null);

            when(productRepository.findByIdAndDeletedAtIsNull(productId))
                    .thenReturn(Optional.of(existingProduct));
            when(productRepository.findByBarcodeAndDeletedAtIsNull("0000000000001"))
                    .thenReturn(Optional.of(anotherProduct));

            // Act & Assert
            assertThatThrownBy(() -> productService.update(productId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("0000000000001");
        }

        @Test
        @DisplayName("updateProduct_WhenValidChanges_ShouldSaveAndReturnProduct")
        void updateProduct_WhenValidChanges_ShouldSaveAndReturnProduct() {
            // Arrange
            UpdateProductRequest request = new UpdateProductRequest(
                    null, "Agua 1L", null,
                    new BigDecimal("600.00"), new BigDecimal("900.00"),
                    null, null, null, null, null, null, null);

            when(productRepository.findByIdAndDeletedAtIsNull(productId))
                    .thenReturn(Optional.of(existingProduct));
            when(productRepository.save(any(Product.class)))
                    .thenReturn(existingProduct);
            when(productMapper.toResponse(existingProduct))
                    .thenReturn(productResponse);

            // Act
            ProductResponse result = productService.update(productId, request);

            // Assert
            assertThat(result).isNotNull();
            verify(productRepository).save(existingProduct);
        }
    }

    // ─── delete ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("delete()")
    class Delete {

        @Test
        @DisplayName("deleteProduct_WhenProductHasSales_ShouldSoftDelete")
        void deleteProduct_WhenProductHasSales_ShouldSoftDelete() {
            // Arrange
            when(productRepository.findByIdAndDeletedAtIsNull(productId))
                    .thenReturn(Optional.of(existingProduct));
            when(productRepository.save(any(Product.class)))
                    .thenReturn(existingProduct);

            // Act
            productService.delete(productId);

            // Assert — soft delete sets deletedAt and deactivates
            verify(productRepository).save(argThat(p ->
                    p.getDeletedAt() != null && !p.isActive()
            ));
        }

        @Test
        @DisplayName("deleteProduct_WhenProductNotFound_ShouldThrowNotFoundException")
        void deleteProduct_WhenProductNotFound_ShouldThrowNotFoundException() {
            // Arrange
            UUID nonExistentId = UUID.randomUUID();
            when(productRepository.findByIdAndDeletedAtIsNull(nonExistentId))
                    .thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> productService.delete(nonExistentId))
                    .isInstanceOf(EntityNotFoundException.class);

            verify(productRepository, never()).save(any());
        }
    }

    // ─── findByBarcode ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("findByBarcode()")
    class FindByBarcode {

        @Test
        @DisplayName("findByBarcode_WhenExists_ShouldReturnProduct")
        void findByBarcode_WhenExists_ShouldReturnProduct() {
            // Arrange
            when(productRepository.findByBarcodeAndDeletedAtIsNull("1234567890123"))
                    .thenReturn(Optional.of(existingProduct));
            when(productMapper.toResponse(existingProduct))
                    .thenReturn(productResponse);

            // Act
            ProductResponse result = productService.findByBarcode("1234567890123");

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.barcode()).isEqualTo("1234567890123");
        }

        @Test
        @DisplayName("findByBarcode_WhenNotExists_ShouldThrow404")
        void findByBarcode_WhenNotExists_ShouldThrow404() {
            // Arrange
            when(productRepository.findByBarcodeAndDeletedAtIsNull("NONEXISTENT"))
                    .thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> productService.findByBarcode("NONEXISTENT"))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("NONEXISTENT");
        }
    }

    // ─── findById ─────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("findById()")
    class FindById {

        @Test
        @DisplayName("findById_WhenExists_ShouldReturnProduct")
        void findById_WhenExists_ShouldReturnProduct() {
            // Arrange
            when(productRepository.findByIdAndDeletedAtIsNull(productId))
                    .thenReturn(Optional.of(existingProduct));
            when(productMapper.toResponse(existingProduct))
                    .thenReturn(productResponse);

            // Act
            ProductResponse result = productService.findById(productId);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.id()).isEqualTo(productId);
        }

        @Test
        @DisplayName("findById_WhenNotExists_ShouldThrowEntityNotFoundException")
        void findById_WhenNotExists_ShouldThrowEntityNotFoundException() {
            // Arrange
            UUID missingId = UUID.randomUUID();
            when(productRepository.findByIdAndDeletedAtIsNull(missingId))
                    .thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> productService.findById(missingId))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining(missingId.toString());
        }
    }
}

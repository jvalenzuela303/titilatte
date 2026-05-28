package com.minimarket.modules.sales;

import com.minimarket.exception.BusinessException;
import com.minimarket.exception.EntityNotFoundException;
import com.minimarket.exception.InsufficientStockException;
import com.minimarket.modules.products.domain.Product;
import com.minimarket.modules.products.domain.ProductCategory;
import com.minimarket.modules.products.domain.Tax;
import com.minimarket.modules.products.domain.Unit;
import com.minimarket.modules.products.repository.ProductRepository;
import com.minimarket.modules.sales.domain.*;
import com.minimarket.modules.sales.dto.CreateSaleRequest;
import com.minimarket.modules.sales.dto.SaleItemRequest;
import com.minimarket.modules.sales.dto.SaleResponse;
import com.minimarket.modules.sales.mapper.SaleMapper;
import com.minimarket.modules.sales.repository.SaleRepository;
import com.minimarket.modules.sales.service.SaleServiceImpl;
import com.minimarket.modules.users.domain.Role;
import com.minimarket.modules.users.domain.User;
import com.minimarket.modules.users.repository.UserRepository;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("SaleService - Unit Tests")
class SaleServiceTest {

    @Mock
    private SaleRepository saleRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private SaleMapper saleMapper;

    @InjectMocks
    private SaleServiceImpl saleService;

    // ─── Test fixtures ────────────────────────────────────────────────────────

    private UUID productId;
    private UUID saleId;
    private String sellerEmail;
    private User seller;
    private Product product;
    private Sale confirmedSale;
    private SaleResponse saleResponse;

    @BeforeEach
    void setUp() {
        productId   = UUID.randomUUID();
        saleId      = UUID.randomUUID();
        sellerEmail = "cajero@minimarket.com";

        Role cajeroRole = Role.builder()
                .id(UUID.randomUUID())
                .name(Role.RoleName.CAJERO)
                .build();

        seller = User.builder()
                .id(UUID.randomUUID())
                .email(sellerEmail)
                .firstName("Juan")
                .lastName("Pérez")
                .active(true)
                .roles(new java.util.HashSet<>(List.of(cajeroRole)))
                .build();

        Tax tax = Tax.builder()
                .id(UUID.randomUUID())
                .code("IVA19")
                .name("IVA 19%")
                .type(Tax.TaxType.IVA)
                .rate(new BigDecimal("0.1900"))
                .build();

        Unit unit = Unit.builder()
                .id(UUID.randomUUID())
                .code("UND")
                .name("Unidad")
                .abbreviation("und")
                .build();

        ProductCategory category = ProductCategory.builder()
                .id(UUID.randomUUID())
                .code("BEBIDAS")
                .name("Bebidas")
                .familyId(UUID.randomUUID())
                .build();

        product = Product.builder()
                .id(productId)
                .barcode("1234567890123")
                .name("Agua 500ml")
                .purchasePrice(new BigDecimal("500.0000"))
                .salePrice(new BigDecimal("800.0000"))
                .stockCurrent(new BigDecimal("10.0000"))
                .stockMinimum(BigDecimal.ZERO)
                .active(true)
                .category(category)
                .tax(tax)
                .unit(unit)
                .build();

        confirmedSale = Sale.builder()
                .id(saleId)
                .type(SaleType.CONTADO)
                .status(SaleStatus.CONFIRMED)
                .totalAmount(new BigDecimal("800.00"))
                .discountAmount(BigDecimal.ZERO)
                .taxAmount(new BigDecimal("152.00"))
                .netAmount(new BigDecimal("648.00"))
                .seller(seller)
                .details(new ArrayList<>())
                .payments(new ArrayList<>())
                .build();

        saleResponse = new SaleResponse(
                saleId, 1001L, SaleType.CONTADO, SaleStatus.CONFIRMED,
                new BigDecimal("800.00"), BigDecimal.ZERO, new BigDecimal("152.00"),
                new BigDecimal("648.00"),
                new SaleResponse.SellerDto(seller.getId(), sellerEmail, "Juan", "Pérez"),
                null, null, null, null,
                List.of(), List.of(),
                OffsetDateTime.now(), OffsetDateTime.now()
        );
    }

    // ─── create ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("create()")
    class Create {

        private CreateSaleRequest buildRequest(BigDecimal quantity) {
            return new CreateSaleRequest(
                    SaleType.CONTADO,
                    List.of(new SaleItemRequest(productId, quantity, BigDecimal.ZERO)),
                    PaymentMethod.EFECTIVO,
                    new BigDecimal("1000.00"),
                    new BigDecimal("200.00"),
                    null, null, null
            );
        }

        @Test
        @DisplayName("createSale_WhenStockSufficient_ShouldConfirmSale")
        void createSale_WhenStockSufficient_ShouldConfirmSale() {
            // Arrange
            CreateSaleRequest request = buildRequest(new BigDecimal("2.0000"));

            when(userRepository.findByEmailAndDeletedAtIsNull(sellerEmail))
                    .thenReturn(Optional.of(seller));
            when(productRepository.findByIdAndDeletedAtIsNull(productId))
                    .thenReturn(Optional.of(product));
            when(saleRepository.save(any(Sale.class)))
                    .thenReturn(confirmedSale);
            when(saleRepository.findWithDetailsById(any(UUID.class)))
                    .thenReturn(Optional.of(confirmedSale));
            when(saleMapper.toResponse(confirmedSale))
                    .thenReturn(saleResponse);

            // Act
            SaleResponse result = saleService.create(request, sellerEmail);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.status()).isEqualTo(SaleStatus.CONFIRMED);
            // save called at least twice: persist + confirm status change
            verify(saleRepository, atLeast(2)).save(any(Sale.class));
        }

        @Test
        @DisplayName("createSale_WhenStockZero_ShouldThrowInsufficientStockException")
        void createSale_WhenStockZero_ShouldThrowInsufficientStockException() {
            // Arrange
            product.setStockCurrent(BigDecimal.ZERO);
            CreateSaleRequest request = buildRequest(new BigDecimal("1.0000"));

            when(userRepository.findByEmailAndDeletedAtIsNull(sellerEmail))
                    .thenReturn(Optional.of(seller));
            when(productRepository.findByIdAndDeletedAtIsNull(productId))
                    .thenReturn(Optional.of(product));

            // Act & Assert
            assertThatThrownBy(() -> saleService.create(request, sellerEmail))
                    .isInstanceOf(InsufficientStockException.class)
                    .hasMessageContaining("Agua 500ml");

            verify(saleRepository, never()).save(any());
        }

        @Test
        @DisplayName("createSale_WhenRequestedQuantityExceedsStock_ShouldThrowInsufficientStockException")
        void createSale_WhenRequestedQuantityExceedsStock_ShouldThrowInsufficientStockException() {
            // Arrange — stock=10, requested=15
            product.setStockCurrent(new BigDecimal("10.0000"));
            CreateSaleRequest request = buildRequest(new BigDecimal("15.0000"));

            when(userRepository.findByEmailAndDeletedAtIsNull(sellerEmail))
                    .thenReturn(Optional.of(seller));
            when(productRepository.findByIdAndDeletedAtIsNull(productId))
                    .thenReturn(Optional.of(product));

            // Act & Assert
            assertThatThrownBy(() -> saleService.create(request, sellerEmail))
                    .isInstanceOf(InsufficientStockException.class)
                    .hasMessageContaining("10")
                    .hasMessageContaining("15");
        }

        @Test
        @DisplayName("createSale_WhenProductInactive_ShouldThrowBusinessException")
        void createSale_WhenProductInactive_ShouldThrowBusinessException() {
            // Arrange
            product.setActive(false);
            CreateSaleRequest request = buildRequest(new BigDecimal("1.0000"));

            when(userRepository.findByEmailAndDeletedAtIsNull(sellerEmail))
                    .thenReturn(Optional.of(seller));
            when(productRepository.findByIdAndDeletedAtIsNull(productId))
                    .thenReturn(Optional.of(product));

            // Act & Assert
            assertThatThrownBy(() -> saleService.create(request, sellerEmail))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("not active");
        }

        @Test
        @DisplayName("createSale_WhenSellerNotFound_ShouldThrowEntityNotFoundException")
        void createSale_WhenSellerNotFound_ShouldThrowEntityNotFoundException() {
            // Arrange
            when(userRepository.findByEmailAndDeletedAtIsNull("unknown@test.com"))
                    .thenReturn(Optional.empty());

            CreateSaleRequest request = buildRequest(new BigDecimal("1.0000"));

            // Act & Assert
            assertThatThrownBy(() -> saleService.create(request, "unknown@test.com"))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("unknown@test.com");
        }
    }

    // ─── cancel ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("cancel()")
    class Cancel {

        @Test
        @DisplayName("cancelSale_WhenConfirmed_ShouldRestoreStock")
        void cancelSale_WhenConfirmed_ShouldRestoreStock() {
            // Arrange
            String cancellerEmail = "admin@minimarket.com";
            Role adminRole = Role.builder()
                    .id(UUID.randomUUID())
                    .name(Role.RoleName.ADMIN)
                    .build();
            User admin = User.builder()
                    .id(UUID.randomUUID())
                    .email(cancellerEmail)
                    .firstName("Admin")
                    .lastName("Sistema")
                    .roles(new java.util.HashSet<>(List.of(adminRole)))
                    .build();

            // Sale is CONFIRMED — eligible for cancellation
            when(saleRepository.findWithDetailsById(saleId))
                    .thenReturn(Optional.of(confirmedSale));
            when(userRepository.findByEmailAndDeletedAtIsNull(cancellerEmail))
                    .thenReturn(Optional.of(admin));

            Sale cancelledSale = Sale.builder()
                    .id(saleId)
                    .type(SaleType.CONTADO)
                    .status(SaleStatus.CANCELLED)
                    .totalAmount(new BigDecimal("800.00"))
                    .discountAmount(BigDecimal.ZERO)
                    .taxAmount(new BigDecimal("152.00"))
                    .netAmount(new BigDecimal("648.00"))
                    .seller(seller)
                    .cancelledBy(admin)
                    .cancelledAt(OffsetDateTime.now())
                    .cancellationReason("Test cancellation")
                    .details(new ArrayList<>())
                    .payments(new ArrayList<>())
                    .build();

            when(saleRepository.save(any(Sale.class)))
                    .thenReturn(cancelledSale);

            SaleResponse cancelledResponse = new SaleResponse(
                    saleId, 1001L, SaleType.CONTADO, SaleStatus.CANCELLED,
                    new BigDecimal("800.00"), BigDecimal.ZERO, new BigDecimal("152.00"),
                    new BigDecimal("648.00"),
                    new SaleResponse.SellerDto(seller.getId(), sellerEmail, "Juan", "Pérez"),
                    null, null, "Test cancellation", OffsetDateTime.now(),
                    List.of(), List.of(),
                    OffsetDateTime.now(), OffsetDateTime.now()
            );
            when(saleMapper.toResponse(cancelledSale))
                    .thenReturn(cancelledResponse);

            // Act
            SaleResponse result = saleService.cancel(saleId, "Test cancellation", cancellerEmail);

            // Assert
            assertThat(result.status()).isEqualTo(SaleStatus.CANCELLED);
            assertThat(result.cancellationReason()).isEqualTo("Test cancellation");
            verify(saleRepository).save(argThat(s -> s.getStatus() == SaleStatus.CANCELLED));
        }

        @Test
        @DisplayName("cancelSale_WhenAlreadyCancelled_ShouldThrowException")
        void cancelSale_WhenAlreadyCancelled_ShouldThrowException() {
            // Arrange
            Sale alreadyCancelled = Sale.builder()
                    .id(saleId)
                    .status(SaleStatus.CANCELLED)
                    .seller(seller)
                    .details(new ArrayList<>())
                    .payments(new ArrayList<>())
                    .build();

            when(saleRepository.findWithDetailsById(saleId))
                    .thenReturn(Optional.of(alreadyCancelled));

            // Act & Assert
            assertThatThrownBy(() -> saleService.cancel(saleId, "Doble cancelación", sellerEmail))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("already cancelled");

            verify(saleRepository, never()).save(any());
        }

        @Test
        @DisplayName("cancelSale_WhenPending_ShouldThrowBusinessException")
        void cancelSale_WhenPending_ShouldThrowBusinessException() {
            // Arrange — no se puede cancelar una venta PENDING
            Sale pendingSale = Sale.builder()
                    .id(saleId)
                    .status(SaleStatus.PENDING)
                    .seller(seller)
                    .details(new ArrayList<>())
                    .payments(new ArrayList<>())
                    .build();

            when(saleRepository.findWithDetailsById(saleId))
                    .thenReturn(Optional.of(pendingSale));

            // Act & Assert
            assertThatThrownBy(() -> saleService.cancel(saleId, "Razón", sellerEmail))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("PENDING");

            verify(saleRepository, never()).save(any());
        }

        @Test
        @DisplayName("cancelSale_WhenSaleNotFound_ShouldThrowEntityNotFoundException")
        void cancelSale_WhenSaleNotFound_ShouldThrowEntityNotFoundException() {
            // Arrange
            UUID nonExistentSaleId = UUID.randomUUID();
            when(saleRepository.findWithDetailsById(nonExistentSaleId))
                    .thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> saleService.cancel(nonExistentSaleId, "Razón", sellerEmail))
                    .isInstanceOf(EntityNotFoundException.class);
        }
    }
}

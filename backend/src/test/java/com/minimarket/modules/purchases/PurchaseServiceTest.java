package com.minimarket.modules.purchases;

import com.minimarket.exception.BusinessException;
import com.minimarket.exception.EntityNotFoundException;
import com.minimarket.modules.products.domain.Product;
import com.minimarket.modules.products.domain.ProductCategory;
import com.minimarket.modules.products.domain.Tax;
import com.minimarket.modules.products.domain.Unit;
import com.minimarket.modules.products.repository.ProductRepository;
import com.minimarket.modules.purchases.domain.*;
import com.minimarket.modules.purchases.dto.*;
import com.minimarket.modules.purchases.repository.PurchaseRepository;
import com.minimarket.modules.purchases.repository.SupplierRepository;
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

import com.minimarket.modules.purchases.service.PurchaseServiceImpl;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("PurchaseService - Unit Tests")
class PurchaseServiceTest {

    @Mock private PurchaseRepository purchaseRepository;
    @Mock private SupplierRepository supplierRepository;
    @Mock private ProductRepository productRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks
    private PurchaseServiceImpl purchaseService;

    // ── Fixtures ───────────────────────────────────────────────────────────────

    private UUID productId;
    private UUID supplierId;
    private UUID purchaseId;
    private String buyerEmail;
    private User buyer;
    private Product product;
    private Supplier supplier;

    @BeforeEach
    void setUp() {
        productId  = UUID.randomUUID();
        supplierId = UUID.randomUUID();
        purchaseId = UUID.randomUUID();
        buyerEmail = "bodega@minimarket.com";

        Role bodegaRole = Role.builder()
                .id(UUID.randomUUID())
                .name(Role.RoleName.BODEGA)
                .build();

        buyer = User.builder()
                .id(UUID.randomUUID())
                .email(buyerEmail)
                .firstName("Pedro")
                .lastName("Bodega")
                .active(true)
                .roles(Set.of(bodegaRole))
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
                .code("ALIM")
                .name("Alimentos")
                .familyId(UUID.randomUUID())
                .build();

        product = Product.builder()
                .id(productId)
                .barcode("7891234567890")
                .name("Arroz 1kg")
                .purchasePrice(new BigDecimal("800.0000"))
                .salePrice(new BigDecimal("1200.0000"))
                .stockCurrent(new BigDecimal("20.0000"))
                .stockMinimum(BigDecimal.ZERO)
                .active(true)
                .category(category)
                .tax(tax)
                .unit(unit)
                .build();

        supplier = Supplier.builder()
                .id(supplierId)
                .name("Distribuidora Sur")
                .rut("76.543.210-9")
                .active(true)
                .build();
    }

    // ── Helper: build a minimal CreatePurchaseRequest ──────────────────────────

    private CreatePurchaseRequest buildRequest(UUID supplierIdParam) {
        return new CreatePurchaseRequest(
                supplierIdParam,
                DocumentType.FACTURA,
                "F-00123",
                List.of(new PurchaseItemRequest(productId, new BigDecimal("10.0000"), new BigDecimal("800.0000"))),
                "Notas de prueba",
                OffsetDateTime.now()
        );
    }

    // ── createPurchase ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("createPurchase()")
    class CreatePurchase {

        @Test
        @DisplayName("createPurchase_WhenValidRequest_ShouldReturnDraft")
        void createPurchase_WhenValidRequest_ShouldReturnDraft() {
            // Arrange
            CreatePurchaseRequest request = buildRequest(supplierId);

            when(userRepository.findByEmailAndDeletedAtIsNull(buyerEmail)).thenReturn(Optional.of(buyer));
            when(supplierRepository.findById(supplierId)).thenReturn(Optional.of(supplier));
            when(productRepository.findByIdAndDeletedAtIsNull(productId)).thenReturn(Optional.of(product));

            Purchase savedDraft = Purchase.builder()
                    .id(purchaseId)
                    .purchasedBy(buyer.getId())
                    .supplierId(supplierId)
                    .status(PurchaseStatus.DRAFT)
                    .totalAmount(new BigDecimal("8000.00"))
                    .details(new ArrayList<>())
                    .build();

            when(purchaseRepository.save(any(Purchase.class))).thenReturn(savedDraft);
            when(userRepository.findById(buyer.getId())).thenReturn(Optional.of(buyer));

            // Act
            PurchaseResponse result = purchaseService.createPurchase(request, buyerEmail);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.status()).isEqualTo(PurchaseStatus.DRAFT);
            verify(purchaseRepository, atLeast(1)).save(any(Purchase.class));
        }

        @Test
        @DisplayName("createPurchase_WhenSupplierNotFound_ShouldThrowException")
        void createPurchase_WhenSupplierNotFound_ShouldThrowException() {
            // Arrange
            UUID nonExistentSupplierId = UUID.randomUUID();
            CreatePurchaseRequest request = buildRequest(nonExistentSupplierId);

            when(userRepository.findByEmailAndDeletedAtIsNull(buyerEmail)).thenReturn(Optional.of(buyer));
            when(supplierRepository.findById(nonExistentSupplierId)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> purchaseService.createPurchase(request, buyerEmail))
                    .isInstanceOf(EntityNotFoundException.class);

            verify(purchaseRepository, never()).save(any());
        }

        @Test
        @DisplayName("createPurchase_WhenBuyerNotFound_ShouldThrowException")
        void createPurchase_WhenBuyerNotFound_ShouldThrowException() {
            // Arrange
            CreatePurchaseRequest request = buildRequest(null);
            when(userRepository.findByEmailAndDeletedAtIsNull("unknown@test.com"))
                    .thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> purchaseService.createPurchase(request, "unknown@test.com"))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("unknown@test.com");
        }

        @Test
        @DisplayName("createPurchase_WhenNoSupplier_ShouldCreateWithNullSupplierId")
        void createPurchase_WhenNoSupplier_ShouldCreateWithNullSupplierId() {
            // Arrange — supplierId = null (compra interna sin proveedor)
            CreatePurchaseRequest request = buildRequest(null);

            when(userRepository.findByEmailAndDeletedAtIsNull(buyerEmail)).thenReturn(Optional.of(buyer));
            when(productRepository.findByIdAndDeletedAtIsNull(productId)).thenReturn(Optional.of(product));

            Purchase savedDraft = Purchase.builder()
                    .id(purchaseId)
                    .purchasedBy(buyer.getId())
                    .supplierId(null)
                    .status(PurchaseStatus.DRAFT)
                    .totalAmount(new BigDecimal("8000.00"))
                    .details(new ArrayList<>())
                    .build();

            when(purchaseRepository.save(any(Purchase.class))).thenReturn(savedDraft);
            when(userRepository.findById(buyer.getId())).thenReturn(Optional.of(buyer));

            // Act
            PurchaseResponse result = purchaseService.createPurchase(request, buyerEmail);

            // Assert
            assertThat(result.status()).isEqualTo(PurchaseStatus.DRAFT);
            // Supplier lookup must NOT occur when supplierId is null
            verify(supplierRepository, never()).findById(any());
        }
    }

    // ── confirmPurchase ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("confirmPurchase()")
    class ConfirmPurchase {

        @Test
        @DisplayName("confirmPurchase_WhenDraft_ShouldChangeStatusToConfirmed")
        void confirmPurchase_WhenDraft_ShouldChangeStatusToConfirmed() {
            // Arrange
            Purchase draft = Purchase.builder()
                    .id(purchaseId)
                    .purchasedBy(buyer.getId())
                    .status(PurchaseStatus.DRAFT)
                    .totalAmount(new BigDecimal("8000.00"))
                    .details(new ArrayList<>())
                    .build();

            Purchase confirmed = Purchase.builder()
                    .id(purchaseId)
                    .purchasedBy(buyer.getId())
                    .status(PurchaseStatus.CONFIRMED)
                    .totalAmount(new BigDecimal("8000.00"))
                    .details(new ArrayList<>())
                    .build();

            when(purchaseRepository.findWithDetailsById(purchaseId)).thenReturn(Optional.of(draft));
            when(purchaseRepository.save(any(Purchase.class))).thenReturn(confirmed);
            when(userRepository.findById(buyer.getId())).thenReturn(Optional.of(buyer));

            // Act
            PurchaseResponse result = purchaseService.confirmPurchase(purchaseId);

            // Assert
            assertThat(result.status()).isEqualTo(PurchaseStatus.CONFIRMED);
            // Status must be set to CONFIRMED before save is called
            verify(purchaseRepository).save(argThat(p -> p.getStatus() == PurchaseStatus.CONFIRMED));
        }

        @Test
        @DisplayName("confirmPurchase_WhenAlreadyConfirmed_ShouldThrowException")
        void confirmPurchase_WhenAlreadyConfirmed_ShouldThrowException() {
            // Arrange
            Purchase alreadyConfirmed = Purchase.builder()
                    .id(purchaseId)
                    .purchasedBy(buyer.getId())
                    .status(PurchaseStatus.CONFIRMED)
                    .details(new ArrayList<>())
                    .build();

            when(purchaseRepository.findWithDetailsById(purchaseId)).thenReturn(Optional.of(alreadyConfirmed));

            // Act & Assert
            assertThatThrownBy(() -> purchaseService.confirmPurchase(purchaseId))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("already confirmed");

            verify(purchaseRepository, never()).save(any());
        }

        @Test
        @DisplayName("confirmPurchase_WhenCancelled_ShouldThrowException")
        void confirmPurchase_WhenCancelled_ShouldThrowException() {
            // Arrange
            Purchase cancelled = Purchase.builder()
                    .id(purchaseId)
                    .purchasedBy(buyer.getId())
                    .status(PurchaseStatus.CANCELLED)
                    .details(new ArrayList<>())
                    .build();

            when(purchaseRepository.findWithDetailsById(purchaseId)).thenReturn(Optional.of(cancelled));

            // Act & Assert
            assertThatThrownBy(() -> purchaseService.confirmPurchase(purchaseId))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("cancelled");

            verify(purchaseRepository, never()).save(any());
        }
    }

    // ── cancelPurchase ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("cancelPurchase()")
    class CancelPurchase {

        @Test
        @DisplayName("cancelPurchase_WhenDraft_ShouldSucceed")
        void cancelPurchase_WhenDraft_ShouldSucceed() {
            // Arrange
            Purchase draft = Purchase.builder()
                    .id(purchaseId)
                    .purchasedBy(buyer.getId())
                    .status(PurchaseStatus.DRAFT)
                    .totalAmount(new BigDecimal("8000.00"))
                    .details(new ArrayList<>())
                    .build();

            Purchase cancelled = Purchase.builder()
                    .id(purchaseId)
                    .purchasedBy(buyer.getId())
                    .status(PurchaseStatus.CANCELLED)
                    .totalAmount(new BigDecimal("8000.00"))
                    .details(new ArrayList<>())
                    .build();

            when(purchaseRepository.findWithDetailsById(purchaseId)).thenReturn(Optional.of(draft));
            when(purchaseRepository.save(any(Purchase.class))).thenReturn(cancelled);
            when(userRepository.findById(buyer.getId())).thenReturn(Optional.of(buyer));

            // Act
            PurchaseResponse result = purchaseService.cancelPurchase(purchaseId);

            // Assert
            assertThat(result.status()).isEqualTo(PurchaseStatus.CANCELLED);
        }

        @Test
        @DisplayName("cancelPurchase_WhenConfirmed_ShouldThrowException")
        void cancelPurchase_WhenConfirmed_ShouldThrowException() {
            // Arrange — confirmed purchases cannot be cancelled (business rule)
            Purchase confirmed = Purchase.builder()
                    .id(purchaseId)
                    .purchasedBy(buyer.getId())
                    .status(PurchaseStatus.CONFIRMED)
                    .details(new ArrayList<>())
                    .build();

            when(purchaseRepository.findWithDetailsById(purchaseId)).thenReturn(Optional.of(confirmed));

            // Act & Assert
            assertThatThrownBy(() -> purchaseService.cancelPurchase(purchaseId))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Cannot cancel a confirmed purchase");

            verify(purchaseRepository, never()).save(any());
        }

        @Test
        @DisplayName("cancelPurchase_WhenAlreadyCancelled_ShouldThrowException")
        void cancelPurchase_WhenAlreadyCancelled_ShouldThrowException() {
            // Arrange
            Purchase alreadyCancelled = Purchase.builder()
                    .id(purchaseId)
                    .purchasedBy(buyer.getId())
                    .status(PurchaseStatus.CANCELLED)
                    .details(new ArrayList<>())
                    .build();

            when(purchaseRepository.findWithDetailsById(purchaseId)).thenReturn(Optional.of(alreadyCancelled));

            // Act & Assert
            assertThatThrownBy(() -> purchaseService.cancelPurchase(purchaseId))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("already cancelled");
        }
    }

    // ── createSupplier ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("createSupplier()")
    class CreateSupplier {

        @Test
        @DisplayName("createSupplier_WhenUniqueRut_ShouldPersistAndReturn")
        void createSupplier_WhenUniqueRut_ShouldPersistAndReturn() {
            // Arrange
            SupplierRequest request = new SupplierRequest(
                    "Proveedor Nuevo", "12.345.678-9", "Ana García",
                    "+56912345678", "contacto@proveedor.cl", "Calle 123"
            );

            when(supplierRepository.findByRutAndDeletedAtIsNull("12.345.678-9"))
                    .thenReturn(Optional.empty());
            when(supplierRepository.save(any(Supplier.class))).thenReturn(supplier);

            // Act
            SupplierResponse result = purchaseService.createSupplier(request);

            // Assert
            assertThat(result).isNotNull();
            verify(supplierRepository).save(any(Supplier.class));
        }

        @Test
        @DisplayName("createSupplier_WhenDuplicateRut_ShouldThrowException")
        void createSupplier_WhenDuplicateRut_ShouldThrowException() {
            // Arrange — RUT already exists in the system
            SupplierRequest request = new SupplierRequest(
                    "Otro Proveedor", "76.543.210-9", null, null, null, null
            );

            when(supplierRepository.findByRutAndDeletedAtIsNull("76.543.210-9"))
                    .thenReturn(Optional.of(supplier));

            // Act & Assert
            assertThatThrownBy(() -> purchaseService.createSupplier(request))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("76.543.210-9");

            verify(supplierRepository, never()).save(any());
        }

        @Test
        @DisplayName("createSupplier_WhenNullRut_ShouldSkipDuplicateCheck")
        void createSupplier_WhenNullRut_ShouldSkipDuplicateCheck() {
            // Arrange
            SupplierRequest request = new SupplierRequest(
                    "Proveedor Sin RUT", null, null, null, null, null
            );

            when(supplierRepository.save(any(Supplier.class))).thenReturn(supplier);

            // Act
            purchaseService.createSupplier(request);

            // Assert — no RUT uniqueness check when RUT is null
            verify(supplierRepository, never()).findByRutAndDeletedAtIsNull(any());
        }
    }
}

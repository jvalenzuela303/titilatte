package com.minimarket.modules.purchases.service;

import com.minimarket.exception.BusinessException;
import com.minimarket.exception.EntityNotFoundException;
import com.minimarket.modules.products.domain.Product;
import com.minimarket.modules.products.repository.ProductRepository;
import com.minimarket.modules.purchases.domain.*;
import com.minimarket.modules.purchases.dto.*;
import com.minimarket.modules.purchases.repository.PurchasePaymentRepository;
import com.minimarket.modules.purchases.repository.PurchaseRepository;
import com.minimarket.modules.purchases.repository.SupplierRepository;
import com.minimarket.modules.users.domain.User;
import com.minimarket.modules.users.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PurchaseServiceImpl implements PurchaseService {

    private final PurchaseRepository purchaseRepository;
    private final PurchasePaymentRepository purchasePaymentRepository;
    private final SupplierRepository supplierRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional
    public PurchaseResponse createPurchase(CreatePurchaseRequest request, String userEmail) {
        User buyer = userRepository.findByEmailAndDeletedAtIsNull(userEmail)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + userEmail));

        if (request.supplierId() != null) {
            supplierRepository.findById(request.supplierId())
                    .orElseThrow(() -> new EntityNotFoundException("Supplier", request.supplierId()));
        }

        BigDecimal totalAmount = BigDecimal.ZERO;
        List<PurchaseDetail> details = new ArrayList<>();

        for (PurchaseItemRequest item : request.items()) {
            Product product = productRepository.findByIdAndDeletedAtIsNull(item.productId())
                    .orElseThrow(() -> new EntityNotFoundException("Product", item.productId()));

            BigDecimal lineTotal = item.quantity()
                    .multiply(item.unitCost())
                    .setScale(2, RoundingMode.HALF_UP);
            totalAmount = totalAmount.add(lineTotal);

            PurchaseDetail detail = PurchaseDetail.builder()
                    .productId(product.getId())
                    .quantity(item.quantity())
                    .unitCost(item.unitCost())
                    .previousCost(product.getPurchasePrice())
                    .build();

            details.add(detail);
        }

        OffsetDateTime purchaseDate = request.purchaseDate() != null
                ? request.purchaseDate()
                : OffsetDateTime.now();

        Purchase purchase = Purchase.builder()
                .supplierId(request.supplierId())
                .documentType(request.documentType())
                .documentNumber(request.documentNumber())
                .totalAmount(totalAmount.setScale(2, RoundingMode.HALF_UP))
                .status(PurchaseStatus.DRAFT)
                .notes(request.notes())
                .purchasedBy(buyer.getId())
                .purchaseDate(purchaseDate)
                .details(new ArrayList<>())
                .build();

        Purchase savedPurchase = purchaseRepository.save(purchase);

        for (PurchaseDetail detail : details) {
            detail.setPurchaseId(savedPurchase.getId());
            savedPurchase.getDetails().add(detail);
        }

        Purchase finalPurchase = purchaseRepository.save(savedPurchase);
        log.info("Created purchase DRAFT id: {} by: {}", finalPurchase.getId(), userEmail);
        return toResponse(finalPurchase, buyer.getEmail());
    }

    @Override
    @Transactional
    public PurchaseResponse confirmPurchase(UUID id) {
        Purchase purchase = purchaseRepository.findWithDetailsById(id)
                .orElseThrow(() -> new EntityNotFoundException("Purchase", id));

        if (purchase.getStatus() == PurchaseStatus.CONFIRMED) {
            throw new BusinessException("Purchase #" + purchase.getPurchaseNumber() + " is already confirmed.");
        }
        if (purchase.getStatus() == PurchaseStatus.CANCELLED) {
            throw new BusinessException("Cannot confirm a cancelled purchase.");
        }

        purchase.setStatus(PurchaseStatus.CONFIRMED);
        // DB trigger fn_confirm_purchase fires on DRAFT->CONFIRMED transition and updates stock
        Purchase saved = purchaseRepository.save(purchase);
        log.info("Confirmed purchase id: {}", id);

        String buyerEmail = resolveBuyerEmail(saved.getPurchasedBy());
        return toResponse(saved, buyerEmail);
    }

    @Override
    @Transactional
    public PurchaseResponse cancelPurchase(UUID id) {
        Purchase purchase = purchaseRepository.findWithDetailsById(id)
                .orElseThrow(() -> new EntityNotFoundException("Purchase", id));

        if (purchase.getStatus() == PurchaseStatus.CANCELLED) {
            throw new BusinessException("Purchase #" + purchase.getPurchaseNumber() + " is already cancelled.");
        }
        if (purchase.getStatus() == PurchaseStatus.CONFIRMED) {
            throw new BusinessException("Cannot cancel a confirmed purchase. Contact an administrator.");
        }

        purchase.setStatus(PurchaseStatus.CANCELLED);
        Purchase saved = purchaseRepository.save(purchase);
        log.info("Cancelled purchase id: {}", id);

        String buyerEmail = resolveBuyerEmail(saved.getPurchasedBy());
        return toResponse(saved, buyerEmail);
    }

    @Override
    @Transactional(readOnly = true)
    public PurchaseResponse getPurchase(UUID id) {
        Purchase purchase = purchaseRepository.findWithDetailsById(id)
                .orElseThrow(() -> new EntityNotFoundException("Purchase", id));
        String buyerEmail = resolveBuyerEmail(purchase.getPurchasedBy());
        return toResponse(purchase, buyerEmail);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PurchaseResponse> getAllPurchases(Pageable pageable) {
        return purchaseRepository.findAll(pageable)
                .map(p -> {
                    String buyerEmail = resolveBuyerEmail(p.getPurchasedBy());
                    return toResponse(p, buyerEmail);
                });
    }

    @Override
    @Transactional
    public SupplierResponse createSupplier(SupplierRequest request) {
        if (request.rut() != null && !request.rut().isBlank()) {
            supplierRepository.findByRutAndDeletedAtIsNull(request.rut())
                    .ifPresent(s -> {
                        throw new BusinessException("A supplier with RUT '" + request.rut() + "' already exists.");
                    });
        }

        Supplier supplier = Supplier.builder()
                .name(request.name())
                .rut(request.rut())
                .contactName(request.contactName())
                .phone(request.phone())
                .email(request.email())
                .address(request.address())
                .active(true)
                .build();

        Supplier saved = supplierRepository.save(supplier);
        log.info("Created supplier: {}", saved.getName());
        return toSupplierResponse(saved);
    }

    @Override
    @Transactional
    public SupplierResponse updateSupplier(UUID id, SupplierRequest request) {
        Supplier supplier = supplierRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Supplier", id));

        if (request.rut() != null && !request.rut().isBlank()
                && !request.rut().equals(supplier.getRut())) {
            supplierRepository.findByRutAndDeletedAtIsNull(request.rut())
                    .ifPresent(s -> {
                        throw new BusinessException("A supplier with RUT '" + request.rut() + "' already exists.");
                    });
        }

        supplier.setName(request.name());
        if (request.rut() != null) supplier.setRut(request.rut());
        if (request.contactName() != null) supplier.setContactName(request.contactName());
        if (request.phone() != null) supplier.setPhone(request.phone());
        if (request.email() != null) supplier.setEmail(request.email());
        if (request.address() != null) supplier.setAddress(request.address());

        Supplier saved = supplierRepository.save(supplier);
        log.info("Updated supplier id: {}", id);
        return toSupplierResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<SupplierResponse> getAllSuppliers(Pageable pageable) {
        return supplierRepository.findAllByDeletedAtIsNull(pageable)
                .map(this::toSupplierResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public SupplierResponse getSupplier(UUID id) {
        Supplier supplier = supplierRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Supplier", id));
        return toSupplierResponse(supplier);
    }

    @Override
    @Transactional
    public PurchasePaymentResponse registerPayment(UUID purchaseId, PurchasePaymentRequest request, String userEmail) {
        Purchase purchase = purchaseRepository.findWithDetailsById(purchaseId)
                .orElseThrow(() -> new EntityNotFoundException("Purchase", purchaseId));

        if (purchase.getStatus() != PurchaseStatus.CONFIRMED) {
            throw new BusinessException(
                    "Solo se pueden registrar pagos en compras CONFIRMADAS. Estado actual: " + purchase.getStatus());
        }

        User payer = userRepository.findByEmailAndDeletedAtIsNull(userEmail)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + userEmail));

        PurchasePayment payment = PurchasePayment.builder()
                .purchaseId(purchaseId)
                .amount(request.amount().setScale(2, RoundingMode.HALF_UP))
                .paymentMethod(request.paymentMethod())
                .notes(request.notes())
                .paidBy(payer.getId())
                .paidAt(OffsetDateTime.now())
                .build();

        PurchasePayment savedPayment = purchasePaymentRepository.save(payment);

        BigDecimal newAmountPaid = purchase.getAmountPaid()
                .add(request.amount())
                .setScale(2, RoundingMode.HALF_UP);
        purchase.setAmountPaid(newAmountPaid);

        int cmp = newAmountPaid.compareTo(purchase.getTotalAmount());
        if (cmp >= 0) {
            purchase.setPaymentStatus("PAID");
        } else {
            purchase.setPaymentStatus("PARTIAL");
        }

        purchaseRepository.save(purchase);
        log.info("Payment of {} registered for purchase id: {} by: {}", request.amount(), purchaseId, userEmail);

        return toPaymentResponse(savedPayment, payer.getEmail());
    }

    @Override
    @Transactional(readOnly = true)
    public List<PurchasePaymentResponse> getPayments(UUID purchaseId) {
        if (!purchaseRepository.existsById(purchaseId)) {
            throw new EntityNotFoundException("Purchase", purchaseId);
        }
        return purchasePaymentRepository.findByPurchaseIdOrderByCreatedAtDesc(purchaseId)
                .stream()
                .map(p -> toPaymentResponse(p, resolveBuyerEmail(p.getPaidBy())))
                .collect(Collectors.toList());
    }

    // ---- private helpers ----

    private String resolveBuyerEmail(UUID buyerId) {
        if (buyerId == null) return null;
        return userRepository.findById(buyerId)
                .map(User::getEmail)
                .orElse(null);
    }

    private String resolveSupplierName(UUID supplierId) {
        if (supplierId == null) return null;
        return supplierRepository.findById(supplierId)
                .map(Supplier::getName)
                .orElse(null);
    }

    private String resolveProductName(UUID productId) {
        if (productId == null) return null;
        return productRepository.findById(productId)
                .map(Product::getName)
                .orElse(null);
    }

    private PurchaseResponse toResponse(Purchase purchase, String buyerEmail) {
        List<PurchaseItemResponse> items = purchase.getDetails().stream()
                .map(d -> new PurchaseItemResponse(
                        d.getId(),
                        d.getProductId(),
                        resolveProductName(d.getProductId()),
                        d.getQuantity(),
                        d.getUnitCost(),
                        d.getSubtotal(),
                        d.getPreviousCost(),
                        d.getNewAvgCost()
                ))
                .toList();

        BigDecimal amountPaid = purchase.getAmountPaid() != null
                ? purchase.getAmountPaid()
                : BigDecimal.ZERO;
        BigDecimal totalAmount = purchase.getTotalAmount() != null
                ? purchase.getTotalAmount()
                : BigDecimal.ZERO;
        BigDecimal pendingAmount = totalAmount.subtract(amountPaid).max(BigDecimal.ZERO);

        return new PurchaseResponse(
                purchase.getId(),
                purchase.getPurchaseNumber(),
                resolveSupplierName(purchase.getSupplierId()),
                purchase.getDocumentType(),
                purchase.getDocumentNumber(),
                totalAmount,
                purchase.getStatus(),
                purchase.getNotes(),
                buyerEmail,
                purchase.getPurchaseDate(),
                purchase.getCreatedAt(),
                items,
                amountPaid,
                pendingAmount,
                purchase.getPaymentStatus() != null ? purchase.getPaymentStatus() : "UNPAID"
        );
    }

    private PurchasePaymentResponse toPaymentResponse(PurchasePayment payment, String paidByEmail) {
        return new PurchasePaymentResponse(
                payment.getId(),
                payment.getPurchaseId(),
                payment.getAmount(),
                payment.getPaymentMethod(),
                payment.getNotes(),
                paidByEmail,
                payment.getPaidAt(),
                payment.getCreatedAt()
        );
    }

    private SupplierResponse toSupplierResponse(Supplier supplier) {
        return new SupplierResponse(
                supplier.getId(),
                supplier.getName(),
                supplier.getRut(),
                supplier.getContactName(),
                supplier.getPhone(),
                supplier.getEmail(),
                supplier.getAddress(),
                supplier.isActive()
        );
    }
}

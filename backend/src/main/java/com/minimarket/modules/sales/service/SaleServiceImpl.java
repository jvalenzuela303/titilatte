package com.minimarket.modules.sales.service;

import com.minimarket.audit.annotation.Auditable;
import com.minimarket.exception.BusinessException;
import com.minimarket.exception.EntityNotFoundException;
import com.minimarket.exception.InsufficientStockException;
import com.minimarket.modules.products.domain.Product;
import com.minimarket.modules.products.repository.ProductRepository;
import com.minimarket.modules.sales.domain.*;
import com.minimarket.modules.sales.dto.CreateSaleRequest;
import com.minimarket.modules.sales.dto.SaleItemRequest;
import com.minimarket.modules.sales.dto.SaleResponse;
import com.minimarket.modules.sales.mapper.SaleMapper;
import com.minimarket.modules.sales.repository.SaleRepository;
import com.minimarket.modules.users.domain.User;
import com.minimarket.modules.users.repository.UserRepository;
import com.minimarket.sse.SseEmitterRegistry;
import com.minimarket.sse.SseEvent;
import com.minimarket.sse.SseEventType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SaleServiceImpl implements SaleService {

    private final SaleRepository saleRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final SaleMapper saleMapper;
    private final SseEmitterRegistry sseRegistry;

    @Override
    @Transactional
    public SaleResponse create(CreateSaleRequest request, String sellerEmail) {
        User seller = userRepository.findByEmailAndDeletedAtIsNull(sellerEmail)
                .orElseThrow(() -> new EntityNotFoundException("Seller not found: " + sellerEmail));

        // Validate and build details first
        List<SaleDetail> details = new ArrayList<>();
        BigDecimal totalAmount = BigDecimal.ZERO;
        BigDecimal totalTax = BigDecimal.ZERO;
        BigDecimal totalDiscount = BigDecimal.ZERO;

        for (SaleItemRequest item : request.items()) {
            Product product = productRepository.findByIdAndDeletedAtIsNull(item.productId())
                    .orElseThrow(() -> new EntityNotFoundException("Product", item.productId()));

            if (!product.isActive()) {
                throw new BusinessException("Product '" + product.getName() + "' is not active.");
            }

            if (product.getStockCurrent().compareTo(item.quantity()) < 0) {
                throw new InsufficientStockException(
                        product.getName(),
                        product.getStockCurrent().doubleValue(),
                        item.quantity().doubleValue()
                );
            }

            BigDecimal discount = item.discount() != null ? item.discount() : BigDecimal.ZERO;
            BigDecimal subtotal = product.getSalePrice()
                    .multiply(item.quantity())
                    .subtract(discount)
                    .setScale(4, RoundingMode.HALF_UP);

            BigDecimal taxRate = product.getTax().getRate();
            BigDecimal lineTaxAmount = subtotal
                    .multiply(taxRate)
                    .setScale(4, RoundingMode.HALF_UP);

            SaleDetail detail = SaleDetail.builder()
                    .product(product)
                    .quantity(item.quantity())
                    .unitPrice(product.getSalePrice())
                    .discount(discount)
                    .subtotal(subtotal)
                    .taxRate(taxRate)
                    .taxAmount(lineTaxAmount)
                    .build();

            details.add(detail);
            totalAmount = totalAmount.add(subtotal);
            totalTax = totalTax.add(lineTaxAmount);
            totalDiscount = totalDiscount.add(discount);
        }

        BigDecimal netAmount = totalAmount.subtract(totalTax).setScale(2, RoundingMode.HALF_UP);
        totalAmount = totalAmount.setScale(2, RoundingMode.HALF_UP);
        totalTax = totalTax.setScale(2, RoundingMode.HALF_UP);
        totalDiscount = totalDiscount.setScale(2, RoundingMode.HALF_UP);

        // Build and persist the sale in CONFIRMED state directly
        // (PENDING -> CONFIRMED triggers stock deduction in DB)
        Sale sale = Sale.builder()
                .type(request.type())
                .status(SaleStatus.PENDING)
                .totalAmount(totalAmount)
                .discountAmount(totalDiscount)
                .taxAmount(totalTax)
                .netAmount(netAmount)
                .seller(seller)
                .customerId(request.customerId())
                .notes(request.notes())
                .details(new ArrayList<>())
                .payments(new ArrayList<>())
                .build();

        Sale savedSale = saleRepository.save(sale);

        // Link details to sale
        for (SaleDetail detail : details) {
            detail.setSale(savedSale);
            savedSale.getDetails().add(detail);
        }

        // Add payment
        BigDecimal changeAmount = request.changeAmount() != null
                ? request.changeAmount()
                : BigDecimal.ZERO;

        Payment payment = Payment.builder()
                .sale(savedSale)
                .method(request.paymentMethod())
                .amount(request.paymentAmount())
                .changeAmount(changeAmount)
                .reference(request.paymentReference())
                .build();

        savedSale.getPayments().add(payment);

        // Flush to ensure details and payments are persisted before status change
        saleRepository.save(savedSale);

        // Confirm the sale — this triggers fn_confirm_sale_stock in DB
        savedSale.setStatus(SaleStatus.CONFIRMED);
        Sale confirmedSale = saleRepository.save(savedSale);

        log.info("Sale created and confirmed: #{} by seller: {}", confirmedSale.getSaleNumber(), sellerEmail);

        // Reload with all associations for response
        Sale fullSale = saleRepository.findWithDetailsById(confirmedSale.getId())
                .orElseThrow(() -> new EntityNotFoundException("Sale", confirmedSale.getId()));

        // Broadcast SSE event to ADMIN and SUPERVISOR
        sseRegistry.broadcastToRoles(
                Set.of("ADMIN", "SUPERVISOR"),
                new SseEvent(
                        SseEventType.VENTA_CONFIRMADA,
                        Map.of(
                                "saleNumber", confirmedSale.getSaleNumber(),
                                "total", confirmedSale.getTotalAmount(),
                                "sellerId", confirmedSale.getSeller().getId()
                        ),
                        LocalDateTime.now()
                )
        );

        return saleMapper.toResponse(fullSale);
    }

    @Override
    @Transactional(readOnly = true)
    public SaleResponse findById(UUID id) {
        Sale sale = saleRepository.findWithDetailsById(id)
                .orElseThrow(() -> new EntityNotFoundException("Sale", id));
        return saleMapper.toResponse(sale);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<SaleResponse> findAll(OffsetDateTime startDate, OffsetDateTime endDate,
                                      UUID sellerId, SaleStatus status, Pageable pageable) {
        return saleRepository.search(startDate, endDate, sellerId, status, pageable)
                .map(saleMapper::toResponse);
    }

    @Override
    @Transactional
    @Auditable(entityType = "SALE", action = "CANCEL", requireReason = true)
    public SaleResponse cancel(UUID id, String reason, String cancellerEmail) {
        Sale sale = saleRepository.findWithDetailsById(id)
                .orElseThrow(() -> new EntityNotFoundException("Sale", id));

        if (sale.getStatus() == SaleStatus.CANCELLED) {
            throw new BusinessException("Sale #" + sale.getSaleNumber() + " is already cancelled.");
        }

        if (sale.getStatus() == SaleStatus.PENDING) {
            throw new BusinessException("Cannot cancel a PENDING sale. It must be CONFIRMED first.");
        }

        User canceller = userRepository.findByEmailAndDeletedAtIsNull(cancellerEmail)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + cancellerEmail));

        sale.setStatus(SaleStatus.CANCELLED);
        sale.setCancelledBy(canceller);
        sale.setCancelledAt(OffsetDateTime.now());
        sale.setCancellationReason(reason);

        Sale saved = saleRepository.save(sale);
        log.info("Sale #{} cancelled by: {}", saved.getSaleNumber(), cancellerEmail);
        return saleMapper.toResponse(saved);
    }
}

package com.minimarket.modules.stock.service;

import com.minimarket.audit.annotation.Auditable;
import com.minimarket.exception.BusinessException;
import com.minimarket.exception.EntityNotFoundException;
import com.minimarket.exception.InsufficientStockException;
import com.minimarket.modules.products.domain.Product;
import com.minimarket.modules.products.dto.ProductResponse;
import com.minimarket.modules.products.mapper.ProductMapper;
import com.minimarket.modules.products.repository.ProductRepository;
import com.minimarket.modules.products.repository.ProductSpecification;
import com.minimarket.modules.stock.domain.MovementType;
import com.minimarket.modules.stock.domain.StockMovement;
import com.minimarket.modules.stock.dto.StockAdjustmentRequest;
import com.minimarket.modules.stock.dto.StockMovementResponse;
import com.minimarket.modules.stock.repository.StockMovementRepository;
import com.minimarket.modules.users.domain.User;
import com.minimarket.modules.users.repository.UserRepository;
import com.minimarket.sse.SseEmitterRegistry;
import com.minimarket.sse.SseEvent;
import com.minimarket.sse.SseEventType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class StockServiceImpl implements StockService {

    private final ProductRepository productRepository;
    private final StockMovementRepository stockMovementRepository;
    private final UserRepository userRepository;
    private final ProductMapper productMapper;
    private final SseEmitterRegistry sseRegistry;

    @Override
    @Transactional(readOnly = true)
    public Page<ProductResponse> findAllStock(Pageable pageable) {
        Specification<Product> spec = ProductSpecification.notDeleted()
                .and(ProductSpecification.withAssociations())
                .and(ProductSpecification.activeEquals(true));
        return productRepository.findAll(spec, pageable)
                .map(productMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ProductResponse> findLowStock(Pageable pageable) {
        return productRepository.findLowStock(pageable)
                .map(productMapper::toResponse);
    }

    @Override
    @Transactional
    @Auditable(entityType = "STOCK", action = "ADJUSTMENT", requireReason = true)
    public StockMovementResponse adjust(StockAdjustmentRequest request, String authorizedByEmail) {
        if (request.movementType() != MovementType.AJUSTE
                && request.movementType() != MovementType.COMPRA
                && request.movementType() != MovementType.MERMA) {
            throw new BusinessException(
                    "Manual adjustments only support types: AJUSTE, COMPRA, MERMA.");
        }

        Product product = productRepository.findByIdAndDeletedAtIsNull(request.productId())
                .orElseThrow(() -> new EntityNotFoundException("Product", request.productId()));

        User authorizedBy = userRepository.findByEmailAndDeletedAtIsNull(authorizedByEmail)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + authorizedByEmail));

        BigDecimal quantityBefore = product.getStockCurrent();
        BigDecimal quantityAfter = quantityBefore.add(request.quantity());

        if (quantityAfter.compareTo(BigDecimal.ZERO) < 0) {
            throw new InsufficientStockException(
                    product.getName(),
                    quantityBefore.doubleValue(),
                    request.quantity().abs().doubleValue()
            );
        }

        product.setStockCurrent(quantityAfter);
        productRepository.save(product);

        StockMovement movement = StockMovement.builder()
                .product(product)
                .movementType(request.movementType())
                .quantity(request.quantity())
                .quantityBefore(quantityBefore)
                .quantityAfter(quantityAfter)
                .authorizedBy(authorizedBy)
                .notes(request.notes())
                .createdBy(authorizedBy)
                .build();

        StockMovement saved = stockMovementRepository.save(movement);
        log.info("Stock adjustment for product {} by {}: {} ({})",
                product.getName(), authorizedByEmail, request.quantity(), request.movementType());

        // Emit STOCK_CRITICO if new stock is at or below minimum
        if (quantityAfter.compareTo(product.getStockMinimum()) <= 0) {
            sseRegistry.broadcastToRoles(
                    Set.of("ADMIN", "SUPERVISOR", "BODEGA"),
                    new SseEvent(
                            SseEventType.STOCK_CRITICO,
                            Map.of(
                                    "productId", product.getId(),
                                    "productName", product.getName(),
                                    "stockCurrent", quantityAfter,
                                    "stockMinimum", product.getStockMinimum()
                            ),
                            LocalDateTime.now()
                    )
            );
        }

        return toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<StockMovementResponse> findMovements(UUID productId, Pageable pageable) {
        return stockMovementRepository.findByProductId(productId, pageable)
                .map(this::toResponse);
    }

    private StockMovementResponse toResponse(StockMovement movement) {
        StockMovementResponse.ProductDto productDto = new StockMovementResponse.ProductDto(
                movement.getProduct().getId(),
                movement.getProduct().getBarcode(),
                movement.getProduct().getName(),
                movement.getProduct().getStockCurrent()
        );

        StockMovementResponse.UserDto authorizedDto = movement.getAuthorizedBy() != null
                ? new StockMovementResponse.UserDto(
                        movement.getAuthorizedBy().getId(),
                        movement.getAuthorizedBy().getEmail(),
                        movement.getAuthorizedBy().getFirstName(),
                        movement.getAuthorizedBy().getLastName())
                : null;

        StockMovementResponse.UserDto createdByDto = new StockMovementResponse.UserDto(
                movement.getCreatedBy().getId(),
                movement.getCreatedBy().getEmail(),
                movement.getCreatedBy().getFirstName(),
                movement.getCreatedBy().getLastName()
        );

        return new StockMovementResponse(
                movement.getId(),
                productDto,
                movement.getMovementType(),
                movement.getQuantity(),
                movement.getQuantityBefore(),
                movement.getQuantityAfter(),
                movement.getReferenceId(),
                movement.getReferenceType(),
                authorizedDto,
                movement.getNotes(),
                createdByDto,
                movement.getCreatedAt()
        );
    }
}

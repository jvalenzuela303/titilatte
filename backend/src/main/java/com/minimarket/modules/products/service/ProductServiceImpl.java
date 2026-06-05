package com.minimarket.modules.products.service;

import com.minimarket.audit.annotation.Auditable;
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
import com.minimarket.modules.products.repository.ProductSpecification;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductServiceImpl implements ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final ProductMapper productMapper;

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    @Transactional(readOnly = true)
    public Page<ProductResponse> findAll(String name, String barcode, UUID categoryId, Boolean active, Pageable pageable) {
        Specification<Product> spec = ProductSpecification.notDeleted()
                .and(ProductSpecification.withAssociations());
        if (name != null && !name.isBlank()) {
            spec = spec.and(ProductSpecification.nameLike(name));
        }
        if (barcode != null && !barcode.isBlank()) {
            spec = spec.and(ProductSpecification.barcodeEquals(barcode));
        }
        if (categoryId != null) {
            spec = spec.and(ProductSpecification.categoryEquals(categoryId));
        }
        if (active != null) {
            spec = spec.and(ProductSpecification.activeEquals(active));
        }
        return productRepository.findAll(spec, pageable)
                .map(productMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public ProductResponse findById(UUID id) {
        Product product = productRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new EntityNotFoundException("Product", id));
        return productMapper.toResponse(product);
    }

    @Override
    @Transactional(readOnly = true)
    @Cacheable(value = "products-catalog", key = "#barcode")
    public ProductResponse findByBarcode(String barcode) {
        Product product = productRepository.findByBarcodeAndDeletedAtIsNull(barcode)
                .orElseThrow(() -> new EntityNotFoundException("Product not found with barcode: " + barcode));
        return productMapper.toResponse(product);
    }

    @Override
    @Transactional
    public ProductResponse create(CreateProductRequest request) {
        if (productRepository.findByBarcodeAndDeletedAtIsNull(request.barcode()).isPresent()) {
            throw new BusinessException("A product with barcode '" + request.barcode() + "' already exists.");
        }

        if (request.salePrice().compareTo(request.purchasePrice()) < 0) {
            throw new BusinessException("Sale price must be greater than or equal to purchase price.");
        }

        ProductCategory category = categoryRepository.findById(request.categoryId())
                .orElseThrow(() -> new EntityNotFoundException("Category", request.categoryId()));

        Tax tax = entityManager.find(Tax.class, request.taxId());
        if (tax == null) {
            throw new EntityNotFoundException("Tax", request.taxId());
        }

        Unit unit = entityManager.find(Unit.class, request.unitId());
        if (unit == null) {
            throw new EntityNotFoundException("Unit", request.unitId());
        }

        Product product = Product.builder()
                .barcode(request.barcode())
                .name(request.name())
                .description(request.description())
                .purchasePrice(request.purchasePrice())
                .salePrice(request.salePrice())
                .stockCurrent(BigDecimal.ZERO)
                .stockMinimum(request.stockMinimum() != null ? request.stockMinimum() : BigDecimal.ZERO)
                .stockMaximum(request.stockMaximum())
                .active(true)
                .trackStock(request.trackStock() == null || request.trackStock())
                .category(category)
                .tax(tax)
                .unit(unit)
                .build();

        Product saved = productRepository.save(product);
        log.info("Created product: {} with barcode: {}", saved.getName(), saved.getBarcode());
        return productMapper.toResponse(saved);
    }

    @Override
    @Transactional
    @Auditable(entityType = "PRODUCT", action = "PRICE_CHANGE", captureOldValue = true)
    @CacheEvict(value = "products-catalog", allEntries = true)
    public ProductResponse update(UUID id, UpdateProductRequest request) {
        Product product = productRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new EntityNotFoundException("Product", id));

        if (request.barcode() != null && !request.barcode().equals(product.getBarcode())) {
            productRepository.findByBarcodeAndDeletedAtIsNull(request.barcode())
                    .ifPresent(existing -> {
                        throw new BusinessException(
                                "A product with barcode '" + request.barcode() + "' already exists.");
                    });
            product.setBarcode(request.barcode());
        }

        if (request.name() != null) product.setName(request.name());
        if (request.description() != null) product.setDescription(request.description());
        if (request.purchasePrice() != null) product.setPurchasePrice(request.purchasePrice());
        if (request.salePrice() != null) product.setSalePrice(request.salePrice());
        if (request.stockMinimum() != null) product.setStockMinimum(request.stockMinimum());
        if (request.stockMaximum() != null) product.setStockMaximum(request.stockMaximum());
        if (request.active() != null) product.setActive(request.active());
        if (request.trackStock() != null) product.setTrackStock(request.trackStock());

        BigDecimal finalSalePrice = product.getSalePrice();
        BigDecimal finalPurchasePrice = product.getPurchasePrice();
        if (finalSalePrice.compareTo(finalPurchasePrice) < 0) {
            throw new BusinessException("Sale price must be greater than or equal to purchase price.");
        }

        if (request.categoryId() != null) {
            ProductCategory category = categoryRepository.findById(request.categoryId())
                    .orElseThrow(() -> new EntityNotFoundException("Category", request.categoryId()));
            product.setCategory(category);
        }

        if (request.taxId() != null) {
            Tax tax = entityManager.find(Tax.class, request.taxId());
            if (tax == null) throw new EntityNotFoundException("Tax", request.taxId());
            product.setTax(tax);
        }

        if (request.unitId() != null) {
            Unit unit = entityManager.find(Unit.class, request.unitId());
            if (unit == null) throw new EntityNotFoundException("Unit", request.unitId());
            product.setUnit(unit);
        }

        Product saved = productRepository.save(product);
        log.info("Updated product id: {}", saved.getId());
        return productMapper.toResponse(saved);
    }

    @Override
    @Transactional
    @CacheEvict(value = "products-catalog", allEntries = true)
    public void delete(UUID id) {
        Product product = productRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new EntityNotFoundException("Product", id));
        product.setDeletedAt(OffsetDateTime.now());
        product.setActive(false);
        productRepository.save(product);
        log.info("Soft deleted product id: {}", id);
    }
}

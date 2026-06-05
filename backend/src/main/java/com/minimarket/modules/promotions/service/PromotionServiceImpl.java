package com.minimarket.modules.promotions.service;

import com.minimarket.exception.BusinessException;
import com.minimarket.exception.EntityNotFoundException;
import com.minimarket.modules.branches.domain.Branch;
import com.minimarket.modules.branches.repository.BranchRepository;
import com.minimarket.modules.products.domain.Product;
import com.minimarket.modules.products.domain.ProductCategory;
import com.minimarket.modules.products.repository.ProductRepository;
import com.minimarket.modules.products.repository.CategoryRepository;
import com.minimarket.modules.promotions.domain.Promotion;
import com.minimarket.modules.promotions.domain.PromotionProduct;
import com.minimarket.modules.promotions.domain.PromotionType;
import com.minimarket.modules.promotions.dto.AppliedPromotionResult;
import com.minimarket.modules.promotions.dto.PromotionImpactDto;
import com.minimarket.modules.promotions.dto.PromotionRequest;
import com.minimarket.modules.promotions.dto.PromotionResponse;
import com.minimarket.modules.promotions.repository.PromotionProductRepository;
import com.minimarket.modules.promotions.repository.PromotionRepository;
import com.minimarket.modules.users.domain.User;
import com.minimarket.modules.users.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PromotionServiceImpl implements PromotionService {

    private final PromotionRepository promotionRepository;
    private final PromotionProductRepository promotionProductRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final CategoryRepository productCategoryRepository;
    private final BranchRepository branchRepository;

    @Override
    @Transactional(readOnly = true)
    public Page<PromotionResponse> findAll(boolean activeOnly, Pageable pageable) {
        return promotionRepository.findAllWithFilter(activeOnly, pageable)
                .map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public PromotionResponse findById(UUID id) {
        Promotion promotion = promotionRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new EntityNotFoundException("Promotion", id));
        return toResponse(promotion);
    }

    @Override
    @Transactional
    public PromotionResponse create(PromotionRequest req, String creatorEmail) {
        User creator = userRepository.findByEmailAndDeletedAtIsNull(creatorEmail)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + creatorEmail));

        validateDateRange(req);

        Promotion promotion = Promotion.builder()
                .name(req.name())
                .description(req.description())
                .type(PromotionType.valueOf(req.type()))
                .value(req.value())
                .minQuantity(req.minQuantity() < 1 ? 1 : req.minQuantity())
                .bonusQuantity(req.bonusQuantity())
                .appliesTo(req.appliesTo())
                .startsAt(req.startsAt())
                .endsAt(req.endsAt())
                .active(req.active())
                .createdBy(creator)
                .promotionProducts(new ArrayList<>())
                .build();

        resolveCategory(req, promotion);
        resolveBranch(req, promotion);

        Promotion saved = promotionRepository.save(promotion);
        resolveAndSaveProducts(req, saved);

        return toResponse(promotionRepository.findByIdAndDeletedAtIsNull(saved.getId())
                .orElseThrow(() -> new EntityNotFoundException("Promotion", saved.getId())));
    }

    @Override
    @Transactional
    public PromotionResponse update(UUID id, PromotionRequest req) {
        Promotion promotion = promotionRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new EntityNotFoundException("Promotion", id));

        validateDateRange(req);

        promotion.setName(req.name());
        promotion.setDescription(req.description());
        promotion.setType(PromotionType.valueOf(req.type()));
        promotion.setValue(req.value());
        promotion.setMinQuantity(req.minQuantity() < 1 ? 1 : req.minQuantity());
        promotion.setBonusQuantity(req.bonusQuantity());
        promotion.setAppliesTo(req.appliesTo());
        promotion.setStartsAt(req.startsAt());
        promotion.setEndsAt(req.endsAt());
        promotion.setActive(req.active());

        resolveCategory(req, promotion);
        resolveBranch(req, promotion);

        promotion.getPromotionProducts().clear();

        // saveAndFlush forces Hibernate to DELETE orphans before the new INSERT in resolveAndSaveProducts
        Promotion saved = promotionRepository.saveAndFlush(promotion);
        resolveAndSaveProducts(req, saved);

        return toResponse(promotionRepository.findByIdAndDeletedAtIsNull(saved.getId())
                .orElseThrow(() -> new EntityNotFoundException("Promotion", saved.getId())));
    }

    @Override
    @Transactional
    public void deactivate(UUID id) {
        Promotion promotion = promotionRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new EntityNotFoundException("Promotion", id));
        promotion.setActive(false);
        promotion.setDeletedAt(OffsetDateTime.now());
        promotionRepository.save(promotion);
        log.info("Promotion {} deactivated (soft deleted)", id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PromotionResponse> findActiveNow() {
        return promotionRepository.findActiveNow(OffsetDateTime.now())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<AppliedPromotionResult> applyBestPromotion(UUID productId, int quantity, UUID branchId) {
        Product product = productRepository.findByIdAndDeletedAtIsNull(productId)
                .orElseThrow(() -> new EntityNotFoundException("Product", productId));

        BigDecimal unitPrice = product.getSalePrice();
        OffsetDateTime now = OffsetDateTime.now();

        List<Promotion> candidates = promotionRepository.findApplicablePromotions(productId, branchId, now);

        return candidates.stream()
                .filter(p -> quantity >= p.getMinQuantity())
                .map(p -> calculateResult(p, unitPrice, quantity))
                .filter(Optional::isPresent)
                .map(Optional::get)
                .max(Comparator.comparing(AppliedPromotionResult::discountAmount));
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, PromotionImpactDto> getImpactReport(LocalDate from, LocalDate to) {
        OffsetDateTime startDt = from.atStartOfDay().atOffset(ZoneOffset.UTC);
        OffsetDateTime endDt = to.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC);

        // Native query for aggregation: join sale_details on applied_promotion_id, filter by sale.created_at
        List<Object[]> rows = promotionRepository.getImpactRawData(startDt, endDt);

        Map<UUID, PromotionImpactDto> result = new HashMap<>();
        for (Object[] row : rows) {
            UUID promoId = (UUID) row[0];
            String promoName = (String) row[1];
            String promoType = (String) row[2];
            long count = ((Number) row[3]).longValue();
            BigDecimal totalDiscount = row[4] != null ? (BigDecimal) row[4] : BigDecimal.ZERO;
            result.put(promoId, new PromotionImpactDto(promoId, promoName, promoType, count, totalDiscount));
        }
        return result;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private Optional<AppliedPromotionResult> calculateResult(Promotion p, BigDecimal unitPrice, int quantity) {
        try {
            return switch (p.getType()) {
                case PERCENTAGE -> calculatePercentage(p, unitPrice, quantity);
                case FIXED_PRICE -> calculateFixedPrice(p, unitPrice, quantity);
                case TWO_FOR_ONE -> calculateTwoForOne(p, unitPrice, quantity);
                case QUANTITY_DISCOUNT -> calculateQuantityDiscount(p, unitPrice, quantity);
            };
        } catch (Exception e) {
            log.warn("Error calculating promotion {}: {}", p.getId(), e.getMessage());
            return Optional.empty();
        }
    }

    private Optional<AppliedPromotionResult> calculatePercentage(Promotion p, BigDecimal unitPrice, int quantity) {
        if (p.getValue() == null) return Optional.empty();
        BigDecimal discountRate = p.getValue();
        BigDecimal finalPrice = unitPrice.multiply(BigDecimal.ONE.subtract(discountRate))
                .setScale(4, RoundingMode.HALF_UP);
        BigDecimal discountAmount = unitPrice.subtract(finalPrice)
                .multiply(BigDecimal.valueOf(quantity))
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal discountPercent = discountRate.multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP);
        return Optional.of(new AppliedPromotionResult(
                p.getId(), p.getName(), p.getType().name(),
                unitPrice, finalPrice, discountAmount, discountPercent,
                quantity, 0, p.getDescription()
        ));
    }

    private Optional<AppliedPromotionResult> calculateFixedPrice(Promotion p, BigDecimal unitPrice, int quantity) {
        if (p.getValue() == null) return Optional.empty();
        BigDecimal finalPrice = p.getValue();
        BigDecimal discountAmount = unitPrice.subtract(finalPrice)
                .multiply(BigDecimal.valueOf(quantity))
                .setScale(2, RoundingMode.HALF_UP);
        if (discountAmount.compareTo(BigDecimal.ZERO) <= 0) return Optional.empty();
        BigDecimal discountPercent = BigDecimal.ONE.subtract(finalPrice.divide(unitPrice, 4, RoundingMode.HALF_UP))
                .multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP);
        return Optional.of(new AppliedPromotionResult(
                p.getId(), p.getName(), p.getType().name(),
                unitPrice, finalPrice, discountAmount, discountPercent,
                quantity, 0, p.getDescription()
        ));
    }

    private Optional<AppliedPromotionResult> calculateTwoForOne(Promotion p, BigDecimal unitPrice, int quantity) {
        int minQty = p.getMinQuantity();
        int bonusQty = p.getBonusQuantity() != null ? p.getBonusQuantity() : 1;
        int groupSize = minQty + bonusQty;
        // buyer pays for minQty units per group
        int paidGroups = (int) Math.ceil((double) quantity / groupSize);
        int effectiveQty = paidGroups * minQty;
        BigDecimal totalOriginal = unitPrice.multiply(BigDecimal.valueOf(quantity));
        BigDecimal totalEffective = unitPrice.multiply(BigDecimal.valueOf(effectiveQty));
        BigDecimal discountAmount = totalOriginal.subtract(totalEffective).setScale(2, RoundingMode.HALF_UP);
        if (discountAmount.compareTo(BigDecimal.ZERO) <= 0) return Optional.empty();
        BigDecimal discountPercent = discountAmount.divide(totalOriginal, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP);
        BigDecimal finalPrice = totalEffective.divide(BigDecimal.valueOf(quantity), 4, RoundingMode.HALF_UP);
        return Optional.of(new AppliedPromotionResult(
                p.getId(), p.getName(), p.getType().name(),
                unitPrice, finalPrice, discountAmount, discountPercent,
                effectiveQty, quantity - effectiveQty, p.getDescription()
        ));
    }

    private Optional<AppliedPromotionResult> calculateQuantityDiscount(Promotion p, BigDecimal unitPrice, int quantity) {
        if (p.getValue() == null || quantity < p.getMinQuantity()) return Optional.empty();
        BigDecimal discountRate = p.getValue();
        BigDecimal finalPrice = unitPrice.multiply(BigDecimal.ONE.subtract(discountRate))
                .setScale(4, RoundingMode.HALF_UP);
        BigDecimal discountAmount = unitPrice.subtract(finalPrice)
                .multiply(BigDecimal.valueOf(quantity))
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal discountPercent = discountRate.multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP);
        return Optional.of(new AppliedPromotionResult(
                p.getId(), p.getName(), p.getType().name(),
                unitPrice, finalPrice, discountAmount, discountPercent,
                quantity, 0, p.getDescription()
        ));
    }

    private void validateDateRange(PromotionRequest req) {
        if (req.endsAt() != null && req.startsAt() != null && !req.endsAt().isAfter(req.startsAt())) {
            throw new BusinessException("endsAt must be after startsAt.");
        }
    }

    private void resolveCategory(PromotionRequest req, Promotion promotion) {
        if ("CATEGORY".equals(req.appliesTo()) && req.categoryId() != null) {
            ProductCategory category = productCategoryRepository.findById(req.categoryId())
                    .orElseThrow(() -> new EntityNotFoundException("ProductCategory", req.categoryId()));
            promotion.setCategory(category);
        } else {
            promotion.setCategory(null);
        }
    }

    private void resolveBranch(PromotionRequest req, Promotion promotion) {
        if (req.branchId() != null) {
            Branch branch = branchRepository.findById(req.branchId())
                    .orElseThrow(() -> new EntityNotFoundException("Branch", req.branchId()));
            promotion.setBranch(branch);
        } else {
            promotion.setBranch(null);
        }
    }

    private void resolveAndSaveProducts(PromotionRequest req, Promotion saved) {
        if ("SPECIFIC_PRODUCTS".equals(req.appliesTo()) && req.productIds() != null && !req.productIds().isEmpty()) {
            for (UUID productId : req.productIds()) {
                Product product = productRepository.findByIdAndDeletedAtIsNull(productId)
                        .orElseThrow(() -> new EntityNotFoundException("Product", productId));
                PromotionProduct pp = PromotionProduct.builder()
                        .id(new PromotionProduct.PromotionProductId(saved.getId(), productId))
                        .promotion(saved)
                        .product(product)
                        .build();
                promotionProductRepository.save(pp);
            }
        }
    }

    private PromotionResponse toResponse(Promotion p) {
        List<UUID> productIds = p.getPromotionProducts() != null
                ? p.getPromotionProducts().stream()
                        .map(pp -> pp.getProduct().getId())
                        .toList()
                : List.of();

        return new PromotionResponse(
                p.getId(),
                p.getName(),
                p.getDescription(),
                p.getType().name(),
                p.getValue(),
                p.getMinQuantity(),
                p.getBonusQuantity(),
                p.getAppliesTo(),
                p.getCategory() != null ? p.getCategory().getId() : null,
                p.getCategory() != null ? p.getCategory().getName() : null,
                p.getStartsAt(),
                p.getEndsAt(),
                p.isActive(),
                p.getBranch() != null ? p.getBranch().getId() : null,
                productIds,
                p.getCreatedAt()
        );
    }
}

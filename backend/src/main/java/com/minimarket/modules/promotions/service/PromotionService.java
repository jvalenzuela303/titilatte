package com.minimarket.modules.promotions.service;

import com.minimarket.modules.promotions.dto.AppliedPromotionResult;
import com.minimarket.modules.promotions.dto.PromotionImpactDto;
import com.minimarket.modules.promotions.dto.PromotionRequest;
import com.minimarket.modules.promotions.dto.PromotionResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public interface PromotionService {

    Page<PromotionResponse> findAll(boolean activeOnly, Pageable pageable);

    PromotionResponse findById(UUID id);

    PromotionResponse create(PromotionRequest req, String creatorEmail);

    PromotionResponse update(UUID id, PromotionRequest req);

    void deactivate(UUID id);

    List<PromotionResponse> findActiveNow();

    Optional<AppliedPromotionResult> applyBestPromotion(UUID productId, int quantity, UUID branchId);

    Map<UUID, PromotionImpactDto> getImpactReport(LocalDate from, LocalDate to);
}

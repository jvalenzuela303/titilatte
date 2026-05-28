package com.minimarket.modules.stock.service;

import com.minimarket.modules.products.dto.ProductResponse;
import com.minimarket.modules.stock.dto.StockAdjustmentRequest;
import com.minimarket.modules.stock.dto.StockMovementResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface StockService {

    Page<ProductResponse> findAllStock(Pageable pageable);

    Page<ProductResponse> findLowStock(Pageable pageable);

    StockMovementResponse adjust(StockAdjustmentRequest request, String authorizedByEmail);

    Page<StockMovementResponse> findMovements(UUID productId, Pageable pageable);
}

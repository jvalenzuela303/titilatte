package com.minimarket.modules.sales.service;

import com.minimarket.modules.sales.domain.SaleStatus;
import com.minimarket.modules.sales.dto.CreateSaleRequest;
import com.minimarket.modules.sales.dto.SaleResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.OffsetDateTime;
import java.util.UUID;

public interface SaleService {

    SaleResponse create(CreateSaleRequest request, String sellerEmail);

    SaleResponse findById(UUID id);

    Page<SaleResponse> findAll(OffsetDateTime startDate, OffsetDateTime endDate,
                               UUID sellerId, SaleStatus status, Pageable pageable);

    SaleResponse cancel(UUID id, String reason, String cancellerEmail);
}

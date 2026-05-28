package com.minimarket.modules.purchases.service;

import com.minimarket.modules.purchases.dto.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface PurchaseService {

    PurchaseResponse createPurchase(CreatePurchaseRequest request, String userEmail);

    PurchaseResponse confirmPurchase(UUID id);

    PurchaseResponse cancelPurchase(UUID id);

    PurchaseResponse getPurchase(UUID id);

    Page<PurchaseResponse> getAllPurchases(Pageable pageable);

    SupplierResponse createSupplier(SupplierRequest request);

    SupplierResponse updateSupplier(UUID id, SupplierRequest request);

    Page<SupplierResponse> getAllSuppliers(Pageable pageable);

    SupplierResponse getSupplier(UUID id);
}

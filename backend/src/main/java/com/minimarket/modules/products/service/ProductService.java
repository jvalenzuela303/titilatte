package com.minimarket.modules.products.service;

import com.minimarket.modules.products.dto.CreateProductRequest;
import com.minimarket.modules.products.dto.ProductResponse;
import com.minimarket.modules.products.dto.UpdateProductRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface ProductService {

    Page<ProductResponse> findAll(String name, String barcode, UUID categoryId, Boolean active, Pageable pageable);

    ProductResponse findById(UUID id);

    ProductResponse findByBarcode(String barcode);

    ProductResponse create(CreateProductRequest request);

    ProductResponse update(UUID id, UpdateProductRequest request);

    void delete(UUID id);
}

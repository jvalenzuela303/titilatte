package com.minimarket.modules.products.service;

import com.minimarket.modules.products.dto.CategoryResponse;
import com.minimarket.modules.products.dto.CreateCategoryRequest;
import com.minimarket.modules.products.dto.UpdateCategoryRequest;

import java.util.List;
import java.util.UUID;

public interface CategoryService {

    List<CategoryResponse> findAll(Boolean activeOnly);

    CategoryResponse findById(UUID id);

    CategoryResponse create(CreateCategoryRequest request);

    CategoryResponse update(UUID id, UpdateCategoryRequest request);

    void delete(UUID id);
}

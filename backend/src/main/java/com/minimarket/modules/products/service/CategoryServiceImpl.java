package com.minimarket.modules.products.service;

import com.minimarket.exception.BusinessException;
import com.minimarket.exception.EntityNotFoundException;
import com.minimarket.modules.products.domain.ProductCategory;
import com.minimarket.modules.products.domain.ProductFamily;
import com.minimarket.modules.products.dto.CategoryResponse;
import com.minimarket.modules.products.dto.CreateCategoryRequest;
import com.minimarket.modules.products.dto.UpdateCategoryRequest;
import com.minimarket.modules.products.repository.CategoryRepository;
import com.minimarket.modules.products.repository.FamilyRepository;
import com.minimarket.modules.products.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CategoryServiceImpl implements CategoryService {

    private final CategoryRepository categoryRepository;
    private final FamilyRepository familyRepository;
    private final ProductRepository productRepository;

    @Override
    @Transactional(readOnly = true)
    public List<CategoryResponse> findAll(Boolean activeOnly) {
        List<ProductCategory> categories;
        if (Boolean.TRUE.equals(activeOnly)) {
            categories = categoryRepository.findAllByActiveTrueOrderByNameAsc();
        } else {
            categories = categoryRepository.findAll();
        }
        return categories.stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public CategoryResponse findById(UUID id) {
        ProductCategory category = categoryRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Category", id));
        return toResponse(category);
    }

    @Override
    @Transactional
    public CategoryResponse create(CreateCategoryRequest request) {
        if (categoryRepository.existsByCode(request.code())) {
            throw new BusinessException("Código ya existe: " + request.code());
        }

        ProductFamily family = familyRepository.findById(request.familyId())
                .orElseThrow(() -> new EntityNotFoundException("ProductFamily", request.familyId()));

        ProductCategory category = ProductCategory.builder()
                .code(request.code())
                .name(request.name())
                .description(request.description())
                .familyId(family.getId())
                .active(request.active())
                .build();

        ProductCategory saved = categoryRepository.save(category);
        log.info("Created category: {} ({})", saved.getName(), saved.getCode());
        return toResponse(saved, family.getName());
    }

    @Override
    @Transactional
    public CategoryResponse update(UUID id, UpdateCategoryRequest request) {
        ProductCategory category = categoryRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Category", id));

        if (request.code() != null && !request.code().equals(category.getCode())) {
            if (categoryRepository.existsByCodeAndIdNot(request.code(), id)) {
                throw new BusinessException("Código ya existe: " + request.code());
            }
            category.setCode(request.code());
        }

        if (request.name() != null) category.setName(request.name());
        if (request.description() != null) category.setDescription(request.description());
        if (request.active() != null) category.setActive(request.active());

        if (request.familyId() != null && !request.familyId().equals(category.getFamilyId())) {
            ProductFamily family = familyRepository.findById(request.familyId())
                    .orElseThrow(() -> new EntityNotFoundException("ProductFamily", request.familyId()));
            category.setFamilyId(family.getId());
        }

        ProductCategory saved = categoryRepository.save(category);
        log.info("Updated category id: {}", saved.getId());
        return toResponse(saved);
    }

    @Override
    @Transactional
    public void delete(UUID id) {
        ProductCategory category = categoryRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Category", id));

        if (productRepository.existsByCategoryIdAndDeletedAtIsNull(id)) {
            throw new BusinessException("No se puede eliminar: la categoría tiene productos asociados");
        }

        categoryRepository.delete(category);
        log.info("Deleted category id: {}", id);
    }

    private CategoryResponse toResponse(ProductCategory category) {
        String familyName = familyRepository.findById(category.getFamilyId())
                .map(ProductFamily::getName)
                .orElse(null);
        long productCount = productRepository.countByCategoryIdAndDeletedAtIsNull(category.getId());
        return new CategoryResponse(
                category.getId(),
                category.getFamilyId(),
                familyName,
                category.getCode(),
                category.getName(),
                category.getDescription(),
                category.isActive(),
                productCount,
                category.getCreatedAt(),
                category.getUpdatedAt()
        );
    }

    private CategoryResponse toResponse(ProductCategory category, String familyName) {
        long productCount = productRepository.countByCategoryIdAndDeletedAtIsNull(category.getId());
        return new CategoryResponse(
                category.getId(),
                category.getFamilyId(),
                familyName,
                category.getCode(),
                category.getName(),
                category.getDescription(),
                category.isActive(),
                productCount,
                category.getCreatedAt(),
                category.getUpdatedAt()
        );
    }
}

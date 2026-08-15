package com.minimarket.modules.products.controller;

import com.minimarket.exception.BusinessException;
import com.minimarket.exception.EntityNotFoundException;
import com.minimarket.modules.products.domain.ProductFamily;
import com.minimarket.modules.products.dto.CategoryResponse;
import com.minimarket.modules.products.dto.CreateCategoryRequest;
import com.minimarket.modules.products.dto.FamilyRequest;
import com.minimarket.modules.products.dto.UpdateCategoryRequest;
import com.minimarket.modules.products.repository.FamilyRepository;
import com.minimarket.modules.products.service.CategoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/categories")
@RequiredArgsConstructor
@Tag(name = "Categories", description = "Product category management")
public class CategoryController {

    private final CategoryService categoryService;
    private final FamilyRepository familyRepository;

    @GetMapping("/families")
    @Operation(summary = "List all active product families")
    public ResponseEntity<List<ProductFamily>> findFamilies() {
        return ResponseEntity.ok(familyRepository.findAllByActiveTrueOrderByNameAsc());
    }

    @GetMapping("/families/all")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Operation(summary = "List all product families including inactive")
    public ResponseEntity<List<ProductFamily>> findAllFamilies() {
        return ResponseEntity.ok(familyRepository.findAll());
    }

    @PostMapping("/families")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Operation(summary = "Create a new product family")
    public ResponseEntity<ProductFamily> createFamily(@Valid @RequestBody FamilyRequest request) {
        Optional<ProductFamily> existing = familyRepository.findAll().stream()
                .filter(f -> f.getCode().equalsIgnoreCase(request.code()))
                .findFirst();
        if (existing.isPresent()) {
            throw new BusinessException("A family with code '" + request.code().toUpperCase() + "' already exists.");
        }
        ProductFamily family = ProductFamily.builder()
                .code(request.code().toUpperCase())
                .name(request.name())
                .description(request.description())
                .active(request.active() == null || request.active())
                .build();
        return ResponseEntity.status(HttpStatus.CREATED).body(familyRepository.save(family));
    }

    @PutMapping("/families/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Operation(summary = "Update a product family")
    public ResponseEntity<ProductFamily> updateFamily(
            @PathVariable UUID id,
            @Valid @RequestBody FamilyRequest request) {
        ProductFamily family = familyRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Family", id));
        if (!family.getCode().equalsIgnoreCase(request.code())) {
            familyRepository.findAll().stream()
                    .filter(f -> f.getCode().equalsIgnoreCase(request.code()) && !f.getId().equals(id))
                    .findFirst()
                    .ifPresent(f -> { throw new BusinessException("A family with code '" + request.code().toUpperCase() + "' already exists."); });
        }
        family.setCode(request.code().toUpperCase());
        family.setName(request.name());
        family.setDescription(request.description());
        if (request.active() != null) family.setActive(request.active());
        return ResponseEntity.ok(familyRepository.save(family));
    }

    @DeleteMapping("/families/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Delete a product family (blocked if it has associated categories)")
    public ResponseEntity<Void> deleteFamily(@PathVariable UUID id) {
        ProductFamily family = familyRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Family", id));
        familyRepository.delete(family);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    @Operation(summary = "List categories, optionally filtered to active only")
    public ResponseEntity<List<CategoryResponse>> findAll(
            @RequestParam(required = false, defaultValue = "false") Boolean activeOnly) {
        return ResponseEntity.ok(categoryService.findAll(activeOnly));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get category by ID")
    public ResponseEntity<CategoryResponse> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(categoryService.findById(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Operation(summary = "Create a new category")
    public ResponseEntity<CategoryResponse> create(@Valid @RequestBody CreateCategoryRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(categoryService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Operation(summary = "Partially update a category")
    public ResponseEntity<CategoryResponse> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateCategoryRequest request) {
        return ResponseEntity.ok(categoryService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Hard delete a category (blocked if it has associated products)")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        categoryService.delete(id);
        return ResponseEntity.noContent().build();
    }
}

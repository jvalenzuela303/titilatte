package com.minimarket.modules.products.controller;

import com.minimarket.modules.products.domain.ProductFamily;
import com.minimarket.modules.products.dto.CategoryResponse;
import com.minimarket.modules.products.dto.CreateCategoryRequest;
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
import java.util.UUID;

@RestController
@RequestMapping("/categories")
@RequiredArgsConstructor
@Tag(name = "Categories", description = "Product category management")
public class CategoryController {

    private final CategoryService categoryService;
    private final FamilyRepository familyRepository;

    @GetMapping("/families")
    @Operation(summary = "List all product families")
    public ResponseEntity<List<ProductFamily>> findFamilies() {
        return ResponseEntity.ok(familyRepository.findAllByActiveTrueOrderByNameAsc());
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

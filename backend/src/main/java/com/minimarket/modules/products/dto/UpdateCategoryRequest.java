package com.minimarket.modules.products.dto;

import jakarta.validation.constraints.Size;

import java.util.UUID;

public record UpdateCategoryRequest(
        @Size(max = 20) String code,
        @Size(max = 100) String name,
        @Size(max = 500) String description,
        UUID familyId,
        Boolean active
) {}

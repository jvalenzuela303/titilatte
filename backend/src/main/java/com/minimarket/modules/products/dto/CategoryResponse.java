package com.minimarket.modules.products.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record CategoryResponse(
        UUID id,
        UUID familyId,
        String familyName,
        String code,
        String name,
        String description,
        boolean active,
        long productCount,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}

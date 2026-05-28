package com.minimarket.modules.users.dto;

import com.minimarket.modules.users.domain.Role;

import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String email,
        String firstName,
        String lastName,
        boolean active,
        Set<Role.RoleName> roles,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}

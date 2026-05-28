package com.minimarket.modules.auth.dto;

import com.minimarket.modules.users.domain.Role;

import java.util.Set;
import java.util.UUID;

public record LoginResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresIn,
        UUID userId,
        String email,
        String firstName,
        String lastName,
        Set<Role.RoleName> roles,
        UUID branchId
) {
    public LoginResponse(String accessToken, String refreshToken, long expiresIn,
                         UUID userId, String email, String firstName, String lastName,
                         Set<Role.RoleName> roles, UUID branchId) {
        this(accessToken, refreshToken, "Bearer", expiresIn, userId, email, firstName, lastName, roles, branchId);
    }
}

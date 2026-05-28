package com.minimarket.modules.users.dto;

import com.minimarket.modules.users.domain.Role;
import jakarta.validation.constraints.*;

import java.util.Set;

public record CreateUserRequest(
        @NotBlank @Email(message = "Must be a valid email address")
        String email,

        @NotBlank @Size(min = 8, max = 100, message = "Password must be between 8 and 100 characters")
        String password,

        @NotBlank @Size(max = 100, message = "First name must not exceed 100 characters")
        String firstName,

        @NotBlank @Size(max = 100, message = "Last name must not exceed 100 characters")
        String lastName,

        @NotEmpty(message = "At least one role must be assigned")
        Set<Role.RoleName> roles
) {}

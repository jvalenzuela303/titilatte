package com.minimarket.modules.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank @Email(message = "Must be a valid email address")
        String email,

        @NotBlank(message = "Password must not be blank")
        String password
) {}

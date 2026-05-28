package com.minimarket.modules.customers.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;

public record CustomerRequest(
        @NotBlank String firstName,
        @NotBlank String lastName,
        String rut,
        String phone,
        String email,
        String address,
        @DecimalMin(value = "0.0", message = "Credit limit cannot be negative") BigDecimal creditLimit
) {}

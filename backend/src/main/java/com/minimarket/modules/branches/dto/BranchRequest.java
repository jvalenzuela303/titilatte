package com.minimarket.modules.branches.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record BranchRequest(
    @NotBlank @Size(max = 100) String name,
    @Size(max = 200) String address,
    @Size(max = 20)  String phone,
    @Size(max = 12)  String rut
) {}

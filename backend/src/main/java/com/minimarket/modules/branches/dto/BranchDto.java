package com.minimarket.modules.branches.dto;

import java.util.UUID;

public record BranchDto(
    UUID id,
    String name,
    String address,
    String phone,
    String rut,
    boolean isActive
) {}

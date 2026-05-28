package com.minimarket.modules.branches.service;

import com.minimarket.modules.branches.dto.BranchDto;
import com.minimarket.modules.branches.dto.BranchRequest;

import java.util.List;
import java.util.UUID;

public interface BranchService {
    List<BranchDto> findAll();
    BranchDto findById(UUID id);
    BranchDto create(BranchRequest request);
    BranchDto update(UUID id, BranchRequest request);
    void deactivate(UUID id);
}

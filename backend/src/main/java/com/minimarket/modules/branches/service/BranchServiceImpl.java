package com.minimarket.modules.branches.service;

import com.minimarket.modules.branches.domain.Branch;
import com.minimarket.modules.branches.dto.BranchDto;
import com.minimarket.modules.branches.dto.BranchRequest;
import com.minimarket.modules.branches.repository.BranchRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BranchServiceImpl implements BranchService {

    private final BranchRepository branchRepository;

    @Override
    @Transactional(readOnly = true)
    public List<BranchDto> findAll() {
        return branchRepository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public BranchDto findById(UUID id) {
        return toDto(findOrThrow(id));
    }

    @Override
    @Transactional
    public BranchDto create(BranchRequest request) {
        Branch branch = Branch.builder()
            .name(request.name())
            .address(request.address())
            .phone(request.phone())
            .rut(request.rut())
            .isActive(true)
            .build();
        return toDto(branchRepository.save(branch));
    }

    @Override
    @Transactional
    public BranchDto update(UUID id, BranchRequest request) {
        Branch branch = findOrThrow(id);
        branch.setName(request.name());
        branch.setAddress(request.address());
        branch.setPhone(request.phone());
        branch.setRut(request.rut());
        return toDto(branchRepository.save(branch));
    }

    @Override
    @Transactional
    public void deactivate(UUID id) {
        Branch branch = findOrThrow(id);
        branch.setActive(false);
        branchRepository.save(branch);
    }

    private Branch findOrThrow(UUID id) {
        return branchRepository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Sucursal no encontrada: " + id));
    }

    private BranchDto toDto(Branch b) {
        return new BranchDto(b.getId(), b.getName(), b.getAddress(),
                             b.getPhone(), b.getRut(), b.isActive());
    }
}

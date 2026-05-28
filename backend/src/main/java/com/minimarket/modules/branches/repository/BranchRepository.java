package com.minimarket.modules.branches.repository;

import com.minimarket.modules.branches.domain.Branch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BranchRepository extends JpaRepository<Branch, UUID> {
    List<Branch> findByIsActiveTrue();
}

package com.minimarket.modules.periodclose.repository;

import com.minimarket.modules.periodclose.domain.PeriodClose;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PeriodCloseRepository extends JpaRepository<PeriodClose, UUID> {

    Optional<PeriodClose> findByPeriodYearAndPeriodMonthAndBranchId(int year, int month, UUID branchId);

    Page<PeriodClose> findAllByOrderByPeriodYearDescPeriodMonthDesc(Pageable pageable);

    List<PeriodClose> findByPeriodYearGreaterThanEqualOrderByPeriodYearAscPeriodMonthAsc(int year);
}

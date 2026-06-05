package com.minimarket.modules.periodclose.service;

import com.minimarket.modules.periodclose.dto.MonthlyComparisonDto;
import com.minimarket.modules.periodclose.dto.PeriodCloseRequest;
import com.minimarket.modules.periodclose.dto.PeriodCloseResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

public interface PeriodCloseService {

    PeriodCloseResponse preview(int year, int month, UUID branchId);

    PeriodCloseResponse closePeriod(PeriodCloseRequest req, String closedByEmail);

    Page<PeriodCloseResponse> findAll(Pageable pageable);

    PeriodCloseResponse findById(UUID id);

    List<MonthlyComparisonDto> getComparison(int lastNMonths, UUID branchId);

    byte[] exportExcel(UUID id);
}

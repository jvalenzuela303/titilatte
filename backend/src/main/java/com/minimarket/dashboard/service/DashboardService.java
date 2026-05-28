package com.minimarket.dashboard.service;

import com.minimarket.dashboard.dto.AdminDashboardResponse;
import com.minimarket.dashboard.dto.CashierDashboardResponse;
import com.minimarket.dashboard.dto.DailySalesDto;
import com.minimarket.dashboard.dto.SupervisorDashboardResponse;
import org.springframework.security.core.Authentication;

import java.util.List;
import java.util.UUID;

public interface DashboardService {

    AdminDashboardResponse getAdminDashboard();

    SupervisorDashboardResponse getSupervisorDashboard();

    CashierDashboardResponse getCashierDashboard(UUID userId);

    List<DailySalesDto> getLast7Days();

    List<DailySalesDto> getLast30Days();

    Object getDashboardForCurrentUser(Authentication auth);
}

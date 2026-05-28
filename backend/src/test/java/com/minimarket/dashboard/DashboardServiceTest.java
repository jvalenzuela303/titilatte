package com.minimarket.dashboard;

import com.minimarket.dashboard.dto.*;
import com.minimarket.dashboard.service.DashboardServiceImpl;
import com.minimarket.modules.cash.domain.CashMovementType;
import com.minimarket.modules.cash.domain.CashRegister;
import com.minimarket.modules.cash.domain.CashStatus;
import com.minimarket.modules.cash.repository.CashMovementRepository;
import com.minimarket.modules.cash.repository.CashRegisterRepository;
import com.minimarket.modules.users.domain.User;
import com.minimarket.modules.users.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("DashboardService - Unit Tests")
class DashboardServiceTest {

    @Mock
    private EntityManager em;

    @Mock
    private CashRegisterRepository cashRegisterRepository;

    @Mock
    private CashMovementRepository cashMovementRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private DashboardServiceImpl dashboardService;

    // ── Helpers ────────────────────────────────────────────────────────────────

    private Query mockNativeQuery(Object result) {
        Query q = mock(Query.class);
        when(q.setParameter(anyString(), any())).thenReturn(q);
        when(q.getSingleResult()).thenReturn(result);
        return q;
    }

    @SuppressWarnings("unchecked")
    private Query mockNativeQueryList(List<?> results) {
        Query q = mock(Query.class);
        when(q.setParameter(anyString(), any())).thenReturn(q);
        when(q.getResultList()).thenReturn(results);
        return q;
    }

    private Authentication buildAuth(String email, String role) {
        UserDetails ud = org.springframework.security.core.userdetails.User
                .withUsername(email)
                .password("x")
                .authorities(new SimpleGrantedAuthority(role))
                .build();
        return new UsernamePasswordAuthenticationToken(ud, null, ud.getAuthorities());
    }

    // ── getAdminDashboard() ────────────────────────────────────────────────────

    @Nested
    @DisplayName("getAdminDashboard()")
    class GetAdminDashboard {

        @Test
        @DisplayName("getAdminDashboard_ShouldReturnCorrectKpis()")
        void getAdminDashboard_ShouldReturnCorrectKpis() {
            // Arrange — sales totals: 10 sales, $5000 revenue, $4000 net
            Object[] salesTotals = new Object[]{10L, new BigDecimal("5000"), new BigDecimal("4000")};
            // cost totals: $3000
            BigDecimal costResult = new BigDecimal("3000");
            // low stock count
            Object lowStockResult = 5;
            // debtors
            Object[] debtorResult = new Object[]{3L, new BigDecimal("1500")};

            // 4 queries are executed: sales, cost, lowStock, debtors + 2 for history
            when(em.createNativeQuery(contains("COUNT(id), COALESCE(SUM(total_amount), 0), COALESCE(SUM(net_amount)")))
                    .thenReturn(mockNativeQuery(salesTotals));
            when(em.createNativeQuery(contains("SUM(sd.quantity * p.purchase_price)")))
                    .thenReturn(mockNativeQuery(costResult));
            when(em.createNativeQuery(contains("stock_current <= stock_minimum")))
                    .thenReturn(mockNativeQuery(lowStockResult));
            when(em.createNativeQuery(contains("SUM(credit_used)")))
                    .thenReturn(mockNativeQuery(debtorResult));
            // history queries (last7 and last30)
            when(em.createNativeQuery(contains("DATE(created_at)")))
                    .thenReturn(mockNativeQueryList(List.of()));

            // Act
            AdminDashboardResponse response = dashboardService.getAdminDashboard();

            // Assert
            assertThat(response.salesToday()).isEqualByComparingTo("5000");
            assertThat(response.saleCountToday()).isEqualTo(10L);
            assertThat(response.profitToday()).isEqualByComparingTo("2000"); // 5000 - 3000
            assertThat(response.profitMarginToday()).isEqualByComparingTo("40.0000"); // 2000/5000 * 100
            assertThat(response.lowStockCount()).isEqualTo(5);
            assertThat(response.debtorCount()).isEqualTo(3);
            assertThat(response.totalDebt()).isEqualByComparingTo("1500");
            assertThat(response.dashboardType()).isEqualTo("ADMIN");
        }

        @Test
        @DisplayName("getAdminDashboard_WhenRevenueIsZero_ShouldReturnZeroMargin()")
        void getAdminDashboard_WhenRevenueIsZero_ShouldReturnZeroMargin() {
            // Arrange — zero revenue (avoid ArithmeticException)
            Object[] salesTotals = new Object[]{0L, BigDecimal.ZERO, BigDecimal.ZERO};
            BigDecimal costResult = BigDecimal.ZERO;
            Object[] debtorResult = new Object[]{0L, BigDecimal.ZERO};

            when(em.createNativeQuery(contains("COUNT(id), COALESCE(SUM(total_amount), 0), COALESCE(SUM(net_amount)")))
                    .thenReturn(mockNativeQuery(salesTotals));
            when(em.createNativeQuery(contains("SUM(sd.quantity * p.purchase_price)")))
                    .thenReturn(mockNativeQuery(costResult));
            when(em.createNativeQuery(contains("stock_current <= stock_minimum")))
                    .thenReturn(mockNativeQuery(0));
            when(em.createNativeQuery(contains("SUM(credit_used)")))
                    .thenReturn(mockNativeQuery(debtorResult));
            when(em.createNativeQuery(contains("DATE(created_at)")))
                    .thenReturn(mockNativeQueryList(List.of()));

            // Act — must not throw ArithmeticException
            AdminDashboardResponse response = dashboardService.getAdminDashboard();

            // Assert — margin is exactly zero
            assertThat(response.profitMarginToday()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(response.salesToday()).isEqualByComparingTo(BigDecimal.ZERO);
        }
    }

    // ── getSupervisorDashboard() ───────────────────────────────────────────────

    @Nested
    @DisplayName("getSupervisorDashboard()")
    class GetSupervisorDashboard {

        @Test
        @DisplayName("getSupervisorDashboard_ShouldReturnOpenCashRegisters()")
        void getSupervisorDashboard_ShouldReturnOpenCashRegisters() {
            // Arrange
            UUID cashierId = UUID.randomUUID();
            CashRegister openRegister = CashRegister.builder()
                    .id(UUID.randomUUID())
                    .registerNumber(1L)
                    .cashierId(cashierId)
                    .openingAmount(new BigDecimal("500"))
                    .status(CashStatus.OPEN)
                    .openedAt(OffsetDateTime.now())
                    .build();

            when(cashRegisterRepository.findAllByStatus(CashStatus.OPEN))
                    .thenReturn(List.of(openRegister));
            when(cashMovementRepository.findAllByCashRegisterId(openRegister.getId()))
                    .thenReturn(List.of());
            when(userRepository.findById(cashierId))
                    .thenReturn(Optional.of(User.builder()
                            .firstName("Juan").lastName("Perez").build()));

            // seller stats
            when(em.createNativeQuery(contains("GROUP BY u.id, u.email")))
                    .thenReturn(mockNativeQueryList(List.of()));
            // low stock
            when(em.createNativeQuery(contains("stock_current <= stock_minimum")))
                    .thenReturn(mockNativeQuery(2));
            // today totals
            when(em.createNativeQuery(contains("COUNT(id), COALESCE(SUM(total_amount), 0)")))
                    .thenReturn(mockNativeQuery(new Object[]{5L, new BigDecimal("2500")}));

            // Act
            SupervisorDashboardResponse response = dashboardService.getSupervisorDashboard();

            // Assert
            assertThat(response.openCashRegisters()).hasSize(1);
            assertThat(response.openCashRegisters().get(0).cashierName()).isEqualTo("Juan Perez");
            assertThat(response.lowStockCount()).isEqualTo(2);
            assertThat(response.dashboardType()).isEqualTo("SUPERVISOR");
        }
    }

    // ── getCashierDashboard() ──────────────────────────────────────────────────

    @Nested
    @DisplayName("getCashierDashboard()")
    class GetCashierDashboard {

        @Test
        @DisplayName("getCashierDashboard_WhenNoCashOpen_ShouldReturnNullCurrentCash()")
        void getCashierDashboard_WhenNoCashOpen_ShouldReturnNullCurrentCash() {
            // Arrange — cashier has no open register
            UUID userId = UUID.randomUUID();
            when(cashRegisterRepository.findByCashierIdAndStatus(userId, CashStatus.OPEN))
                    .thenReturn(Optional.empty());

            Object[] saleTotals = new Object[]{0L, BigDecimal.ZERO};
            when(em.createNativeQuery(contains("seller_id = :userId")))
                    .thenReturn(mockNativeQuery(saleTotals));

            // Act
            CashierDashboardResponse response = dashboardService.getCashierDashboard(userId);

            // Assert
            assertThat(response.currentCash()).isNull();
            assertThat(response.myTotalSalesToday()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(response.mySaleCountToday()).isEqualTo(0L);
            assertThat(response.dashboardType()).isEqualTo("CASHIER");
        }

        @Test
        @DisplayName("getCashierDashboard_WhenCashIsOpen_ShouldReturnCashSummary()")
        void getCashierDashboard_WhenCashIsOpen_ShouldReturnCashSummary() {
            // Arrange
            UUID userId = UUID.randomUUID();
            CashRegister openRegister = CashRegister.builder()
                    .id(UUID.randomUUID())
                    .registerNumber(3L)
                    .cashierId(userId)
                    .openingAmount(new BigDecimal("300"))
                    .status(CashStatus.OPEN)
                    .openedAt(OffsetDateTime.now())
                    .build();

            when(cashRegisterRepository.findByCashierIdAndStatus(userId, CashStatus.OPEN))
                    .thenReturn(Optional.of(openRegister));
            when(cashMovementRepository.findAllByCashRegisterId(openRegister.getId()))
                    .thenReturn(List.of());
            when(userRepository.findById(userId))
                    .thenReturn(Optional.of(User.builder().firstName("Ana").lastName("Lopez").build()));

            Object[] saleTotals = new Object[]{3L, new BigDecimal("750")};
            when(em.createNativeQuery(contains("seller_id = :userId")))
                    .thenReturn(mockNativeQuery(saleTotals));

            // Act
            CashierDashboardResponse response = dashboardService.getCashierDashboard(userId);

            // Assert
            assertThat(response.currentCash()).isNotNull();
            assertThat(response.currentCash().registerNumber()).isEqualTo(3L);
            assertThat(response.myTotalSalesToday()).isEqualByComparingTo("750");
            assertThat(response.mySaleCountToday()).isEqualTo(3L);
        }
    }

    // ── getDashboardForCurrentUser() ───────────────────────────────────────────

    @Nested
    @DisplayName("getDashboardForCurrentUser()")
    class GetDashboardForCurrentUser {

        @Test
        @DisplayName("getDashboardForCurrentUser_WhenAdmin_ShouldCallAdminMethod()")
        void getDashboardForCurrentUser_WhenAdmin_ShouldCallAdminMethod() {
            // Arrange
            Authentication auth = buildAuth("admin@test.com", "ROLE_ADMIN");

            // Stub all queries required by getAdminDashboard
            Object[] salesTotals = new Object[]{0L, BigDecimal.ZERO, BigDecimal.ZERO};
            when(em.createNativeQuery(contains("COUNT(id), COALESCE(SUM(total_amount), 0), COALESCE(SUM(net_amount)")))
                    .thenReturn(mockNativeQuery(salesTotals));
            when(em.createNativeQuery(contains("SUM(sd.quantity * p.purchase_price)")))
                    .thenReturn(mockNativeQuery(BigDecimal.ZERO));
            when(em.createNativeQuery(contains("stock_current <= stock_minimum")))
                    .thenReturn(mockNativeQuery(0));
            when(em.createNativeQuery(contains("SUM(credit_used)")))
                    .thenReturn(mockNativeQuery(new Object[]{0L, BigDecimal.ZERO}));
            when(em.createNativeQuery(contains("DATE(created_at)")))
                    .thenReturn(mockNativeQueryList(List.of()));

            // Act
            Object result = dashboardService.getDashboardForCurrentUser(auth);

            // Assert — returns AdminDashboardResponse
            assertThat(result).isInstanceOf(AdminDashboardResponse.class);
            assertThat(((AdminDashboardResponse) result).dashboardType()).isEqualTo("ADMIN");
        }

        @Test
        @DisplayName("getDashboardForCurrentUser_WhenSupervisor_ShouldCallSupervisorMethod()")
        void getDashboardForCurrentUser_WhenSupervisor_ShouldCallSupervisorMethod() {
            // Arrange
            Authentication auth = buildAuth("supervisor@test.com", "ROLE_SUPERVISOR");

            when(cashRegisterRepository.findAllByStatus(CashStatus.OPEN)).thenReturn(List.of());
            when(em.createNativeQuery(contains("GROUP BY u.id, u.email")))
                    .thenReturn(mockNativeQueryList(List.of()));
            when(em.createNativeQuery(contains("stock_current <= stock_minimum")))
                    .thenReturn(mockNativeQuery(0));
            when(em.createNativeQuery(contains("COUNT(id), COALESCE(SUM(total_amount), 0)")))
                    .thenReturn(mockNativeQuery(new Object[]{0L, BigDecimal.ZERO}));

            // Act
            Object result = dashboardService.getDashboardForCurrentUser(auth);

            // Assert
            assertThat(result).isInstanceOf(SupervisorDashboardResponse.class);
            assertThat(((SupervisorDashboardResponse) result).dashboardType()).isEqualTo("SUPERVISOR");
        }

        @Test
        @DisplayName("getDashboardForCurrentUser_WhenCajero_ShouldCallCashierMethod()")
        void getDashboardForCurrentUser_WhenCajero_ShouldCallCashierMethod() {
            // Arrange
            String cajeroEmail = "cajero@test.com";
            UUID cajeroId = UUID.randomUUID();
            Authentication auth = buildAuth(cajeroEmail, "ROLE_CAJERO");

            User cajeroUser = User.builder().id(cajeroId).email(cajeroEmail).build();
            when(userRepository.findByEmailAndDeletedAtIsNull(cajeroEmail))
                    .thenReturn(Optional.of(cajeroUser));
            when(cashRegisterRepository.findByCashierIdAndStatus(cajeroId, CashStatus.OPEN))
                    .thenReturn(Optional.empty());

            Object[] saleTotals = new Object[]{0L, BigDecimal.ZERO};
            when(em.createNativeQuery(contains("seller_id = :userId")))
                    .thenReturn(mockNativeQuery(saleTotals));

            // Act
            Object result = dashboardService.getDashboardForCurrentUser(auth);

            // Assert
            assertThat(result).isInstanceOf(CashierDashboardResponse.class);
            assertThat(((CashierDashboardResponse) result).dashboardType()).isEqualTo("CASHIER");
        }

        @Test
        @DisplayName("getDashboardForCurrentUser_WhenCajeroNotFound_ShouldThrowIllegalStateException()")
        void getDashboardForCurrentUser_WhenCajeroNotFound_ShouldThrowIllegalStateException() {
            // Arrange
            String email = "ghost@test.com";
            Authentication auth = buildAuth(email, "ROLE_CAJERO");
            when(userRepository.findByEmailAndDeletedAtIsNull(email)).thenReturn(Optional.empty());

            // Act + Assert
            assertThatThrownBy(() -> dashboardService.getDashboardForCurrentUser(auth))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("User not found");
        }
    }
}

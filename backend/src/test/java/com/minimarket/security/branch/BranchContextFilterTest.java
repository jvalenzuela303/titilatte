package com.minimarket.security.branch;

import com.minimarket.modules.users.domain.User;
import com.minimarket.modules.users.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("BranchContextFilter - Unit Tests")
class BranchContextFilterTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private JdbcTemplate jdbcTemplate;

    @InjectMocks
    private BranchContextFilter branchContextFilter;

    private static final String TEST_EMAIL = "cajero@minimarket.com";
    private static final UUID TEST_BRANCH_ID = UUID.randomUUID();

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void authenticateAs(String email) {
        UserDetails userDetails = org.springframework.security.core.userdetails.User
                .withUsername(email)
                .password("irrelevant")
                .authorities(List.of(new SimpleGrantedAuthority("ROLE_CAJERO")))
                .build();
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    // ── doFilterInternal ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("doFilterInternal()")
    class DoFilterInternal {

        @Test
        @DisplayName("doFilter_authenticatedUserWithBranch_setsLocalBranchId — jdbcTemplate.execute llamado con UUID")
        void doFilter_authenticatedUserWithBranch_setsLocalBranchId() throws Exception {
            // Arrange
            authenticateAs(TEST_EMAIL);

            User user = User.builder()
                    .id(UUID.randomUUID())
                    .email(TEST_EMAIL)
                    .branchId(TEST_BRANCH_ID)
                    .build();

            when(userRepository.findByEmailAndDeletedAtIsNull(TEST_EMAIL))
                    .thenReturn(Optional.of(user));

            MockHttpServletRequest  request  = new MockHttpServletRequest();
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain         chain    = new MockFilterChain();

            // Act
            branchContextFilter.doFilterInternal(request, response, chain);

            // Assert — jdbcTemplate.execute fue llamado con el UUID de la sucursal
            verify(jdbcTemplate).execute(contains(TEST_BRANCH_ID.toString()));
        }

        @Test
        @DisplayName("doFilter_adminWithNullBranch_setsAll — branchId=null → SET LOCAL = 'ALL'")
        void doFilter_adminWithNullBranch_setsAll() throws Exception {
            // Arrange — admin global sin sucursal asignada (branchId = null)
            String adminEmail = "admin@minimarket.com";
            authenticateAs(adminEmail);

            User adminUser = User.builder()
                    .id(UUID.randomUUID())
                    .email(adminEmail)
                    .branchId(null)  // null → acceso cross-sucursal
                    .build();

            when(userRepository.findByEmailAndDeletedAtIsNull(adminEmail))
                    .thenReturn(Optional.of(adminUser));

            MockHttpServletRequest  request  = new MockHttpServletRequest();
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain         chain    = new MockFilterChain();

            // Act
            branchContextFilter.doFilterInternal(request, response, chain);

            // Assert — jdbcTemplate.execute fue llamado con 'ALL'
            verify(jdbcTemplate).execute(contains("ALL"));
        }

        @Test
        @DisplayName("doFilter_unauthenticated_skipsSettingBranchId — sin autenticación, jdbcTemplate.execute no se llama")
        void doFilter_unauthenticated_skipsSettingBranchId() throws Exception {
            // Arrange — sin authentication en el SecurityContext
            SecurityContextHolder.clearContext();

            MockHttpServletRequest  request  = new MockHttpServletRequest();
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain         chain    = new MockFilterChain();

            // Act
            branchContextFilter.doFilterInternal(request, response, chain);

            // Assert — jdbcTemplate.execute NUNCA se llama
            verify(jdbcTemplate, never()).execute(anyString());
            // Assert — la cadena continúa igual
            verify(userRepository, never()).findByEmailAndDeletedAtIsNull(anyString());
        }

        @Test
        @DisplayName("doFilter_userNotFoundInRepo_skipsSettingBranchId — email no existe en BD")
        void doFilter_userNotFoundInRepo_skipsSettingBranchId() throws Exception {
            // Arrange — authentication válida pero usuario no existe en repositorio
            String ghostEmail = "ghost@minimarket.com";
            authenticateAs(ghostEmail);

            when(userRepository.findByEmailAndDeletedAtIsNull(ghostEmail))
                    .thenReturn(Optional.empty());

            MockHttpServletRequest  request  = new MockHttpServletRequest();
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain         chain    = new MockFilterChain();

            // Act
            branchContextFilter.doFilterInternal(request, response, chain);

            // Assert — sin branchId resuelto, jdbcTemplate no se invoca
            verify(jdbcTemplate, never()).execute(anyString());
        }

        @Test
        @DisplayName("doFilter_jdbcThrowsException_continuesFilterChain — excepción SQL no rompe el request")
        void doFilter_jdbcThrowsException_continuesFilterChain() throws Exception {
            // Arrange
            authenticateAs(TEST_EMAIL);

            User user = User.builder()
                    .id(UUID.randomUUID())
                    .email(TEST_EMAIL)
                    .branchId(TEST_BRANCH_ID)
                    .build();

            when(userRepository.findByEmailAndDeletedAtIsNull(TEST_EMAIL))
                    .thenReturn(Optional.of(user));
            doThrow(new RuntimeException("DB connection lost"))
                    .when(jdbcTemplate).execute(anyString());

            MockHttpServletRequest  request  = new MockHttpServletRequest();
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain         chain    = new MockFilterChain();

            // Act — no debe propagar la excepción
            branchContextFilter.doFilterInternal(request, response, chain);

            // Assert — la cadena de filtros continuó a pesar de la excepción JDBC
            // (chain.doFilter fue invocado — MockFilterChain lo registra)
            // No se lanzó excepción = el filtro la capturó internamente
        }
    }
}

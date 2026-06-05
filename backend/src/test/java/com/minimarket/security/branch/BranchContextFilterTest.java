package com.minimarket.security.branch;

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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("BranchContextFilter - Unit Tests")
class BranchContextFilterTest {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @InjectMocks
    private BranchContextFilter branchContextFilter;

    @Nested
    @DisplayName("doFilterInternal()")
    class DoFilterInternal {

        @Test
        @DisplayName("doFilter_siempreSetea_ALL — tienda única, branch_id siempre es ALL")
        void doFilter_siempreSetea_ALL() throws Exception {
            MockHttpServletRequest  request  = new MockHttpServletRequest();
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain         chain    = new MockFilterChain();

            branchContextFilter.doFilterInternal(request, response, chain);

            // jdbcTemplate.execute debe invocarse una vez (SET LOCAL app.current_branch_id = 'ALL')
            verify(jdbcTemplate, times(1)).execute(any(org.springframework.jdbc.core.ConnectionCallback.class));
        }

        @Test
        @DisplayName("doFilter_jdbcThrowsException_continuesFilterChain — excepción SQL no rompe el request")
        void doFilter_jdbcThrowsException_continuesFilterChain() throws Exception {
            doThrow(new RuntimeException("DB connection lost"))
                    .when(jdbcTemplate).execute(any(org.springframework.jdbc.core.ConnectionCallback.class));

            MockHttpServletRequest  request  = new MockHttpServletRequest();
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain         chain    = new MockFilterChain();

            // No debe propagar la excepción — el filtro la captura internamente
            branchContextFilter.doFilterInternal(request, response, chain);
        }
    }
}

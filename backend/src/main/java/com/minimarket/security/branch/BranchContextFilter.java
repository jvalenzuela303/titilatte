package com.minimarket.security.branch;

import com.minimarket.modules.users.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.regex.Pattern;

@Component
@Order(-200)
@Slf4j
@RequiredArgsConstructor
public class BranchContextFilter extends OncePerRequestFilter {

    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;

    // Acepta exactamente un UUID canónico (32 hex + 4 guiones) o el literal "ALL".
    // Cualquier otro valor se rechaza antes de llegar a la base de datos.
    private static final Pattern SAFE_BRANCH_ID =
        Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$|^ALL$");

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String branchId = resolveBranchId();
        if (branchId != null) {
            if (!SAFE_BRANCH_ID.matcher(branchId).matches()) {
                log.warn("BranchContextFilter: valor de branch_id rechazado por no ser UUID ni ALL: [{}]", branchId);
                filterChain.doFilter(request, response);
                return;
            }
            try {
                // SET LOCAL aplica solo a la transacción actual — el pool de conexiones
                // no retiene el valor entre requests.
                // Se usa PreparedStatement para evitar inyección SQL; el parámetro
                // ya fue validado como UUID o "ALL" por SAFE_BRANCH_ID.
                jdbcTemplate.execute(
                    (java.sql.Connection con) -> {
                        try (java.sql.PreparedStatement ps =
                                con.prepareStatement("SET LOCAL app.current_branch_id = ?")) {
                            ps.setString(1, branchId);
                            ps.execute();
                        }
                        return null;
                    });
            } catch (Exception e) {
                log.debug("No se pudo configurar branch context: {}", e.getMessage());
            }
        }
        filterChain.doFilter(request, response);
    }

    private String resolveBranchId() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || !auth.isAuthenticated()) return null;

            String email = ((UserDetails) auth.getPrincipal()).getUsername();
            return userRepository.findByEmailAndDeletedAtIsNull(email)
                .map(user -> user.getBranchId() != null
                    ? user.getBranchId().toString()
                    : "ALL")              // ADMIN global → acceso cross-sucursal
                .orElse(null);
        } catch (Exception e) {
            log.debug("No se pudo resolver branch_id del usuario: {}", e.getMessage());
            return null;
        }
    }
}

package com.minimarket.security.branch;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Establece el contexto de sucursal para las políticas RLS de PostgreSQL.
 * Al operar con una única tienda física se configura siempre como "ALL"
 * de modo que todas las filas sean visibles sin filtrado por sucursal.
 */
@Component
@Order(-200)
@Slf4j
@RequiredArgsConstructor
public class BranchContextFilter extends OncePerRequestFilter {

    private final JdbcTemplate jdbcTemplate;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            jdbcTemplate.execute(
                (java.sql.Connection con) -> {
                    try (java.sql.PreparedStatement ps =
                            con.prepareStatement("SET LOCAL app.current_branch_id = ?")) {
                        ps.setString(1, "ALL");
                        ps.execute();
                    }
                    return null;
                });
        } catch (Exception e) {
            log.debug("No se pudo configurar branch context: {}", e.getMessage());
        }
        filterChain.doFilter(request, response);
    }
}

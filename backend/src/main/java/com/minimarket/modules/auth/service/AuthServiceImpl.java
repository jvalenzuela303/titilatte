package com.minimarket.modules.auth.service;

import com.minimarket.audit.service.AuditService;
import com.minimarket.config.JwtConfig;
import com.minimarket.exception.BusinessException;
import com.minimarket.exception.EntityNotFoundException;
import com.minimarket.modules.auth.domain.RefreshToken;
import com.minimarket.modules.auth.dto.LoginRequest;
import com.minimarket.modules.auth.dto.LoginResponse;
import com.minimarket.modules.auth.dto.RefreshTokenRequest;
import com.minimarket.modules.users.domain.Role;
import com.minimarket.modules.users.domain.User;
import com.minimarket.modules.users.repository.UserRepository;
import com.minimarket.security.JwtService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final JwtConfig jwtConfig;
    private final UserDetailsService userDetailsService;
    private final AuditService auditService;

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    @Transactional
    public LoginResponse login(LoginRequest request) {
        String ip = resolveClientIp();
        String userAgent = resolveUserAgent();

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.email(), request.password())
            );
        } catch (AuthenticationException ex) {
            auditService.log("AUTH", null, "LOGIN_FAILED", null,
                    Map.of("email", request.email()), null, null, ip, userAgent);
            throw ex;
        }

        User user = userRepository.findByEmailAndDeletedAtIsNull(request.email())
                .orElseThrow(() -> new EntityNotFoundException("User not found with email: " + request.email()));

        UserDetails userDetails = userDetailsService.loadUserByUsername(request.email());
        Map<String, Object> claims = buildClaims(user);
        String accessToken = jwtService.generateAccessToken(claims, userDetails);
        String rawRefreshToken = jwtService.generateRefreshToken();
        String tokenHash = hashToken(rawRefreshToken);

        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .tokenHash(tokenHash)
                .expiresAt(OffsetDateTime.now().plusSeconds(jwtConfig.getRefreshExpiration() / 1000))
                .build();

        entityManager.persist(refreshToken);

        Set<Role.RoleName> roles = user.getRoles().stream()
                .map(Role::getName)
                .collect(Collectors.toSet());

        log.info("User logged in: {}", user.getEmail());
        return new LoginResponse(
                accessToken,
                rawRefreshToken,
                jwtConfig.getExpiration(),
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                roles,
                user.getBranchId()
        );
    }

    @Override
    @Transactional
    public LoginResponse refresh(RefreshTokenRequest request) {
        String tokenHash = hashToken(request.refreshToken());

        RefreshToken refreshToken = findActiveRefreshToken(tokenHash);

        if (!refreshToken.isValid()) {
            throw new BusinessException("Refresh token is expired or revoked.");
        }

        User user = refreshToken.getUser();
        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getEmail());
        Map<String, Object> claims = buildClaims(user);
        String newAccessToken = jwtService.generateAccessToken(claims, userDetails);

        Set<Role.RoleName> roles = user.getRoles().stream()
                .map(Role::getName)
                .collect(Collectors.toSet());

        log.info("Access token refreshed for user: {}", user.getEmail());
        return new LoginResponse(
                newAccessToken,
                request.refreshToken(),
                jwtConfig.getExpiration(),
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                roles,
                user.getBranchId()
        );
    }

    @Override
    @Transactional
    public void logout(RefreshTokenRequest request) {
        String tokenHash = hashToken(request.refreshToken());
        RefreshToken refreshToken = findActiveRefreshToken(tokenHash);
        refreshToken.setRevokedAt(OffsetDateTime.now());
        log.info("User logged out, refresh token revoked for user id: {}", refreshToken.getUser().getId());
    }

    private RefreshToken findActiveRefreshToken(String tokenHash) {
        return entityManager.createQuery(
                        "SELECT rt FROM RefreshToken rt " +
                        "JOIN FETCH rt.user u " +
                        "JOIN FETCH u.roles " +
                        "WHERE rt.tokenHash = :hash AND rt.revokedAt IS NULL",
                        RefreshToken.class)
                .setParameter("hash", tokenHash)
                .getResultStream()
                .findFirst()
                .orElseThrow(() -> new BusinessException("Invalid or revoked refresh token."));
    }

    private String resolveClientIp() {
        try {
            ServletRequestAttributes attrs =
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs == null) return null;
            HttpServletRequest req = attrs.getRequest();
            String xff = req.getHeader("X-Forwarded-For");
            if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
            String realIp = req.getHeader("X-Real-IP");
            if (realIp != null && !realIp.isBlank()) return realIp.trim();
            return req.getRemoteAddr();
        } catch (Exception e) {
            return null;
        }
    }

    private String resolveUserAgent() {
        try {
            ServletRequestAttributes attrs =
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs == null) return null;
            return attrs.getRequest().getHeader("User-Agent");
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Construye los claims adicionales del JWT. El claim "branch_id" se omite
     * cuando el usuario no tiene sucursal asignada (administradores globales).
     */
    private Map<String, Object> buildClaims(User user) {
        Map<String, Object> claims = new java.util.HashMap<>();
        if (user.getBranchId() != null) {
            claims.put("branch_id", user.getBranchId().toString());
        }
        return claims;
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }
}

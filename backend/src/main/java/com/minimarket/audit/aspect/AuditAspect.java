package com.minimarket.audit.aspect;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.minimarket.audit.annotation.Auditable;
import com.minimarket.audit.service.AuditService;
import com.minimarket.modules.users.domain.User;
import com.minimarket.modules.users.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.UUID;

@Aspect
@Component
@Slf4j
@RequiredArgsConstructor
public class AuditAspect {

    private final AuditService auditService;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Around("@annotation(auditable)")
    public Object audit(ProceedingJoinPoint joinPoint, Auditable auditable) throws Throwable {
        // 1. Extract userId from SecurityContextHolder
        UUID userId = resolveCurrentUserId();

        // 2. Extract IP and User-Agent from request
        String ipAddress = null;
        String userAgent = null;
        try {
            ServletRequestAttributes attrs =
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                HttpServletRequest request = attrs.getRequest();
                ipAddress = resolveClientIp(request);
                userAgent = request.getHeader("User-Agent");
            }
        } catch (Exception e) {
            log.debug("Could not extract request context for audit: {}", e.getMessage());
        }

        // 3. Capture old value if requested (first UUID arg is assumed to be entity id)
        Object oldValue = null;
        UUID entityId = resolveEntityId(joinPoint.getArgs());
        if (auditable.captureOldValue() && entityId != null) {
            oldValue = captureOldValue(joinPoint, entityId, auditable.entityType());
        }

        // 4. Execute the real method
        Object result = joinPoint.proceed();

        // 5. Serialize result as newValue and log.
        // DESIGN NOTE (ADR-007): audit logging is intentionally fail-safe.
        // AuditService.log() runs in its own transaction (Propagation.REQUIRES_NEW),
        // so a failure here does NOT roll back the business transaction — the business
        // operation has already committed at this point (joinPoint.proceed() completed).
        // The catch block ensures that an audit failure is never visible to the caller.
        // Trade-off: it is possible for a business action to succeed without an audit
        // record. This is an explicit decision: availability of the core operation takes
        // precedence over audit completeness.
        try {
            auditService.log(
                    auditable.entityType(),
                    entityId,
                    auditable.action(),
                    oldValue,
                    result,
                    null,  // reason extracted separately if requireReason — see note below
                    userId,
                    ipAddress,
                    userAgent
            );
        } catch (Exception e) {
            log.error("Audit logging failed for {}.{}: {}",
                    auditable.entityType(), auditable.action(), e.getMessage());
        }

        return result;
    }

    // ---- private helpers ----

    private UUID resolveCurrentUserId() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || !auth.isAuthenticated()) return null;
            String email = ((UserDetails) auth.getPrincipal()).getUsername();
            return userRepository.findByEmailAndDeletedAtIsNull(email)
                    .map(User::getId)
                    .orElse(null);
        } catch (Exception e) {
            log.debug("Could not resolve current user for audit: {}", e.getMessage());
            return null;
        }
    }

    private UUID resolveEntityId(Object[] args) {
        if (args == null) return null;
        for (Object arg : args) {
            if (arg instanceof UUID uuid) {
                return uuid;
            }
        }
        return null;
    }

    /**
     * Attempts to invoke a findById-style method on the target service to snapshot the current state.
     * Falls back gracefully if the method doesn't exist or fails.
     */
    private Object captureOldValue(ProceedingJoinPoint joinPoint, UUID entityId, String entityType) {
        try {
            Object target = joinPoint.getTarget();
            java.lang.reflect.Method findById = target.getClass().getMethod("findById", UUID.class);
            return findById.invoke(target, entityId);
        } catch (NoSuchMethodException e) {
            log.debug("No findById method found on target for entity type {}; skipping old value capture", entityType);
            return null;
        } catch (Exception e) {
            log.warn("Failed to capture old value for entity {} id={}: {}", entityType, entityId, e.getMessage());
            return null;
        }
    }

    /**
     * Resolves the real client IP from the request.
     *
     * Security note: X-Forwarded-For and X-Real-IP are HTTP headers that any client can spoof.
     * These headers must only be trusted when the immediate peer (getRemoteAddr()) is a known
     * internal proxy/load-balancer. In this deployment the only trusted upstream is the Nginx
     * reverse-proxy whose container sits on the internal Docker network (172.16.0.0/12 or
     * 192.168.0.0/16). All other remotes are treated as untrusted and their forwarded-for
     * values are ignored to prevent audit log IP spoofing.
     */
    private String resolveClientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();

        // Only trust forwarded-for headers when the direct peer is an internal (trusted) proxy.
        if (isTrustedProxy(remoteAddr)) {
            String xff = request.getHeader("X-Forwarded-For");
            if (xff != null && !xff.isBlank()) {
                // Take the LAST entry appended by our own proxy, not the first (client-controlled)
                // entry. When Nginx appends the real client IP via proxy_add_x_forwarded_for the
                // rightmost value is the one Nginx itself observed — not one the client supplied.
                String[] parts = xff.split(",");
                return parts[parts.length - 1].trim();
            }
            String realIp = request.getHeader("X-Real-IP");
            if (realIp != null && !realIp.isBlank()) {
                return realIp.trim();
            }
        }

        return remoteAddr;
    }

    /** Returns true when the remoteAddr belongs to a private/loopback range used by Docker. */
    private boolean isTrustedProxy(String remoteAddr) {
        if (remoteAddr == null) return false;
        return remoteAddr.startsWith("10.")
                || remoteAddr.startsWith("172.")
                || remoteAddr.startsWith("192.168.")
                || remoteAddr.equals("127.0.0.1")
                || remoteAddr.equals("0:0:0:0:0:0:0:1"); // IPv6 loopback
    }
}

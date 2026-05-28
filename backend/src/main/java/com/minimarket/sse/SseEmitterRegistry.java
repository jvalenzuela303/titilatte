package com.minimarket.sse;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.minimarket.modules.users.domain.Role;
import com.minimarket.modules.users.repository.UserRepository;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Component
@Slf4j
@RequiredArgsConstructor
public class SseEmitterRegistry {

    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final MeterRegistry meterRegistry;

    /**
     * Maximum number of concurrent SSE connections across all users.
     * Prevents memory exhaustion under load or after a token-stuffing attack.
     * At ~10 KB per idle emitter the default of 500 caps heap consumption at ~5 MB.
     */
    private static final int MAX_GLOBAL_CONNECTIONS = 500;

    private final ConcurrentHashMap<UUID, SseEmitter> emitters = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<UUID, Set<String>> userRoleCache = new ConcurrentHashMap<>();

    // Gauge registered at construction time via @PostConstruct equivalent — lazy registration on first use
    private volatile boolean gaugeRegistered = false;

    public void register(UUID userId, SseEmitter emitter) {
        // Enforce global connection cap before accepting new emitters.
        if (emitters.size() >= MAX_GLOBAL_CONNECTIONS) {
            log.warn("SSE connection limit reached ({}/{}). Rejecting new emitter for userId={}",
                    emitters.size(), MAX_GLOBAL_CONNECTIONS, userId);
            emitter.complete();
            return;
        }

        // If a previous emitter exists for this user (e.g. duplicate tab), complete it cleanly
        // before replacing so the old connection is not leaked.
        SseEmitter previous = emitters.get(userId);
        if (previous != null) {
            log.debug("Replacing existing SSE emitter for userId={}", userId);
            try { previous.complete(); } catch (Exception ignored) {}
        }

        emitters.put(userId, emitter);
        cacheUserRoles(userId);

        emitter.onCompletion(() -> remove(userId));
        emitter.onTimeout(() -> remove(userId));
        emitter.onError(ex -> remove(userId));

        if (!gaugeRegistered) {
            meterRegistry.gauge("sse_active_connections", this, SseEmitterRegistry::getActiveCount);
            gaugeRegistered = true;
        }

        log.debug("SSE emitter registered for userId={}", userId);
    }

    public void remove(UUID userId) {
        emitters.remove(userId);
        userRoleCache.remove(userId);
        log.debug("SSE emitter removed for userId={}", userId);
    }

    public void emit(UUID userId, SseEvent event) {
        SseEmitter emitter = emitters.get(userId);
        if (emitter == null) {
            return;
        }
        try {
            String json = objectMapper.writeValueAsString(event.data());
            emitter.send(SseEmitter.event()
                    .name(event.eventType().name())
                    .data(json));
        } catch (IOException e) {
            log.warn("Failed to emit SSE to userId={}, removing emitter. Cause: {}", userId, e.getMessage());
            remove(userId);
        }
    }

    public void broadcastToRoles(Set<String> roles, SseEvent event) {
        emitters.keySet().forEach(userId -> {
            Set<String> userRoles = userRoleCache.computeIfAbsent(userId, this::loadUserRoles);
            boolean hasRole = userRoles.stream().anyMatch(roles::contains);
            if (hasRole) {
                emit(userId, event);
            }
        });
    }

    public int getActiveCount() {
        return emitters.size();
    }

    private void cacheUserRoles(UUID userId) {
        userRoleCache.put(userId, loadUserRoles(userId));
    }

    private Set<String> loadUserRoles(UUID userId) {
        return userRepository.findByIdAndDeletedAtIsNull(userId)
                .map(user -> user.getRoles().stream()
                        .map(role -> role.getName().name())
                        .collect(Collectors.toSet()))
                .orElse(Set.of());
    }
}

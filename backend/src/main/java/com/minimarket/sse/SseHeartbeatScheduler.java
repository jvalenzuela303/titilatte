package com.minimarket.sse;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Set;

@Component
@Slf4j
@RequiredArgsConstructor
public class SseHeartbeatScheduler {

    private final SseEmitterRegistry registry;

    // All role names in the platform
    private static final Set<String> ALL_ROLES = Set.of("ADMIN", "SUPERVISOR", "CAJERO", "BODEGA");

    @Scheduled(fixedDelay = 30_000)
    public void sendHeartbeat() {
        int activeConnections = registry.getActiveCount();
        if (activeConnections == 0) {
            return;
        }

        SseEvent heartbeat = new SseEvent(
                SseEventType.HEARTBEAT,
                Map.of("time", LocalDateTime.now().toString()),
                LocalDateTime.now()
        );

        registry.broadcastToRoles(ALL_ROLES, heartbeat);

        log.debug("Heartbeat sent to {} SSE connections", activeConnections);
    }
}

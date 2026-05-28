package com.minimarket.sse;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.minimarket.modules.users.domain.Role;
import com.minimarket.modules.users.domain.User;
import com.minimarket.modules.users.repository.UserRepository;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("SseEmitterRegistry - Unit Tests")
class SseEmitterRegistryTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private ObjectMapper objectMapper;

    private MeterRegistry meterRegistry;
    private SseEmitterRegistry registry;

    @BeforeEach
    void setUp() {
        meterRegistry = new SimpleMeterRegistry();
        registry = new SseEmitterRegistry(userRepository, objectMapper, meterRegistry);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private User buildUserWithRole(UUID userId, Role.RoleName roleName) {
        Role role = Role.builder().name(roleName).build();
        return User.builder()
                .id(userId)
                .email("user@test.com")
                .roles(Set.of(role))
                .build();
    }

    // ── register ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("register()")
    class Register {

        @Test
        @DisplayName("register_ShouldAddEmitterToMap()")
        void register_ShouldAddEmitterToMap() {
            // Arrange
            UUID userId = UUID.randomUUID();
            SseEmitter emitter = new SseEmitter();
            when(userRepository.findByIdAndDeletedAtIsNull(userId))
                    .thenReturn(Optional.of(buildUserWithRole(userId, Role.RoleName.CAJERO)));

            // Act
            registry.register(userId, emitter);

            // Assert
            assertThat(registry.getActiveCount()).isEqualTo(1);
        }

        @Test
        @DisplayName("register_ShouldCacheUserRolesOnRegistration()")
        void register_ShouldCacheUserRolesOnRegistration() {
            // Arrange
            UUID userId = UUID.randomUUID();
            SseEmitter emitter = new SseEmitter();
            User user = buildUserWithRole(userId, Role.RoleName.ADMIN);
            when(userRepository.findByIdAndDeletedAtIsNull(userId)).thenReturn(Optional.of(user));

            // Act
            registry.register(userId, emitter);

            // Assert — repository called exactly once during registration
            verify(userRepository, times(1)).findByIdAndDeletedAtIsNull(userId);
        }

        @Test
        @DisplayName("register_ShouldRegisterGaugeOnFirstRegistration()")
        void register_ShouldRegisterGaugeOnFirstRegistration() {
            // Arrange
            UUID userId = UUID.randomUUID();
            SseEmitter emitter = new SseEmitter();
            when(userRepository.findByIdAndDeletedAtIsNull(userId))
                    .thenReturn(Optional.of(buildUserWithRole(userId, Role.RoleName.CAJERO)));

            // Act
            registry.register(userId, emitter);

            // Assert — gauge is tracked in the meter registry
            assertThat(meterRegistry.find("sse_active_connections").gauge()).isNotNull();
        }
    }

    // ── remove ─────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("remove()")
    class Remove {

        @Test
        @DisplayName("remove_ShouldDeleteEmitterFromMap()")
        void remove_ShouldDeleteEmitterFromMap() {
            // Arrange
            UUID userId = UUID.randomUUID();
            SseEmitter emitter = new SseEmitter();
            when(userRepository.findByIdAndDeletedAtIsNull(userId))
                    .thenReturn(Optional.of(buildUserWithRole(userId, Role.RoleName.CAJERO)));
            registry.register(userId, emitter);
            assertThat(registry.getActiveCount()).isEqualTo(1);

            // Act
            registry.remove(userId);

            // Assert
            assertThat(registry.getActiveCount()).isEqualTo(0);
        }

        @Test
        @DisplayName("remove_NonExistentUser_ShouldBeNoOp()")
        void remove_NonExistentUser_ShouldBeNoOp() {
            // Arrange
            UUID unknownId = UUID.randomUUID();

            // Act + Assert — must not throw
            registry.remove(unknownId);
            assertThat(registry.getActiveCount()).isEqualTo(0);
        }
    }

    // ── getActiveCount ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getActiveCount()")
    class GetActiveCount {

        @Test
        @DisplayName("getActiveCount_ShouldReflectCurrentConnections()")
        void getActiveCount_ShouldReflectCurrentConnections() {
            // Arrange
            UUID user1 = UUID.randomUUID();
            UUID user2 = UUID.randomUUID();
            UUID user3 = UUID.randomUUID();

            when(userRepository.findByIdAndDeletedAtIsNull(user1))
                    .thenReturn(Optional.of(buildUserWithRole(user1, Role.RoleName.CAJERO)));
            when(userRepository.findByIdAndDeletedAtIsNull(user2))
                    .thenReturn(Optional.of(buildUserWithRole(user2, Role.RoleName.CAJERO)));
            when(userRepository.findByIdAndDeletedAtIsNull(user3))
                    .thenReturn(Optional.of(buildUserWithRole(user3, Role.RoleName.ADMIN)));

            // Act
            registry.register(user1, new SseEmitter());
            registry.register(user2, new SseEmitter());
            registry.register(user3, new SseEmitter());
            assertThat(registry.getActiveCount()).isEqualTo(3);

            registry.remove(user2);

            // Assert
            assertThat(registry.getActiveCount()).isEqualTo(2);
        }
    }

    // ── emit ───────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("emit()")
    class Emit {

        @Test
        @DisplayName("emit_WhenEmitterTimedOut_ShouldRemoveFromMap()")
        void emit_WhenEmitterTimedOut_ShouldRemoveFromMap() throws Exception {
            // Arrange
            UUID userId = UUID.randomUUID();
            SseEmitter faultyEmitter = mock(SseEmitter.class);
            when(userRepository.findByIdAndDeletedAtIsNull(userId))
                    .thenReturn(Optional.of(buildUserWithRole(userId, Role.RoleName.CAJERO)));

            // Make the emitter throw IOException to simulate a timed-out / disconnected client
            doThrow(new IOException("Connection reset")).when(faultyEmitter)
                    .send(any(SseEmitter.SseEventBuilder.class));
            when(objectMapper.writeValueAsString(any())).thenReturn("{\"test\":true}");

            registry.register(userId, faultyEmitter);
            assertThat(registry.getActiveCount()).isEqualTo(1);

            SseEvent event = new SseEvent(SseEventType.HEARTBEAT, "ping", LocalDateTime.now());

            // Act — send will fail, registry must auto-remove
            registry.emit(userId, event);

            // Assert
            assertThat(registry.getActiveCount()).isEqualTo(0);
        }

        @Test
        @DisplayName("emit_WhenUserNotRegistered_ShouldBeNoOp()")
        void emit_WhenUserNotRegistered_ShouldBeNoOp() throws Exception {
            // Arrange
            UUID ghostId = UUID.randomUUID();
            SseEvent event = new SseEvent(SseEventType.HEARTBEAT, "ping", LocalDateTime.now());

            // Act + Assert — must not throw, objectMapper must NOT be called
            registry.emit(ghostId, event);
            verify(objectMapper, never()).writeValueAsString(any());
        }
    }

    // ── broadcastToRoles ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("broadcastToRoles()")
    class BroadcastToRoles {

        @Test
        @DisplayName("broadcastToRoles_ShouldOnlySendToMatchingRole()")
        void broadcastToRoles_ShouldOnlySendToMatchingRole() throws Exception {
            // Arrange
            UUID adminId = UUID.randomUUID();
            UUID cajeroId = UUID.randomUUID();

            SseEmitter adminEmitter = mock(SseEmitter.class);
            SseEmitter cajeroEmitter = mock(SseEmitter.class);

            when(userRepository.findByIdAndDeletedAtIsNull(adminId))
                    .thenReturn(Optional.of(buildUserWithRole(adminId, Role.RoleName.ADMIN)));
            when(userRepository.findByIdAndDeletedAtIsNull(cajeroId))
                    .thenReturn(Optional.of(buildUserWithRole(cajeroId, Role.RoleName.CAJERO)));
            when(objectMapper.writeValueAsString(any())).thenReturn("{\"stock\":5}");

            registry.register(adminId, adminEmitter);
            registry.register(cajeroId, cajeroEmitter);

            SseEvent event = new SseEvent(SseEventType.STOCK_CRITICO, "low", LocalDateTime.now());

            // Act — broadcast only to ADMIN role
            registry.broadcastToRoles(Set.of("ADMIN"), event);

            // Assert
            verify(adminEmitter, times(1)).send(any(SseEmitter.SseEventBuilder.class));
            verify(cajeroEmitter, never()).send(any(SseEmitter.SseEventBuilder.class));
        }

        @Test
        @DisplayName("broadcastToRoles_WhenNoMatchingRole_ShouldNotSendToAnyone()")
        void broadcastToRoles_WhenNoMatchingRole_ShouldNotSendToAnyone() throws Exception {
            // Arrange
            UUID cajeroId = UUID.randomUUID();
            SseEmitter cajeroEmitter = mock(SseEmitter.class);

            when(userRepository.findByIdAndDeletedAtIsNull(cajeroId))
                    .thenReturn(Optional.of(buildUserWithRole(cajeroId, Role.RoleName.CAJERO)));

            registry.register(cajeroId, cajeroEmitter);

            SseEvent event = new SseEvent(SseEventType.STOCK_CRITICO, "low", LocalDateTime.now());

            // Act — broadcast only to SUPERVISOR (no supervisors connected)
            registry.broadcastToRoles(Set.of("SUPERVISOR"), event);

            // Assert
            verify(cajeroEmitter, never()).send(any(SseEmitter.SseEventBuilder.class));
        }

        @Test
        @DisplayName("broadcastToRoles_WhenEmitterFails_ShouldRemoveAndContinue()")
        void broadcastToRoles_WhenEmitterFails_ShouldRemoveAndContinue() throws Exception {
            // Arrange
            UUID user1 = UUID.randomUUID();
            UUID user2 = UUID.randomUUID();

            SseEmitter faultyEmitter = mock(SseEmitter.class);
            SseEmitter healthyEmitter = mock(SseEmitter.class);

            when(userRepository.findByIdAndDeletedAtIsNull(user1))
                    .thenReturn(Optional.of(buildUserWithRole(user1, Role.RoleName.CAJERO)));
            when(userRepository.findByIdAndDeletedAtIsNull(user2))
                    .thenReturn(Optional.of(buildUserWithRole(user2, Role.RoleName.CAJERO)));
            when(objectMapper.writeValueAsString(any())).thenReturn("{\"ok\":true}");

            doThrow(new IOException("broken")).when(faultyEmitter)
                    .send(any(SseEmitter.SseEventBuilder.class));

            registry.register(user1, faultyEmitter);
            registry.register(user2, healthyEmitter);

            SseEvent event = new SseEvent(SseEventType.VENTA_CONFIRMADA, "v1", LocalDateTime.now());

            // Act
            registry.broadcastToRoles(Set.of("CAJERO"), event);

            // Assert — faulty emitter removed, healthy emitter still received the event
            assertThat(registry.getActiveCount()).isEqualTo(1);
            verify(healthyEmitter, times(1)).send(any(SseEmitter.SseEventBuilder.class));
        }
    }
}

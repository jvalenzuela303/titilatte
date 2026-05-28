package com.minimarket.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.minimarket.audit.annotation.Auditable;
import com.minimarket.audit.aspect.AuditAspect;
import com.minimarket.audit.service.AuditService;
import com.minimarket.modules.users.domain.User;
import com.minimarket.modules.users.repository.UserRepository;
import org.aspectj.lang.ProceedingJoinPoint;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuditAspect - Unit Tests")
class AuditAspectTest {

    @Mock
    private AuditService auditService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private ProceedingJoinPoint joinPoint;

    @Mock
    private Auditable auditable;

    @InjectMocks
    private AuditAspect auditAspect;

    private static final String TEST_EMAIL = "admin@minimarket.com";
    private static final UUID TEST_USER_ID = UUID.randomUUID();
    private static final UUID TEST_ENTITY_ID = UUID.randomUUID();

    @BeforeEach
    void setUpSecurityContext() {
        UserDetails userDetails = org.springframework.security.core.userdetails.User
                .withUsername(TEST_EMAIL)
                .password("irrelevant")
                .authorities(List.of(new SimpleGrantedAuthority("ROLE_ADMIN")))
                .build();
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @BeforeEach
    void setUpAuditableDefaults() {
        when(auditable.entityType()).thenReturn("SALE");
        when(auditable.action()).thenReturn("CANCEL");
        when(auditable.captureOldValue()).thenReturn(false);
        when(auditable.requireReason()).thenReturn(false);
    }

    // ── auditableMethod_ShouldCreateAuditLogEntry ──────────────────────────────

    @Nested
    @DisplayName("Happy path — audit log is created")
    class HappyPath {

        @Test
        @DisplayName("auditableMethod_ShouldCreateAuditLogEntry()")
        void auditableMethod_ShouldCreateAuditLogEntry() throws Throwable {
            // Arrange
            Object methodResult = new Object();
            when(joinPoint.getArgs()).thenReturn(new Object[]{TEST_ENTITY_ID});
            when(joinPoint.proceed()).thenReturn(methodResult);

            User user = User.builder().id(TEST_USER_ID).email(TEST_EMAIL).build();
            when(userRepository.findByEmailAndDeletedAtIsNull(TEST_EMAIL)).thenReturn(Optional.of(user));

            // Act
            Object result = auditAspect.audit(joinPoint, auditable);

            // Assert — the method result is passed through
            assertThat(result).isSameAs(methodResult);

            // Assert — AuditService.log() was called with correct entityType and action
            verify(auditService, times(1)).log(
                    eq("SALE"),
                    eq(TEST_ENTITY_ID),
                    eq("CANCEL"),
                    isNull(),            // oldValue not captured (captureOldValue=false)
                    eq(methodResult),    // newValue = result
                    isNull(),            // reason
                    eq(TEST_USER_ID),
                    any(),
                    any()
            );
        }

        @Test
        @DisplayName("auditableWithReason_WhenNoReasonProvided_ShouldStillAudit()")
        void auditableWithReason_WhenNoReasonProvided_ShouldStillAudit() throws Throwable {
            // Arrange — method args contain no reason string, only the entity UUID
            when(joinPoint.getArgs()).thenReturn(new Object[]{TEST_ENTITY_ID});
            when(joinPoint.proceed()).thenReturn("cancelled");

            User user = User.builder().id(TEST_USER_ID).email(TEST_EMAIL).build();
            when(userRepository.findByEmailAndDeletedAtIsNull(TEST_EMAIL)).thenReturn(Optional.of(user));

            // Act — must NOT throw even with null reason
            Object result = auditAspect.audit(joinPoint, auditable);

            // Assert — audit is still written
            assertThat(result).isEqualTo("cancelled");
            verify(auditService, times(1)).log(
                    anyString(), any(), anyString(),
                    any(), any(), isNull(), any(), any(), any()
            );
        }

        @Test
        @DisplayName("auditableMethod_WhenArgsHaveNoUUID_ShouldAuditWithNullEntityId()")
        void auditableMethod_WhenArgsHaveNoUUID_ShouldAuditWithNullEntityId() throws Throwable {
            // Arrange — no UUID in args (e.g. create operation)
            when(joinPoint.getArgs()).thenReturn(new Object[]{"someString", 42});
            when(joinPoint.proceed()).thenReturn("created");

            User user = User.builder().id(TEST_USER_ID).email(TEST_EMAIL).build();
            when(userRepository.findByEmailAndDeletedAtIsNull(TEST_EMAIL)).thenReturn(Optional.of(user));

            // Act
            auditAspect.audit(joinPoint, auditable);

            // Assert — entityId is null
            verify(auditService, times(1)).log(
                    anyString(), isNull(), anyString(),
                    any(), any(), any(), any(), any(), any()
            );
        }

        @Test
        @DisplayName("auditableMethod_WhenSecurityContextIsEmpty_ShouldAuditWithNullUserId()")
        void auditableMethod_WhenSecurityContextIsEmpty_ShouldAuditWithNullUserId() throws Throwable {
            // Arrange — clear security context
            SecurityContextHolder.clearContext();
            when(joinPoint.getArgs()).thenReturn(new Object[]{TEST_ENTITY_ID});
            when(joinPoint.proceed()).thenReturn("ok");

            // Act
            auditAspect.audit(joinPoint, auditable);

            // Assert — performedBy is null but log is still created
            verify(auditService, times(1)).log(
                    anyString(), any(), anyString(),
                    any(), any(), any(), isNull(), any(), any()
            );
        }
    }

    // ── Fail-safe behaviour ────────────────────────────────────────────────────

    @Nested
    @DisplayName("Fail-safe — audit failure does NOT propagate (current design)")
    class FailSafe {

        @Test
        @DisplayName("auditableFail_WhenAuditServiceFails_ShouldNotPropagateException()")
        void auditableFail_WhenAuditServiceFails_ShouldNotPropagateException() throws Throwable {
            // Arrange — auditService.log() throws a RuntimeException
            when(joinPoint.getArgs()).thenReturn(new Object[]{TEST_ENTITY_ID});
            when(joinPoint.proceed()).thenReturn("result");

            User user = User.builder().id(TEST_USER_ID).email(TEST_EMAIL).build();
            when(userRepository.findByEmailAndDeletedAtIsNull(TEST_EMAIL)).thenReturn(Optional.of(user));

            doThrow(new RuntimeException("Audit log write failed"))
                    .when(auditService).log(any(), any(), any(), any(), any(), any(), any(), any(), any());

            // Act + Assert — AuditAspect catches the exception internally and logs it
            // The operation result is still returned to the caller
            Object result = auditAspect.audit(joinPoint, auditable);
            assertThat(result).isEqualTo("result");
        }

        @Test
        @DisplayName("auditableFail_WhenJoinPointFails_ShouldPropagateException()")
        void auditableFail_WhenJoinPointFails_ShouldPropagateException() throws Throwable {
            // Arrange — the real method throws (not the audit)
            when(joinPoint.getArgs()).thenReturn(new Object[]{TEST_ENTITY_ID});
            when(joinPoint.proceed()).thenThrow(new IllegalStateException("Business rule violated"));

            User user = User.builder().id(TEST_USER_ID).email(TEST_EMAIL).build();
            when(userRepository.findByEmailAndDeletedAtIsNull(TEST_EMAIL)).thenReturn(Optional.of(user));

            // Act + Assert — exception from the real method must propagate
            assertThatThrownBy(() -> auditAspect.audit(joinPoint, auditable))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessage("Business rule violated");

            // Assert — audit is NOT written when the real method fails (aspect calls proceed() first)
            verify(auditService, never()).log(any(), any(), any(), any(), any(), any(), any(), any(), any());
        }
    }
}

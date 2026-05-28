package com.minimarket.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.minimarket.audit.domain.AuditLog;
import com.minimarket.audit.dto.AuditFilterRequest;
import com.minimarket.audit.dto.AuditLogResponse;
import com.minimarket.audit.repository.AuditLogRepository;
import com.minimarket.audit.service.AuditServiceImpl;
import com.minimarket.modules.users.domain.User;
import com.minimarket.modules.users.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuditService - Unit Tests")
class AuditServiceTest {

    @Mock
    private AuditLogRepository repo;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private AuditServiceImpl auditService;

    // ObjectMapper used for serialization — use the real one so JSON roundtrip is accurate
    private final ObjectMapper realObjectMapper = new ObjectMapper()
            .findAndRegisterModules();

    // Re-create service with real ObjectMapper
    @org.junit.jupiter.api.BeforeEach
    void injectRealObjectMapper() throws Exception {
        var field = AuditServiceImpl.class.getDeclaredField("objectMapper");
        field.setAccessible(true);
        field.set(auditService, realObjectMapper);
    }

    // ── log() ──────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("log()")
    class Log {

        @Test
        @DisplayName("log_ShouldPersistAuditLog()")
        void log_ShouldPersistAuditLog() {
            // Arrange
            UUID entityId = UUID.randomUUID();
            UUID performedBy = UUID.randomUUID();
            when(repo.save(any(AuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            auditService.log("SALE", entityId, "CANCEL",
                    null, "cancelled-sale", "Stock defect",
                    performedBy, "127.0.0.1", "Mozilla/5.0");

            // Assert
            ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
            verify(repo, times(1)).save(captor.capture());

            AuditLog saved = captor.getValue();
            assertThat(saved.getEntityType()).isEqualTo("SALE");
            assertThat(saved.getEntityId()).isEqualTo(entityId);
            assertThat(saved.getAction()).isEqualTo("CANCEL");
            assertThat(saved.getReason()).isEqualTo("Stock defect");
            assertThat(saved.getPerformedBy()).isEqualTo(performedBy);
            assertThat(saved.getIpAddress()).isEqualTo("127.0.0.1");
            assertThat(saved.getUserAgent()).isEqualTo("Mozilla/5.0");
            // newValue must be serialised JSON of the object
            assertThat(saved.getNewValue()).contains("cancelled-sale");
        }

        @Test
        @DisplayName("log_WhenOldAndNewValueAreNull_ShouldPersistWithNullJsonFields()")
        void log_WhenOldAndNewValueAreNull_ShouldPersistWithNullJsonFields() {
            // Arrange
            when(repo.save(any(AuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            auditService.log("USER", null, "LOGIN_FAILED",
                    null, null, null,
                    null, null, null);

            // Assert
            ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
            verify(repo).save(captor.capture());

            AuditLog saved = captor.getValue();
            assertThat(saved.getOldValue()).isNull();
            assertThat(saved.getNewValue()).isNull();
        }

        @Test
        @DisplayName("log_WhenRepositorySaveFails_ShouldThrowException()")
        void log_WhenRepositorySaveFails_ShouldThrowException() {
            // Arrange — repo.save throws to simulate a DB constraint violation
            when(repo.save(any(AuditLog.class)))
                    .thenThrow(new RuntimeException("DB constraint violated"));

            // Act + Assert — fail-safe: RuntimeException is re-thrown as RuntimeException("Audit log write failed")
            assertThatThrownBy(() ->
                    auditService.log("SALE", UUID.randomUUID(), "CANCEL",
                            null, null, null,
                            UUID.randomUUID(), "127.0.0.1", null)
            )
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Audit log write failed");
        }
    }

    // ── getAuditLogs() ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getAuditLogs()")
    class GetAuditLogs {

        @Test
        @DisplayName("getAuditLogs_WithFilters_ShouldReturnFilteredResults()")
        void getAuditLogs_WithFilters_ShouldReturnFilteredResults() {
            // Arrange
            UUID logId = UUID.randomUUID();
            UUID entityId = UUID.randomUUID();
            UUID performedBy = UUID.randomUUID();
            String performedByEmail = "admin@test.com";

            AuditLog log = AuditLog.builder()
                    .id(logId)
                    .entityType("SALE")
                    .entityId(entityId)
                    .action("CANCEL")
                    .reason("Devolucion")
                    .performedBy(performedBy)
                    .ipAddress("192.168.1.1")
                    .createdAt(LocalDateTime.now())
                    .build();

            Page<AuditLog> page = new PageImpl<>(List.of(log));
            when(repo.findAll(any(Specification.class), any(Pageable.class))).thenReturn(page);
            when(userRepository.findById(performedBy))
                    .thenReturn(Optional.of(User.builder().email(performedByEmail).build()));

            AuditFilterRequest filter = new AuditFilterRequest("SALE", "CANCEL",
                    LocalDate.now().minusDays(7), LocalDate.now());
            Pageable pageable = PageRequest.of(0, 20);

            // Act
            Page<AuditLogResponse> result = auditService.getAuditLogs(filter, pageable);

            // Assert
            assertThat(result.getContent()).hasSize(1);
            AuditLogResponse response = result.getContent().get(0);
            assertThat(response.id()).isEqualTo(logId);
            assertThat(response.entityType()).isEqualTo("SALE");
            assertThat(response.action()).isEqualTo("CANCEL");
            assertThat(response.performedByEmail()).isEqualTo(performedByEmail);
        }

        @Test
        @DisplayName("getAuditLogs_WhenEmpty_ShouldReturnEmptyPage()")
        void getAuditLogs_WhenEmpty_ShouldReturnEmptyPage() {
            // Arrange
            when(repo.findAll(any(Specification.class), any(Pageable.class)))
                    .thenReturn(Page.empty());

            AuditFilterRequest filter = new AuditFilterRequest(null, null, null, null);

            // Act
            Page<AuditLogResponse> result = auditService.getAuditLogs(filter, PageRequest.of(0, 10));

            // Assert
            assertThat(result.getContent()).isEmpty();
        }
    }

    // ── exportExcel() ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("exportExcel()")
    class ExportExcel {

        @Test
        @DisplayName("exportExcel_ShouldReturnNonEmptyBytes()")
        void exportExcel_ShouldReturnNonEmptyBytes() {
            // Arrange
            UUID logId = UUID.randomUUID();
            AuditLog log = AuditLog.builder()
                    .id(logId)
                    .entityType("PRODUCT")
                    .action("PRICE_CHANGE")
                    .oldValue("{\"price\":100}")
                    .newValue("{\"price\":120}")
                    .performedBy(null)
                    .createdAt(LocalDateTime.now())
                    .build();

            Page<AuditLog> page = new PageImpl<>(List.of(log));
            when(repo.findAll(any(Specification.class), any(Pageable.class))).thenReturn(page);

            AuditFilterRequest filter = new AuditFilterRequest(null, null, null, null);

            // Act
            byte[] bytes = auditService.exportExcel(filter);

            // Assert — XLSX magic bytes: PK (50 4B)
            assertThat(bytes).isNotEmpty();
            assertThat(bytes[0]).isEqualTo((byte) 0x50); // 'P'
            assertThat(bytes[1]).isEqualTo((byte) 0x4B); // 'K'
        }

        @Test
        @DisplayName("exportExcel_WhenNoLogs_ShouldReturnWorkbookWithHeaderOnly()")
        void exportExcel_WhenNoLogs_ShouldReturnWorkbookWithHeaderOnly() {
            // Arrange
            when(repo.findAll(any(Specification.class), any(Pageable.class)))
                    .thenReturn(Page.empty());

            AuditFilterRequest filter = new AuditFilterRequest(null, null, null, null);

            // Act
            byte[] bytes = auditService.exportExcel(filter);

            // Assert — still a valid XLSX even with zero data rows
            assertThat(bytes).isNotEmpty();
            assertThat(bytes[0]).isEqualTo((byte) 0x50);
        }
    }
}

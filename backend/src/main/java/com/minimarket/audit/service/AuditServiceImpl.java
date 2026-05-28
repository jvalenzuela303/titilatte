package com.minimarket.audit.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.minimarket.audit.domain.AuditLog;
import com.minimarket.audit.dto.AuditFilterRequest;
import com.minimarket.audit.dto.AuditLogResponse;
import com.minimarket.audit.repository.AuditLogRepository;
import com.minimarket.modules.users.repository.UserRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class AuditServiceImpl implements AuditService {

    private static final int MAX_EXPORT_ROWS = 10_000;

    private final AuditLogRepository repo;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(
            String entityType,
            UUID entityId,
            String action,
            Object oldValue,
            Object newValue,
            String reason,
            UUID performedBy,
            String ipAddress,
            String userAgent
    ) {
        try {
            String oldJson = oldValue != null ? objectMapper.writeValueAsString(oldValue) : null;
            String newJson = newValue != null ? objectMapper.writeValueAsString(newValue) : null;

            AuditLog auditLog = AuditLog.builder()
                    .entityType(entityType)
                    .entityId(entityId)
                    .action(action)
                    .oldValue(oldJson)
                    .newValue(newJson)
                    .reason(reason)
                    .performedBy(performedBy)
                    .ipAddress(ipAddress)
                    .userAgent(userAgent)
                    .build();

            repo.save(auditLog);
            log.debug("Audit log saved: entityType={} action={} performedBy={}", entityType, action, performedBy);
        } catch (Exception e) {
            log.error("Failed to write audit log: entityType={} action={}", entityType, action, e);
            throw new RuntimeException("Audit log write failed", e);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AuditLogResponse> getAuditLogs(AuditFilterRequest filter, Pageable pageable) {
        Specification<AuditLog> spec = buildSpecification(filter);
        return repo.findAll(spec, pageable).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public byte[] exportExcel(AuditFilterRequest filter) {
        Specification<AuditLog> spec = buildSpecification(filter);

        // Limit to MAX_EXPORT_ROWS to avoid OOM
        org.springframework.data.domain.PageRequest limitedPage =
                org.springframework.data.domain.PageRequest.of(0, MAX_EXPORT_ROWS,
                        org.springframework.data.domain.Sort.by("createdAt").descending());

        List<AuditLog> logs = repo.findAll(spec, limitedPage).getContent();

        try (XSSFWorkbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("Audit Log");

            // Header row
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            Row header = sheet.createRow(0);
            String[] columns = {"ID", "Entity Type", "Entity ID", "Action",
                    "Old Value", "New Value", "Reason", "Performed By", "IP Address", "Created At"};
            for (int i = 0; i < columns.length; i++) {
                Cell cell = header.createCell(i);
                cell.setCellValue(columns[i]);
                cell.setCellStyle(headerStyle);
            }

            // Data rows
            int rowNum = 1;
            for (AuditLog log : logs) {
                Row row = sheet.createRow(rowNum++);
                row.createCell(0).setCellValue(log.getId() != null ? log.getId().toString() : "");
                row.createCell(1).setCellValue(log.getEntityType());
                row.createCell(2).setCellValue(log.getEntityId() != null ? log.getEntityId().toString() : "");
                row.createCell(3).setCellValue(log.getAction());
                row.createCell(4).setCellValue(truncate(log.getOldValue(), 1000));
                row.createCell(5).setCellValue(truncate(log.getNewValue(), 1000));
                row.createCell(6).setCellValue(log.getReason() != null ? log.getReason() : "");
                row.createCell(7).setCellValue(resolveUserEmail(log.getPerformedBy()));
                row.createCell(8).setCellValue(log.getIpAddress() != null ? log.getIpAddress() : "");
                row.createCell(9).setCellValue(log.getCreatedAt() != null ? log.getCreatedAt().toString() : "");
            }

            // Auto-size columns
            for (int i = 0; i < columns.length; i++) {
                sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            return out.toByteArray();

        } catch (IOException e) {
            throw new RuntimeException("Failed to generate audit Excel export", e);
        }
    }

    // ---- private helpers ----

    private Specification<AuditLog> buildSpecification(AuditFilterRequest filter) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (filter.entityType() != null && !filter.entityType().isBlank()) {
                predicates.add(cb.equal(root.get("entityType"), filter.entityType().toUpperCase()));
            }
            if (filter.action() != null && !filter.action().isBlank()) {
                predicates.add(cb.equal(root.get("action"), filter.action().toUpperCase()));
            }
            if (filter.startDate() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"),
                        filter.startDate().atStartOfDay()));
            }
            if (filter.endDate() != null) {
                predicates.add(cb.lessThan(root.get("createdAt"),
                        filter.endDate().plusDays(1).atStartOfDay()));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private AuditLogResponse toResponse(AuditLog log) {
        String performedByEmail = resolveUserEmail(log.getPerformedBy());
        return new AuditLogResponse(
                log.getId(),
                log.getEntityType(),
                log.getEntityId(),
                log.getAction(),
                log.getOldValue(),
                log.getNewValue(),
                log.getReason(),
                performedByEmail,
                log.getIpAddress(),
                log.getCreatedAt()
        );
    }

    private String resolveUserEmail(UUID userId) {
        if (userId == null) return null;
        return userRepository.findById(userId)
                .map(u -> u.getEmail())
                .orElse(userId.toString());
    }

    private String truncate(String value, int maxLength) {
        if (value == null) return "";
        return value.length() > maxLength ? value.substring(0, maxLength) + "..." : value;
    }
}

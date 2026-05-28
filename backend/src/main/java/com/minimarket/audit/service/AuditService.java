package com.minimarket.audit.service;

import com.minimarket.audit.dto.AuditFilterRequest;
import com.minimarket.audit.dto.AuditLogResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Map;
import java.util.UUID;

public interface AuditService {

    void log(
            String entityType,
            UUID entityId,
            String action,
            Object oldValue,
            Object newValue,
            String reason,
            UUID performedBy,
            String ipAddress,
            String userAgent
    );

    Page<AuditLogResponse> getAuditLogs(AuditFilterRequest filter, Pageable pageable);

    byte[] exportExcel(AuditFilterRequest filter);
}

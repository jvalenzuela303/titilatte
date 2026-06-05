package com.minimarket.modules.alerts.service;

import com.minimarket.exception.BusinessException;
import com.minimarket.exception.EntityNotFoundException;
import com.minimarket.modules.alerts.domain.AlertHistory;
import com.minimarket.modules.alerts.domain.AlertRule;
import com.minimarket.modules.alerts.domain.AlertSeverity;
import com.minimarket.modules.alerts.domain.AlertType;
import com.minimarket.modules.alerts.dto.AlertHistoryResponse;
import com.minimarket.modules.alerts.dto.AlertRuleRequest;
import com.minimarket.modules.alerts.dto.AlertRuleResponse;
import com.minimarket.modules.alerts.repository.AlertHistoryRepository;
import com.minimarket.modules.alerts.repository.AlertRuleRepository;
import com.minimarket.modules.cash.domain.CashRegister;
import com.minimarket.modules.cash.domain.CashStatus;
import com.minimarket.modules.cash.repository.CashRegisterRepository;
import com.minimarket.modules.users.domain.User;
import com.minimarket.modules.users.repository.UserRepository;
import com.minimarket.sse.SseEmitterRegistry;
import com.minimarket.sse.SseEvent;
import com.minimarket.sse.SseEventType;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class AlertServiceImpl implements AlertService {

    private final AlertRuleRepository alertRuleRepository;
    private final AlertHistoryRepository alertHistoryRepository;
    private final UserRepository userRepository;
    private final CashRegisterRepository cashRegisterRepository;
    private final SseEmitterRegistry sseRegistry;

    @PersistenceContext
    private EntityManager entityManager;

    // -------------------------------------------------------------------------
    // Rule management
    // -------------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public Page<AlertRuleResponse> findAllRules(Pageable pageable) {
        return alertRuleRepository.findAllActive(pageable).map(this::toRuleResponse);
    }

    @Override
    public AlertRuleResponse createRule(AlertRuleRequest req, String creatorEmail) {
        validateRequest(req);

        User creator = userRepository.findByEmailAndDeletedAtIsNull(creatorEmail)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + creatorEmail));

        AlertRule rule = AlertRule.builder()
                .name(req.name())
                .description(req.description())
                .type(req.type())
                .thresholdValue(req.thresholdValue())
                .thresholdMinutes(req.thresholdMinutes())
                .checkIntervalMinutes(req.checkIntervalMinutes())
                .recipientRole(req.recipientRole())
                .active(req.active())
                .createdBy(creator)
                .build();

        return toRuleResponse(alertRuleRepository.save(rule));
    }

    @Override
    public AlertRuleResponse updateRule(UUID id, AlertRuleRequest req) {
        validateRequest(req);

        AlertRule rule = alertRuleRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new EntityNotFoundException("AlertRule", id));

        rule.setName(req.name());
        rule.setDescription(req.description());
        rule.setType(req.type());
        rule.setThresholdValue(req.thresholdValue());
        rule.setThresholdMinutes(req.thresholdMinutes());
        rule.setCheckIntervalMinutes(req.checkIntervalMinutes());
        rule.setRecipientRole(req.recipientRole());
        rule.setActive(req.active());

        return toRuleResponse(alertRuleRepository.save(rule));
    }

    @Override
    public void deactivateRule(UUID id) {
        AlertRule rule = alertRuleRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new EntityNotFoundException("AlertRule", id));
        rule.setActive(false);
        rule.setDeletedAt(OffsetDateTime.now(ZoneOffset.UTC));
        alertRuleRepository.save(rule);
        log.info("Alert rule {} deactivated", id);
    }

    // -------------------------------------------------------------------------
    // History
    // -------------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public Page<AlertHistoryResponse> getHistory(Pageable pageable) {
        return alertHistoryRepository.findAllByOrderByTriggeredAtDesc(pageable)
                .map(this::toHistoryResponse);
    }

    @Override
    public AlertHistoryResponse acknowledge(UUID historyId, String userEmail) {
        AlertHistory history = alertHistoryRepository.findByIdAndAcknowledgedFalse(historyId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "AlertHistory not found or already acknowledged: " + historyId));

        User user = userRepository.findByEmailAndDeletedAtIsNull(userEmail)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + userEmail));

        history.setAcknowledged(true);
        history.setAcknowledgedBy(user);
        history.setAcknowledgedAt(OffsetDateTime.now(ZoneOffset.UTC));

        return toHistoryResponse(alertHistoryRepository.save(history));
    }

    // -------------------------------------------------------------------------
    // Scheduler evaluation
    // -------------------------------------------------------------------------

    @Override
    public void evaluateAllRules() {
        List<AlertRule> activeRules = alertRuleRepository.findAllByActiveTrueAndDeletedAtIsNull();
        log.debug("Evaluating {} active alert rules", activeRules.size());

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        for (AlertRule rule : activeRules) {
            try {
                if (!isDue(rule, now)) {
                    continue;
                }
                evaluateRule(rule, now);
            } catch (Exception ex) {
                log.error("Error evaluating alert rule {} ({}): {}", rule.getId(), rule.getName(), ex.getMessage(), ex);
            } finally {
                rule.setLastCheckedAt(now);
                alertRuleRepository.save(rule);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private boolean isDue(AlertRule rule, OffsetDateTime now) {
        if (rule.getLastCheckedAt() == null) {
            return true;
        }
        return rule.getLastCheckedAt().plusMinutes(rule.getCheckIntervalMinutes()).isBefore(now)
                || rule.getLastCheckedAt().plusMinutes(rule.getCheckIntervalMinutes()).isEqual(now);
    }

    private void evaluateRule(AlertRule rule, OffsetDateTime now) {
        switch (rule.getType()) {
            case SALES_BELOW_THRESHOLD -> evaluateSalesBelowThreshold(rule, now);
            case CASH_OPEN_TOO_LONG    -> evaluateCashOpenTooLong(rule, now);
            case LOW_STOCK_COUNT       -> evaluateLowStockCount(rule, now);
            case HIGH_DEBT_TOTAL       -> evaluateHighDebtTotal(rule, now);
        }
    }

    @SuppressWarnings("unchecked")
    private void evaluateSalesBelowThreshold(AlertRule rule, OffsetDateTime now) {
        // Sum of confirmed sales total_amount for today
        List<Object> result = entityManager.createNativeQuery(
                "SELECT COALESCE(SUM(total_amount), 0) " +
                "FROM sales " +
                "WHERE status = 'CONFIRMED' " +
                "AND DATE(created_at AT TIME ZONE 'UTC') = CURRENT_DATE"
        ).getResultList();

        BigDecimal todaySales = toBigDecimal(result.isEmpty() ? BigDecimal.ZERO : result.get(0));

        BigDecimal threshold = rule.getThresholdValue();
        if (threshold == null || todaySales.compareTo(threshold) >= 0) {
            return;
        }

        AlertSeverity severity = todaySales.compareTo(threshold.multiply(new BigDecimal("0.5"))) < 0
                ? AlertSeverity.CRITICAL
                : AlertSeverity.WARNING;

        String message = String.format(
                "Ventas del día: $%.0f (umbral: $%.0f)", todaySales, threshold);

        fireAlert(rule, severity, message,
                Map.of("todaySales", todaySales, "threshold", threshold), now);
    }

    private void evaluateCashOpenTooLong(AlertRule rule, OffsetDateTime now) {
        if (rule.getThresholdMinutes() == null) {
            log.warn("Rule {} (CASH_OPEN_TOO_LONG) has no thresholdMinutes configured", rule.getId());
            return;
        }

        OffsetDateTime cutoff = now.minusMinutes(rule.getThresholdMinutes());
        List<CashRegister> openRegisters = cashRegisterRepository.findAllByStatus(CashStatus.OPEN);

        for (CashRegister register : openRegisters) {
            if (register.getOpenedAt() != null && register.getOpenedAt().isBefore(cutoff)) {
                long minutesOpen = ChronoUnit.MINUTES.between(register.getOpenedAt(), now);
                String message = String.format(
                        "Caja #%d lleva %d minutos abierta", register.getRegisterNumber(), minutesOpen);

                fireAlert(rule, AlertSeverity.CRITICAL, message,
                        Map.of("registerId", register.getId(),
                               "registerNumber", register.getRegisterNumber(),
                               "minutesOpen", minutesOpen,
                               "openedAt", register.getOpenedAt().toString()),
                        now);
            }
        }
    }

    @SuppressWarnings("unchecked")
    private void evaluateLowStockCount(AlertRule rule, OffsetDateTime now) {
        List<Object> result = entityManager.createNativeQuery(
                "SELECT COUNT(*) " +
                "FROM products " +
                "WHERE deleted_at IS NULL " +
                "AND is_active = true " +
                "AND stock_current <= stock_minimum"
        ).getResultList();

        long count = toLong(result.isEmpty() ? 0L : result.get(0));
        BigDecimal threshold = rule.getThresholdValue();

        if (threshold == null || BigDecimal.valueOf(count).compareTo(threshold) <= 0) {
            return;
        }

        String message = String.format(
                "%d producto(s) con stock por debajo del mínimo (umbral: %.0f)", count, threshold);

        fireAlert(rule, AlertSeverity.WARNING, message,
                Map.of("lowStockCount", count, "threshold", threshold), now);
    }

    @SuppressWarnings("unchecked")
    private void evaluateHighDebtTotal(AlertRule rule, OffsetDateTime now) {
        List<Object> result = entityManager.createNativeQuery(
                "SELECT COALESCE(SUM(credit_used), 0) " +
                "FROM customers " +
                "WHERE is_active = true " +
                "AND deleted_at IS NULL"
        ).getResultList();

        BigDecimal totalDebt = toBigDecimal(result.isEmpty() ? BigDecimal.ZERO : result.get(0));
        BigDecimal threshold = rule.getThresholdValue();

        if (threshold == null || totalDebt.compareTo(threshold) <= 0) {
            return;
        }

        String message = String.format(
                "Deuda total de clientes: $%.0f (umbral: $%.0f)", totalDebt, threshold);

        fireAlert(rule, AlertSeverity.WARNING, message,
                Map.of("totalDebt", totalDebt, "threshold", threshold), now);
    }

    private void fireAlert(AlertRule rule, AlertSeverity severity, String message,
                           Map<String, Object> context, OffsetDateTime now) {
        log.info("Firing alert for rule {} ({}): {} - {}", rule.getId(), rule.getName(), severity, message);

        AlertHistory history = AlertHistory.builder()
                .rule(rule)
                .ruleName(rule.getName())
                .type(rule.getType())
                .severity(severity)
                .message(message)
                .contextJson(contextToJson(context))
                .triggeredAt(now)
                .acknowledged(false)
                .build();

        alertHistoryRepository.save(history);

        rule.setLastTriggeredAt(now);

        sseRegistry.broadcastToRoles(
                Set.of(rule.getRecipientRole()),
                new SseEvent(
                        SseEventType.ALERTA_DISPARADA,
                        Map.of(
                                "ruleId", rule.getId(),
                                "ruleName", rule.getName(),
                                "message", message,
                                "severity", severity.name(),
                                "type", rule.getType().name()
                        ),
                        LocalDateTime.now()
                )
        );
    }

    private String contextToJson(Map<String, Object> context) {
        if (context == null || context.isEmpty()) {
            return null;
        }
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, Object> entry : context.entrySet()) {
            if (!first) sb.append(",");
            sb.append("\"").append(entry.getKey()).append("\":");
            Object val = entry.getValue();
            if (val instanceof String) {
                sb.append("\"").append(val).append("\"");
            } else {
                sb.append(val);
            }
            first = false;
        }
        sb.append("}");
        return sb.toString();
    }

    private BigDecimal toBigDecimal(Object obj) {
        if (obj == null) return BigDecimal.ZERO;
        if (obj instanceof BigDecimal bd) return bd;
        if (obj instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        return new BigDecimal(obj.toString());
    }

    private long toLong(Object obj) {
        if (obj == null) return 0L;
        if (obj instanceof Long l) return l;
        if (obj instanceof Number n) return n.longValue();
        return Long.parseLong(obj.toString());
    }

    private void validateRequest(AlertRuleRequest req) {
        if (!req.isThresholdValid()) {
            if (req.type() == AlertType.CASH_OPEN_TOO_LONG) {
                throw new BusinessException(
                        "thresholdMinutes must be a positive integer for CASH_OPEN_TOO_LONG rules");
            }
            throw new BusinessException(
                    "thresholdValue must be a positive number for " + req.type() + " rules");
        }
    }

    private AlertRuleResponse toRuleResponse(AlertRule rule) {
        return new AlertRuleResponse(
                rule.getId(),
                rule.getName(),
                rule.getDescription(),
                rule.getType().name(),
                rule.getThresholdValue(),
                rule.getThresholdMinutes(),
                rule.getCheckIntervalMinutes(),
                rule.getRecipientRole(),
                rule.isActive(),
                rule.getLastCheckedAt(),
                rule.getLastTriggeredAt(),
                rule.getCreatedAt()
        );
    }

    private AlertHistoryResponse toHistoryResponse(AlertHistory history) {
        return new AlertHistoryResponse(
                history.getId(),
                history.getRule() != null ? history.getRule().getId() : null,
                history.getRuleName(),
                history.getType().name(),
                history.getSeverity().name(),
                history.getMessage(),
                history.getTriggeredAt(),
                history.isAcknowledged(),
                history.getAcknowledgedBy() != null ? history.getAcknowledgedBy().getEmail() : null,
                history.getAcknowledgedAt()
        );
    }
}

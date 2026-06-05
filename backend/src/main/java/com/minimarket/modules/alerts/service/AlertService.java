package com.minimarket.modules.alerts.service;

import com.minimarket.modules.alerts.dto.AlertHistoryResponse;
import com.minimarket.modules.alerts.dto.AlertRuleRequest;
import com.minimarket.modules.alerts.dto.AlertRuleResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface AlertService {

    Page<AlertRuleResponse> findAllRules(Pageable pageable);

    AlertRuleResponse createRule(AlertRuleRequest req, String creatorEmail);

    AlertRuleResponse updateRule(UUID id, AlertRuleRequest req);

    void deactivateRule(UUID id);

    Page<AlertHistoryResponse> getHistory(Pageable pageable);

    AlertHistoryResponse acknowledge(UUID historyId, String userEmail);

    void evaluateAllRules();
}

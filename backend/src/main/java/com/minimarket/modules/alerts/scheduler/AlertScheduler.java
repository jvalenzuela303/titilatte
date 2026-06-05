package com.minimarket.modules.alerts.scheduler;

import com.minimarket.modules.alerts.service.AlertService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Slf4j
@RequiredArgsConstructor
public class AlertScheduler {

    private final AlertService alertService;

    /**
     * Evaluates all active alert rules every minute (after an initial 30-second delay).
     * Each rule controls its own evaluation frequency via checkIntervalMinutes.
     */
    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    public void runEvaluation() {
        log.debug("Running scheduled alert evaluation");
        alertService.evaluateAllRules();
    }
}

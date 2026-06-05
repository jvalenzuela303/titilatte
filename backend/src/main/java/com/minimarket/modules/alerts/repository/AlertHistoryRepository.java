package com.minimarket.modules.alerts.repository;

import com.minimarket.modules.alerts.domain.AlertHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface AlertHistoryRepository extends JpaRepository<AlertHistory, UUID> {

    Page<AlertHistory> findAllByOrderByTriggeredAtDesc(Pageable pageable);

    Optional<AlertHistory> findByIdAndAcknowledgedFalse(UUID id);
}

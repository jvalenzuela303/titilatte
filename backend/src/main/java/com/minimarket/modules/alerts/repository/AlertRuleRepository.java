package com.minimarket.modules.alerts.repository;

import com.minimarket.modules.alerts.domain.AlertRule;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AlertRuleRepository extends JpaRepository<AlertRule, UUID> {

    List<AlertRule> findAllByActiveTrueAndDeletedAtIsNull();

    @Query("SELECT r FROM AlertRule r WHERE r.deletedAt IS NULL")
    Page<AlertRule> findAllActive(Pageable pageable);

    Optional<AlertRule> findByIdAndDeletedAtIsNull(@Param("id") UUID id);
}

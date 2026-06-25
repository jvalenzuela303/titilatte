package com.minimarket.modules.orders.repository;

import com.minimarket.modules.orders.domain.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface OrderRepository extends JpaRepository<Order, UUID> {

    Page<Order> findByStatusInOrderByDeliveryDateAsc(List<String> statuses, Pageable pageable);

    Page<Order> findAllByOrderByDeliveryDateAsc(Pageable pageable);

    @Query("""
            SELECT o FROM Order o
            WHERE o.reminderSent = false
              AND o.status NOT IN ('DELIVERED', 'CANCELLED')
              AND o.deliveryDate BETWEEN :from AND :until
            """)
    List<Order> findOrdersDueSoon(@Param("from") OffsetDateTime from, @Param("until") OffsetDateTime until);
}

package com.minimarket.modules.orders.repository;

import com.minimarket.modules.orders.domain.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface OrderRepository extends JpaRepository<Order, UUID> {

    Page<Order> findByStatusInOrderByDeliveryDateAsc(List<String> statuses, Pageable pageable);

    Page<Order> findAllByOrderByDeliveryDateAsc(Pageable pageable);
}

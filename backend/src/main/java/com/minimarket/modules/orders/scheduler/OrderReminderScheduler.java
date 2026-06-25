package com.minimarket.modules.orders.scheduler;

import com.minimarket.modules.orders.domain.Order;
import com.minimarket.modules.orders.repository.OrderRepository;
import com.minimarket.sse.SseEmitterRegistry;
import com.minimarket.sse.SseEvent;
import com.minimarket.sse.SseEventType;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
@Slf4j
@RequiredArgsConstructor
public class OrderReminderScheduler {

    private final OrderRepository orderRepository;
    private final SseEmitterRegistry sseRegistry;

    /**
     * Every 15 minutes: find orders with delivery within the next 24 hours
     * that haven't had a reminder sent yet, broadcast SSE alert, mark as sent.
     */
    @Scheduled(fixedDelay = 900_000, initialDelay = 60_000)
    @Transactional
    public void sendDeliveryReminders() {
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime in24h = now.plusHours(24);

        List<Order> dueSoon = orderRepository.findOrdersDueSoon(now, in24h);
        if (dueSoon.isEmpty()) return;

        log.info("Sending delivery reminders for {} orders due within 24h", dueSoon.size());

        for (Order order : dueSoon) {
            Map<String, Object> payload = Map.of(
                    "orderId", order.getId().toString(),
                    "orderNumber", order.getOrderNumber(),
                    "customerName", order.getCustomerName(),
                    "deliveryDate", order.getDeliveryDate().toString(),
                    "status", order.getStatus()
            );

            sseRegistry.broadcastToRoles(
                    Set.of("ADMIN", "SUPERVISOR"),
                    new SseEvent(SseEventType.PEDIDO_PROXIMO, payload, LocalDateTime.now())
            );

            order.setReminderSent(true);
            orderRepository.save(order);
        }
    }
}

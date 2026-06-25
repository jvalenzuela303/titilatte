package com.minimarket.modules.orders.service;

import com.minimarket.exception.BusinessException;
import com.minimarket.exception.EntityNotFoundException;
import com.minimarket.modules.orders.domain.Order;
import com.minimarket.modules.orders.domain.OrderPayment;
import com.minimarket.modules.orders.dto.CreateOrderRequest;
import com.minimarket.modules.orders.dto.OrderPaymentRequest;
import com.minimarket.modules.orders.dto.OrderPaymentResponse;
import com.minimarket.modules.orders.dto.OrderResponse;
import com.minimarket.modules.orders.mapper.OrderMapper;
import com.minimarket.modules.orders.repository.OrderPaymentRepository;
import com.minimarket.modules.orders.repository.OrderRepository;
import com.minimarket.modules.users.domain.User;
import com.minimarket.modules.users.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {

    private static final Set<String> VALID_STATUSES = Set.of(
            "PENDING", "IN_PROGRESS", "READY", "DELIVERED", "CANCELLED"
    );

    private final OrderRepository orderRepository;
    private final OrderPaymentRepository orderPaymentRepository;
    private final UserRepository userRepository;
    private final OrderMapper orderMapper;

    @Override
    @Transactional
    public OrderResponse create(CreateOrderRequest request, String creatorEmail) {
        User creator = userRepository.findByEmailAndDeletedAtIsNull(creatorEmail)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + creatorEmail));

        Order order = Order.builder()
                .customerId(request.customerId())
                .customerName(request.customerName())
                .customerPhone(request.customerPhone())
                .description(request.description())
                .totalAmount(request.totalAmount())
                .amountPaid(BigDecimal.ZERO)
                .status("PENDING")
                .paymentStatus("UNPAID")
                .deliveryDate(request.deliveryDate())
                .notes(request.notes())
                .createdBy(creator.getId())
                .build();

        Order saved = orderRepository.save(order);
        log.info("Order created: #{} by {}", saved.getId(), creatorEmail);

        return orderMapper.toResponse(saved, creator.getEmail());
    }

    @Override
    @Transactional(readOnly = true)
    public Page<OrderResponse> findAll(String status, Pageable pageable) {
        Page<Order> page;

        if (status != null && !status.isBlank()) {
            page = orderRepository.findByStatusInOrderByDeliveryDateAsc(List.of(status), pageable);
        } else {
            page = orderRepository.findAllByOrderByDeliveryDateAsc(pageable);
        }

        return page.map(order -> {
            User creator = userRepository.findByIdAndDeletedAtIsNull(order.getCreatedBy())
                    .orElse(null);
            String email = creator != null ? creator.getEmail() : null;
            return orderMapper.toResponse(order, email);
        });
    }

    @Override
    @Transactional(readOnly = true)
    public OrderResponse findById(UUID id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Order", id));

        User creator = userRepository.findByIdAndDeletedAtIsNull(order.getCreatedBy())
                .orElse(null);
        String email = creator != null ? creator.getEmail() : null;

        return orderMapper.toResponse(order, email);
    }

    @Override
    @Transactional
    public OrderResponse updateStatus(UUID id, String newStatus) {
        if (!VALID_STATUSES.contains(newStatus)) {
            throw new BusinessException(
                    "Invalid status '" + newStatus + "'. Valid values: " + VALID_STATUSES);
        }

        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Order", id));

        order.setStatus(newStatus);
        Order saved = orderRepository.save(order);
        log.info("Order #{} status updated to {}", saved.getOrderNumber(), newStatus);

        User creator = userRepository.findByIdAndDeletedAtIsNull(saved.getCreatedBy())
                .orElse(null);
        String email = creator != null ? creator.getEmail() : null;

        return orderMapper.toResponse(saved, email);
    }

    @Override
    @Transactional
    public OrderPaymentResponse registerPayment(UUID id, OrderPaymentRequest request, String userEmail) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Order", id));

        if ("CANCELLED".equals(order.getStatus())) {
            throw new BusinessException("Cannot register payment on a cancelled order.");
        }
        if ("PAID".equals(order.getPaymentStatus())) {
            throw new BusinessException("This order is already fully paid.");
        }

        User paidBy = userRepository.findByEmailAndDeletedAtIsNull(userEmail)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + userEmail));

        OrderPayment payment = OrderPayment.builder()
                .orderId(order.getId())
                .amount(request.amount())
                .paymentMethod(request.paymentMethod())
                .notes(request.notes())
                .paidBy(paidBy.getId())
                .paidAt(OffsetDateTime.now())
                .build();

        orderPaymentRepository.save(payment);

        BigDecimal newAmountPaid = order.getAmountPaid().add(request.amount());
        order.setAmountPaid(newAmountPaid);

        if (newAmountPaid.compareTo(order.getTotalAmount()) >= 0) {
            order.setPaymentStatus("PAID");
        } else {
            order.setPaymentStatus("PARTIAL");
        }

        orderRepository.save(order);
        log.info("Payment of {} registered on order #{} by {}", request.amount(), order.getOrderNumber(), userEmail);

        return orderMapper.toPaymentResponse(payment, paidBy.getEmail());
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrderPaymentResponse> getPayments(UUID id) {
        if (!orderRepository.existsById(id)) {
            throw new EntityNotFoundException("Order", id);
        }

        List<OrderPayment> payments = orderPaymentRepository.findByOrderIdOrderByCreatedAtDesc(id);

        return payments.stream()
                .map(p -> {
                    User paidBy = userRepository.findByIdAndDeletedAtIsNull(p.getPaidBy())
                            .orElse(null);
                    String email = paidBy != null ? paidBy.getEmail() : null;
                    return orderMapper.toPaymentResponse(p, email);
                })
                .toList();
    }
}

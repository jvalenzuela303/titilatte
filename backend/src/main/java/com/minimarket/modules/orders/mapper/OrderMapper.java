package com.minimarket.modules.orders.mapper;

import com.minimarket.modules.orders.domain.Order;
import com.minimarket.modules.orders.domain.OrderItem;
import com.minimarket.modules.orders.domain.OrderPayment;
import com.minimarket.modules.orders.dto.OrderItemResponse;
import com.minimarket.modules.orders.dto.OrderPaymentResponse;
import com.minimarket.modules.orders.dto.OrderResponse;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

@Component
public class OrderMapper {

    public OrderResponse toResponse(Order order, String createdByEmail, List<OrderItem> items) {
        BigDecimal pending = order.getTotalAmount()
                .subtract(order.getAmountPaid())
                .max(BigDecimal.ZERO);

        List<OrderItemResponse> itemResponses = items.stream()
                .map(item -> new OrderItemResponse(
                        item.getId(),
                        item.getProductName(),
                        item.getQuantity(),
                        item.getUnitCost(),
                        item.getQuantity().multiply(item.getUnitCost())
                ))
                .toList();

        return new OrderResponse(
                order.getId(),
                order.getOrderNumber(),
                order.getCustomerId(),
                order.getCustomerName(),
                order.getCustomerPhone(),
                order.getDescription(),
                itemResponses,
                order.getTotalAmount(),
                order.getAmountPaid(),
                pending,
                order.getStatus(),
                order.getPaymentStatus(),
                order.getDeliveryDate(),
                order.getNotes(),
                createdByEmail,
                order.getCreatedAt(),
                order.getUpdatedAt()
        );
    }

    public OrderPaymentResponse toPaymentResponse(OrderPayment payment, String paidByEmail) {
        return new OrderPaymentResponse(
                payment.getId(),
                payment.getOrderId(),
                payment.getAmount(),
                payment.getPaymentMethod(),
                payment.getNotes(),
                paidByEmail,
                payment.getPaidAt(),
                payment.getCreatedAt()
        );
    }
}

package com.minimarket.modules.orders.service;

import com.minimarket.modules.orders.dto.CreateOrderRequest;
import com.minimarket.modules.orders.dto.OrderPaymentRequest;
import com.minimarket.modules.orders.dto.OrderPaymentResponse;
import com.minimarket.modules.orders.dto.OrderResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

public interface OrderService {

    OrderResponse create(CreateOrderRequest request, String creatorEmail);

    Page<OrderResponse> findAll(String status, Pageable pageable);

    OrderResponse findById(UUID id);

    OrderResponse updateStatus(UUID id, String newStatus);

    OrderPaymentResponse registerPayment(UUID id, OrderPaymentRequest request, String userEmail);

    List<OrderPaymentResponse> getPayments(UUID id);
}

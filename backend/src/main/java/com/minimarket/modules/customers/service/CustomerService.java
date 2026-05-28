package com.minimarket.modules.customers.service;

import com.minimarket.modules.customers.dto.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

public interface CustomerService {

    CustomerResponse createCustomer(CustomerRequest request);

    CustomerResponse updateCustomer(UUID id, CustomerRequest request);

    CustomerResponse getCustomer(UUID id);

    Page<CustomerResponse> getAllCustomers(String search, Pageable pageable);

    void deleteCustomer(UUID id);

    CustomerPaymentResponse registerPayment(UUID customerId, CustomerPaymentRequest request, String receiverEmail);

    Page<CustomerPaymentResponse> getPayments(UUID customerId, Pageable pageable);

    List<CustomerDebtResponse> getDebtors();

    CustomerResponse updateCreditLimit(UUID id, CreditLimitRequest request);
}

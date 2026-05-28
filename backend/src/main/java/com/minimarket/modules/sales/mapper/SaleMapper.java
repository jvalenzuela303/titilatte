package com.minimarket.modules.sales.mapper;

import com.minimarket.modules.sales.domain.Payment;
import com.minimarket.modules.sales.domain.Sale;
import com.minimarket.modules.sales.domain.SaleDetail;
import com.minimarket.modules.sales.dto.SaleResponse;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class SaleMapper {

    public SaleResponse toResponse(Sale sale) {
        SaleResponse.SellerDto sellerDto = new SaleResponse.SellerDto(
                sale.getSeller().getId(),
                sale.getSeller().getEmail(),
                sale.getSeller().getFirstName(),
                sale.getSeller().getLastName()
        );

        List<SaleResponse.SaleDetailDto> detailDtos = sale.getDetails().stream()
                .map(this::toDetailDto)
                .collect(Collectors.toList());

        List<SaleResponse.PaymentDto> paymentDtos = sale.getPayments().stream()
                .map(this::toPaymentDto)
                .collect(Collectors.toList());

        return new SaleResponse(
                sale.getId(),
                sale.getSaleNumber(),
                sale.getType(),
                sale.getStatus(),
                sale.getTotalAmount(),
                sale.getDiscountAmount(),
                sale.getTaxAmount(),
                sale.getNetAmount(),
                sellerDto,
                sale.getCustomerId(),
                sale.getNotes(),
                sale.getCancellationReason(),
                sale.getCancelledAt(),
                detailDtos,
                paymentDtos,
                sale.getCreatedAt(),
                sale.getUpdatedAt()
        );
    }

    private SaleResponse.SaleDetailDto toDetailDto(SaleDetail detail) {
        return new SaleResponse.SaleDetailDto(
                detail.getId(),
                detail.getProduct().getId(),
                detail.getProduct().getName(),
                detail.getProduct().getBarcode(),
                detail.getQuantity(),
                detail.getUnitPrice(),
                detail.getDiscount(),
                detail.getSubtotal(),
                detail.getTaxRate(),
                detail.getTaxAmount()
        );
    }

    private SaleResponse.PaymentDto toPaymentDto(Payment payment) {
        return new SaleResponse.PaymentDto(
                payment.getId(),
                payment.getMethod(),
                payment.getAmount(),
                payment.getChangeAmount(),
                payment.getReference(),
                payment.getCreatedAt()
        );
    }
}

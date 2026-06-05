package com.minimarket.modules.sales.repository;

import com.minimarket.modules.sales.domain.Sale;
import com.minimarket.modules.sales.domain.SaleStatus;
import org.springframework.data.jpa.domain.Specification;

import java.time.OffsetDateTime;
import java.util.UUID;

public final class SaleSpecification {

    private SaleSpecification() {}

    public static Specification<Sale> withFilters(
            OffsetDateTime startDate,
            OffsetDateTime endDate,
            UUID sellerId,
            SaleStatus status) {

        return Specification
                .where(afterOrEqual(startDate))
                .and(beforeOrEqual(endDate))
                .and(bySeller(sellerId))
                .and(byStatus(status));
    }

    private static Specification<Sale> afterOrEqual(OffsetDateTime startDate) {
        return (root, query, cb) ->
                startDate == null ? null : cb.greaterThanOrEqualTo(root.get("createdAt"), startDate);
    }

    private static Specification<Sale> beforeOrEqual(OffsetDateTime endDate) {
        return (root, query, cb) ->
                endDate == null ? null : cb.lessThanOrEqualTo(root.get("createdAt"), endDate);
    }

    private static Specification<Sale> bySeller(UUID sellerId) {
        return (root, query, cb) ->
                sellerId == null ? null : cb.equal(root.get("seller").get("id"), sellerId);
    }

    private static Specification<Sale> byStatus(SaleStatus status) {
        return (root, query, cb) ->
                status == null ? null : cb.equal(root.get("status"), status);
    }
}

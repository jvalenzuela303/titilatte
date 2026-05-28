package com.minimarket.modules.products.repository;

import com.minimarket.modules.products.domain.Product;
import jakarta.persistence.criteria.JoinType;
import org.springframework.data.jpa.domain.Specification;

import java.util.UUID;

public class ProductSpecification {

    private ProductSpecification() {}

    public static Specification<Product> notDeleted() {
        return (root, query, cb) -> cb.isNull(root.get("deletedAt"));
    }

    public static Specification<Product> nameLike(String name) {
        return (root, query, cb) ->
                cb.like(cb.lower(root.get("name")), "%" + name.toLowerCase() + "%");
    }

    public static Specification<Product> barcodeEquals(String barcode) {
        return (root, query, cb) -> cb.equal(root.get("barcode"), barcode);
    }

    public static Specification<Product> categoryEquals(UUID categoryId) {
        return (root, query, cb) -> cb.equal(root.get("category").get("id"), categoryId);
    }

    public static Specification<Product> activeEquals(Boolean active) {
        return (root, query, cb) -> cb.equal(root.get("active"), active);
    }

    public static Specification<Product> withAssociations() {
        return (root, query, cb) -> {
            // Avoid duplicate rows from multiple fetches on paginated queries
            if (query != null && Long.class.equals(query.getResultType())) {
                // count query — no fetch joins needed
                root.join("category", JoinType.LEFT);
                root.join("tax", JoinType.LEFT);
                root.join("unit", JoinType.LEFT);
            } else {
                root.fetch("category", JoinType.LEFT);
                root.fetch("tax", JoinType.LEFT);
                root.fetch("unit", JoinType.LEFT);
                query.distinct(true);
            }
            return null;
        };
    }
}

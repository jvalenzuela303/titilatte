package com.minimarket.modules.products.mapper;

import com.minimarket.modules.products.domain.Product;
import com.minimarket.modules.products.dto.ProductResponse;
import org.springframework.stereotype.Component;

@Component
public class ProductMapper {

    public ProductResponse toResponse(Product product) {
        return new ProductResponse(
                product.getId(),
                product.getBarcode(),
                product.getName(),
                product.getDescription(),
                product.getPurchasePrice(),
                product.getSalePrice(),
                product.getStockCurrent(),
                product.getStockMinimum(),
                product.getStockMaximum(),
                product.isActive(),
                new ProductResponse.CategoryDto(
                        product.getCategory().getId(),
                        product.getCategory().getCode(),
                        product.getCategory().getName()
                ),
                new ProductResponse.TaxDto(
                        product.getTax().getId(),
                        product.getTax().getCode(),
                        product.getTax().getName(),
                        product.getTax().getRate()
                ),
                new ProductResponse.UnitDto(
                        product.getUnit().getId(),
                        product.getUnit().getCode(),
                        product.getUnit().getName(),
                        product.getUnit().getAbbreviation()
                ),
                product.getCreatedAt(),
                product.getUpdatedAt()
        );
    }
}

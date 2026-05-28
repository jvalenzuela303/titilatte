package com.minimarket.exception;

public class InsufficientStockException extends RuntimeException {

    public InsufficientStockException(String message) {
        super(message);
    }

    public InsufficientStockException(String productName, double available, double requested) {
        super(String.format("Insufficient stock for product '%s'. Available: %.4f, Requested: %.4f",
                productName, available, requested));
    }
}

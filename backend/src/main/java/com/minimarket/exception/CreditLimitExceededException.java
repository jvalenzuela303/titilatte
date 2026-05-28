package com.minimarket.exception;

public class CreditLimitExceededException extends RuntimeException {

    public CreditLimitExceededException(String customerName) {
        super("El cliente " + customerName + " ha superado su límite de crédito");
    }
}

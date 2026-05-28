package com.minimarket.exception;

public class CashRegisterAlreadyOpenException extends RuntimeException {

    public CashRegisterAlreadyOpenException() {
        super("El cajero ya tiene una caja abierta en este turno");
    }
}

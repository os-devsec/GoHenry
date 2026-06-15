package com.integrador.orders;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collections;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleResponseStatus(ResponseStatusException error) {
        String detail = error.getReason() == null ? "No pudimos completar la solicitud" : error.getReason();
        return ResponseEntity
                .status(error.getStatus())
                .body(Collections.singletonMap("detail", detail));
    }
}

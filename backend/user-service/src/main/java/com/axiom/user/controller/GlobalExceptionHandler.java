package com.axiom.user.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException ex) {
        String msg = ex.getMessage();
        if (msg == null) msg = "Bad request";

        HttpStatus status = HttpStatus.BAD_REQUEST;

        // Map well-known prefixes to specific HTTP statuses
        if (msg.startsWith("ACCESS_PENDING:")) {
            status = HttpStatus.FORBIDDEN;
        } else if (msg.startsWith("ACCESS_DENIED:")) {
            status = HttpStatus.FORBIDDEN;
        } else if (msg.startsWith("Invalid credentials")) {
            status = HttpStatus.UNAUTHORIZED;
        }

        log.warn("Business rule violation [{}]: {}", status.value(), msg);

        return ResponseEntity.status(status).body(Map.of(
            "error",     status.getReasonPhrase(),
            "message",   msg,
            "status",    status.value(),
            "timestamp", Instant.now().toString()
        ));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalState(IllegalStateException ex) {
        log.error("Unexpected state error: {}", ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
            "error",     "Internal Server Error",
            "message",   "An unexpected error occurred",
            "status",    500,
            "timestamp", Instant.now().toString()
        ));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        String details = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage())
            .collect(Collectors.joining(", "));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
            "error",     "Validation Failed",
            "message",   details,
            "status",    400,
            "timestamp", Instant.now().toString()
        ));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception ex) {
        log.error("Unhandled exception: {}", ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
            "error",     "Internal Server Error",
            "message",   "An unexpected error occurred. Please try again.",
            "status",    500,
            "timestamp", Instant.now().toString()
        ));
    }
}


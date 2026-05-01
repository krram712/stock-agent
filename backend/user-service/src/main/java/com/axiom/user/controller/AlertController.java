package com.axiom.user.controller;

import com.axiom.user.model.Alert;
import com.axiom.user.repository.AlertRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/alerts")
@RequiredArgsConstructor
public class AlertController {

    private final AlertRepository alertRepository;

    @GetMapping
    public ResponseEntity<List<Alert>> getAll(@RequestHeader("X-User-Id") String userId) {
        return ResponseEntity.ok(alertRepository.findByUserIdOrderByCreatedAtDesc(UUID.fromString(userId)));
    }

    @PostMapping
    public ResponseEntity<Alert> create(
            @RequestHeader("X-User-Id") String userId,
            @RequestBody Alert alert) {
        alert.setId(null);
        alert.setUserId(UUID.fromString(userId));
        return ResponseEntity.status(HttpStatus.CREATED).body(alertRepository.save(alert));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable UUID id) {
        return alertRepository.findByIdAndUserId(id, UUID.fromString(userId))
            .map(alert -> {
                alertRepository.delete(alert);
                return ResponseEntity.noContent().build();
            })
            .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", "Alert not found")));
    }
}


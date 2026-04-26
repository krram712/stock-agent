package com.axiom.user.controller;

import com.axiom.user.model.User;
import com.axiom.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final UserRepository userRepository;

    @GetMapping("/users")
    public ResponseEntity<?> listUsers(@RequestHeader("X-User-Role") String role) {
        if (!"ADMIN".equals(role)) return ResponseEntity.status(403).body("Forbidden");
        List<User> users = userRepository.findAllByOrderByCreatedAtDesc();
        return ResponseEntity.ok(users.stream().map(u -> Map.of(
            "id",        u.getId().toString(),
            "email",     u.getEmail(),
            "username",  u.getUsername() != null ? u.getUsername() : "",
            "firstName", u.getFirstName() != null ? u.getFirstName() : "",
            "lastName",  u.getLastName() != null ? u.getLastName() : "",
            "role",      u.getRole().name(),
            "status",    u.getStatus().name(),
            "createdAt", u.getCreatedAt().toString()
        )).toList());
    }

    @PutMapping("/users/{id}/approve")
    public ResponseEntity<?> approve(@RequestHeader("X-User-Role") String role, @PathVariable UUID id) {
        if (!"ADMIN".equals(role)) return ResponseEntity.status(403).body("Forbidden");
        User user = userRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setStatus(User.AccountStatus.APPROVED);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "User approved", "id", id.toString()));
    }

    @PutMapping("/users/{id}/reject")
    public ResponseEntity<?> reject(@RequestHeader("X-User-Role") String role, @PathVariable UUID id) {
        if (!"ADMIN".equals(role)) return ResponseEntity.status(403).body("Forbidden");
        User user = userRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setStatus(User.AccountStatus.REJECTED);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "User rejected", "id", id.toString()));
    }
}
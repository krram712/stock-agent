package com.axiom.user.controller;

import com.axiom.user.model.Script;
import com.axiom.user.service.ScriptService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/scripts")
@RequiredArgsConstructor
public class ScriptController {

    private final ScriptService scriptService;

    @GetMapping
    public ResponseEntity<List<Script>> getAll(
            @RequestParam(required = false) String category) {
        List<Script> scripts = category != null
                ? scriptService.getByCategory(category)
                : scriptService.getAll();
        // Strip content from list view for bandwidth
        scripts.forEach(s -> s.setContent(null));
        return ResponseEntity.ok(scripts);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Script> getById(@PathVariable UUID id) {
        return scriptService.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Script> create(
            @RequestHeader(value = "X-User-Role", defaultValue = "USER") String role,
            @RequestBody Script script) {
        if (!"ADMIN".equals(role)) return ResponseEntity.status(403).build();
        return ResponseEntity.ok(scriptService.create(script));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Script> update(
            @RequestHeader(value = "X-User-Role", defaultValue = "USER") String role,
            @PathVariable UUID id,
            @RequestBody Script patch) {
        if (!"ADMIN".equals(role)) return ResponseEntity.status(403).build();
        return ResponseEntity.ok(scriptService.update(id, patch));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @RequestHeader(value = "X-User-Role", defaultValue = "USER") String role,
            @PathVariable UUID id) {
        if (!"ADMIN".equals(role)) return ResponseEntity.status(403).build();
        scriptService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
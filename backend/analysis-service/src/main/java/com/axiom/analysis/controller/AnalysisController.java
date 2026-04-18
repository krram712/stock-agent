package com.axiom.analysis.controller;

import com.axiom.analysis.dto.AnalysisRequest;
import com.axiom.analysis.model.StockAnalysis;
import com.axiom.analysis.service.AnalysisService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/analysis")
@RequiredArgsConstructor
public class AnalysisController {

    private final AnalysisService analysisService;

    @PostMapping
    public ResponseEntity<StockAnalysis> analyze(
            @Valid @RequestBody AnalysisRequest req,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        UUID uid = userId != null ? UUID.fromString(userId) : null;
        return ResponseEntity.ok(analysisService.analyze(req, uid));
    }

    @GetMapping("/history")
    public ResponseEntity<Page<StockAnalysis>> getHistory(
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        if (userId == null) return ResponseEntity.ok(Page.empty());
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(analysisService.getUserHistory(UUID.fromString(userId), pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<StockAnalysis> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(analysisService.getById(id));
    }
}


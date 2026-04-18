package com.axiom.user.controller;

import com.axiom.user.model.Watchlist;
import com.axiom.user.service.WatchlistService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/watchlists")
@RequiredArgsConstructor
public class WatchlistController {

    private final WatchlistService watchlistService;

    @GetMapping
    public ResponseEntity<List<Watchlist>> getAll(@RequestHeader("X-User-Id") String userId) {
        return ResponseEntity.ok(watchlistService.getByUserId(UUID.fromString(userId)));
    }

    @PostMapping
    public ResponseEntity<Watchlist> create(
            @RequestHeader("X-User-Id") String userId,
            @RequestBody Watchlist watchlist) {
        watchlist.setUserId(UUID.fromString(userId));
        return ResponseEntity.ok(watchlistService.create(watchlist));
    }

    @PutMapping("/{id}/tickers")
    public ResponseEntity<Watchlist> updateTickers(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable UUID id,
            @RequestBody List<String> tickers) {
        return ResponseEntity.ok(watchlistService.updateTickers(id, UUID.fromString(userId), tickers));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable UUID id) {
        watchlistService.delete(id, UUID.fromString(userId));
        return ResponseEntity.noContent().build();
    }
}


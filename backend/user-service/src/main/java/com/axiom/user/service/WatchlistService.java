package com.axiom.user.service;

import com.axiom.user.model.Watchlist;
import com.axiom.user.repository.WatchlistRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WatchlistService {

    private final WatchlistRepository watchlistRepository;

    public List<Watchlist> getByUserId(UUID userId) {
        return watchlistRepository.findByUserId(userId);
    }

    @Transactional
    public Watchlist create(Watchlist watchlist) {
        return watchlistRepository.save(watchlist);
    }

    @Transactional
    public Watchlist updateTickers(UUID id, UUID userId, List<String> tickers) {
        Watchlist wl = watchlistRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Watchlist not found"));
        if (!wl.getUserId().equals(userId)) throw new IllegalArgumentException("Not authorized");
        wl.setTickers(tickers);
        return watchlistRepository.save(wl);
    }

    @Transactional
    public void delete(UUID id, UUID userId) {
        Watchlist wl = watchlistRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Watchlist not found"));
        if (!wl.getUserId().equals(userId)) throw new IllegalArgumentException("Not authorized");
        watchlistRepository.delete(wl);
    }
}


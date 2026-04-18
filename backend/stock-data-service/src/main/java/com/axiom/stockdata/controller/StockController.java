package com.axiom.stockdata.controller;

import com.axiom.stockdata.model.*;
import com.axiom.stockdata.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/stocks")
@RequiredArgsConstructor
public class StockController {

    private final MarketDataService marketDataService;

    @GetMapping("/{ticker}/quote")
    public ResponseEntity<StockQuote> getQuote(@PathVariable String ticker) {
        return ResponseEntity.ok(marketDataService.getQuote(ticker.toUpperCase()));
    }

    @GetMapping("/{ticker}/technicals")
    public ResponseEntity<TechnicalIndicators> getTechnicals(@PathVariable String ticker) {
        return ResponseEntity.ok(marketDataService.getTechnicals(ticker.toUpperCase()));
    }

    @GetMapping("/{ticker}/history")
    public ResponseEntity<?> getHistory(
            @PathVariable String ticker,
            @RequestParam(defaultValue = "1D") String interval,
            @RequestParam(defaultValue = "3M") String range) {
        return ResponseEntity.ok(marketDataService.getHistory(ticker.toUpperCase(), interval, range));
    }

    @GetMapping("/{ticker}/fundamentals")
    public ResponseEntity<?> getFundamentals(@PathVariable String ticker) {
        return ResponseEntity.ok(marketDataService.getFundamentals(ticker.toUpperCase()));
    }

    @GetMapping("/{ticker}/news")
    public ResponseEntity<?> getNews(@PathVariable String ticker) {
        return ResponseEntity.ok(marketDataService.getNews(ticker.toUpperCase()));
    }

    @GetMapping("/{ticker}/analysts")
    public ResponseEntity<?> getAnalysts(@PathVariable String ticker) {
        return ResponseEntity.ok(marketDataService.getFundamentals(ticker.toUpperCase()));
    }

    @GetMapping("/search")
    public ResponseEntity<List<?>> search(@RequestParam String q) {
        return ResponseEntity.ok(marketDataService.search(q));
    }
}


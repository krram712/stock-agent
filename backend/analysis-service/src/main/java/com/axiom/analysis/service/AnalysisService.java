package com.axiom.analysis.service;

import com.axiom.analysis.dto.AnalysisRequest;
import com.axiom.analysis.model.StockAnalysis;
import com.axiom.analysis.repository.AnalysisRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class AnalysisService {

    private final AnalysisRepository analysisRepository;
    private final WebClient stockDataClient;
    private final ScoringEngine scoringEngine;
    private final ObjectMapper objectMapper;

    // In-memory cache (replaces Redis for local dev)
    private final Map<String, StockAnalysis> analysisCache = new ConcurrentHashMap<>();

    @Value("${analysis.cache-ttl-minutes:30}")
    private int cacheTtlMinutes;

    public StockAnalysis analyze(AnalysisRequest req, UUID userId) {
        String cacheKey = "analysis:" + req.getTicker() + ":" + req.getHorizon();

        if (!req.isForceRefresh()) {
            StockAnalysis cached = analysisCache.get(cacheKey);
            if (cached != null && cached.getExpiresAt() != null && cached.getExpiresAt().isAfter(Instant.now())) {
                return cached;
            }
        }

        Map<String, Object> quote        = fetchQuote(req.getTicker());
        Map<String, Object> technicals   = fetchTechnicals(req.getTicker());
        Map<String, Object> fundamentals = fetchFundamentals(req.getTicker());

        ScoringResult score  = scoringEngine.calculate(quote, technicals, fundamentals, fundamentals, req.getHorizon());
        Map<String, Object> srLevels = scoringEngine.calculateSRLevels(quote, technicals);
        Map<String, Object> signals  = scoringEngine.generateSignals(quote, technicals, score, req.getHorizon());

        String executiveSummary = buildExecutiveSummary(req.getTicker(), req.getHorizon(), score, quote);
        String marketPulse      = buildMarketPulse(quote, technicals);
        String technicalSection = buildTechnicalSection(technicals);
        String srSection        = buildSRSection(srLevels);
        String fundSection      = buildFundamentalsSection(fundamentals);
        String entryExit        = buildEntryExitSection(signals);
        String scorecard        = buildScorecard(score);
        String risks            = buildRisks(req.getTicker(), req.getHorizon());
        String tradePlan        = buildTradePlan(req.getTicker(), signals, score, req.getHorizon());

        StockAnalysis analysis = StockAnalysis.builder()
            .ticker(req.getTicker()).horizon(req.getHorizon()).userId(userId)
            .overallScore(score.getOverallScore()).verdict(score.getVerdict())
            .entryLow((BigDecimal) signals.get("entryLow"))
            .entryHigh((BigDecimal) signals.get("entryHigh"))
            .stopLoss((BigDecimal) signals.get("stopLoss"))
            .target1((BigDecimal) signals.get("target1"))
            .target2((BigDecimal) signals.get("target2"))
            .target3((BigDecimal) signals.get("target3"))
            .riskReward((BigDecimal) signals.get("riskReward"))
            .executiveSummary(executiveSummary)
            .marketPulse(marketPulse)
            .technicalAnalysis(technicalSection)
            .supportResistance(srSection)
            .fundamentals(fundSection)
            .entryExitSignals(entryExit)
            .bullBearScorecard(scorecard)
            .riskFactors(risks)
            .tradePlan(tradePlan)
            .customAnalysis(req.getCustomPrompt())
            .createdAt(Instant.now())
            .expiresAt(Instant.now().plus(Duration.ofMinutes(cacheTtlMinutes)))
            .build();

        analysis = analysisRepository.save(analysis);
        analysisCache.put(cacheKey, analysis);
        return analysis;
    }

    public Page<StockAnalysis> getUserHistory(UUID userId, Pageable pageable) {
        return analysisRepository.findByUserId(userId, pageable);
    }

    public StockAnalysis getById(UUID id) {
        return analysisRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Analysis not found"));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchQuote(String ticker) {
        try {
            return stockDataClient.get()
                .uri("/api/v1/stocks/{ticker}/quote", ticker)
                .retrieve().bodyToMono(Map.class).block(Duration.ofSeconds(10));
        } catch (Exception e) {
            log.warn("Failed to fetch quote for {}: {}", ticker, e.getMessage());
            return Map.of("price", 100.0, "week52High", 130.0, "week52Low", 70.0, "high", 102.0, "low", 98.0);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchTechnicals(String ticker) {
        try {
            return stockDataClient.get()
                .uri("/api/v1/stocks/{ticker}/technicals", ticker)
                .retrieve().bodyToMono(Map.class).block(Duration.ofSeconds(10));
        } catch (Exception e) {
            log.warn("Failed to fetch technicals for {}: {}", ticker, e.getMessage());
            return Map.of("rsi14", 55.0, "macdHistogram", 0.5, "overallTrend", "BULLISH",
                "goldenCross", false, "adx14", 25.0, "cmf", 0.1, "bollingerSqueeze", false);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchFundamentals(String ticker) {
        try {
            return stockDataClient.get()
                .uri("/api/v1/stocks/{ticker}/fundamentals", ticker)
                .retrieve().bodyToMono(Map.class).block(Duration.ofSeconds(10));
        } catch (Exception e) {
            log.warn("Failed to fetch fundamentals for {}: {}", ticker, e.getMessage());
            return Map.of("revenueGrowthYoy", 12.0, "netMargin", 18.0, "pegRatio", 1.5, "buyPercentage", 65.0);
        }
    }

    // ─── Report builders ─────────────────────────────────────────────────
    private String buildExecutiveSummary(String ticker, String horizon, ScoringResult score, Map<String, Object> quote) {
        return String.format("""
            TICKER: %s | HORIZON: %s | SCORE: %d/100 | VERDICT: %s
            
            Overall Assessment: %s
            
            Score Breakdown:
              Trend:       %.1f/10
              Momentum:    %.1f/10
              Volume:      %.1f/10
              Fundamentals:%.1f/10
              Analysts:    %.1f/10
              Setup:       %.1f/10
            """,
            ticker, horizon.toUpperCase(), score.getOverallScore(), score.getVerdict(),
            verdictDescription(score.getVerdict()),
            score.getTrendScore(), score.getMomentumScore(), score.getVolumeScore(),
            score.getFundamentalScore(), score.getAnalystScore(), score.getSetupScore());
    }

    private String buildMarketPulse(Map<String, Object> quote, Map<String, Object> technicals) {
        return String.format("""
            Current Price:  $%s
            52W High/Low:   $%s / $%s
            Overall Trend:  %s
            RSI(14):        %s
            MACD Histogram: %s
            Volume Signal:  CMF = %s
            """,
            quote.get("price"), quote.get("week52High"), quote.get("week52Low"),
            technicals.getOrDefault("overallTrend", "N/A"),
            technicals.getOrDefault("rsi14", "N/A"),
            technicals.getOrDefault("macdHistogram", "N/A"),
            technicals.getOrDefault("cmf", "N/A"));
    }

    private String buildTechnicalSection(Map<String, Object> t) {
        return String.format("""
            Moving Averages:
              EMA(9):   %s   EMA(20): %s
              EMA(50):  %s   EMA(200):%s
              SMA(200): %s   VWAP:    %s
            
            Momentum:
              RSI(14): %s   MACD Line: %s
              MACD Signal: %s   Histogram: %s
            
            Volatility:
              Bollinger Upper: %s  Middle: %s  Lower: %s
              BB Width: %s  Squeeze: %s
              ATR(14): %s
            
            Trend Strength:
              ADX(14): %s
              Golden Cross: %s  Death Cross: %s
            """,
            t.getOrDefault("ema9","N/A"), t.getOrDefault("ema20","N/A"),
            t.getOrDefault("ema50","N/A"), t.getOrDefault("ema200","N/A"),
            t.getOrDefault("sma200","N/A"), t.getOrDefault("vwap","N/A"),
            t.getOrDefault("rsi14","N/A"), t.getOrDefault("macdLine","N/A"),
            t.getOrDefault("macdSignal","N/A"), t.getOrDefault("macdHistogram","N/A"),
            t.getOrDefault("bollingerUpper","N/A"), t.getOrDefault("bollingerMiddle","N/A"),
            t.getOrDefault("bollingerLower","N/A"), t.getOrDefault("bollingerWidth","N/A"),
            t.getOrDefault("bollingerSqueeze","N/A"), t.getOrDefault("atr14","N/A"),
            t.getOrDefault("adx14","N/A"),
            t.getOrDefault("goldenCross","N/A"), t.getOrDefault("deathCross","N/A"));
    }

    private String buildSRSection(Map<String, Object> sr) {
        return String.format("""
            Pivot: %s
            
            Resistance Levels:  R1: %s  R2: %s  R3: %s
            Support Levels:     S1: %s  S2: %s  S3: %s
            
            Fibonacci Levels:
              23.6%%: %s    38.2%%: %s    50.0%%: %s
              61.8%%: %s    78.6%%: %s
            Extensions:
              127.2%%: %s   161.8%%: %s
            """,
            sr.get("pivot"),
            sr.get("r1"), sr.get("r2"), sr.get("r3"),
            sr.get("s1"), sr.get("s2"), sr.get("s3"),
            sr.get("fib236"), sr.get("fib382"), sr.get("fib500"),
            sr.get("fib618"), sr.get("fib786"),
            sr.get("ext1272"), sr.get("ext1618"));
    }

    private String buildFundamentalsSection(Map<String, Object> f) {
        return String.format("""
            Valuation:
              P/E Ratio:       %s
              PEG Ratio:       %s
              P/B Ratio:       %s
            
            Growth & Profitability:
              Revenue Growth (YoY): %s%%
              Net Margin:           %s%%
              Return on Equity:     %s%%
            
            Balance Sheet:
              Debt/Equity:     %s
              EPS:             %s
              Dividend Yield:  %s%%
            
            Analyst Consensus:
              Buy Rating:      %s%%
            """,
            f.getOrDefault("peRatio","N/A"), f.getOrDefault("pegRatio","N/A"),
            f.getOrDefault("pbRatio","N/A"),
            f.getOrDefault("revenueGrowthYoy","N/A"), f.getOrDefault("netMargin","N/A"),
            f.getOrDefault("roe","N/A"), f.getOrDefault("debtToEquity","N/A"),
            f.getOrDefault("eps","N/A"), f.getOrDefault("dividendYield","N/A"),
            f.getOrDefault("buyPercentage","N/A"));
    }

    private String buildEntryExitSection(Map<String, Object> s) {
        return String.format("""
            ENTRY ZONE:  $%s — $%s
            STOP LOSS:   $%s  (-%s%%)
            
            TARGETS:
              T1 (partial exit):  $%s
              T2 (main target):   $%s
              T3 (stretch goal):  $%s
            
            RISK/REWARD RATIO: 1:%s
            """,
            s.get("entryLow"), s.get("entryHigh"),
            s.get("stopLoss"), s.get("stopPercent"),
            s.get("target1"), s.get("target2"), s.get("target3"),
            s.get("riskReward"));
    }

    private String buildScorecard(ScoringResult s) {
        return String.format("""
            BULL FACTORS:
              %s Golden Cross pattern
              %s Price above key EMAs
              %s RSI in bullish zone (>50)
              %s Positive MACD histogram
              %s Strong analyst consensus
            
            BEAR FACTORS:
              %s Market uncertainty
              %s Potential resistance ahead
              %s Macro headwinds
            
            OVERALL SCORE: %d/100 → %s
            """,
            s.getTrendScore() > 6 ? "✅" : "❌",
            s.getTrendScore() > 5 ? "✅" : "❌",
            s.getMomentumScore() > 6 ? "✅" : "❌",
            s.getMomentumScore() > 5 ? "✅" : "❌",
            s.getAnalystScore() > 6 ? "✅" : "❌",
            s.getTrendScore() < 5 ? "⚠️" : "—",
            s.getSetupScore() < 5 ? "⚠️" : "—",
            s.getFundamentalScore() < 5 ? "⚠️" : "—",
            s.getOverallScore(), s.getVerdict());
    }

    private String buildRisks(String ticker, String horizon) {
        return String.format("""
            PRIMARY RISKS for %s (%s horizon):
            
            1. Market Risk — Broad market selloff could override individual stock setups
            2. Earnings Risk — Unexpected earnings miss/beat can gap price significantly
            3. Sector Rotation — Capital may rotate out of this sector
            4. Liquidity Risk — Low volume periods can cause slippage
            5. Macro Risk — Fed rate decisions, inflation data, geopolitical events
            
            ⚠️  This analysis is for educational purposes only. Not financial advice.
            ⚠️  Always use proper position sizing and never risk more than 1-2%% per trade.
            """, ticker, horizon);
    }

    private String buildTradePlan(String ticker, Map<String, Object> s, ScoringResult score, String horizon) {
        return String.format("""
            TRADE PLAN — %s | %s | Score: %d
            
            ACTION: %s
            
            EXECUTION:
              1. Wait for price to reach entry zone $%s–$%s
              2. Enter with 1/3 position on initial touch
              3. Add remaining on confirmation candle
              4. Place stop at $%s immediately after entry
            
            MANAGEMENT:
              • Take 30%% profit at T1 ($%s)
              • Move stop to breakeven at T1
              • Take 40%% profit at T2 ($%s)
              • Let remaining 30%% run to T3 ($%s)
            
            R/R: 1:%s  |  Max Risk: 1-2%% of portfolio
            """,
            ticker, horizon.toUpperCase(), score.getOverallScore(),
            score.getOverallScore() >= 58 ? "CONSIDER LONG" : score.getOverallScore() <= 42 ? "AVOID / SHORT BIAS" : "WAIT FOR SETUP",
            s.get("entryLow"), s.get("entryHigh"), s.get("stopLoss"),
            s.get("target1"), s.get("target2"), s.get("target3"), s.get("riskReward"));
    }

    private String verdictDescription(com.axiom.analysis.model.StockAnalysis.Verdict v) {
        return switch (v) {
            case STRONG_BULL -> "Strong bullish setup — high conviction long opportunity";
            case MILD_BULL   -> "Mild bullish — moderate opportunity with manageable risk";
            case NEUTRAL     -> "Neutral — wait for clearer direction before entry";
            case MILD_BEAR   -> "Mild bearish — caution advised, consider reducing exposure";
            case STRONG_BEAR -> "Strong bearish setup — avoid longs, defensive positioning";
        };
    }
}


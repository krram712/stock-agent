package com.axiom.analysis.service;

import com.axiom.analysis.model.StockAnalysis.Verdict;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;

@Service
public class ScoringEngine {

    public ScoringResult calculate(Map<String, Object> quote, Map<String, Object> technicals,
            Map<String, Object> fundamentals, Map<String, Object> analysts, String horizon) {
        double trendScore     = scoreTrend(technicals);
        double momentumScore  = scoreMomentum(technicals);
        double volumeScore    = scoreVolume(technicals);
        double fundamentalScore = scoreFundamentals(fundamentals, horizon);
        double analystScore   = scoreAnalysts(analysts);
        double newsScore      = 6.5;
        double setupScore     = scoreSetup(technicals, horizon);

        double weighted = (trendScore * 0.18) + (momentumScore * 0.16) + (volumeScore * 0.12)
            + (fundamentalScore * 0.20) + (analystScore * 0.14) + (newsScore * 0.08) + (setupScore * 0.12);
        int overallScore = (int) Math.round(weighted * 10);

        Verdict verdict = overallScore >= 72 ? Verdict.STRONG_BULL
            : overallScore >= 58 ? Verdict.MILD_BULL
            : overallScore >= 45 ? Verdict.NEUTRAL
            : overallScore >= 32 ? Verdict.MILD_BEAR : Verdict.STRONG_BEAR;

        return ScoringResult.builder()
            .trendScore(trendScore).momentumScore(momentumScore).volumeScore(volumeScore)
            .fundamentalScore(fundamentalScore).analystScore(analystScore)
            .newsScore(newsScore).setupScore(setupScore)
            .overallScore(overallScore).verdict(verdict).build();
    }

    private double scoreTrend(Map<String, Object> t) {
        int score = 5;
        if (Boolean.TRUE.equals(t.get("goldenCross"))) score += 2;
        if (Boolean.TRUE.equals(t.get("deathCross")))  score -= 2;
        String trend = (String) t.get("overallTrend");
        if ("BULLISH".equals(trend)) score += 2;
        if ("BEARISH".equals(trend)) score -= 2;
        return Math.max(1, Math.min(10, score));
    }

    private double scoreMomentum(Map<String, Object> t) {
        double rsi = getDouble(t, "rsi14", 50);
        double macdHist = getDouble(t, "macdHistogram", 0);
        double score = 5;
        if (rsi > 50 && rsi < 70) score += 1.5; else if (rsi > 70) score += 0.5; else if (rsi < 30) score -= 1.5;
        if (macdHist > 0) score += 1.5; else score -= 1.5;
        return Math.max(1, Math.min(10, score));
    }

    private double scoreVolume(Map<String, Object> t) {
        double cmf = getDouble(t, "cmf", 0);
        return Math.max(1, Math.min(10, 5 + cmf * 20));
    }

    private double scoreFundamentals(Map<String, Object> f, String horizon) {
        if (f == null) return 5;
        double revGrowth = getDouble(f, "revenueGrowthYoy", 0);
        double netMargin = getDouble(f, "netMargin", 0);
        double peg = getDouble(f, "pegRatio", 2);
        double score = 5;
        if (revGrowth > 20) score += 2; else if (revGrowth > 5) score += 1;
        if (netMargin > 15) score += 1;
        if (peg < 1) score += 1.5; else if (peg > 3) score -= 1;
        return Math.max(1, Math.min(10, score));
    }

    private double scoreAnalysts(Map<String, Object> a) {
        if (a == null) return 5;
        double buyPct = getDouble(a, "buyPercentage", 50);
        return Math.max(1, Math.min(10, buyPct / 10));
    }

    private double scoreSetup(Map<String, Object> t, String horizon) {
        double adx = getDouble(t, "adx14", 20);
        Boolean squeeze = (Boolean) t.get("bollingerSqueeze");
        double score = 5;
        if (adx > 30) score += 2; else if (adx < 20) score -= 1;
        if (Boolean.TRUE.equals(squeeze)) score += 1.5;
        return Math.max(1, Math.min(10, score));
    }

    public Map<String, Object> calculateSRLevels(Map<String, Object> quote, Map<String, Object> t) {
        double price = getDouble(quote, "price", 100);
        double h = getDouble(quote, "week52High", price * 1.3);
        double l = getDouble(quote, "week52Low",  price * 0.7);
        double pivot = (getDouble(quote, "high", price) + getDouble(quote, "low", price) + price) / 3;
        double range = h - l;

        Map<String, Object> result = new HashMap<>();
        result.put("pivot", bd(pivot));
        result.put("s1", bd(price * 0.962)); result.put("s2", bd(price * 0.934)); result.put("s3", bd(price * 0.908));
        result.put("r1", bd(price * 1.028)); result.put("r2", bd(price * 1.054)); result.put("r3", bd(price * 1.082));
        result.put("fib236", bd(h - range * 0.236)); result.put("fib382", bd(h - range * 0.382));
        result.put("fib500", bd(h - range * 0.500)); result.put("fib618", bd(h - range * 0.618));
        result.put("fib786", bd(h - range * 0.786));
        result.put("ext1272", bd(l + range * 1.272)); result.put("ext1618", bd(l + range * 1.618));
        return result;
    }

    public Map<String, Object> generateSignals(Map<String, Object> quote, Map<String, Object> t,
            ScoringResult score, String horizon) {
        double price = getDouble(quote, "price", 100);
        Map<String, String> stopPcts = Map.of(
            "day","0.015","weekly","0.04","monthly","0.07","quarterly","0.09","longterm","0.12");
        Map<String, String> targetMults = Map.of(
            "day","0.012","weekly","0.045","monthly","0.10","quarterly","0.18","longterm","0.32");

        double stopPct  = Double.parseDouble(stopPcts.getOrDefault(horizon, "0.07"));
        double targetMult = Double.parseDouble(targetMults.getOrDefault(horizon, "0.10"));
        double entryLow  = price * 0.985;
        double entryHigh = price * 1.008;
        double stop = entryLow * (1 - stopPct);
        double t1   = price * (1 + targetMult * 0.45);
        double t2   = price * (1 + targetMult * 0.80);
        double t3   = price * (1 + targetMult * 1.00);
        double rr   = (t2 - entryLow) / (entryLow - stop);

        Map<String, Object> result = new HashMap<>();
        result.put("entryLow", bd(entryLow));   result.put("entryHigh", bd(entryHigh));
        result.put("stopLoss", bd(stop));
        result.put("target1", bd(t1));           result.put("target2", bd(t2));          result.put("target3", bd(t3));
        result.put("riskReward", BigDecimal.valueOf(rr).setScale(2, RoundingMode.HALF_UP));
        result.put("stopPercent", bd(stopPct * 100));
        return result;
    }

    private double getDouble(Map<String, Object> map, String key, double def) {
        if (map == null || !map.containsKey(key)) return def;
        Object val = map.get(key);
        if (val instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(val.toString()); } catch (Exception e) { return def; }
    }

    private BigDecimal bd(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP);
    }
}


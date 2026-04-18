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
        double price  = getDouble(quote, "price", 100);
        double dayH   = getDouble(quote, "high",  price * 1.01);
        double dayL   = getDouble(quote, "low",   price * 0.99);
        double prev   = getDouble(quote, "previousClose", price);
        double w52h   = getDouble(quote, "week52High", price * 1.30);
        double w52l   = getDouble(quote, "week52Low",  price * 0.70);

        // Standard floor-trader pivot from yesterday's H/L/C
        double pivot = (dayH + dayL + prev) / 3.0;
        double r1    = 2 * pivot - dayL;
        double s1    = 2 * pivot - dayH;
        double r2    = pivot + (dayH - dayL);
        double s2    = pivot - (dayH - dayL);
        double r3    = dayH + 2 * (pivot - dayL);
        double s3    = dayL - 2 * (dayH - pivot);

        // Fibonacci retracement levels off 52-week range
        double range    = w52h - w52l;
        double fib236   = w52h - range * 0.236;
        double fib382   = w52h - range * 0.382;
        double fib500   = w52h - range * 0.500;
        double fib618   = w52h - range * 0.618;
        double fib786   = w52h - range * 0.786;
        double ext1272  = w52l  + range * 1.272;
        double ext1618  = w52l  + range * 1.618;

        // Use EMA levels as dynamic S/R if available
        double ema20  = getDouble(t, "ema20",  0);
        double ema50  = getDouble(t, "ema50",  0);
        double ema200 = getDouble(t, "ema200", 0);
        double bbLower = getDouble(t, "bollingerLower", s1);
        double bbUpper = getDouble(t, "bollingerUpper", r1);

        Map<String, Object> result = new HashMap<>();
        result.put("pivot",   bd(pivot));
        result.put("r1",      bd(r1));   result.put("r2", bd(r2));   result.put("r3", bd(r3));
        result.put("s1",      bd(s1));   result.put("s2", bd(s2));   result.put("s3", bd(s3));
        result.put("fib236",  bd(fib236)); result.put("fib382", bd(fib382));
        result.put("fib500",  bd(fib500)); result.put("fib618", bd(fib618));
        result.put("fib786",  bd(fib786));
        result.put("ext1272", bd(ext1272)); result.put("ext1618", bd(ext1618));
        result.put("bbLower", bd(bbLower)); result.put("bbUpper", bd(bbUpper));
        if (ema20  > 0) result.put("ema20",  bd(ema20));
        if (ema50  > 0) result.put("ema50",  bd(ema50));
        if (ema200 > 0) result.put("ema200", bd(ema200));
        return result;
    }

    public Map<String, Object> generateSignals(Map<String, Object> quote, Map<String, Object> t,
            ScoringResult score, String horizon) {
        double price   = getDouble(quote, "price", 100);
        double atr     = getDouble(t, "atr14", price * 0.015);  // fallback 1.5% if no ATR

        // ATR multipliers per horizon — wider for longer timeframes
        double atrStopMult   = switch (horizon) {
            case "day"       -> 1.0;
            case "weekly"    -> 1.5;
            case "monthly"   -> 2.0;
            case "quarterly" -> 2.5;
            default          -> 3.0;  // longterm
        };
        double atrTargetMult = switch (horizon) {
            case "day"       -> 1.5;
            case "weekly"    -> 2.5;
            case "monthly"   -> 4.0;
            case "quarterly" -> 6.0;
            default          -> 9.0;  // longterm
        };

        // Entry zone: between EMA9 (or -0.5×ATR) and current price
        double ema9     = getDouble(t, "ema9",  0);
        double bbLower  = getDouble(t, "bollingerLower", 0);
        double bbMiddle = getDouble(t, "bollingerMiddle", price);

        // Entry low = best of: EMA9, Bollinger lower, or price - 0.5×ATR
        double entryLow;
        if (ema9 > 0 && ema9 < price && ema9 > price - atr * 2) {
            entryLow = ema9;                          // dynamic EMA9 support
        } else if (bbLower > 0 && bbLower < price && bbLower > price - atr * 3) {
            entryLow = bbLower;                       // Bollinger lower band
        } else {
            entryLow = price - (atr * 0.5);          // half ATR below price
        }
        // Entry high = just above current price (confirm breakout)
        double entryHigh = price + (atr * 0.3);

        // Stop loss = entry low - (ATR × atrStopMult), but never more than 15% below price
        double rawStop  = entryLow - (atr * atrStopMult);
        double maxStop  = price * 0.85;
        double stop     = Math.max(rawStop, maxStop);
        double stopPct  = (entryLow - stop) / entryLow * 100;

        // Targets: use resistance levels (BB upper, R1, R2) and ATR projections
        double bbUpper = getDouble(t, "bollingerUpper", 0);
        double dayH    = getDouble(quote, "high",  price);
        double prev    = getDouble(quote, "previousClose", price);
        double r1      = 2 * ((dayH + getDouble(quote, "low", price) + prev) / 3.0) - getDouble(quote, "low", price);

        double t1 = (bbUpper > price) ? bbUpper : price + (atr * atrTargetMult * 0.40);
        double t2 = (r1      > price) ? r1      : price + (atr * atrTargetMult * 0.75);
        double t3 = price + (atr * atrTargetMult);

        // Ensure targets are strictly increasing
        t1 = Math.max(t1, price + atr * 0.5);
        t2 = Math.max(t2, t1   + atr * 0.5);
        t3 = Math.max(t3, t2   + atr * 0.5);

        double rr = (entryLow > stop) ? (t2 - entryLow) / (entryLow - stop) : 0;

        Map<String, Object> result = new HashMap<>();
        result.put("entryLow",   bd(entryLow));
        result.put("entryHigh",  bd(entryHigh));
        result.put("stopLoss",   bd(stop));
        result.put("target1",    bd(t1));
        result.put("target2",    bd(t2));
        result.put("target3",    bd(t3));
        result.put("riskReward", BigDecimal.valueOf(rr).setScale(2, RoundingMode.HALF_UP));
        result.put("stopPercent", bd(stopPct));
        result.put("atr",        bd(atr));
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


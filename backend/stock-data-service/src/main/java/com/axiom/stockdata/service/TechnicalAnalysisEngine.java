package com.axiom.stockdata.service;

import com.axiom.stockdata.model.TechnicalIndicators;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
public class TechnicalAnalysisEngine {

    private static final MathContext MC = new MathContext(10, RoundingMode.HALF_UP);
    private static final BigDecimal TWO = BigDecimal.valueOf(2);

    public BigDecimal calculateEMA(List<BigDecimal> prices, int period) {
        if (prices.size() < period) return null;
        BigDecimal multiplier = TWO.divide(BigDecimal.valueOf(period + 1), MC);
        BigDecimal ema = prices.subList(0, period).stream()
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(BigDecimal.valueOf(period), MC);
        for (int i = period; i < prices.size(); i++) {
            ema = prices.get(i).subtract(ema).multiply(multiplier, MC).add(ema);
        }
        return ema.setScale(2, RoundingMode.HALF_UP);
    }

    public BigDecimal calculateSMA(List<BigDecimal> prices, int period) {
        if (prices.size() < period) return null;
        List<BigDecimal> slice = prices.subList(prices.size() - period, prices.size());
        return slice.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(BigDecimal.valueOf(period), MC)
            .setScale(2, RoundingMode.HALF_UP);
    }

    public BigDecimal calculateRSI(List<BigDecimal> prices, int period) {
        if (prices.size() < period + 1) return null;
        BigDecimal avgGain = BigDecimal.ZERO, avgLoss = BigDecimal.ZERO;
        for (int i = 1; i <= period; i++) {
            BigDecimal change = prices.get(i).subtract(prices.get(i - 1));
            if (change.compareTo(BigDecimal.ZERO) > 0) avgGain = avgGain.add(change);
            else avgLoss = avgLoss.add(change.abs());
        }
        avgGain = avgGain.divide(BigDecimal.valueOf(period), MC);
        avgLoss = avgLoss.divide(BigDecimal.valueOf(period), MC);
        for (int i = period + 1; i < prices.size(); i++) {
            BigDecimal change = prices.get(i).subtract(prices.get(i - 1));
            BigDecimal gain = change.compareTo(BigDecimal.ZERO) > 0 ? change : BigDecimal.ZERO;
            BigDecimal loss = change.compareTo(BigDecimal.ZERO) < 0 ? change.abs() : BigDecimal.ZERO;
            avgGain = avgGain.multiply(BigDecimal.valueOf(period - 1), MC).add(gain)
                .divide(BigDecimal.valueOf(period), MC);
            avgLoss = avgLoss.multiply(BigDecimal.valueOf(period - 1), MC).add(loss)
                .divide(BigDecimal.valueOf(period), MC);
        }
        if (avgLoss.compareTo(BigDecimal.ZERO) == 0) return BigDecimal.valueOf(100);
        BigDecimal rs = avgGain.divide(avgLoss, MC);
        return BigDecimal.valueOf(100).subtract(
            BigDecimal.valueOf(100).divide(BigDecimal.ONE.add(rs), MC))
            .setScale(2, RoundingMode.HALF_UP);
    }

    public BigDecimal[] calculateMACD(List<BigDecimal> prices) {
        if (prices.size() < 35) return null; // need at least 26 + 9
        // Build MACD line history: EMA12 - EMA26 for each point from index 25 onward
        BigDecimal multiplier12 = TWO.divide(BigDecimal.valueOf(13), MC);
        BigDecimal multiplier26 = TWO.divide(BigDecimal.valueOf(27), MC);
        // Seed EMAs with SMA of first period
        BigDecimal ema12 = prices.subList(0, 12).stream().reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(BigDecimal.valueOf(12), MC);
        BigDecimal ema26 = prices.subList(0, 26).stream().reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(BigDecimal.valueOf(26), MC);
        for (int i = 12; i < 26; i++) {
            ema12 = prices.get(i).subtract(ema12).multiply(multiplier12, MC).add(ema12);
        }
        // Collect MACD line values starting from index 25
        List<BigDecimal> macdHistory = new ArrayList<>();
        for (int i = 26; i < prices.size(); i++) {
            ema12 = prices.get(i).subtract(ema12).multiply(multiplier12, MC).add(ema12);
            ema26 = prices.get(i).subtract(ema26).multiply(multiplier26, MC).add(ema26);
            macdHistory.add(ema12.subtract(ema26));
        }
        // Signal line = 9-period EMA of MACD history
        BigDecimal signal = calculateEMA(macdHistory, 9);
        if (signal == null) return null;
        BigDecimal macdLine = macdHistory.get(macdHistory.size() - 1);
        BigDecimal histogram = macdLine.subtract(signal);
        return new BigDecimal[]{
            macdLine.setScale(4, RoundingMode.HALF_UP),
            signal.setScale(4, RoundingMode.HALF_UP),
            histogram.setScale(4, RoundingMode.HALF_UP)
        };
    }

    public BigDecimal[] calculateBollingerBands(List<BigDecimal> prices, int period, double stdDevMultiplier) {
        BigDecimal sma = calculateSMA(prices, period);
        if (sma == null) return null;
        List<BigDecimal> slice = prices.subList(prices.size() - period, prices.size());
        BigDecimal variance = slice.stream()
            .map(p -> p.subtract(sma).pow(2))
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(BigDecimal.valueOf(period), MC);
        BigDecimal stdDev = BigDecimal.valueOf(Math.sqrt(variance.doubleValue()));
        BigDecimal upper = sma.add(stdDev.multiply(BigDecimal.valueOf(stdDevMultiplier)));
        BigDecimal lower = sma.subtract(stdDev.multiply(BigDecimal.valueOf(stdDevMultiplier)));
        BigDecimal width = upper.subtract(lower).divide(sma, MC).multiply(BigDecimal.valueOf(100));
        return new BigDecimal[]{
            upper.setScale(2, RoundingMode.HALF_UP),
            sma.setScale(2, RoundingMode.HALF_UP),
            lower.setScale(2, RoundingMode.HALF_UP),
            width.setScale(2, RoundingMode.HALF_UP)
        };
    }

    public BigDecimal calculateATR(List<BigDecimal> highs, List<BigDecimal> lows, List<BigDecimal> closes, int period) {
        if (highs.size() < period + 1) return null;
        BigDecimal atr = BigDecimal.ZERO;
        for (int i = 1; i <= period; i++) {
            BigDecimal tr = highs.get(i).subtract(lows.get(i)).abs()
                .max(highs.get(i).subtract(closes.get(i - 1)).abs())
                .max(lows.get(i).subtract(closes.get(i - 1)).abs());
            atr = atr.add(tr);
        }
        atr = atr.divide(BigDecimal.valueOf(period), MC);
        return atr.setScale(4, RoundingMode.HALF_UP);
    }

    public BigDecimal calculateADX(List<BigDecimal> highs, List<BigDecimal> lows, List<BigDecimal> closes, int period) {
        if (highs.size() < period * 2) return null;
        double[] dx = new double[highs.size() - 1];
        for (int i = 1; i < highs.size(); i++) {
            double upMove = highs.get(i).subtract(highs.get(i - 1)).doubleValue();
            double downMove = lows.get(i - 1).subtract(lows.get(i)).doubleValue();
            double plusDM = (upMove > downMove && upMove > 0) ? upMove : 0;
            double minusDM = (downMove > upMove && downMove > 0) ? downMove : 0;
            double tr = Math.max(highs.get(i).subtract(lows.get(i)).doubleValue(),
                Math.max(Math.abs(highs.get(i).subtract(closes.get(i - 1)).doubleValue()),
                    Math.abs(lows.get(i).subtract(closes.get(i - 1)).doubleValue())));
            dx[i - 1] = (plusDM + minusDM) == 0 ? 0 : Math.abs(plusDM - minusDM) / (plusDM + minusDM) * 100;
        }
        double adx = 0;
        for (int i = 0; i < period; i++) adx += dx[i];
        adx /= period;
        for (int i = period; i < dx.length; i++) {
            adx = (adx * (period - 1) + dx[i]) / period;
        }
        return BigDecimal.valueOf(adx).setScale(2, RoundingMode.HALF_UP);
    }

    public TechnicalIndicators calculate(String ticker, List<BigDecimal> closes, List<BigDecimal> highs,
            List<BigDecimal> lows, List<BigDecimal> volumes) {

        BigDecimal lastPrice = closes.get(closes.size() - 1);
        BigDecimal ema9   = calculateEMA(closes, 9);
        BigDecimal ema20  = calculateEMA(closes, 20);
        BigDecimal ema50  = calculateEMA(closes, 50);
        BigDecimal ema200 = calculateEMA(closes, 200);
        BigDecimal sma20  = calculateSMA(closes, 20);
        BigDecimal sma50  = calculateSMA(closes, 50);
        BigDecimal sma200 = calculateSMA(closes, 200);
        BigDecimal rsi    = calculateRSI(closes, 14);
        BigDecimal[] macd = calculateMACD(closes);
        BigDecimal[] bb   = calculateBollingerBands(closes, 20, 2.0);
        BigDecimal atr    = calculateATR(highs, lows, closes, 14);
        BigDecimal adx    = calculateADX(highs, lows, closes, 14);
        BigDecimal cmf    = calculateCMF(highs, lows, closes, volumes, 20);
        BigDecimal vwap   = calculateVWAP(highs, lows, closes, volumes);
        BigDecimal[] aroon = calculateAroon(highs, lows, 25);

        boolean goldenCross = ema50 != null && ema200 != null && ema50.compareTo(ema200) > 0;
        boolean deathCross  = ema50 != null && ema200 != null && ema50.compareTo(ema200) < 0;

        int bullSignals = 0, bearSignals = 0;
        if (ema9  != null && lastPrice.compareTo(ema9)  > 0) bullSignals++; else bearSignals++;
        if (ema20 != null && lastPrice.compareTo(ema20) > 0) bullSignals++; else bearSignals++;
        if (ema50 != null && lastPrice.compareTo(ema50) > 0) bullSignals++; else bearSignals++;
        if (rsi   != null && rsi.compareTo(BigDecimal.valueOf(50)) > 0) bullSignals++; else bearSignals++;
        if (goldenCross) bullSignals++; if (deathCross) bearSignals++;
        String trend = bullSignals > bearSignals + 1 ? "BULLISH" : bearSignals > bullSignals + 1 ? "BEARISH" : "NEUTRAL";

        return TechnicalIndicators.builder()
            .ticker(ticker).ema9(ema9).ema20(ema20).ema50(ema50).ema200(ema200)
            .sma20(sma20).sma50(sma50).sma200(sma200).vwap(vwap).rsi14(rsi)
            .macdLine(macd != null ? macd[0] : null)
            .macdSignal(macd != null ? macd[1] : null)
            .macdHistogram(macd != null ? macd[2] : null)
            .bollingerUpper(bb != null ? bb[0] : null)
            .bollingerMiddle(bb != null ? bb[1] : null)
            .bollingerLower(bb != null ? bb[2] : null)
            .bollingerWidth(bb != null ? bb[3] : null)
            .bollingerSqueeze(bb != null && bb[3].compareTo(BigDecimal.valueOf(6)) < 0)
            .atr14(atr).cmf(cmf).adx14(adx)
            .aroonUp(aroon != null ? aroon[0] : null)
            .aroonDown(aroon != null ? aroon[1] : null)
            .goldenCross(goldenCross).deathCross(deathCross).overallTrend(trend)
            .build();
    }

    private BigDecimal calculateCMF(List<BigDecimal> highs, List<BigDecimal> lows,
            List<BigDecimal> closes, List<BigDecimal> volumes, int period) {
        BigDecimal moneyFlowVolume = BigDecimal.ZERO, totalVolume = BigDecimal.ZERO;
        int start = Math.max(0, closes.size() - period);
        for (int i = start; i < closes.size(); i++) {
            BigDecimal range = highs.get(i).subtract(lows.get(i));
            if (range.compareTo(BigDecimal.ZERO) == 0) continue;
            BigDecimal mfm = closes.get(i).subtract(lows.get(i))
                .subtract(highs.get(i).subtract(closes.get(i))).divide(range, MC);
            moneyFlowVolume = moneyFlowVolume.add(mfm.multiply(volumes.get(i)));
            totalVolume = totalVolume.add(volumes.get(i));
        }
        return totalVolume.compareTo(BigDecimal.ZERO) == 0 ? BigDecimal.ZERO
            : moneyFlowVolume.divide(totalVolume, MC).setScale(4, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateVWAP(List<BigDecimal> highs, List<BigDecimal> lows,
            List<BigDecimal> closes, List<BigDecimal> volumes) {
        BigDecimal tpv = BigDecimal.ZERO, tv = BigDecimal.ZERO;
        for (int i = 0; i < closes.size(); i++) {
            BigDecimal tp = highs.get(i).add(lows.get(i)).add(closes.get(i)).divide(BigDecimal.valueOf(3), MC);
            tpv = tpv.add(tp.multiply(volumes.get(i)));
            tv = tv.add(volumes.get(i));
        }
        return tv.compareTo(BigDecimal.ZERO) == 0 ? closes.get(closes.size() - 1)
            : tpv.divide(tv, MC).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal[] calculateAroon(List<BigDecimal> highs, List<BigDecimal> lows, int period) {
        if (highs.size() < period + 1) return null;
        List<BigDecimal> hSlice = highs.subList(highs.size() - period - 1, highs.size());
        List<BigDecimal> lSlice = lows.subList(lows.size() - period - 1, lows.size());
        // Find index of highest high and lowest low in the slice (most recent = index period)
        int highIdx = 0, lowIdx = 0;
        for (int i = 1; i <= period; i++) {
            if (hSlice.get(i).compareTo(hSlice.get(highIdx)) > 0) highIdx = i;
            if (lSlice.get(i).compareTo(lSlice.get(lowIdx)) < 0) lowIdx = i;
        }
        // periods since last high/low = (period - highIdx), so Aroon = 100 * highIdx / period
        return new BigDecimal[]{
            BigDecimal.valueOf(100.0 * highIdx / period).setScale(1, RoundingMode.HALF_UP),
            BigDecimal.valueOf(100.0 * lowIdx  / period).setScale(1, RoundingMode.HALF_UP)
        };
    }
}


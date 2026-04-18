package com.axiom.stockdata.model;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;

@Data
@Builder
public class TechnicalIndicators {
    private String ticker;
    private BigDecimal ema9, ema20, ema50, ema200;
    private BigDecimal sma20, sma50, sma200;
    private BigDecimal vwap;
    private BigDecimal rsi14;
    private BigDecimal macdLine, macdSignal, macdHistogram;
    private BigDecimal stochK, stochD;
    private BigDecimal bollingerUpper, bollingerMiddle, bollingerLower, bollingerWidth;
    private Boolean bollingerSqueeze;
    private BigDecimal atr14;
    private String obvTrend;
    private BigDecimal cmf, mfi;
    private BigDecimal adx14;
    private BigDecimal parabolicSar;
    private Boolean sarBullish;
    private BigDecimal aroonUp, aroonDown;
    private BigDecimal ichimokuTenkan, ichimokuKijun;
    private Boolean priceAboveCloud, tenkanKijunBullish;
    private Boolean goldenCross, deathCross;
    private String overallTrend;
}


package com.axiom.stockdata.model;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
public class StockQuote {
    private String ticker;
    private BigDecimal price;
    private BigDecimal open;
    private BigDecimal high;
    private BigDecimal low;
    private BigDecimal previousClose;
    private BigDecimal change;
    private BigDecimal changePercent;
    private Long volume;
    private Long avgVolume;
    private BigDecimal marketCap;
    private BigDecimal week52High;
    private BigDecimal week52Low;
    private Instant timestamp;
}


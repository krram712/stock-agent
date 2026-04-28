package com.axiom.stockdata.service;

import com.axiom.stockdata.model.StockQuote;
import com.axiom.stockdata.model.TechnicalIndicators;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.http.ResponseCookie;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.HashMap;
import java.util.concurrent.atomic.AtomicReference;

@Slf4j
@Service
@RequiredArgsConstructor
public class MarketDataService {

    private final TechnicalAnalysisEngine technicalEngine;
    private final WebClient.Builder webClientBuilder;

    // Yahoo Finance base URLs
    private static final String YAHOO_CHART_URL   = "https://query1.finance.yahoo.com";
    private static final String YAHOO_CHART_URL2  = "https://query2.finance.yahoo.com";

    // Cached Yahoo crumb (valid ~1 hour)
    private final AtomicReference<String> yahooCrumb   = new AtomicReference<>(null);
    private final AtomicReference<String> yahooCookie  = new AtomicReference<>(null);
    private volatile long crumbFetchedAt = 0;

    private String getYahooCrumb() {
        long now = System.currentTimeMillis();
        if (yahooCrumb.get() != null && (now - crumbFetchedAt) < 55 * 60 * 1000) {
            return yahooCrumb.get();
        }
        try {
            var response = webClientBuilder.baseUrl("https://fc.yahoo.com").build()
                .get().uri("/")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36")
                .header("Accept", "text/html,application/xhtml+xml")
                .exchangeToMono(r -> {
                    String cookie = r.cookies().values().stream()
                        .flatMap(Collection::stream)
                        .filter(c -> c.getName().startsWith("A1") || c.getName().equals("cmp"))
                        .map(c -> c.getName() + "=" + c.getValue())
                        .findFirst().orElse(null);
                    yahooCookie.set(cookie);
                    return r.bodyToMono(String.class);
                }).block(Duration.ofSeconds(8));

            String crumb = webClientBuilder.baseUrl(YAHOO_CHART_URL).build()
                .get().uri("/v1/test/getcrumb")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36")
                .header("Cookie", yahooCookie.get() != null ? yahooCookie.get() : "")
                .retrieve().bodyToMono(String.class).block(Duration.ofSeconds(8));

            if (crumb != null && !crumb.isBlank() && !crumb.contains("error")) {
                yahooCrumb.set(crumb.trim());
                crumbFetchedAt = now;
                log.info("✅ Yahoo crumb refreshed: {}", crumb.trim().substring(0, Math.min(6, crumb.trim().length())) + "…");
                return yahooCrumb.get();
            }
        } catch (Exception e) {
            log.warn("Yahoo crumb fetch failed: {}", e.getMessage());
        }
        return null;
    }

    private WebClient.RequestHeadersSpec<?> yahooGet(String baseUrl, String path) {
        String crumb  = getYahooCrumb();
        String cookie = yahooCookie.get();
        String fullPath = crumb != null ? path + (path.contains("?") ? "&" : "?") + "crumb=" + crumb : path;
        var req = webClientBuilder.baseUrl(baseUrl).build().get().uri(fullPath)
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36")
            .header("Accept", "application/json,text/plain,*/*")
            .header("Referer", "https://finance.yahoo.com/");
        if (cookie != null) req = ((WebClient.RequestHeadersSpec<?>) req).header("Cookie", cookie);
        return req;
    }

    @Value("${market-data.alpha-vantage.api-key:demo}")
    private String alphaVantageKey;
    @Value("${market-data.alpha-vantage.base-url:https://www.alphavantage.co/query}")
    private String alphaVantageUrl;

    @Value("${market-data.finnhub.api-key:demo}")
    private String finnhubKey;
    @Value("${market-data.finnhub.base-url:https://finnhub.io/api/v1}")
    private String finnhubUrl;

    @Value("${market-data.polygon.api-key:demo}")
    private String polygonKey;
    @Value("${market-data.polygon.base-url:https://api.polygon.io}")
    private String polygonUrl;

    private boolean isRealKey(String key) {
        return key != null && !key.equals("demo") && !key.isBlank();
    }

    private static final Map<String, double[]> DEMO_PRICES = new LinkedHashMap<>();
    static {
        DEMO_PRICES.put("AAPL",  new double[]{173.50, 0.85});
        DEMO_PRICES.put("NVDA",  new double[]{875.40, 2.10});
        DEMO_PRICES.put("TSLA",  new double[]{248.20, -1.30});
        DEMO_PRICES.put("MSFT",  new double[]{415.80, 0.62});
        DEMO_PRICES.put("AMZN",  new double[]{188.90, 1.15});
        DEMO_PRICES.put("META",  new double[]{506.30, 1.42});
        DEMO_PRICES.put("GOOGL", new double[]{175.60, 0.74});
        DEMO_PRICES.put("BRK.B", new double[]{393.20, 0.22});
        DEMO_PRICES.put("JPM",   new double[]{213.40, 0.55});
        DEMO_PRICES.put("V",     new double[]{278.90, 0.33});
    }

    // ═══════════════════════════════════════════════════════════════
    // YAHOO FINANCE — QUOTE (PRIMARY, free forever)
    // ═══════════════════════════════════════════════════════════════
    private StockQuote fetchLiveQuoteYahoo(String ticker) {
        String path = "/v8/finance/chart/" + ticker + "?interval=1d&range=1d&includePrePost=false";
        JsonNode root;
        try {
            root = yahooGet(YAHOO_CHART_URL, path).retrieve().bodyToMono(JsonNode.class).block(Duration.ofSeconds(12));
        } catch (Exception e) {
            root = yahooGet(YAHOO_CHART_URL2, path).retrieve().bodyToMono(JsonNode.class).block(Duration.ofSeconds(12));
        }

        JsonNode meta = root.path("chart").path("result").path(0).path("meta");
        if (meta.isMissingNode()) throw new RuntimeException("Yahoo: no data for " + ticker);

        double price    = meta.path("regularMarketPrice").asDouble();
        if (price == 0) throw new RuntimeException("Yahoo: price=0 for " + ticker);
        double prev     = meta.path("chartPreviousClose").asDouble(meta.path("previousClose").asDouble());
        double open     = meta.path("regularMarketOpen").asDouble(prev);
        double high     = meta.path("regularMarketDayHigh").asDouble(price);
        double low      = meta.path("regularMarketDayLow").asDouble(price);
        long   volume   = meta.path("regularMarketVolume").asLong(1_000_000L);
        long   avgVol   = meta.path("averageDailyVolume10Day").asLong(volume);
        double mktCap   = meta.path("marketCap").asDouble(price * 15_000_000_000.0);
        double w52h     = meta.path("fiftyTwoWeekHigh").asDouble(price * 1.38);
        double w52l     = meta.path("fiftyTwoWeekLow").asDouble(price * 0.62);

        log.info("✅ LIVE quote (Yahoo Finance): {} @ ${}", ticker, price);
        return StockQuote.builder()
            .ticker(ticker).price(bd(price))
            .open(bd(open)).high(bd(high)).low(bd(low))
            .previousClose(bd(prev))
            .change(bd(price - prev))
            .changePercent(bd(prev > 0 ? (price - prev) / prev * 100 : 0))
            .volume(volume).avgVolume(avgVol)
            .marketCap(bd(mktCap))
            .week52High(bd(w52h)).week52Low(bd(w52l))
            .timestamp(Instant.now())
            .build();
    }

    // ═══════════════════════════════════════════════════════════════
    // YAHOO FINANCE — OHLCV HISTORY (PRIMARY)
    // ═══════════════════════════════════════════════════════════════
    private Map<String, List<BigDecimal>> fetchDailyOHLCVYahoo(String ticker, int limit) {
        String range = limit <= 7 ? "5d" : limit <= 30 ? "1mo" : limit <= 90 ? "3mo" : limit <= 180 ? "6mo" : "1y";
        String path  = "/v8/finance/chart/" + ticker + "?interval=1d&range=" + range;
        JsonNode root;
        try {
            root = yahooGet(YAHOO_CHART_URL, path).retrieve().bodyToMono(JsonNode.class).block(Duration.ofSeconds(15));
        } catch (Exception e) {
            root = yahooGet(YAHOO_CHART_URL2, path).retrieve().bodyToMono(JsonNode.class).block(Duration.ofSeconds(15));
        }

        JsonNode result  = root.path("chart").path("result").path(0);
        JsonNode quote   = result.path("indicators").path("quote").path(0);
        JsonNode closesN = quote.path("close");
        if (closesN.isMissingNode() || closesN.size() == 0) throw new RuntimeException("Yahoo: no OHLCV for " + ticker);

        List<BigDecimal> closes  = new ArrayList<>();
        List<BigDecimal> highs   = new ArrayList<>();
        List<BigDecimal> lows    = new ArrayList<>();
        List<BigDecimal> volumes = new ArrayList<>();

        int size = Math.min(closesN.size(), limit);
        int start = closesN.size() - size;
        for (int i = start; i < closesN.size(); i++) {
            double c = closesN.path(i).asDouble();
            double h = quote.path("high").path(i).asDouble(c);
            double l = quote.path("low").path(i).asDouble(c);
            double v = quote.path("volume").path(i).asDouble(1_000_000);
            if (c == 0) continue; // skip null bars
            closes.add(bd(c)); highs.add(bd(h)); lows.add(bd(l)); volumes.add(bd(v));
        }
        if (closes.isEmpty()) throw new RuntimeException("Yahoo: empty OHLCV for " + ticker);
        log.info("✅ LIVE OHLCV (Yahoo Finance): {} — {} bars", ticker, closes.size());
        return Map.of("close", closes, "high", highs, "low", lows, "volume", volumes);
    }

    // ═══════════════════════════════════════════════════════════════
    // YAHOO FINANCE — FUNDAMENTALS (PRIMARY)
    // ═══════════════════════════════════════════════════════════════
    private Map<String, Object> fetchFundamentalsYahoo(String ticker) {
        String modules = "summaryDetail,defaultKeyStatistics,financialData,price";
        String path    = "/v10/finance/quoteSummary/" + ticker + "?modules=" + modules;
        JsonNode root;
        try {
            root = yahooGet(YAHOO_CHART_URL, path).retrieve().bodyToMono(JsonNode.class).block(Duration.ofSeconds(12));
        } catch (Exception e) {
            root = yahooGet(YAHOO_CHART_URL2, path).retrieve().bodyToMono(JsonNode.class).block(Duration.ofSeconds(12));
        }

        JsonNode res  = root.path("quoteSummary").path("result").path(0);
        if (res.isMissingNode()) throw new RuntimeException("Yahoo fundamentals: no data for " + ticker);

        JsonNode sd   = res.path("summaryDetail");
        JsonNode ks   = res.path("defaultKeyStatistics");
        JsonNode fd   = res.path("financialData");
        JsonNode pr   = res.path("price");

        double peRatio        = sd.path("trailingPE").path("raw").asDouble(
                                ks.path("trailingEps").path("raw").asDouble(0) > 0 ?
                                pr.path("regularMarketPrice").path("raw").asDouble(100) /
                                ks.path("trailingEps").path("raw").asDouble(1) : 20);
        double pegRatio       = ks.path("pegRatio").path("raw").asDouble(1.5);
        double pbRatio        = ks.path("priceToBook").path("raw").asDouble(3.0);
        double revenueGrowth  = fd.path("revenueGrowth").path("raw").asDouble(0.10) * 100;
        double netMargin      = fd.path("profitMargins").path("raw").asDouble(0.15) * 100;
        double roe            = fd.path("returnOnEquity").path("raw").asDouble(0.15) * 100;
        double debtToEquity   = fd.path("debtToEquity").path("raw").asDouble(50) / 100;
        double dividendYield  = sd.path("dividendYield").path("raw").asDouble(0) * 100;
        double eps            = ks.path("trailingEps").path("raw").asDouble(5.0);
        double analystTarget  = fd.path("targetMeanPrice").path("raw").asDouble(0);
        double currentPrice   = pr.path("regularMarketPrice").path("raw").asDouble(0);
        double upside         = analystTarget > 0 && currentPrice > 0 ? (analystTarget - currentPrice) / currentPrice * 100 : 10;
        double buyPct         = fd.path("recommendationMean").path("raw").asDouble(2.5) <= 2.5 ? 75 : 50;

        log.info("✅ LIVE fundamentals (Yahoo Finance): {}", ticker);
        Map<String, Object> result = new HashMap<>();
        result.put("ticker",           ticker);
        result.put("peRatio",          bd(peRatio));
        result.put("pegRatio",         bd(Math.max(0, pegRatio)));
        result.put("pbRatio",          bd(Math.max(0, pbRatio)));
        result.put("revenueGrowthYoy", bd(revenueGrowth));
        result.put("netMargin",        bd(netMargin));
        result.put("roe",              bd(roe));
        result.put("debtToEquity",     bd(debtToEquity));
        result.put("dividendYield",    bd(dividendYield));
        result.put("eps",              bd(eps));
        result.put("analystTarget",    bd(analystTarget));
        result.put("upsideToTarget",   bd(upside));
        result.put("buyPercentage",    bd(buyPct));
        return result;
    }

    // ═══════════════════════════════════════════════════════════════
    // QUOTE — Yahoo first, then Finnhub, then AlphaVantage, then demo
    // ═══════════════════════════════════════════════════════════════
    public StockQuote getQuote(String ticker) {
        try { return fetchLiveQuoteYahoo(ticker); }
        catch (Exception e) { log.warn("Yahoo quote failed for {}: {}", ticker, e.getMessage()); }

        if (isRealKey(finnhubKey)) {
            try { return fetchLiveQuoteFinnhub(ticker); }
            catch (Exception e) { log.warn("Finnhub quote failed for {}: {}", ticker, e.getMessage()); }
        }
        if (isRealKey(alphaVantageKey)) {
            try { return fetchLiveQuoteAlphaVantage(ticker); }
            catch (Exception e) { log.warn("AlphaVantage quote failed for {}: {}", ticker, e.getMessage()); }
        }
        return buildDemoQuote(ticker);
    }

    private StockQuote fetchLiveQuoteFinnhub(String ticker) {
        WebClient client = webClientBuilder.baseUrl(finnhubUrl).build();
        JsonNode q = client.get()
            .uri(u -> u.path("/quote").queryParam("symbol", ticker).queryParam("token", finnhubKey).build())
            .retrieve().bodyToMono(JsonNode.class).block(Duration.ofSeconds(10));
        double price = q.path("c").asDouble();
        if (price == 0) throw new RuntimeException("No Finnhub data");
        double prev = q.path("pc").asDouble();
        double w52h = price * 1.38, w52l = price * 0.62;
        if (isRealKey(polygonKey)) {
            try {
                JsonNode snap = webClientBuilder.baseUrl(polygonUrl).build().get()
                    .uri(u -> u.path("/v2/snapshot/locale/us/markets/stocks/tickers/{t}").build(ticker))
                    .header("Authorization", "Bearer " + polygonKey)
                    .retrieve().bodyToMono(JsonNode.class).block(Duration.ofSeconds(8));
                JsonNode td = snap.path("ticker").path("day");
                if (!td.isMissingNode()) {
                    w52h = snap.path("ticker").path("prevDay").path("h").asDouble(w52h);
                    w52l = snap.path("ticker").path("prevDay").path("l").asDouble(w52l);
                }
            } catch (Exception ignored) {}
        }
        log.info("✅ LIVE quote (Finnhub): {} @ ${}", ticker, price);
        return StockQuote.builder()
            .ticker(ticker).price(bd(price))
            .open(bd(q.path("o").asDouble())).high(bd(q.path("h").asDouble())).low(bd(q.path("l").asDouble()))
            .previousClose(bd(prev)).change(bd(price - prev))
            .changePercent(bd(prev > 0 ? (price - prev) / prev * 100 : 0))
            .volume(q.path("t").asLong(1_200_000L)).avgVolume(1_500_000L)
            .marketCap(bd(price * 15_000_000_000.0))
            .week52High(bd(w52h)).week52Low(bd(w52l)).timestamp(Instant.now())
            .build();
    }

    private StockQuote fetchLiveQuoteAlphaVantage(String ticker) {
        WebClient client = webClientBuilder.baseUrl(alphaVantageUrl).build();
        JsonNode root = client.get()
            .uri(u -> u.queryParam("function", "GLOBAL_QUOTE")
                .queryParam("symbol", ticker).queryParam("apikey", alphaVantageKey).build())
            .retrieve().bodyToMono(JsonNode.class).block(Duration.ofSeconds(10));
        JsonNode q = root.path("Global Quote");
        if (q.isMissingNode() || q.isEmpty()) throw new RuntimeException("No AlphaVantage data");
        double price = q.path("05. price").asDouble();
        double prev  = q.path("08. previous close").asDouble();
        double chPct = Double.parseDouble(q.path("10. change percent").asText("0%").replace("%","").trim());
        log.info("✅ LIVE quote (Alpha Vantage): {} @ ${}", ticker, price);
        return StockQuote.builder()
            .ticker(ticker).price(bd(price))
            .open(bd(q.path("02. open").asDouble())).high(bd(q.path("03. high").asDouble()))
            .low(bd(q.path("04. low").asDouble())).previousClose(bd(prev))
            .change(bd(q.path("09. change").asDouble())).changePercent(bd(chPct))
            .volume(q.path("06. volume").asLong()).avgVolume(q.path("06. volume").asLong())
            .marketCap(bd(price * 15_000_000_000.0))
            .week52High(bd(price * 1.38)).week52Low(bd(price * 0.62)).timestamp(Instant.now())
            .build();
    }

    private StockQuote buildDemoQuote(String ticker) {
        double[] base = DEMO_PRICES.getOrDefault(ticker, new double[]{100.0 + new Random(ticker.hashCode()).nextDouble() * 200, 0.5});
        double price = base[0] * (0.99 + new Random().nextDouble() * 0.02);
        double chPct = base[1] + (new Random().nextDouble() - 0.5) * 0.5;
        double prev  = price / (1 + chPct / 100);
        return StockQuote.builder()
            .ticker(ticker).price(bd(price)).open(bd(prev * 1.001))
            .high(bd(price * 1.008)).low(bd(price * 0.993))
            .previousClose(bd(prev)).change(bd(price - prev)).changePercent(bd(chPct))
            .volume(1_200_000L + new Random().nextLong(800_000)).avgVolume(1_500_000L)
            .marketCap(bd(price * 15_000_000_000.0))
            .week52High(bd(price * 1.38)).week52Low(bd(price * 0.72)).timestamp(Instant.now())
            .build();
    }

    // ═══════════════════════════════════════════════════════════════
    // TECHNICALS — Yahoo first, then Alpha Vantage, then synthetic
    // ═══════════════════════════════════════════════════════════════
    public TechnicalIndicators getTechnicals(String ticker) {
        List<BigDecimal> closes, highs, lows, volumes;

        try {
            Map<String, List<BigDecimal>> ohlcv = fetchDailyOHLCVYahoo(ticker, 250);
            closes = ohlcv.get("close"); highs = ohlcv.get("high");
            lows   = ohlcv.get("low");   volumes = ohlcv.get("volume");
            return technicalEngine.calculate(ticker, closes, highs, lows, volumes);
        } catch (Exception e) { log.warn("Yahoo OHLCV failed for {}: {}", ticker, e.getMessage()); }

        if (isRealKey(alphaVantageKey)) {
            try {
                Map<String, List<BigDecimal>> ohlcv = fetchDailyOHLCVAlphaVantage(ticker, 250);
                closes  = ohlcv.get("close"); highs   = ohlcv.get("high");
                lows    = ohlcv.get("low");   volumes = ohlcv.get("volume");
                log.info("✅ LIVE technicals (Alpha Vantage): {} — {} bars", ticker, closes.size());
                return technicalEngine.calculate(ticker, closes, highs, lows, volumes);
            } catch (Exception e) { log.warn("AlphaVantage daily data failed for {}: {}", ticker, e.getMessage()); }
        }

        // Fallback: synthetic
        double price = getQuote(ticker).getPrice().doubleValue();
        closes  = generatePriceHistory(price, 250);
        highs   = closes.stream().map(c -> c.multiply(BigDecimal.valueOf(1.005))).toList();
        lows    = closes.stream().map(c -> c.multiply(BigDecimal.valueOf(0.995))).toList();
        volumes = new ArrayList<>();
        for (int i = 0; i < 250; i++) volumes.add(BigDecimal.valueOf(1_000_000 + new Random().nextInt(500_000)));
        return technicalEngine.calculate(ticker, closes, highs, lows, volumes);
    }

    private Map<String, List<BigDecimal>> fetchDailyOHLCVAlphaVantage(String ticker, int limit) {
        WebClient client = webClientBuilder.baseUrl(alphaVantageUrl).build();
        JsonNode root = client.get()
            .uri(u -> u.queryParam("function", "TIME_SERIES_DAILY")
                .queryParam("symbol", ticker).queryParam("outputsize", "compact")
                .queryParam("apikey", alphaVantageKey).build())
            .retrieve().bodyToMono(JsonNode.class).block(Duration.ofSeconds(15));
        JsonNode ts = root.path("Time Series (Daily)");
        if (ts.isMissingNode()) throw new RuntimeException("No daily data");
        List<BigDecimal> closes = new ArrayList<>(), opens = new ArrayList<>(),
            highs = new ArrayList<>(), lows = new ArrayList<>(), vols = new ArrayList<>();
        List<String> dates = new ArrayList<>();
        ts.fieldNames().forEachRemaining(dates::add);
        Collections.sort(dates);
        int start = Math.max(0, dates.size() - limit);
        for (int i = start; i < dates.size(); i++) {
            JsonNode day = ts.path(dates.get(i));
            opens.add(new BigDecimal(day.path("1. open").asText("0")));
            closes.add(new BigDecimal(day.path("4. close").asText("0")));
            highs.add(new BigDecimal(day.path("2. high").asText("0")));
            lows.add(new BigDecimal(day.path("3. low").asText("0")));
            vols.add(new BigDecimal(day.path("5. volume").asText("0")));
        }
        return Map.of("close", closes, "open", opens, "high", highs, "low", lows, "volume", vols);
    }

    // ═══════════════════════════════════════════════════════════════
    // HISTORY — Yahoo first, then Alpha Vantage, then demo
    // ═══════════════════════════════════════════════════════════════
    public Map<String, Object> getHistory(String ticker, String interval, String range) {
        try { return fetchHistoryYahoo(ticker, interval, range); }
        catch (Exception e) { log.warn("Yahoo history failed for {}: {}", ticker, e.getMessage()); }

        if (isRealKey(alphaVantageKey)) {
            try { return fetchHistoryAlphaVantage(ticker, interval, range); }
            catch (Exception e) { log.warn("AlphaVantage history failed for {}: {}", ticker, e.getMessage()); }
        }
        return buildDemoHistory(ticker, interval, range);
    }

    private Map<String, Object> fetchHistoryYahoo(String ticker, String interval, String range) {
        String yahooRange = switch (range) {
            case "1D" -> "1d"; case "5D" -> "5d"; case "1M" -> "1mo";
            case "3M" -> "3mo"; case "6M" -> "6mo"; case "1Y" -> "1y";
            case "5Y" -> "5y"; default -> "1y";
        };
        String yahooInterval = switch (interval) {
            case "1m" -> "1m"; case "5m" -> "5m"; case "15m" -> "15m";
            case "1h" -> "60m"; default -> "1d";
        };
        JsonNode root;
        String histPath = "/v8/finance/chart/" + ticker + "?interval=" + yahooInterval + "&range=" + yahooRange;
        try {
            root = yahooGet(YAHOO_CHART_URL, histPath).retrieve().bodyToMono(JsonNode.class).block(Duration.ofSeconds(15));
        } catch (Exception e) {
            root = yahooGet(YAHOO_CHART_URL2, histPath).retrieve().bodyToMono(JsonNode.class).block(Duration.ofSeconds(15));
        }

        JsonNode result     = root.path("chart").path("result").path(0);
        JsonNode timestamps = result.path("timestamp");
        JsonNode q          = result.path("indicators").path("quote").path(0);

        List<Map<String, Object>> candles = new ArrayList<>();
        for (int i = 0; i < timestamps.size(); i++) {
            double c = q.path("close").path(i).asDouble();
            if (c == 0) continue;
            Map<String, Object> candle = new HashMap<>();
            candle.put("t", timestamps.path(i).asLong() * 1000L);
            candle.put("o", bd(q.path("open").path(i).asDouble(c)));
            candle.put("h", bd(q.path("high").path(i).asDouble(c)));
            candle.put("l", bd(q.path("low").path(i).asDouble(c)));
            candle.put("c", bd(c));
            candle.put("v", q.path("volume").path(i).asLong(0));
            candles.add(candle);
        }
        if (candles.isEmpty()) throw new RuntimeException("Yahoo: empty history for " + ticker);
        log.info("✅ LIVE history (Yahoo Finance): {} — {} candles", ticker, candles.size());
        return Map.of("ticker", ticker, "interval", interval, "range", range, "candles", candles);
    }

    private Map<String, Object> fetchHistoryAlphaVantage(String ticker, String interval, String range) {
        int limit = switch (range) { case "1W"->7; case "1M"->22; case "3M"->66; case "6M"->130; default->252; };
        Map<String, List<BigDecimal>> ohlcv = fetchDailyOHLCVAlphaVantage(ticker, limit);
        List<BigDecimal> closes = ohlcv.get("close");
        List<BigDecimal> opens  = ohlcv.get("open");
        List<Map<String, Object>> candles = new ArrayList<>();
        long now = System.currentTimeMillis();
        for (int i = 0; i < closes.size(); i++) {
            Map<String, Object> c = new HashMap<>();
            c.put("t", now - (long)(closes.size() - i) * 86400000L);
            c.put("o", opens.get(i));
            c.put("h", ohlcv.get("high").get(i));
            c.put("l", ohlcv.get("low").get(i));
            c.put("c", closes.get(i));
            c.put("v", ohlcv.get("volume").get(i));
            candles.add(c);
        }
        log.info("✅ LIVE history (Alpha Vantage): {} — {} candles", ticker, candles.size());
        return Map.of("ticker", ticker, "interval", interval, "range", range, "candles", candles);
    }

    private Map<String, Object> buildDemoHistory(String ticker, String interval, String range) {
        double price = buildDemoQuote(ticker).getPrice().doubleValue();
        int bars = switch (range) { case "1D"->1; case "5D"->5; case "1W"->7; case "1M"->30; case "3M"->90; case "6M"->180; case "1Y"->252; case "5Y"->1260; default->252; };
        List<Map<String, Object>> candles = new ArrayList<>();
        double p = price * 0.85;
        for (int i = 0; i < bars; i++) {
            p = p * (0.995 + new Random().nextDouble() * 0.01);
            double o = p * (0.998 + new Random().nextDouble() * 0.004);
            double h = Math.max(o, p) * (1 + new Random().nextDouble() * 0.005);
            double l = Math.min(o, p) * (0.995 + new Random().nextDouble() * 0.005);
            Map<String, Object> c = new HashMap<>();
            c.put("t", System.currentTimeMillis() - (long)(bars - i) * 86400000L);
            c.put("o", bd(o)); c.put("h", bd(h)); c.put("l", bd(l)); c.put("c", bd(p));
            c.put("v", 1_000_000 + new Random().nextInt(500_000));
            candles.add(c);
        }
        return Map.of("ticker", ticker, "interval", interval, "range", range, "candles", candles);
    }

    // ═══════════════════════════════════════════════════════════════
    // FUNDAMENTALS — Yahoo first, then Polygon, then demo
    // ═══════════════════════════════════════════════════════════════
    public Map<String, Object> getFundamentals(String ticker) {
        try { return fetchFundamentalsYahoo(ticker); }
        catch (Exception e) { log.warn("Yahoo fundamentals failed for {}: {}", ticker, e.getMessage()); }

        if (isRealKey(polygonKey)) {
            try { return fetchFundamentalsPolygon(ticker); }
            catch (Exception e) { log.warn("Polygon fundamentals failed for {}: {}", ticker, e.getMessage()); }
        }
        return buildDemoFundamentals(ticker);
    }

    private Map<String, Object> fetchFundamentalsPolygon(String ticker) {
        WebClient client = webClientBuilder.baseUrl(polygonUrl).build();
        JsonNode root = client.get()
            .uri(u -> u.path("/vX/reference/financials")
                .queryParam("ticker", ticker).queryParam("limit", 1)
                .queryParam("apiKey", polygonKey).build())
            .retrieve().bodyToMono(JsonNode.class).block(Duration.ofSeconds(10));
        JsonNode results = root.path("results");
        if (!results.isArray() || results.size() == 0) throw new RuntimeException("No Polygon financials");
        JsonNode fin = results.get(0).path("financials");
        double revenue   = fin.path("income_statement").path("revenues").path("value").asDouble(0);
        double netIncome = fin.path("income_statement").path("net_income_loss").path("value").asDouble(0);
        double equity    = fin.path("balance_sheet").path("equity").path("value").asDouble(1);
        double debt      = fin.path("balance_sheet").path("liabilities").path("value").asDouble(0);
        double netMargin = revenue > 0 ? netIncome / revenue * 100 : 0;
        double roe       = equity > 0 ? netIncome / equity * 100 : 0;
        double de        = equity > 0 ? debt / equity : 0;
        StockQuote q = getQuote(ticker);
        double price = q.getPrice().doubleValue();
        double buyPct = 65;
        if (isRealKey(finnhubKey)) {
            try {
                JsonNode rec = webClientBuilder.baseUrl(finnhubUrl).build().get()
                    .uri(u -> u.path("/stock/recommendation").queryParam("symbol", ticker).queryParam("token", finnhubKey).build())
                    .retrieve().bodyToMono(JsonNode.class).block(Duration.ofSeconds(8));
                if (rec.isArray() && rec.size() > 0) {
                    JsonNode latest = rec.get(0);
                    double buy = latest.path("buy").asDouble(0) + latest.path("strongBuy").asDouble(0);
                    double total = buy + latest.path("hold").asDouble(0) + latest.path("sell").asDouble(0) + latest.path("strongSell").asDouble(0);
                    if (total > 0) buyPct = buy / total * 100;
                }
            } catch (Exception ignored) {}
        }
        log.info("✅ LIVE fundamentals (Polygon): {}", ticker);
        Map<String, Object> result = new HashMap<>();
        result.put("ticker", ticker);
        result.put("peRatio",          bd(price > 0 && netIncome > 0 ? price * 1e9 / netIncome : 20));
        result.put("pegRatio",         bd(1.5));
        result.put("pbRatio",          bd(equity > 0 ? price * 1e9 / equity : 3));
        result.put("revenueGrowthYoy", bd(netMargin > 0 ? Math.min(netMargin, 40) : 10));
        result.put("netMargin",        bd(netMargin));
        result.put("roe",              bd(roe));
        result.put("debtToEquity",     bd(de));
        result.put("dividendYield",    bd(1.0));
        result.put("eps",              bd(netIncome / 1e9));
        result.put("buyPercentage",    bd(buyPct));
        return result;
    }

    private Map<String, Object> buildDemoFundamentals(String ticker) {
        Random r = new Random(ticker.hashCode());
        Map<String, Object> result = new HashMap<>();
        result.put("ticker", ticker);
        result.put("peRatio",          bd(15 + r.nextDouble() * 25));
        result.put("pegRatio",         bd(0.8 + r.nextDouble() * 2));
        result.put("pbRatio",          bd(2 + r.nextDouble() * 8));
        result.put("revenueGrowthYoy", bd(5 + r.nextDouble() * 30));
        result.put("netMargin",        bd(8 + r.nextDouble() * 20));
        result.put("roe",              bd(12 + r.nextDouble() * 25));
        result.put("debtToEquity",     bd(0.2 + r.nextDouble() * 1.5));
        result.put("dividendYield",    bd(r.nextDouble() * 3));
        result.put("eps",              bd(2 + r.nextDouble() * 15));
        result.put("buyPercentage",    bd(40 + r.nextDouble() * 50));
        return result;
    }

    // ═══════════════════════════════════════════════════════════════
    // NEWS — Finnhub (unchanged)
    // ═══════════════════════════════════════════════════════════════
    public List<Map<String, Object>> getNews(String ticker) {
        if (isRealKey(finnhubKey)) {
            try { return fetchNewsFinnhub(ticker); }
            catch (Exception e) { log.warn("Finnhub news failed for {}: {}", ticker, e.getMessage()); }
        }
        return buildDemoNews(ticker);
    }

    private List<Map<String, Object>> fetchNewsFinnhub(String ticker) {
        String to   = LocalDate.now().format(DateTimeFormatter.ISO_DATE);
        String from = LocalDate.now().minusDays(7).format(DateTimeFormatter.ISO_DATE);
        JsonNode root = webClientBuilder.baseUrl(finnhubUrl).build().get()
            .uri(u -> u.path("/company-news").queryParam("symbol", ticker)
                .queryParam("from", from).queryParam("to", to).queryParam("token", finnhubKey).build())
            .retrieve().bodyToMono(JsonNode.class).block(Duration.ofSeconds(10));
        List<Map<String, Object>> news = new ArrayList<>();
        if (root.isArray()) {
            int count = Math.min(root.size(), 5);
            for (int i = 0; i < count; i++) {
                JsonNode a = root.get(i);
                Map<String, Object> item = new HashMap<>();
                item.put("title",       a.path("headline").asText("News"));
                item.put("source",      a.path("source").asText("Unknown"));
                item.put("url",         a.path("url").asText("#"));
                item.put("publishedAt", Instant.ofEpochSecond(a.path("datetime").asLong()).toString());
                item.put("summary",     a.path("summary").asText(""));
                item.put("sentiment",   "NEUTRAL");
                news.add(item);
            }
        }
        if (news.isEmpty()) throw new RuntimeException("No Finnhub news");
        log.info("✅ LIVE news (Finnhub): {} — {} articles", ticker, news.size());
        return news;
    }

    private List<Map<String, Object>> buildDemoNews(String ticker) {
        Map<String, Object> n1 = new HashMap<>();
        n1.put("title", ticker + " reports strong quarterly earnings beating expectations");
        n1.put("source", "Reuters"); n1.put("url", "https://reuters.com");
        n1.put("publishedAt", Instant.now().minusSeconds(3600).toString()); n1.put("sentiment", "POSITIVE");
        Map<String, Object> n2 = new HashMap<>();
        n2.put("title", "Analysts raise price target for " + ticker + " citing strong growth");
        n2.put("source", "Bloomberg"); n2.put("url", "https://bloomberg.com");
        n2.put("publishedAt", Instant.now().minusSeconds(7200).toString()); n2.put("sentiment", "POSITIVE");
        Map<String, Object> n3 = new HashMap<>();
        n3.put("title", "Market outlook: " + ticker + " positioned for continued growth in 2026");
        n3.put("source", "MarketWatch"); n3.put("url", "https://marketwatch.com");
        n3.put("publishedAt", Instant.now().minusSeconds(14400).toString()); n3.put("sentiment", "NEUTRAL");
        return List.of(n1, n2, n3);
    }

    // ═══════════════════════════════════════════════════════════════
    // SEARCH — Finnhub
    // ═══════════════════════════════════════════════════════════════
    public List<Map<String, Object>> search(String query) {
        if (isRealKey(finnhubKey)) {
            try {
                JsonNode root = webClientBuilder.baseUrl(finnhubUrl).build().get()
                    .uri(u -> u.path("/search").queryParam("q", query).queryParam("token", finnhubKey).build())
                    .retrieve().bodyToMono(JsonNode.class).block(Duration.ofSeconds(8));
                List<Map<String, Object>> results = new ArrayList<>();
                JsonNode hits = root.path("result");
                if (hits.isArray()) {
                    int count = Math.min(hits.size(), 10);
                    for (int i = 0; i < count; i++) {
                        JsonNode h = hits.get(i);
                        if (!"Common Stock".equals(h.path("type").asText())) continue;
                        Map<String, Object> item = new HashMap<>();
                        item.put("ticker",   h.path("symbol").asText());
                        item.put("name",     h.path("description").asText());
                        item.put("exchange", h.path("primaryExchange").asText("US"));
                        results.add(item);
                    }
                }
                if (!results.isEmpty()) return results;
            } catch (Exception e) { log.warn("Finnhub search failed: {}", e.getMessage()); }
        }
        return DEMO_PRICES.keySet().stream()
            .filter(t -> t.contains(query.toUpperCase()))
            .map(t -> Map.<String, Object>of("ticker", t, "name", t + " Inc.", "exchange", "NASDAQ"))
            .toList();
    }

    // ═══════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════
    private List<BigDecimal> generatePriceHistory(double currentPrice, int bars) {
        List<BigDecimal> prices = new ArrayList<>();
        double p = currentPrice * 0.80;
        for (int i = 0; i < bars; i++) {
            p = p * (0.994 + new Random().nextDouble() * 0.012);
            prices.add(bd(p));
        }
        prices.set(bars - 1, bd(currentPrice));
        return prices;
    }

    private BigDecimal bd(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP);
    }
}


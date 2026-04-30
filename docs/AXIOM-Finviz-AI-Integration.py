#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════╗
║  AXIOM FINVIZ + FREE AI INTEGRATION ENGINE                              ║
║  Combines: Finviz (90+ metrics) + Groq (LLaMA 70B) + Alpha Vantage     ║
║            + VADER Sentiment + FinBERT + Gemini (free) + News NLP      ║
║  Run: pip install finviz groq vaderSentiment transformers requests      ║
╚══════════════════════════════════════════════════════════════════════════╝
"""

import os, json, time, datetime
from typing import Optional

# ── Required: pip install these ──────────────────────────────────────────────
# pip install finviz groq vaderSentiment requests pandas --break-system-packages

# ══════════════════════════════════════════════════════════════════════════════
# CONFIG — Add your FREE API keys here
# ══════════════════════════════════════════════════════════════════════════════
GROQ_API_KEY        = os.getenv("GROQ_API_KEY", "YOUR_GROQ_KEY")        # console.groq.com (FREE, 14,400/day)
ALPHA_VANTAGE_KEY   = os.getenv("ALPHA_VANTAGE_KEY", "demo")            # alphavantage.co  (FREE, 25/day)
GEMINI_API_KEY      = os.getenv("GEMINI_API_KEY", "YOUR_GEMINI_KEY")    # ai.google.dev    (FREE, 100/day)
FINNHUB_API_KEY     = os.getenv("FINNHUB_API_KEY", "YOUR_FINNHUB_KEY")  # finnhub.io       (FREE, 60/min)

# ══════════════════════════════════════════════════════════════════════════════
# STEP 1: FINVIZ DATA FETCHER
# Pulls 90+ metrics: price, fundamentals, technicals, analyst ratings, insider
# ══════════════════════════════════════════════════════════════════════════════
class FinvizDataFetcher:
    """
    Uses the unofficial finviz Python library (pip install finviz)
    Data is delayed 15-20 min — use for analysis, NOT live trading
    """

    def get_stock_data(self, ticker: str) -> dict:
        """Get 90+ metrics for a ticker from Finviz"""
        try:
            import finviz
            data = finviz.get_stock(ticker.upper())
            return {
                "ticker":        data.get("Ticker", ticker),
                "company":       data.get("Company", ""),
                "sector":        data.get("Sector", ""),
                "industry":      data.get("Industry", ""),
                "country":       data.get("Country", ""),
                # Price
                "price":         float(data.get("Price", 0) or 0),
                "change_pct":    data.get("Change", "0%"),
                "volume":        data.get("Volume", ""),
                "avg_volume":    data.get("Avg Volume", ""),
                "market_cap":    data.get("Market Cap", ""),
                "52w_high":      data.get("52W High", ""),
                "52w_low":       data.get("52W Low", ""),
                # Valuation
                "pe":            data.get("P/E", ""),
                "forward_pe":    data.get("Forward P/E", ""),
                "peg":           data.get("PEG", ""),
                "ps":            data.get("P/S", ""),
                "pb":            data.get("P/B", ""),
                "ev_ebitda":     data.get("EV/EBITDA", ""),
                # Fundamentals
                "eps_ttm":       data.get("EPS (ttm)", ""),
                "eps_growth_yoy":data.get("EPS this Y", ""),
                "eps_growth_qoq":data.get("EPS Q/Q", ""),
                "sales_growth":  data.get("Sales Q/Q", ""),
                "revenue":       data.get("Revenue", ""),
                "gross_margin":  data.get("Gross Margin", ""),
                "oper_margin":   data.get("Oper. Margin", ""),
                "profit_margin": data.get("Profit Margin", ""),
                "roe":           data.get("ROE", ""),
                "roa":           data.get("ROA", ""),
                "roi":           data.get("ROI", ""),
                "debt_equity":   data.get("Debt/Eq", ""),
                "current_ratio": data.get("Current Ratio", ""),
                "quick_ratio":   data.get("Quick Ratio", ""),
                # Dividends
                "dividend_yield":data.get("Dividend %", ""),
                "payout_ratio":  data.get("Payout Ratio", ""),
                # Technical indicators (Finviz computed)
                "rsi":           data.get("RSI (14)", ""),
                "sma20":         data.get("SMA20", ""),
                "sma50":         data.get("SMA50", ""),
                "sma200":        data.get("SMA200", ""),
                "atr":           data.get("ATR (14)", ""),
                "beta":          data.get("Beta", ""),
                "volatility_w":  data.get("Volatility W", ""),
                "volatility_m":  data.get("Volatility M", ""),
                # Analyst
                "analyst_recom": data.get("Recom", ""),
                "target_price":  data.get("Target Price", ""),
                "analyst_count": data.get("#Analyst", ""),
                # Short interest
                "short_float":   data.get("Short Float", ""),
                "short_ratio":   data.get("Short Ratio", ""),
                # Insider / institutional
                "insider_own":   data.get("Insider Own", ""),
                "insider_trans": data.get("Insider Trans", ""),
                "inst_own":      data.get("Inst Own", ""),
                "inst_trans":    data.get("Inst Trans", ""),
                # Earnings
                "earnings_date": data.get("Earnings", ""),
                "optionable":    data.get("Optionable", ""),
                "shortable":     data.get("Shortable", ""),
            }
        except Exception as e:
            print(f"[Finviz] Error fetching {ticker}: {e}")
            return {"ticker": ticker, "error": str(e)}

    def get_news(self, ticker: str) -> list:
        """Get latest news headlines from Finviz"""
        try:
            import finviz
            news = finviz.get_news(ticker.upper())
            return [{"time": n[0], "headline": n[1], "url": n[2], "source": n[3]}
                    for n in news[:10]]
        except Exception as e:
            print(f"[Finviz News] Error: {e}")
            return []

    def get_analyst_targets(self, ticker: str) -> list:
        """Get analyst price targets and rating changes"""
        try:
            import finviz
            targets = finviz.get_analyst_price_targets(ticker.upper(), last_ratings=10)
            return targets
        except Exception as e:
            print(f"[Finviz Analysts] Error: {e}")
            return []

    def get_insiders(self, ticker: str) -> list:
        """Get recent insider transactions"""
        try:
            import finviz
            insiders = finviz.get_insider(ticker.upper())
            return insiders[:5]
        except Exception as e:
            print(f"[Finviz Insiders] Error: {e}")
            return []

    def screen_bullish(self, extra_filters: list = None) -> list:
        """Screen for high-probability bullish setups using Finviz filters"""
        try:
            from finviz.screener import Screener
            # Bullish setup filters:
            # - Large cap, above SMA50, RSI 50-70, high volume, positive EPS growth
            filters = [
                "cap_largeover",           # Large cap (>$10B)
                "ta_sma50_pa",             # Price above SMA50
                "ta_rsi_om50",             # RSI over 50
                "ta_rsi_nob70",            # RSI not overbought (< 70)
                "fa_eps5years_pos",        # Positive 5-year EPS growth
                "sh_avgvol_o500",          # Avg volume > 500k
            ]
            if extra_filters:
                filters.extend(extra_filters)

            screener = Screener(
                filters=filters,
                table="Technical",
                order="-volume"
            )
            results = []
            for stock in screener[:20]:
                results.append({
                    "ticker":   stock.get("Ticker", ""),
                    "price":    stock.get("Price", ""),
                    "change":   stock.get("Change", ""),
                    "volume":   stock.get("Volume", ""),
                    "rsi":      stock.get("RSI (14)", ""),
                    "sma50":    stock.get("SMA50", ""),
                    "pattern":  stock.get("Pattern", ""),
                    "country":  stock.get("Country", ""),
                    "sector":   stock.get("Sector", ""),
                })
            return results
        except Exception as e:
            print(f"[Finviz Screener] Error: {e}")
            return []

    def screen_options_flow(self) -> list:
        """Screen for stocks with high options activity (breakout candidates)"""
        try:
            from finviz.screener import Screener
            filters = [
                "sh_opt_option",           # Optionable stocks only
                "ta_highlow52w_nh",        # Near 52-week high (momentum)
                "sh_avgvol_o1000",         # High average volume
                "fa_eps5years_pos",        # Positive growth
                "cap_midover",             # Mid+ cap
            ]
            screener = Screener(filters=filters, table="Overview", order="-change")
            return [{"ticker": s.get("Ticker"), "price": s.get("Price"),
                     "change": s.get("Change"), "market_cap": s.get("Market Cap")}
                    for s in screener[:15]]
        except Exception as e:
            print(f"[Options Screen] Error: {e}")
            return []


# ══════════════════════════════════════════════════════════════════════════════
# STEP 2: VADER SENTIMENT ANALYZER (100% FREE — no API needed)
# Fast, accurate for financial news headlines
# ══════════════════════════════════════════════════════════════════════════════
class VaderNewsSentiment:
    """
    Uses VADER (Valence Aware Dictionary and sEntiment Reasoner)
    pip install vaderSentiment
    Free, no API key, runs locally
    """

    def __init__(self):
        try:
            from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
            self.analyzer = SentimentIntensityAnalyzer()
            self.available = True
        except ImportError:
            self.available = False
            print("[VADER] Not installed. Run: pip install vaderSentiment")

    def analyze_headlines(self, headlines: list) -> dict:
        """Analyze a list of news headlines and return aggregate sentiment"""
        if not self.available or not headlines:
            return {"score": 0, "label": "NEUTRAL", "bull_count": 0, "bear_count": 0}

        scores = []
        bull_count = bear_count = neutral_count = 0

        for item in headlines:
            text = item.get("headline", item) if isinstance(item, dict) else str(item)
            scores_raw = self.analyzer.polarity_scores(text)
            compound = scores_raw["compound"]
            scores.append(compound)

            if compound >= 0.05:
                bull_count += 1
            elif compound <= -0.05:
                bear_count += 1
            else:
                neutral_count += 1

        avg_score = sum(scores) / len(scores) if scores else 0
        total = len(headlines)

        return {
            "score":        round(avg_score, 4),
            "label":        "BULLISH" if avg_score > 0.05 else "BEARISH" if avg_score < -0.05 else "NEUTRAL",
            "bull_pct":     round(bull_count / total * 100, 1) if total > 0 else 0,
            "bear_pct":     round(bear_count / total * 100, 1) if total > 0 else 0,
            "neutral_pct":  round(neutral_count / total * 100, 1) if total > 0 else 0,
            "bull_count":   bull_count,
            "bear_count":   bear_count,
            "total_headlines": total,
            "individual_scores": [
                {"headline": (h.get("headline", h) if isinstance(h, dict) else h)[:60],
                 "score": round(self.analyzer.polarity_scores(
                     h.get("headline", h) if isinstance(h, dict) else h)["compound"], 3)}
                for h in headlines[:5]
            ]
        }


# ══════════════════════════════════════════════════════════════════════════════
# STEP 3: GROQ AI ANALYZER (FREE — Llama 70B, 14,400 req/day)
# The fastest free AI — 300-750 tokens/sec on LPU hardware
# ══════════════════════════════════════════════════════════════════════════════
class GroqAIAnalyzer:
    """
    Uses Groq's free tier with Llama 3.3 70B
    Free: 30 RPM, 14,400 req/day
    Sign up: console.groq.com (no credit card)
    """

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.available = api_key and api_key != "YOUR_GROQ_KEY"

    def analyze_stock(self, ticker: str, finviz_data: dict,
                      news_headlines: list, sentiment: dict) -> dict:
        """Use Groq/LLaMA to generate comprehensive stock analysis"""
        if not self.available:
            return {"analysis": "GROQ_KEY not set. Get free key at console.groq.com",
                    "signal": "UNKNOWN", "confidence": 0}

        try:
            from groq import Groq
            client = Groq(api_key=self.api_key)

            # Format data for AI
            headlines_text = "\n".join([
                f"  - {h.get('headline', h)}" for h in news_headlines[:8]
            ]) if news_headlines else "  No recent news"

            prompt = f"""You are an expert quantitative stock analyst. Analyze {ticker} and provide a precise trading signal.

FINVIZ DATA:
- Price: ${finviz_data.get('price', 'N/A')}
- Change: {finviz_data.get('change_pct', 'N/A')}
- Sector: {finviz_data.get('sector', 'N/A')} | Industry: {finviz_data.get('industry', 'N/A')}
- Market Cap: {finviz_data.get('market_cap', 'N/A')}
- P/E: {finviz_data.get('pe', 'N/A')} | Forward P/E: {finviz_data.get('forward_pe', 'N/A')} | PEG: {finviz_data.get('peg', 'N/A')}
- EPS Growth YoY: {finviz_data.get('eps_growth_yoy', 'N/A')} | Sales Growth: {finviz_data.get('sales_growth', 'N/A')}
- Gross Margin: {finviz_data.get('gross_margin', 'N/A')} | Profit Margin: {finviz_data.get('profit_margin', 'N/A')}
- ROE: {finviz_data.get('roe', 'N/A')} | ROI: {finviz_data.get('roi', 'N/A')}
- Debt/Equity: {finviz_data.get('debt_equity', 'N/A')}
- RSI (14): {finviz_data.get('rsi', 'N/A')}
- Price vs SMA20: {finviz_data.get('sma20', 'N/A')} | SMA50: {finviz_data.get('sma50', 'N/A')} | SMA200: {finviz_data.get('sma200', 'N/A')}
- Beta: {finviz_data.get('beta', 'N/A')} | ATR: {finviz_data.get('atr', 'N/A')}
- Analyst Recommendation: {finviz_data.get('analyst_recom', 'N/A')} | Target: ${finviz_data.get('target_price', 'N/A')}
- Short Float: {finviz_data.get('short_float', 'N/A')} | Insider Own: {finviz_data.get('insider_own', 'N/A')}
- Earnings Date: {finviz_data.get('earnings_date', 'N/A')}

NEWS SENTIMENT: {sentiment.get('label', 'N/A')} (score: {sentiment.get('score', 0):.3f})
- Bullish headlines: {sentiment.get('bull_pct', 0)}% | Bearish: {sentiment.get('bear_pct', 0)}%

RECENT NEWS HEADLINES:
{headlines_text}

Respond ONLY in this exact JSON format (no other text):
{{
  "signal": "STRONG_BUY" or "BUY" or "HOLD" or "SELL" or "STRONG_SELL",
  "confidence": <integer 0-100>,
  "verdict": "BULLISH" or "BEARISH" or "NEUTRAL",
  "score": <integer 0-100>,
  "entry_price": <float or null>,
  "stop_loss": <float or null>,
  "target_1": <float or null>,
  "target_2": <float or null>,
  "risk_reward": <float or null>,
  "time_horizon": "day" or "weekly" or "monthly",
  "key_catalysts": ["catalyst1", "catalyst2"],
  "key_risks": ["risk1", "risk2"],
  "technical_summary": "<1 sentence>",
  "fundamental_summary": "<1 sentence>",
  "news_impact": "<1 sentence>",
  "trade_plan": "<2 sentences>",
  "options_strategy": "Long Call" or "Long Put" or "Iron Condor" or "Straddle" or "Bull Call Spread" or "Bear Put Spread" or "Covered Call" or "Cash-Secured Put",
  "options_rationale": "<1 sentence>"
}}"""

            response = client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.3-70b-versatile",
                temperature=0.1,
                max_tokens=1000,
                response_format={"type": "json_object"}
            )

            result_text = response.choices[0].message.content
            result = json.loads(result_text)
            result["model"] = "llama-3.3-70b-versatile @ Groq"
            result["tokens_used"] = response.usage.total_tokens
            return result

        except json.JSONDecodeError as e:
            return {"signal": "ERROR", "confidence": 0, "error": f"JSON parse error: {e}"}
        except Exception as e:
            return {"signal": "ERROR", "confidence": 0, "error": str(e)}

    def analyze_options(self, ticker: str, finviz_data: dict,
                        iv_estimate: float, days_to_earnings: int) -> dict:
        """Get options-specific AI analysis from Groq"""
        if not self.available:
            return {"strategy": "KEY_NEEDED", "rationale": "Set GROQ_API_KEY"}

        try:
            from groq import Groq
            client = Groq(api_key=self.api_key)

            prompt = f"""You are an expert options trader. Based on this data for {ticker}, recommend the best options strategy.

Data:
- Price: ${finviz_data.get('price', 0)}
- Volatility Weekly: {finviz_data.get('volatility_w', 'N/A')}
- Volatility Monthly: {finviz_data.get('volatility_m', 'N/A')}
- Beta: {finviz_data.get('beta', 'N/A')}
- RSI: {finviz_data.get('rsi', 'N/A')}
- Short Float: {finviz_data.get('short_float', 'N/A')}
- IV Estimate: {iv_estimate:.1f}%
- Days to Earnings: {days_to_earnings}
- Analyst Rating: {finviz_data.get('analyst_recom', 'N/A')}
- Target Price: ${finviz_data.get('target_price', 'N/A')}

Respond ONLY in JSON:
{{
  "best_strategy": "strategy name",
  "score": <0-100>,
  "iv_assessment": "CHEAP" or "FAIR" or "EXPENSIVE",
  "sell_premium": <true/false>,
  "earnings_play": <true/false>,
  "suggested_strike": <float>,
  "suggested_dte": <integer>,
  "max_risk": "description",
  "max_profit": "description",
  "rationale": "<2 sentences>",
  "alternative": "alternative strategy name"
}}"""

            resp = client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.3-70b-versatile",
                temperature=0.1,
                max_tokens=400,
                response_format={"type": "json_object"}
            )
            result = json.loads(resp.choices[0].message.content)
            result["model"] = "llama-3.3-70b-versatile @ Groq"
            return result
        except Exception as e:
            return {"strategy": "ERROR", "error": str(e)}

    def batch_screen_with_ai(self, screener_results: list) -> list:
        """Use Groq to score/rank a batch of screener results"""
        if not self.available or not screener_results:
            return screener_results

        try:
            from groq import Groq
            client = Groq(api_key=self.api_key)

            tickers_info = "\n".join([
                f"- {s.get('ticker', '')}: ${s.get('price', '')}, "
                f"Change: {s.get('change', '')}, RSI: {s.get('rsi', '')}, "
                f"Pattern: {s.get('pattern', 'None')}, "
                f"Sector: {s.get('sector', '')}"
                for s in screener_results[:15]
            ])

            prompt = f"""You are a quantitative analyst. Rank these Finviz screener results by probability of near-term bullish move (1-2 weeks).

Stocks:
{tickers_info}

Return ONLY JSON array:
[
  {{"ticker": "XXXX", "rank": 1, "score": 85, "reason": "brief reason"}},
  ...
]
Sort by score descending. Include all {len(screener_results[:15])} stocks."""

            resp = client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.3-70b-versatile",
                temperature=0.1,
                max_tokens=800
            )

            text = resp.choices[0].message.content
            # Extract JSON array
            start = text.find("[")
            end = text.rfind("]") + 1
            if start != -1 and end > start:
                ranked = json.loads(text[start:end])
                return ranked
            return screener_results
        except Exception as e:
            print(f"[Groq Batch] Error: {e}")
            return screener_results


# ══════════════════════════════════════════════════════════════════════════════
# STEP 4: GEMINI FREE AI (100 req/day free, multimodal)
# Good for chart image analysis + news summarization
# ══════════════════════════════════════════════════════════════════════════════
class GeminiAnalyzer:
    """
    Uses Google Gemini free tier
    Free: 100 req/day (Flash), 15 RPM
    Get key: ai.google.dev (no credit card)
    """

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.available = api_key and api_key != "YOUR_GEMINI_KEY"
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

    def analyze_news_deep(self, ticker: str, headlines: list) -> dict:
        """Deep news analysis using Gemini"""
        if not self.available:
            return {"summary": "GEMINI_KEY not set. Get free at ai.google.dev"}

        try:
            import requests
            news_text = "\n".join([h.get("headline", h) if isinstance(h, dict) else h
                                   for h in headlines[:10]])

            prompt = f"""Analyze these news headlines for {ticker} and provide trading intelligence:

{news_text}

Return JSON:
{{
  "overall_sentiment": "BULLISH/BEARISH/NEUTRAL",
  "sentiment_score": <-1 to 1 float>,
  "key_events": ["event1", "event2"],
  "market_impact": "HIGH/MEDIUM/LOW",
  "catalysts_bull": ["catalyst1"],
  "catalysts_bear": ["risk1"],
  "earnings_mentioned": <true/false>,
  "upgrade_mentioned": <true/false>,
  "downgrade_mentioned": <true/false>,
  "insider_mentioned": <true/false>,
  "summary": "<2 sentence summary>",
  "action_recommended": "BUY/SELL/HOLD/WAIT"
}}"""

            resp = requests.post(
                f"{self.base_url}?key={self.api_key}",
                json={"contents": [{"parts": [{"text": prompt}]}],
                      "generationConfig": {"temperature": 0.1, "maxOutputTokens": 500}},
                timeout=15
            )

            if resp.status_code == 200:
                text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                # Extract JSON
                start, end = text.find("{"), text.rfind("}") + 1
                if start != -1:
                    return {**json.loads(text[start:end]), "model": "gemini-1.5-flash"}
            return {"error": f"HTTP {resp.status_code}", "summary": "Gemini unavailable"}
        except Exception as e:
            return {"error": str(e), "summary": "Gemini error"}


# ══════════════════════════════════════════════════════════════════════════════
# STEP 5: ALPHA VANTAGE — News + Sentiment (FREE, official API)
# Built-in AI sentiment scores. Free: 25 req/day
# ══════════════════════════════════════════════════════════════════════════════
class AlphaVantageNews:
    """
    Alpha Vantage News & Sentiment API — official, free
    Returns AI-scored sentiment per article
    Free: 25 req/day | alphavantage.co/support/#api-key
    """

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base = "https://www.alphavantage.co/query"

    def get_news_sentiment(self, ticker: str) -> dict:
        """Get news with AI sentiment scores from Alpha Vantage"""
        try:
            import requests
            params = {
                "function": "NEWS_SENTIMENT",
                "tickers": ticker.upper(),
                "apikey": self.api_key,
                "limit": 10,
                "sort": "LATEST"
            }
            resp = requests.get(self.base, params=params, timeout=15)
            if resp.status_code != 200:
                return {"error": f"HTTP {resp.status_code}"}

            data = resp.json()
            if "feed" not in data:
                return {"error": data.get("Note", "Rate limited or no data")}

            articles = []
            total_score = 0
            bull_count = bear_count = 0

            for article in data["feed"][:10]:
                # Find ticker-specific sentiment
                ticker_sentiment = next(
                    (ts for ts in article.get("ticker_sentiment", [])
                     if ts.get("ticker") == ticker.upper()),
                    None
                )
                score = float(ticker_sentiment.get("ticker_sentiment_score", 0)) if ticker_sentiment else 0
                label = ticker_sentiment.get("ticker_sentiment_label", "Neutral") if ticker_sentiment else "Neutral"

                articles.append({
                    "title":     article.get("title", "")[:80],
                    "source":    article.get("source", ""),
                    "time":      article.get("time_published", "")[:16],
                    "score":     round(score, 4),
                    "label":     label,
                    "relevance": float(ticker_sentiment.get("relevance_score", 0)) if ticker_sentiment else 0,
                    "url":       article.get("url", "")
                })
                total_score += score
                if score > 0.15: bull_count += 1
                elif score < -0.15: bear_count += 1

            avg_score = total_score / len(articles) if articles else 0
            return {
                "ticker":        ticker,
                "articles":      articles,
                "avg_score":     round(avg_score, 4),
                "label":         "BULLISH" if avg_score > 0.15 else "BEARISH" if avg_score < -0.15 else "NEUTRAL",
                "bull_articles": bull_count,
                "bear_articles": bear_count,
                "total":         len(articles),
                "source":        "Alpha Vantage AI Sentiment"
            }
        except Exception as e:
            return {"error": str(e)}

    def get_technical_indicators(self, ticker: str) -> dict:
        """Get RSI, MACD, EMA from Alpha Vantage (free, official)"""
        try:
            import requests
            indicators = {}
            endpoints = [
                ("RSI",  {"function":"RSI","symbol":ticker,"interval":"daily","time_period":14,"series_type":"close","apikey":self.api_key}),
                ("MACD", {"function":"MACD","symbol":ticker,"interval":"daily","fastperiod":12,"slowperiod":26,"signalperiod":9,"series_type":"close","apikey":self.api_key}),
                ("EMA20",{"function":"EMA","symbol":ticker,"interval":"daily","time_period":20,"series_type":"close","apikey":self.api_key}),
                ("EMA50",{"function":"EMA","symbol":ticker,"interval":"daily","time_period":50,"series_type":"close","apikey":self.api_key}),
            ]

            for name, params in endpoints:
                try:
                    resp = requests.get(self.base, params=params, timeout=10)
                    data = resp.json()
                    # Each indicator has a different key format
                    for key in data:
                        if "Technical" in key or "Analysis" in key:
                            latest = list(data[key].values())[0]
                            indicators[name] = {k: round(float(v), 4) for k, v in latest.items()}
                    time.sleep(0.5)  # Rate limit respect
                except Exception:
                    pass

            return indicators
        except Exception as e:
            return {"error": str(e)}


# ══════════════════════════════════════════════════════════════════════════════
# STEP 6: MASTER AXIOM SIGNAL ENGINE
# Combines ALL sources → single signal with confidence
# ══════════════════════════════════════════════════════════════════════════════
class AXIOMSignalEngine:
    """
    Master engine that combines Finviz + VADER + Groq + Gemini + Alpha Vantage
    into a single high-confidence signal
    """

    def __init__(self):
        self.finviz    = FinvizDataFetcher()
        self.vader     = VaderNewsSentiment()
        self.groq      = GroqAIAnalyzer(GROQ_API_KEY)
        self.gemini    = GeminiAnalyzer(GEMINI_API_KEY)
        self.av        = AlphaVantageNews(ALPHA_VANTAGE_KEY)

    def full_analysis(self, ticker: str) -> dict:
        """
        Complete analysis pipeline:
        1. Finviz: 90+ metrics + news + analyst ratings + insiders
        2. VADER: fast local sentiment on headlines
        3. Alpha Vantage: official AI news sentiment + technicals
        4. Gemini: deep news narrative analysis
        5. Groq/LLaMA: master AI signal with entry/exit
        6. Combine: weighted consensus score
        """
        print(f"\n{'='*60}")
        print(f"  AXIOM FULL ANALYSIS: {ticker.upper()}")
        print(f"{'='*60}")
        result = {"ticker": ticker.upper(), "timestamp": datetime.datetime.now().isoformat()}

        # ── 1. Finviz data ─────────────────────────────────────────
        print(f"[1/6] Fetching Finviz data...")
        fv_data  = self.finviz.get_stock_data(ticker)
        news     = self.finviz.get_news(ticker)
        analysts = self.finviz.get_analyst_targets(ticker)
        insiders = self.finviz.get_insiders(ticker)
        result["finviz"] = fv_data
        result["news_count"] = len(news)
        print(f"      Price: ${fv_data.get('price', 'N/A')} | RSI: {fv_data.get('rsi', 'N/A')} | {len(news)} news items")

        # ── 2. VADER sentiment ─────────────────────────────────────
        print(f"[2/6] VADER sentiment analysis...")
        vader_sentiment = self.vader.analyze_headlines(news)
        result["vader_sentiment"] = vader_sentiment
        print(f"      {vader_sentiment.get('label')} | Score: {vader_sentiment.get('score', 0):.3f} | "
              f"Bull: {vader_sentiment.get('bull_pct', 0)}% Bear: {vader_sentiment.get('bear_pct', 0)}%")

        # ── 3. Alpha Vantage AI sentiment ──────────────────────────
        print(f"[3/6] Alpha Vantage AI sentiment...")
        av_sentiment = self.av.get_news_sentiment(ticker)
        result["av_sentiment"] = av_sentiment
        if "error" not in av_sentiment:
            print(f"      {av_sentiment.get('label')} | Score: {av_sentiment.get('avg_score', 0):.3f} | "
                  f"{av_sentiment.get('total', 0)} articles analyzed")
        else:
            print(f"      AV: {av_sentiment.get('error', 'unavailable')}")

        # ── 4. Gemini news analysis ────────────────────────────────
        print(f"[4/6] Gemini deep news analysis...")
        all_headlines = ([n.get("headline") for n in news] +
                         [a.get("title") for a in av_sentiment.get("articles", [])])
        gemini_analysis = self.gemini.analyze_news_deep(ticker, all_headlines[:12])
        result["gemini_analysis"] = gemini_analysis
        if "error" not in gemini_analysis:
            print(f"      {gemini_analysis.get('overall_sentiment')} | "
                  f"Impact: {gemini_analysis.get('market_impact')} | "
                  f"Action: {gemini_analysis.get('action_recommended')}")
        else:
            print(f"      Gemini: {gemini_analysis.get('error', 'unavailable')}")

        # ── 5. Groq/LLaMA master signal ────────────────────────────
        print(f"[5/6] Groq AI (LLaMA 70B) master signal...")
        combined_sentiment = {
            "score":     (vader_sentiment.get("score", 0) +
                         av_sentiment.get("avg_score", 0)) / 2,
            "label":     vader_sentiment.get("label", "NEUTRAL"),
            "bull_pct":  vader_sentiment.get("bull_pct", 0),
            "bear_pct":  vader_sentiment.get("bear_pct", 0),
        }
        groq_signal = self.groq.analyze_stock(ticker, fv_data, news, combined_sentiment)
        result["ai_signal"] = groq_signal
        print(f"      Signal: {groq_signal.get('signal')} | "
              f"Confidence: {groq_signal.get('confidence', 0)}% | "
              f"Score: {groq_signal.get('score', 0)}/100")

        # ── 6. Options AI analysis ─────────────────────────────────
        if fv_data.get("optionable") == "Yes":
            print(f"[6/6] Groq options strategy analysis...")
            vol_w = fv_data.get("volatility_w", "2%")
            iv_est = float(str(vol_w).replace("%", "")) * 52**0.5 if vol_w else 30.0
            options_signal = self.groq.analyze_options(ticker, fv_data, iv_est, 21)
            result["options_signal"] = options_signal
            print(f"      Strategy: {options_signal.get('best_strategy')} | "
                  f"IV: {options_signal.get('iv_assessment')} | "
                  f"Score: {options_signal.get('score', 0)}/100")
        else:
            print(f"[6/6] Options: Not optionable")
            result["options_signal"] = None

        # ── Compute master consensus ───────────────────────────────
        result["master_signal"] = self._compute_consensus(
            groq_signal, vader_sentiment, av_sentiment, gemini_analysis, fv_data
        )
        result["analyst_targets"] = analysts[:3]
        result["insider_activity"] = insiders[:3]

        self._print_summary(result)
        return result

    def _compute_consensus(self, groq, vader, av, gemini, fv_data) -> dict:
        """Weighted consensus from all AI sources"""
        signals = []

        # Groq (weight: 40%)
        groq_score = groq.get("score", 50)
        signals.append(("Groq/LLaMA", groq_score, 0.40))

        # VADER (weight: 15%)
        vader_score = 50 + vader.get("score", 0) * 50
        signals.append(("VADER", vader_score, 0.15))

        # AV Sentiment (weight: 20%)
        av_score = 50 + av.get("avg_score", 0) * 50
        signals.append(("Alpha Vantage AI", av_score, 0.20))

        # Gemini (weight: 15%)
        gem_score_raw = gemini.get("sentiment_score", 0)
        gem_score = 50 + gem_score_raw * 50
        signals.append(("Gemini", gem_score, 0.15))

        # Finviz technical (weight: 10%) — based on RSI and price vs SMA
        try:
            rsi = float(str(fv_data.get("rsi", 50)).replace("%", ""))
            sma50 = fv_data.get("sma50", "0%")
            price_vs_sma50 = float(str(sma50).replace("%", ""))
            fv_tech_score = 50 + (rsi - 50) * 0.3 + price_vs_sma50 * 2
            fv_tech_score = max(0, min(100, fv_tech_score))
        except:
            fv_tech_score = 50
        signals.append(("Finviz Technical", fv_tech_score, 0.10))

        # Weighted average
        total_weight = sum(w for _, _, w in signals)
        weighted_score = sum(s * w for _, s, w in signals) / total_weight

        final_score = round(max(0, min(100, weighted_score)))
        verdict = ("STRONG BUY"  if final_score >= 75 else
                   "BUY"         if final_score >= 62 else
                   "HOLD"        if final_score >= 45 else
                   "SELL"        if final_score >= 32 else "STRONG SELL")

        return {
            "score":          final_score,
            "verdict":        verdict,
            "confidence":     round(abs(final_score - 50) * 2),
            "breakdown":      {name: round(score, 1) for name, score, _ in signals},
            "entry_price":    groq.get("entry_price"),
            "stop_loss":      groq.get("stop_loss"),
            "target_1":       groq.get("target_1"),
            "target_2":       groq.get("target_2"),
            "risk_reward":    groq.get("risk_reward"),
            "time_horizon":   groq.get("time_horizon", "weekly"),
            "options_strat":  groq.get("options_strategy"),
            "trade_plan":     groq.get("trade_plan"),
        }

    def _print_summary(self, result: dict):
        ms = result.get("master_signal", {})
        fv = result.get("finviz", {})
        ai = result.get("ai_signal", {})

        print(f"\n{'═'*60}")
        print(f"  AXIOM MASTER SIGNAL: {result['ticker']}")
        print(f"{'═'*60}")
        print(f"  VERDICT:    {ms.get('verdict', 'UNKNOWN')} ({ms.get('score', 0)}/100)")
        print(f"  CONFIDENCE: {ms.get('confidence', 0)}%")
        print(f"  ENTRY:      ${ms.get('entry_price', 'N/A')}")
        print(f"  STOP LOSS:  ${ms.get('stop_loss', 'N/A')}")
        print(f"  TARGET 1:   ${ms.get('target_1', 'N/A')}")
        print(f"  TARGET 2:   ${ms.get('target_2', 'N/A')}")
        print(f"  R/R RATIO:  1:{ms.get('risk_reward', 'N/A')}")
        print(f"  OPTIONS:    {ms.get('options_strat', 'N/A')}")
        print(f"\n  SCORE BREAKDOWN:")
        for src, score in ms.get("breakdown", {}).items():
            bar = "█" * int(score / 10)
            print(f"    {src:<22} {bar:<10} {score:.0f}/100")
        print(f"\n  TRADE PLAN: {ai.get('trade_plan', 'N/A')}")
        print(f"{'═'*60}")

    def scan_watchlist(self, tickers: list) -> list:
        """Scan multiple tickers and rank by signal score"""
        results = []
        for i, ticker in enumerate(tickers):
            print(f"\nScanning {i+1}/{len(tickers)}: {ticker}")
            try:
                result = self.full_analysis(ticker)
                results.append({
                    "ticker":     ticker,
                    "score":      result.get("master_signal", {}).get("score", 0),
                    "verdict":    result.get("master_signal", {}).get("verdict", "UNKNOWN"),
                    "signal":     result.get("ai_signal", {}).get("signal", "UNKNOWN"),
                    "confidence": result.get("master_signal", {}).get("confidence", 0),
                    "price":      result.get("finviz", {}).get("price", 0),
                    "options":    result.get("master_signal", {}).get("options_strat", "N/A"),
                })
                time.sleep(2)  # Rate limit respect
            except Exception as e:
                print(f"  Error scanning {ticker}: {e}")

        results.sort(key=lambda x: x["score"], reverse=True)
        print(f"\n{'='*50}")
        print("  WATCHLIST RANKING (by AXIOM score)")
        print(f"{'='*50}")
        for r in results:
            print(f"  {r['ticker']:<6} {r['verdict']:<12} {r['score']:>3}/100  "
                  f"({r['confidence']}% conf)  ${r['price']}  {r['options']}")
        return results


# ══════════════════════════════════════════════════════════════════════════════
# USAGE EXAMPLES
# ══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    engine = AXIOMSignalEngine()

    # ── Example 1: Full analysis on single stock ──────────────────
    result = engine.full_analysis("NVDA")
    print(json.dumps(result.get("master_signal", {}), indent=2))

    # ── Example 2: Scan a watchlist ───────────────────────────────
    # watchlist = ["AAPL", "NVDA", "MSFT", "TSLA", "META", "AMZN"]
    # rankings = engine.scan_watchlist(watchlist)

    # ── Example 3: Finviz screener → AI rank ─────────────────────
    # finviz = FinvizDataFetcher()
    # screener_results = finviz.screen_bullish()
    # print(f"Found {len(screener_results)} bullish stocks from Finviz")
    # groq = GroqAIAnalyzer(GROQ_API_KEY)
    # ranked = groq.batch_screen_with_ai(screener_results)
    # print("Top 5 AI-ranked setups:")
    # for r in ranked[:5]:
    #     print(f"  #{r['rank']} {r['ticker']} — {r['score']}/100 — {r['reason']}")

    # ── Example 4: Options flow candidates ───────────────────────
    # finviz = FinvizDataFetcher()
    # options_candidates = finviz.screen_options_flow()
    # for c in options_candidates[:5]:
    #     print(f"  {c['ticker']} ${c['price']} {c['change']}")


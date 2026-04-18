# AXIOM — API Reference

Base URL: `https://stockagentify.com`

All `/api/*` routes go through the API Gateway. Protected routes require a Bearer JWT token.

---

## Authentication

### Register
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```
**Response:**
```json
{
  "token": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

### Refresh Token
```http
POST /api/v1/auth/refresh?refreshToken=eyJhbGci...
```

### Logout
```http
POST /api/v1/auth/logout?refreshToken=eyJhbGci...
```

---

## Stock Data

### Get Quote
```http
GET /api/v1/stocks/{ticker}/quote
```
**Example:** `GET /api/v1/stocks/AAPL/quote`

**Response:**
```json
{
  "ticker": "AAPL",
  "price": 270.23,
  "open": 266.96,
  "high": 272.30,
  "low": 266.72,
  "previousClose": 263.40,
  "change": 6.83,
  "changePercent": 2.59,
  "volume": 1776456000,
  "avgVolume": 1500000,
  "marketCap": 4053450000000.00,
  "week52High": 372.92,
  "week52Low": 167.54,
  "timestamp": "2026-04-18T21:47:22Z"
}
```

### Get Technical Indicators
```http
GET /api/v1/stocks/{ticker}/technicals
```

### Get Price History
```http
GET /api/v1/stocks/{ticker}/history?interval=1D&range=3M
```

**Interval options:** `1m`, `5m`, `15m`, `1h`, `1D`, `1W`  
**Range options:** `1D`, `5D`, `1M`, `3M`, `6M`, `1Y`, `5Y`

---

## AI Analysis

### Run Full Analysis
```http
POST /api/v1/analysis
Content-Type: application/json

{
  "ticker": "AAPL",
  "horizon": "weekly",
  "customPrompt": "Focus on earnings upcoming next week"
}
```

**Horizon options:** `day`, `weekly`, `monthly`, `quarterly`, `longterm`

**Response:**
```json
{
  "ticker": "AAPL",
  "horizon": "weekly",
  "verdict": "MILD_BULL",
  "overallScore": 72,
  "entryLow": 265.00,
  "entryHigh": 270.00,
  "stopLoss": 258.00,
  "target1": 280.00,
  "target2": 295.00,
  "target3": 310.00,
  "riskReward": 2.5,
  "executiveSummary": "AAPL shows bullish momentum...",
  "marketPulse": "Market conditions are favorable...",
  "technicalAnalysis": "RSI at 58, MACD bullish crossover...",
  "supportResistance": "Key support at $265, resistance at $280...",
  "fundamentals": "P/E ratio of 28x, strong cash flow...",
  "entryExitSignals": "Enter on pullback to $265-270 zone...",
  "bullBearScorecard": "Bull: 6/9 | Bear: 3/9...",
  "riskFactors": "Macro headwinds, tariff uncertainty...",
  "tradePlan": "Buy 1/3 at $267, add at $263, target $280..."
}
```

**Verdict values:**
- `STRONG_BULL` — Score 80-100 (green)
- `MILD_BULL` — Score 60-79 (yellow)
- `NEUTRAL` — Score 40-59 (gray)
- `MILD_BEAR` — Score 20-39 (orange)
- `STRONG_BEAR` — Score 0-19 (red)

### Get Analysis History
```http
GET /api/v1/analysis/history?page=0&size=10
Authorization: Bearer {token}
```

---

## Watchlists

All watchlist endpoints require authentication.

### Get All Watchlists
```http
GET /api/v1/watchlists
Authorization: Bearer {token}
```

### Create Watchlist
```http
POST /api/v1/watchlists
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Tech Stocks",
  "tickers": ["AAPL", "NVDA", "MSFT"]
}
```

### Update Tickers
```http
PUT /api/v1/watchlists/{id}/tickers
Authorization: Bearer {token}
Content-Type: application/json

["AAPL", "NVDA", "TSLA", "META"]
```

### Delete Watchlist
```http
DELETE /api/v1/watchlists/{id}
Authorization: Bearer {token}
```

---

## Health Checks (Internal)

These are blocked by nginx (`location /actuator { deny all; }`) for external access.

```bash
# Internal health checks (run from inside VPS)
docker exec axiom-api-gateway-1 wget -qO- http://localhost:8080/actuator/health
docker exec axiom-user-service-1 wget -qO- http://localhost:8081/actuator/health
docker exec axiom-stock-data-service-1 wget -qO- http://localhost:8082/actuator/health
docker exec axiom-analysis-service-1 wget -qO- http://localhost:8083/actuator/health
```

---

## Error Responses

| Status | Meaning |
|--------|---------|
| 400 | Bad Request — invalid input |
| 401 | Unauthorized — missing/invalid JWT |
| 403 | Forbidden — insufficient permissions |
| 404 | Not Found — route or resource not found |
| 429 | Too Many Requests — rate limit exceeded |
| 500 | Internal Server Error |
| 502 | Bad Gateway — upstream service down |
| 503 | Service Unavailable — service starting up |


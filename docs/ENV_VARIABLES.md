# AXIOM — Environment Variables Guide

All environment variables go in `/opt/axiom/.env` on the VPS.

---

## Complete .env Template

```env
# ─── Database ────────────────────────────────────────────
POSTGRES_USER=axiom
POSTGRES_PASSWORD=change_this_strong_password

# ─── Cache ───────────────────────────────────────────────
REDIS_PASSWORD=change_this_redis_password

# ─── Security ────────────────────────────────────────────
# Minimum 32 characters, random string
JWT_SECRET=axiom_jwt_secret_change_in_prod_min_256_bits_abcdefghijklmnop

# ─── Market Data APIs ────────────────────────────────────
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
FINNHUB_API_KEY=your_finnhub_key
POLYGON_API_KEY=your_polygon_key

# ─── AI ──────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-api03-...

# ─── Admin ───────────────────────────────────────────────
ADMIN_EMAIL=your@email.com
```

---

## How to Get Each API Key

### Alpha Vantage (Stock Data)
- **Free tier**: 25 requests/day, 500 requests/month
- **Sign up**: https://www.alphavantage.co/support/#api-key
- **Steps**:
  1. Go to https://www.alphavantage.co/support/#api-key
  2. Enter your email
  3. Copy the API key from the response email
- **Used for**: Real-time quotes, historical price data, technical indicators

### Finnhub (Stock Data)
- **Free tier**: 60 API calls/minute
- **Sign up**: https://finnhub.io/register
- **Steps**:
  1. Create account at finnhub.io
  2. Go to Dashboard → API Keys
  3. Copy the sandbox or production key
- **Used for**: Real-time quotes, company fundamentals, market news

### Polygon.io (Stock Data)
- **Free tier**: Unlimited (previous day data only on free plan)
- **Sign up**: https://polygon.io/dashboard/signup
- **Steps**:
  1. Create account at polygon.io
  2. Go to Dashboard → API Keys
  3. Copy the default key
- **Used for**: Historical data, aggregates, ticker details

### Anthropic Claude (AI Analysis)
- **Pricing**: Pay-per-token (no free tier for API, but low cost)
- **Sign up**: https://console.anthropic.com
- **Steps**:
  1. Create account at console.anthropic.com
  2. Add credit card (minimum $5 credit)
  3. Go to API Keys → Create Key
  4. Copy the key (starts with `sk-ant-api03-`)
- **Model used**: `claude-sonnet-4-6` (latest Claude 3.5 Sonnet)
- **Cost estimate**: ~$0.01-0.05 per analysis request

> **Note**: If you don't have Anthropic API access, you can use OpenRouter (https://openrouter.ai) which provides access to Claude through their proxy. Key format: `sk-or-v1-...`

---

## Generating Secure Passwords

### JWT Secret (minimum 32 chars)
```bash
# Generate on Linux/Mac
openssl rand -base64 48

# Or use any random string generator
```

### Database / Redis Passwords
```bash
openssl rand -base64 24
```

---

## Setting Variables on VPS

```bash
# Edit the .env file
nano /opt/axiom/.env

# Verify it loaded correctly (shows all env vars for a service)
docker compose -f docker-compose.prod.yml config | grep ALPHA_VANTAGE

# After changing .env, restart affected services
docker compose -f docker-compose.prod.yml up -d
```

---

## Variables Per Service

| Variable | Used By | Required |
|----------|---------|----------|
| `POSTGRES_USER` | postgres, user-service, analysis-service | ✅ Yes |
| `POSTGRES_PASSWORD` | postgres, user-service, analysis-service | ✅ Yes |
| `REDIS_PASSWORD` | redis, user-service | ✅ Yes |
| `JWT_SECRET` | user-service, api-gateway | ✅ Yes |
| `ALPHA_VANTAGE_API_KEY` | stock-data-service | ✅ Yes (or use `demo`) |
| `FINNHUB_API_KEY` | stock-data-service | ✅ Yes (or use `demo`) |
| `POLYGON_API_KEY` | stock-data-service | ✅ Yes (or use `demo`) |
| `ANTHROPIC_API_KEY` | analysis-service | ✅ Yes |
| `ADMIN_EMAIL` | certbot SSL renewal | ✅ Yes |

> **Note**: Using `demo` for market data API keys will return demo/sample data, not real prices.


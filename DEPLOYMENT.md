# 🚀 Axiom Stock Agent — Deployment Guide

## Architecture

```
Vercel (Web Frontend)  →  Railway API Gateway  →  Railway Microservices
                                                   ├── user-service      (+ PostgreSQL)
                                                   ├── stock-data-service (H2 in-memory)
                                                   └── analysis-service  (+ PostgreSQL)
```

---

## 🚂 Railway — Backend Deployment

### Step 1 — Create a Railway Project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **Deploy from GitHub repo** → select `stock-agent`

---

### Step 2 — Add PostgreSQL & Redis

In your Railway project dashboard:
- Click **+ New** → **Database** → **Add PostgreSQL** (used by user-service & analysis-service)
- Click **+ New** → **Database** → **Add Redis** (used by user-service for token cache)

---

### Step 3 — Deploy Each Microservice

Create **4 services** from the same GitHub repo, each with a different root directory:

#### 🔷 user-service
| Setting | Value |
|---|---|
| **Root Directory** | `backend/user-service` |
| **Build Command** | *(auto — uses Dockerfile)* |

**Environment Variables:**
```
SPRING_PROFILES_ACTIVE=railway
DATABASE_URL=${{Postgres.DATABASE_URL}}
PGUSER=${{Postgres.PGUSER}}
PGPASSWORD=${{Postgres.PGPASSWORD}}
REDIS_HOST=${{Redis.REDIS_HOST}}
REDIS_PORT=${{Redis.REDIS_PORT}}
REDIS_PASSWORD=${{Redis.REDIS_PASSWORD}}
JWT_SECRET=your-256-bit-secret-here
```

---

#### 🔷 stock-data-service
| Setting | Value |
|---|---|
| **Root Directory** | `backend/stock-data-service` |

**Environment Variables:**
```
SPRING_PROFILES_ACTIVE=railway
ALPHA_VANTAGE_API_KEY=your_key
FINNHUB_API_KEY=your_key
POLYGON_API_KEY=your_key
```

---

#### 🔷 analysis-service
| Setting | Value |
|---|---|
| **Root Directory** | `backend/analysis-service` |

**Environment Variables:**
```
SPRING_PROFILES_ACTIVE=railway
DATABASE_URL=${{Postgres.DATABASE_URL}}
PGUSER=${{Postgres.PGUSER}}
PGPASSWORD=${{Postgres.PGPASSWORD}}
STOCK_DATA_SERVICE_URL=https://<stock-data-service-railway-url>
ANTHROPIC_API_KEY=your_anthropic_key
```
> Replace `<stock-data-service-railway-url>` with the Railway public URL of stock-data-service after it deploys.

---

#### 🔷 api-gateway
| Setting | Value |
|---|---|
| **Root Directory** | `backend/api-gateway` |

**Environment Variables:**
```
SPRING_PROFILES_ACTIVE=railway
JWT_SECRET=your-256-bit-secret-here   (same as user-service)
USER_SERVICE_URL=https://<user-service-railway-url>
STOCK_DATA_SERVICE_URL=https://<stock-data-service-railway-url>
ANALYSIS_SERVICE_URL=https://<analysis-service-railway-url>
```

> ⚠️ **Enable public domain** on the api-gateway service: Settings → Networking → **Generate Domain**

---

## ▲ Vercel — Frontend Deployment

### Step 1 — Import Project

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import `stock-agent` from GitHub
3. Set **Root Directory** to `web`
4. Framework preset: **Vite** *(auto-detected)*

### Step 2 — Set Environment Variable

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://<your-api-gateway-railway-domain>` |

### Step 3 — Deploy

Click **Deploy** — Vercel will run `npm install && npm run build` automatically.

---

## 🔑 Required API Keys

| Key | Where to get |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `ALPHA_VANTAGE_API_KEY` | [alphavantage.co/support](https://www.alphavantage.co/support/#api-key) (free) |
| `FINNHUB_API_KEY` | [finnhub.io](https://finnhub.io) (free tier) |
| `POLYGON_API_KEY` | [polygon.io](https://polygon.io) (free tier) |
| `JWT_SECRET` | Generate: `openssl rand -hex 32` |

---

## 🔄 Deployment Order

Deploy services in this order to get Railway URLs before setting env vars:

```
1. PostgreSQL  (Railway addon — auto)
2. Redis       (Railway addon — auto)
3. user-service
4. stock-data-service
5. analysis-service   ← needs stock-data-service URL
6. api-gateway        ← needs all 3 service URLs
7. Vercel web         ← needs api-gateway URL
```

---

## 🧪 Verify Deployment

```bash
# API Gateway health
curl https://<gateway-url>/actuator/health

# Stock quote test
curl https://<gateway-url>/api/v1/stocks/AAPL/quote

# Analysis test
curl -X POST https://<gateway-url>/api/v1/analysis \
  -H "Content-Type: application/json" \
  -d '{"ticker":"AAPL","horizon":"weekly"}'
```


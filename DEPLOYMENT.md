# 🚀 Axiom Stock Agent — Deployment Guide

## Architecture

```
Vercel (Web Frontend)
        │
        │  HTTPS API calls
        ▼
Hostinger VPS ── Nginx (SSL termination, port 443)
        │
        ▼
  Docker Network (axiom-net)
  ├── api-gateway      :8080
  ├── user-service     :8081  ── PostgreSQL
  ├── stock-data-service :8082
  ├── analysis-service :8083  ── PostgreSQL
  ├── postgres         :5432
  └── redis            :6379
```

---

## 🖥️ Hostinger VPS — Backend Deployment

### Requirements
- Hostinger VPS plan (Ubuntu 22.04 recommended, min 2GB RAM)
- A domain name pointed to your VPS IP (DNS A record)
- SSH access

---

### Step 1 — SSH into your VPS

In Hostinger panel → **VPS** → **Manage** → copy the IP address.

```bash
ssh root@YOUR_VPS_IP
```

---

### Step 2 — One-Command Deploy

```bash
curl -fsSL https://raw.githubusercontent.com/krram712/stock-agent/main/deploy.sh | bash -s -- yourdomain.com
```

This script automatically:
- Installs Docker & Docker Compose
- Clones the repo to `/opt/axiom`
- Generates strong secrets (JWT, DB passwords)
- Creates all 4 microservice containers + PostgreSQL + Redis + Nginx
- Issues a free **Let's Encrypt SSL certificate**
- Configures HTTPS redirect

---

### Step 3 — Set Your API Keys

After deploy, edit the `.env` file:

```bash
nano /opt/axiom/.env
```

Fill in:
```env
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
ALPHA_VANTAGE_API_KEY=your_key
FINNHUB_API_KEY=your_key
POLYGON_API_KEY=your_key
```

Then restart:
```bash
cd /opt/axiom
docker compose -f docker-compose.prod.yml --env-file .env up -d
```

---

### Step 4 — Point Your Domain DNS

In **Hostinger DNS Zone** (or wherever your domain is managed):

| Type | Name | Value |
|------|------|-------|
| A    | @    | YOUR_VPS_IP |
| A    | www  | YOUR_VPS_IP |

> DNS propagation can take up to 30 minutes. Check with: `nslookup yourdomain.com`

---

## ▲ Vercel — Frontend Deployment

### Step 1 — Import Project

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import `stock-agent` from GitHub
3. Set **Root Directory** → `web`
4. Framework: **Vite** *(auto-detected)*

### Step 2 — Set Environment Variable

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://yourdomain.com` |

### Step 3 — Deploy

Click **Deploy** — done ✅

---

## 🔑 Required API Keys

| Key | Where to get | Cost |
|-----|-------------|------|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) | Pay-per-use |
| `ALPHA_VANTAGE_API_KEY` | [alphavantage.co](https://www.alphavantage.co/support/#api-key) | Free (25 req/day) |
| `FINNHUB_API_KEY` | [finnhub.io](https://finnhub.io) | Free (60 req/min) |
| `POLYGON_API_KEY` | [polygon.io](https://polygon.io) | Free tier |

---

## 🛠️ Useful Commands (on VPS)

```bash
# View all logs
cd /opt/axiom
docker compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker compose -f docker-compose.prod.yml logs -f api-gateway

# Restart all services
docker compose -f docker-compose.prod.yml restart

# Pull latest code & redeploy
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build

# Check running containers
docker compose -f docker-compose.prod.yml ps

# Renew SSL manually
docker compose -f docker-compose.prod.yml run --rm certbot renew
```

---

## 🧪 Verify Deployment

```bash
# Health check
curl https://yourdomain.com/actuator/health

# Stock quote
curl https://yourdomain.com/api/v1/stocks/AAPL/quote

# Analysis
curl -X POST https://yourdomain.com/api/v1/analysis \
  -H "Content-Type: application/json" \
  -d '{"ticker":"AAPL","horizon":"weekly"}'
```

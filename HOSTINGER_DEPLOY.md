# AXIOM — Hostinger VPS Deployment Guide

## Requirements
- Hostinger KVM2+ VPS (minimum 4 GB RAM, 2 vCPU)
- Ubuntu 22.04 OS
- Domain pointing to your VPS IP (DNS A record)

---

## Step 1 — SSH into your VPS

```bash
ssh root@YOUR_VPS_IP
```

---

## Step 2 — One-command deploy

```bash
curl -fsSL https://raw.githubusercontent.com/krram712/stock-agent/main/deploy.sh | bash -s stockagentify.com
```

Or if you cloned first:
```bash
bash /opt/axiom/deploy.sh stockagentify.com
```

Replace `stockagentify.com` with your actual domain or just use your IP:
```bash
bash deploy.sh 185.XXX.XXX.XXX
```

---

## Step 3 — Set your API keys

The deploy script auto-generates DB/Redis/JWT secrets. You **must** add your API keys:

```bash
nano /opt/axiom/.env
```

Fill in:
| Key | Where to get |
|-----|-------------|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com |
| `GROQ_API_KEY` | https://console.groq.com |
| `TAVILY_API_KEY` | https://app.tavily.com |
| `ALPHA_VANTAGE_API_KEY` | https://www.alphavantage.co/support/#api-key |
| `FINNHUB_API_KEY` | https://finnhub.io |

After editing `.env`, restart services:
```bash
cd /opt/axiom
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

---

## Step 4 — Verify everything is running

```bash
cd /opt/axiom
docker compose -f docker-compose.prod.yml ps
```

Expected output — all services `Up (healthy)`:
```
NAME                STATUS
axiom-postgres      Up (healthy)
axiom-redis         Up (healthy)
axiom-user-service  Up (healthy)
axiom-stock-data    Up (healthy)
axiom-analysis      Up (healthy)
axiom-api-gateway   Up (healthy)
axiom-webhook       Up (healthy)
axiom-web           Up
axiom-nginx         Up
```

Check logs if any service fails:
```bash
docker compose -f docker-compose.prod.yml logs -f api-gateway
docker compose -f docker-compose.prod.yml logs -f analysis-service
docker compose -f docker-compose.prod.yml logs -f webhook-server
```

---

## Step 5 — Test the endpoints

```bash
# Health check
curl https://stockagentify.com/api/v1/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"wrong"}' 

# Webhook server
curl https://stockagentify.com/health

# AI search
curl https://stockagentify.com/ai-search -X POST \
  -H "Content-Type: application/json" \
  -d '{"ticker":"AAPL","prompt":"latest news"}'
```

---

## Step 6 — Frontend (Vercel)

If your web frontend is deployed on Vercel, set this environment variable in Vercel dashboard:

```
VITE_API_URL=https://stockagentify.com
```

Then redeploy.

---

## Useful Commands

```bash
cd /opt/axiom

# View all logs live
docker compose -f docker-compose.prod.yml logs -f

# Restart a specific service
docker compose -f docker-compose.prod.yml restart api-gateway

# Full stop
docker compose -f docker-compose.prod.yml down

# Full start
docker compose -f docker-compose.prod.yml --env-file .env up -d

# Rebuild after code changes
git pull && docker compose -f docker-compose.prod.yml --env-file .env up -d --build

# Check disk usage
docker system df

# Clean unused images
docker system prune -f
```

---

## SSL Certificate Renewal

Certbot renews automatically via the certbot container. To renew manually:

```bash
docker compose -f docker-compose.prod.yml run --rm certbot renew
docker compose -f docker-compose.prod.yml restart nginx
```

---

## Architecture on VPS

```
Internet
   │
   ▼
Nginx :80/:443  (SSL termination, reverse proxy)
   ├── /api/*        → api-gateway:8080
   │     ├── /api/v1/auth/**       → user-service:8081 (no JWT required)
   │     ├── /api/v1/watchlists/** → user-service:8081 (JWT required)
   │     ├── /api/v1/stocks/**     → stock-data-service:8082
   │     └── /api/v1/analysis/**   → analysis-service:8083
   ├── /webhook      → webhook-server:3001  (TradingView alerts)
   ├── /signals      → webhook-server:3001  (signal history)
   ├── /stream       → webhook-server:3001  (SSE live feed)
   ├── /ai-search    → webhook-server:3001  (Groq + Tavily)
   └── /             → web:80               (React frontend)
```

---

## Troubleshooting

### Watchlists not loading
Ensure `api-gateway` is healthy. The JWT filter (GlobalFilter) must forward `X-User-Id`.
```bash
docker compose -f docker-compose.prod.yml logs api-gateway | grep -i "error\|jwt"
```

### SSL certificate failed
1. Ensure DNS A record points to your VPS IP (check with `dig stockagentify.com`)
2. Wait 5–10 min for DNS propagation
3. Re-run: `bash deploy.sh stockagentify.com`

### Out of memory
Kafka + Zookeeper are removed from prod compose (too heavy). If you still run out of memory:
```bash
free -h
docker stats
```
Consider upgrading to KVM4 (8 GB RAM).

### Database not initialized
```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U axiom -c '\l'
```
Should show `axiom_users`, `axiom_analysis`, `axiom_stocks`.
If not:
```bash
docker compose -f docker-compose.prod.yml exec postgres bash -c "bash /docker-entrypoint-initdb.d/init-db.sh"
```


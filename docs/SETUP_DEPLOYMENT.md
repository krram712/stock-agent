# AXIOM — Complete Setup & Deployment Guide

> **Target**: Hostinger VPS (KVM2, Ubuntu 22.04) at `82.180.139.237`  
> **Domain**: `stockagentify.com`  
> **Live URL**: https://stockagentify.com

---

## Prerequisites

- Hostinger VPS (KVM2 or higher) with Ubuntu 22.04
- Domain name (stockagentify.com) with DNS access
- API keys (see [Environment Variables](./ENV_VARIABLES.md))
- SSH access to the VPS

---

## Workflow Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT WORKFLOW                                  │
│                                                                         │
│  LOCAL MACHINE                    VPS (Hostinger)                       │
│  ─────────────                    ──────────────                        │
│                                                                         │
│  1. Clone repo         ──push──►  2. git pull on VPS                   │
│  2. Configure .env                3. Install Docker                     │
│  3. Push to GitHub                4. Configure DNS                      │
│                                   5. Get SSL cert (DNS-01)              │
│                                   6. docker compose up                  │
│                                   7. Verify all services                │
│                                                                         │
│  ┌──────────┐    ┌─────────┐    ┌──────────┐    ┌──────────────────┐  │
│  │  GitHub  │───►│   VPS   │───►│  Docker  │───►│  Live at HTTPS   │  │
│  │   Repo   │    │  /opt/  │    │ Compose  │    │ stockagentify.com│  │
│  └──────────┘    └─────────┘    └──────────┘    └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## PHASE 1 — VPS Initial Setup

### Step 1.1 — SSH into VPS
```bash
ssh root@82.180.139.237
# or using Hostinger terminal in browser
```

### Step 1.2 — Install Docker
```bash
apt-get update && apt-get upgrade -y
apt-get install -y docker.io docker-compose-plugin git curl

# Verify
docker --version
docker compose version
```

### Step 1.3 — Disable k3s (Hostinger pre-installs Kubernetes)
> ⚠️ Hostinger VPS comes with k3s (Kubernetes + Traefik) pre-installed.
> Traefik intercepts ports 80/443 and must be disabled.

```bash
sudo systemctl stop k3s
sudo systemctl disable k3s

# Verify Traefik is no longer intercepting
iptables -t nat -L PREROUTING -n | grep "dpt:80"
# Should return nothing (no DNAT rules)
```

### Step 1.4 — Clone the Repository
```bash
mkdir -p /opt/axiom
cd /opt/axiom
git clone https://github.com/krram712/stock-agent.git .
```

---

## PHASE 2 — DNS Configuration

### Step 2.1 — Get VPS IP
```bash
curl ifconfig.me
# Returns: 82.180.139.237
```

### Step 2.2 — Configure DNS in Hostinger Panel
Go to **Hostinger → Domains → stockagentify.com → DNS Zone**

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | 82.180.139.237 | 300 |
| A | www | 82.180.139.237 | 300 |

### Step 2.3 — Verify DNS Propagation
```bash
nslookup stockagentify.com
# Should return: 82.180.139.237

# Or from VPS:
dig stockagentify.com +short
```

---

## PHASE 3 — Environment Configuration

### Step 3.1 — Create .env file
```bash
cd /opt/axiom
cp .env.example .env
nano .env
```

### Step 3.2 — Fill in all values
```env
# Database
POSTGRES_USER=axiom
POSTGRES_PASSWORD=your_strong_password_here
REDIS_PASSWORD=your_redis_password_here

# Security
JWT_SECRET=your_256bit_secret_minimum_32_chars_long

# Market Data APIs
ALPHA_VANTAGE_API_KEY=BEQODXTCVEWVP1KK
FINNHUB_API_KEY=d7hva89r01qu8vfmpsc0d7hva89r01qu8vfmpscg
POLYGON_API_KEY=nlgzvdYG3dPaubFGS3oLnXlQUojD1gPo

# AI
ANTHROPIC_API_KEY=sk-ant-api03-...

# Admin
ADMIN_EMAIL=krram712@gmail.com
```

> **How to get API keys**: See [Environment Variables Guide](./ENV_VARIABLES.md)

---

## PHASE 4 — SSL Certificate (Let's Encrypt)

> ⚠️ We use **DNS-01 challenge** (not HTTP-01) because Hostinger VPS has
> Traefik/iptables that can intercept port 80 challenges.

### Step 4.1 — Install Certbot
```bash
apt-get install -y certbot
```

### Step 4.2 — Request Certificate (DNS-01 Manual Challenge)
```bash
certbot certonly \
  --manual \
  --preferred-challenges dns \
  -d stockagentify.com \
  -d www.stockagentify.com \
  --email krram712@gmail.com \
  --agree-tos
```

### Step 4.3 — Add DNS TXT Records
Certbot will display something like:
```
Please deploy a DNS TXT record under the name:
_acme-challenge.stockagentify.com
with the following value:
aBcDeFgHiJkLmNoPqRsTuVwXyZ123456789
```

Go to **Hostinger → DNS Zone** and add:

| Type | Name | Value |
|------|------|-------|
| TXT | _acme-challenge | aBcDeFgHiJkLmNoPqRsTuVwXyZ123456789 |
| TXT | _acme-challenge.www | (second value if shown) |

Wait 1-2 minutes, verify:
```bash
nslookup -type=TXT _acme-challenge.stockagentify.com
# Should return the TXT value
```

Then press **Enter** in certbot to complete.

### Step 4.4 — Verify Certificate
```bash
certbot certificates
# Shows: Certificate Name: stockagentify.com
#        Expiry Date: 90 days from now
#        Certificate Path: /etc/letsencrypt/live/stockagentify.com/fullchain.pem
```

---

## PHASE 5 — Docker Compose Deployment

### Step 5.1 — Build and Start All Services
```bash
cd /opt/axiom
docker compose -f docker-compose.prod.yml up -d --build
```

**Build order** (automatic via `depends_on`):
```
postgres ──┐
redis   ──►├──► user-service ──────────────────────────────┐
           ├──► stock-data-service ────────────────────────►├──► api-gateway ──► nginx
           └──► analysis-service (needs stock-data-service)─┘
web (independent build)
certbot (independent)
```

### Step 5.2 — Monitor Build Progress
```bash
# Watch logs during build
docker compose -f docker-compose.prod.yml logs -f

# Or watch specific service
docker compose -f docker-compose.prod.yml logs -f api-gateway
```

### Step 5.3 — Verify All Services Are Healthy
```bash
sleep 60 && docker compose -f docker-compose.prod.yml ps
```

Expected output:
```
NAME                         STATUS
axiom-analysis-service-1     Up X minutes (healthy)
axiom-api-gateway-1          Up X minutes (healthy)
axiom-certbot-1              Up X minutes
axiom-nginx-1                Up X minutes
axiom-postgres-1             Up X minutes (healthy)
axiom-redis-1                Up X minutes (healthy)
axiom-stock-data-service-1   Up X minutes (healthy)
axiom-user-service-1         Up X minutes (healthy)
axiom-web-1                  Up X minutes
```

---

## PHASE 6 — Verify Deployment

### Step 6.1 — Test Web UI
```bash
curl -k https://stockagentify.com/
# Expected: HTML with <title>AXIOM — AI Stock Analysis</title>
```

### Step 6.2 — Test Stock Data API
```bash
curl -k https://stockagentify.com/api/v1/stocks/AAPL/quote
# Expected: JSON with price, change, marketCap etc.
```

### Step 6.3 — Test Auth API
```bash
curl -k -X POST https://stockagentify.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test1234!","name":"Test User"}'
# Expected: {"token":"...","refreshToken":"..."}
```

### Step 6.4 — Test AI Analysis
```bash
curl -k -X POST https://stockagentify.com/api/v1/analysis \
  -H "Content-Type: application/json" \
  -d '{"ticker":"AAPL","horizon":"weekly"}'
# Expected: Full analysis JSON with executiveSummary, verdict, score etc.
```

---

## PHASE 7 — Ongoing Operations

### Update Application (after git push)
```bash
cd /opt/axiom
git pull origin main

# If only frontend changed:
docker compose -f docker-compose.prod.yml build web
docker compose -f docker-compose.prod.yml up -d web

# If backend config changed (no rebuild needed — config is volume mounted):
docker compose -f docker-compose.prod.yml restart api-gateway

# Full rebuild (all services):
docker compose -f docker-compose.prod.yml up -d --build
```

### View Logs
```bash
# All services
docker compose -f docker-compose.prod.yml logs --tail=50

# Specific service
docker compose -f docker-compose.prod.yml logs --tail=50 nginx
docker compose -f docker-compose.prod.yml logs --tail=50 api-gateway
docker compose -f docker-compose.prod.yml logs --tail=50 analysis-service
```

### Restart Individual Services
```bash
docker compose -f docker-compose.prod.yml restart nginx
docker compose -f docker-compose.prod.yml restart api-gateway
docker compose -f docker-compose.prod.yml restart web
```

### Stop Everything
```bash
docker compose -f docker-compose.prod.yml down
```

### Check Disk Space
```bash
df -h
docker system df
```

### Clean Up Docker Cache
```bash
docker system prune -f
docker image prune -f
```

### Renew SSL Certificate (manual)
```bash
# Auto-renewal is handled by certbot container every 12h
# To manually renew:
docker run --rm -v certbot_conf:/etc/letsencrypt \
  --entrypoint "" certbot/certbot \
  certbot renew
docker compose -f docker-compose.prod.yml restart nginx
```

---

## Architecture Diagram — Container Communication

```
┌─────────────────────────────────────────────────────────┐
│                  axiom-net (Docker Bridge)               │
│                                                          │
│  ┌──────────┐    ┌──────────────┐    ┌────────────────┐ │
│  │  nginx   │───►│  api-gateway │───►│  user-service  │ │
│  │  :80/443 │    │  :8080       │    │  :8081         │ │
│  │  (pub)   │    └──────┬───────┘    └────────────────┘ │
│  └────┬─────┘           │            ┌────────────────┐ │
│       │                 ├───────────►│ stock-data-svc │ │
│       │                 │            │  :8082         │ │
│       ▼                 │            └────────────────┘ │
│  ┌──────────┐           │            ┌────────────────┐ │
│  │   web    │           └───────────►│ analysis-svc   │ │
│  │  :80     │                        │  :8083         │ │
│  └──────────┘                        └────────────────┘ │
│                         ┌────────────────────────────┐  │
│                         │  postgres :5432             │  │
│                         │  redis    :6379             │  │
│                         └────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
         ↑ Only nginx exposes ports externally (80, 443)
```

---

## Nginx Configuration

**File**: `nginx/conf.d/axiom.conf`

```nginx
# HTTP → HTTPS redirect
server {
    listen 80;
    server_name stockagentify.com www.stockagentify.com;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

# HTTPS
server {
    listen 443 ssl;
    http2 on;
    server_name stockagentify.com www.stockagentify.com;
    ssl_certificate     /etc/letsencrypt/live/stockagentify.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/stockagentify.com/privkey.pem;

    location /api/ {
        proxy_pass http://api-gateway:8080;   # Backend APIs
    }
    location / {
        proxy_pass http://web:80;             # React frontend
    }
}
```

---

## Common Issues Quick Reference

| Problem | Cause | Fix |
|---------|-------|-----|
| nginx restarting | axiom.conf missing | `git pull` to restore config |
| nginx restarting | SSL cert not found | Run certbot DNS-01 challenge |
| api-gateway restarting | Bad route predicates | Split multi-Path routes into separate routes |
| certbot 404 fail | k3s/Traefik intercepting :80 | Use DNS-01 challenge instead |
| curl: connection refused | nginx down | Check `docker compose logs nginx` |
| 404 on /api/* | Route not matched in gateway | Check application-prod.yml route predicates |
| No inter-container comms | iptables flushed | `systemctl restart docker` |

> See [Troubleshooting Guide](./TROUBLESHOOTING.md) for detailed fixes.


# AXIOM — System Architecture

## Overview

AXIOM is a full-stack AI-powered stock analysis platform built with a microservices architecture. It uses Spring Boot microservices for the backend, a React frontend, and runs entirely on Docker Compose on a Hostinger VPS.

---

## High-Level Architecture

```
╔══════════════════════════════════════════════════════════════════════════╗
║                          INTERNET / USERS                               ║
║                   Browser / Mobile (stockagentify.com)                  ║
╚═══════════════════════════════╦══════════════════════════════════════════╝
                                │ HTTPS :443
                                ▼
╔══════════════════════════════════════════════════════════════════════════╗
║                         NGINX (Reverse Proxy)                           ║
║  ┌─────────────────────────┐   ┌──────────────────────────────────────┐ ║
║  │  SSL Termination        │   │  Let's Encrypt Certificate           │ ║
║  │  stockagentify.com      │   │  /etc/letsencrypt/live/              │ ║
║  └─────────────────────────┘   └──────────────────────────────────────┘ ║
║                                                                          ║
║  /api/*  ──────────────────────────────────► api-gateway:8080           ║
║  /*      ──────────────────────────────────► web:80                     ║
╚══════════════════════════════════════════════════════════════════════════╝
          │                                           │
          ▼                                           ▼
╔═════════════════════╗                   ╔═══════════════════════╗
║   API Gateway       ║                   ║   Web Frontend (React) ║
║   Spring Cloud      ║                   ║   Vite + nginx:alpine  ║
║   Gateway :8080     ║                   ║   port 80              ║
╚══════════╦══════════╝                   ╚═══════════════════════╝
           │ Routes traffic
    ┌──────┼──────────────────┐
    │      │                  │
    ▼      ▼                  ▼
╔═══════╗ ╔════════════════╗ ╔══════════════════╗
║ User  ║ ║  Stock Data    ║ ║ Analysis Service ║
║Service║ ║  Service       ║ ║ (Claude AI)      ║
║ :8081 ║ ║  :8082         ║ ║ :8083            ║
╚═══╦═══╝ ╚═══════╦════════╝ ╚════════╦═════════╝
    │              │                   │
    ▼              ▼                   ▼
╔═══════════╗  ╔═════════════╗  ╔═══════════════╗
║ PostgreSQL ║  ║ Alpha Vantage║  ║  Anthropic    ║
║ Redis      ║  ║ Finnhub      ║  ║  Claude API   ║
║ (shared)   ║  ║ Polygon.io   ║  ║               ║
╚═══════════╝  ╚═════════════╝  ╚═══════════════╝
```

---

## Services

### 1. nginx (Reverse Proxy)
- **Image**: `nginx:alpine`
- **Ports**: 80 (HTTP redirect), 443 (HTTPS)
- **Role**: SSL termination, route `/api/*` to api-gateway, route `/*` to web UI
- **Config**: `nginx/conf.d/axiom.conf`

### 2. Web Frontend
- **Stack**: React + Vite + TypeScript
- **Build**: Multi-stage Docker (Node build → nginx serve)
- **Port**: 80 (internal only)
- **Features**: TradingView charts, AI analysis display, mobile-responsive

### 3. API Gateway
- **Stack**: Spring Cloud Gateway
- **Port**: 8080 (internal only)
- **Role**: Single entry point for all backend APIs, JWT validation, routing

**Routing Table:**
| Path | Routes To |
|------|-----------|
| `/api/v1/auth/**` | user-service:8081 |
| `/api/v1/users/**` | user-service:8081 |
| `/api/v1/watchlists/**` | user-service:8081 |
| `/api/v1/stocks/**` | stock-data-service:8082 |
| `/api/v1/market/**` | stock-data-service:8082 |
| `/api/v1/analysis/**` | analysis-service:8083 |
| `/api/v1/signals/**` | analysis-service:8083 |

### 4. User Service
- **Stack**: Spring Boot + PostgreSQL + Redis
- **Port**: 8081 (internal only)
- **Features**: JWT auth, user registration/login, watchlists

### 5. Stock Data Service
- **Stack**: Spring Boot
- **Port**: 8082 (internal only)
- **Features**: Real-time quotes, technical indicators, price history
- **Data Sources**: Alpha Vantage, Finnhub, Polygon.io

### 6. Analysis Service
- **Stack**: Spring Boot + PostgreSQL + Anthropic Claude API
- **Port**: 8083 (internal only)
- **Features**: AI-powered stock analysis with 9-section report

### 7. PostgreSQL
- **Image**: `postgres:16-alpine`
- **Databases**: `axiom_users`, `axiom_analysis`
- **Persistence**: Docker volume `postgres_data`

### 8. Redis
- **Image**: `redis:7-alpine`
- **Role**: Session cache, JWT blacklist, rate limiting

### 9. Certbot
- **Image**: `certbot/certbot`
- **Role**: Auto-renew Let's Encrypt SSL certificates every 12 hours

---

## Data Flow — Stock Analysis Request

```
User types "AAPL" + clicks "RUN FULL ANALYSIS"
        │
        ▼
React Frontend (browser)
  POST https://stockagentify.com/api/v1/analysis
        │
        ▼ HTTPS
nginx (SSL termination)
        │
        ▼ HTTP
API Gateway :8080
  - Validates JWT token
  - Adds X-Gateway header
        │
        ▼
Analysis Service :8083
  ├── Calls Stock Data Service for AAPL quote + technicals
  ├── Calls Anthropic Claude API with market data
  │     └── Returns 9-section AI analysis
  ├── Saves to PostgreSQL
  └── Returns JSON response
        │
        ▼
API Gateway → nginx → React Frontend
        │
        ▼
Display: Executive Summary, Market Pulse, Technical Analysis,
         Support/Resistance, Fundamentals, Entry/Exit Signals,
         Bull/Bear Scorecard, Risk Factors, Trade Plan
```

---

## Docker Network

All containers share the `axiom-net` bridge network. Services communicate by container name (e.g., `http://api-gateway:8080`). Only nginx exposes ports 80/443 externally.

```
axiom-net (bridge)
├── axiom-nginx-1        (ports: 0.0.0.0:80, 0.0.0.0:443)
├── axiom-web-1          (internal: 80)
├── axiom-api-gateway-1  (internal: 8080)
├── axiom-user-service-1 (internal: 8081)
├── axiom-stock-data-service-1 (internal: 8082)
├── axiom-analysis-service-1   (internal: 8083)
├── axiom-postgres-1     (internal: 5432)
├── axiom-redis-1        (internal: 6379)
└── axiom-certbot-1      (volumes only)
```

---

## Technology Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, TradingView Widgets |
| API Gateway | Spring Cloud Gateway 3.x |
| Microservices | Spring Boot 3.x, Java 17 |
| AI Engine | Anthropic Claude (claude-sonnet) |
| Market Data | Alpha Vantage, Finnhub, Polygon.io |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Container | Docker, Docker Compose |
| Web Server | nginx:alpine |
| SSL | Let's Encrypt (Certbot, DNS-01 challenge) |
| VPS | Hostinger KVM2 (Ubuntu) |
| Domain | stockagentify.com |


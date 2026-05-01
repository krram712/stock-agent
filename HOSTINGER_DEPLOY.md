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

## Production-Safe Daily Backup + Restore

This flow backs up:
- PostgreSQL app databases (`axiom_users`, `axiom_analysis`, `axiom_stocks`)
- The `.env` file (for disaster recovery)

### 1) Create backup script

```bash
mkdir -p /opt/axiom/scripts /opt/axiom/backups

cat > /opt/axiom/scripts/backup.sh << 'EOF'
#!/usr/bin/env bash
set -euo pipefail
umask 077

APP_DIR="/opt/axiom"
BACKUP_DIR="$APP_DIR/backups"
TS="$(date +%F_%H-%M-%S)"
WORK_DIR="$BACKUP_DIR/tmp_$TS"
OUT_FILE="$BACKUP_DIR/axiom-backup-$TS.tar.gz"

mkdir -p "$WORK_DIR"
cp "$APP_DIR/.env" "$WORK_DIR/.env"

docker compose -f "$APP_DIR/docker-compose.prod.yml" --env-file "$APP_DIR/.env" exec -T postgres \
  pg_dump -U axiom -d axiom_users | gzip > "$WORK_DIR/axiom_users.sql.gz"

docker compose -f "$APP_DIR/docker-compose.prod.yml" --env-file "$APP_DIR/.env" exec -T postgres \
  pg_dump -U axiom -d axiom_analysis | gzip > "$WORK_DIR/axiom_analysis.sql.gz"

docker compose -f "$APP_DIR/docker-compose.prod.yml" --env-file "$APP_DIR/.env" exec -T postgres \
  pg_dump -U axiom -d axiom_stocks | gzip > "$WORK_DIR/axiom_stocks.sql.gz"

cat > "$WORK_DIR/backup-info.txt" << META
timestamp=$TS
host=$(hostname)
repo=$(cd "$APP_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")
META

tar -C "$WORK_DIR" -czf "$OUT_FILE" .
rm -rf "$WORK_DIR"

# Retain last 14 days
find "$BACKUP_DIR" -maxdepth 1 -type f -name "axiom-backup-*.tar.gz" -mtime +14 -delete

echo "Backup complete: $OUT_FILE"
EOF

chmod +x /opt/axiom/scripts/backup.sh
```

### 2) Create restore script

```bash
cat > /opt/axiom/scripts/restore.sh << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 /opt/axiom/backups/axiom-backup-YYYY-MM-DD_HH-MM-SS.tar.gz"
  exit 1
fi

APP_DIR="/opt/axiom"
ARCHIVE="$1"
RESTORE_DIR="$APP_DIR/backups/restore_$(date +%F_%H-%M-%S)"

mkdir -p "$RESTORE_DIR"
tar -C "$RESTORE_DIR" -xzf "$ARCHIVE"

cp "$RESTORE_DIR/.env" "$APP_DIR/.env"

gunzip -c "$RESTORE_DIR/axiom_users.sql.gz" | \
  docker compose -f "$APP_DIR/docker-compose.prod.yml" --env-file "$APP_DIR/.env" exec -T postgres psql -U axiom -d axiom_users

gunzip -c "$RESTORE_DIR/axiom_analysis.sql.gz" | \
  docker compose -f "$APP_DIR/docker-compose.prod.yml" --env-file "$APP_DIR/.env" exec -T postgres psql -U axiom -d axiom_analysis

gunzip -c "$RESTORE_DIR/axiom_stocks.sql.gz" | \
  docker compose -f "$APP_DIR/docker-compose.prod.yml" --env-file "$APP_DIR/.env" exec -T postgres psql -U axiom -d axiom_stocks

docker compose -f "$APP_DIR/docker-compose.prod.yml" --env-file "$APP_DIR/.env" up -d

echo "Restore complete. Unpacked files: $RESTORE_DIR"
EOF

chmod +x /opt/axiom/scripts/restore.sh
```

### 3) Schedule daily backup (cron)

```bash
( crontab -l 2>/dev/null; echo "15 2 * * * /opt/axiom/scripts/backup.sh >> /opt/axiom/backups/backup.log 2>&1" ) | crontab -
crontab -l
```

### 4) Validate backup now

```bash
/opt/axiom/scripts/backup.sh
ls -lh /opt/axiom/backups | tail -n 5
tail -n 50 /opt/axiom/backups/backup.log 2>/dev/null || true
```

### 5) Restore when needed

```bash
/opt/axiom/scripts/restore.sh /opt/axiom/backups/axiom-backup-YYYY-MM-DD_HH-MM-SS.tar.gz
```

### Security notes
- Backups include `.env`; treat backup files as secrets.
- Keep permissions restricted (`root` only) on `/opt/axiom/backups`.
- For stronger resilience, copy backups offsite (S3/B2/another VPS).

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


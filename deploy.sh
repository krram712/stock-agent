#!/bin/bash
# ============================================================
# Axiom Stock Agent — Hostinger VPS Deploy Script
# Run once on a fresh Ubuntu 22.04 VPS
# Usage: bash deploy.sh yourdomain.com
# ============================================================
set -e

DOMAIN=${1:-"yourdomain.com"}
APP_DIR="/opt/axiom"
REPO="https://github.com/krram712/stock-agent.git"

# Detect if domain is actually an IP address
IS_IP=false
if [[ $DOMAIN =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  IS_IP=true
  echo "  ℹ️  IP address detected — SSL will be skipped."
fi

echo ""
echo "  ██████╗  █████╗ ██╗  ██╗██╗ ██████╗ ███╗   ███╗"
echo "  ██╔══██╗██╔══██╗╚██╗██╔╝██║██╔═══██╗████╗ ████║"
echo "  ███████║╚█████╔╝ ╚███╔╝ ██║██║   ██║██╔████╔██║"
echo "  ██╔══██║██╔══██╗ ██╔██╗ ██║██║   ██║██║╚██╔╝██║"
echo "  ██║  ██║╚█████╔╝██╔╝ ██╗██║╚██████╔╝██║ ╚═╝ ██║"
echo "  ╚═╝  ╚═╝ ╚════╝ ╚═╝  ╚═╝╚═╝ ╚═════╝ ╚═╝     ╚═╝"
echo ""
echo "  Deploying to: $DOMAIN"
echo ""

# ── 1. Install dependencies ────────────────────────────────────
echo "[1/7] Installing Docker & Docker Compose..."
apt-get update -qq
apt-get install -y -qq docker.io docker-compose-v2 git curl ufw

systemctl enable docker
systemctl start docker

# ── 2. Firewall ────────────────────────────────────────────────
echo "[2/7] Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ── 3. Clone repo ──────────────────────────────────────────────
echo "[3/7] Cloning repository..."
mkdir -p $APP_DIR
if [ -d "$APP_DIR/.git" ]; then
  cd $APP_DIR && git pull origin main
else
  git clone $REPO $APP_DIR
fi
cd $APP_DIR

# ── 4. Create .env ─────────────────────────────────────────────
echo "[4/7] Setting up environment..."
if [ ! -f "$APP_DIR/.env" ]; then
  cp .env.example .env
  # Generate strong secrets automatically
  JWT_SECRET=$(openssl rand -hex 32)
  PG_PASS=$(openssl rand -hex 16)
  REDIS_PASS=$(openssl rand -hex 16)
  sed -i "s/change_me_strong_password/$PG_PASS/" .env
  sed -i "s/change_me_redis_password/$REDIS_PASS/" .env
  sed -i "s/change_me_256_bit_secret_at_least_32_chars_long/$JWT_SECRET/" .env
  echo ""
  echo "  ⚠️  .env created with auto-generated secrets."
  echo "  Edit /opt/axiom/.env to set your API keys:"
  echo "    ANTHROPIC_API_KEY, ALPHA_VANTAGE_API_KEY, FINNHUB_API_KEY"
  echo ""
fi

# ── 5. Create init-db script ───────────────────────────────────
echo "[5/7] Creating DB init script..."
mkdir -p scripts
cat > scripts/init-db.sh << 'EOF'
#!/bin/bash
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
  CREATE DATABASE axiom_users;
  CREATE DATABASE axiom_analysis;
  CREATE DATABASE axiom_stocks;
EOSQL
EOF
chmod +x scripts/init-db.sh

# ── 6. Configure Nginx domain ──────────────────────────────────
echo "[6/7] Configuring Nginx for $DOMAIN..."
if [ "$IS_IP" = true ]; then
  cp nginx/conf.d/axiom-ip.conf nginx/conf.d/default.conf
else
  sed -i "s/YOUR_DOMAIN.com/$DOMAIN/g" nginx/conf.d/axiom.conf
  sed -i "s/YOUR_DOMAIN.com/$DOMAIN/g" nginx/conf.d/axiom-init.conf
  cp nginx/conf.d/axiom-init.conf nginx/conf.d/default.conf
fi

# ── 7. Start services ──────────────────────────────────────────
echo "[7/7] Starting all services..."
docker compose -f docker-compose.prod.yml --env-file .env up -d --build

echo ""
echo "  Waiting 60s for services to start..."
sleep 60

# ── 8. Issue SSL certificate ───────────────────────────────────
if [ "$IS_IP" = false ]; then
  echo "[8/8] Issuing SSL certificate for $DOMAIN..."
  EMAIL=$(cat .env | grep ADMIN_EMAIL | cut -d= -f2 || echo "admin@$DOMAIN")
  docker compose -f docker-compose.prod.yml run --rm certbot \
    certonly --webroot --webroot-path=/var/www/certbot \
    --email "$EMAIL" --agree-tos --no-eff-email \
    -d "$DOMAIN" -d "www.$DOMAIN" || echo "  ⚠️  SSL failed — ensure DNS points to this server IP first"

  # Switch to full HTTPS config
  cp nginx/conf.d/axiom.conf nginx/conf.d/default.conf
  docker compose -f docker-compose.prod.yml restart nginx
else
  echo "[8/8] Skipping SSL (IP address mode — HTTP only)"
fi

# ── Done ───────────────────────────────────────────────────────
echo ""
echo "  ════════════════════════════════════════════════"
echo "  ✅  Axiom deployed!"
if [ "$IS_IP" = true ]; then
  echo "  🌐  API:  http://$DOMAIN"
  echo "  ⚠️   HTTP only (no SSL on raw IP)"
else
  echo "  🌐  API:  https://$DOMAIN"
  echo "  🔒  SSL:  Let's Encrypt (auto-renews)"
fi
echo "  📋  Logs: docker compose -f docker-compose.prod.yml logs -f"
echo "  ════════════════════════════════════════════════"
echo ""
if [ "$IS_IP" = true ]; then
  echo "  Next: Set VITE_API_URL=http://$DOMAIN in Vercel"
else
  echo "  Next: Set VITE_API_URL=https://$DOMAIN in Vercel"
fi
echo ""


# AXIOM — Troubleshooting Guide

Complete record of all issues encountered during deployment and their solutions.

---

## Issue 1 — nginx: Cannot Load Certificate `YOUR_DOMAIN.com`

**Error:**
```
nginx: [emerg] cannot load certificate "/etc/letsencrypt/live/YOUR_DOMAIN.com/fullchain.pem"
```

**Cause:** Placeholder domain name not replaced in nginx config.

**Fix:**
```bash
sed -i 's/YOUR_DOMAIN.com/stockagentify.com/g' /opt/axiom/nginx/conf.d/axiom.conf
docker compose -f docker-compose.prod.yml restart nginx
```

---

## Issue 2 — nginx: host not found in upstream `api-gateway`

**Error:**
```
nginx: [emerg] host not found in upstream "api-gateway"
```

**Cause:** `axiom-init.conf` had `proxy_pass http://api-gateway:8080` but api-gateway wasn't started yet, and nginx loads all conf.d/*.conf files.

**Fix:** Changed nginx.conf to only load `axiom.conf` (not `*.conf`):
```nginx
# nginx/nginx.conf
include /etc/nginx/conf.d/axiom.conf;  # NOT *.conf
```

---

## Issue 3 — Certbot 404 HTTP Challenge Failure

**Error:**
```
Challenge failed for domain stockagentify.com
http-01 challenge: 404 Not Found
```

**Cause:** Hostinger VPS has **k3s** (Kubernetes) pre-installed with **Traefik** as ingress controller. Traefik intercepts all port 80 traffic via iptables DNAT rules before nginx can see it.

**Diagnosis:**
```bash
iptables -t nat -L PREROUTING -n
# Shows: DNAT tcp -- anywhere anywhere tcp dpt:80 to:10.43.0.1:80
# This is Traefik intercepting all port 80 traffic
```

**Fix:** Switch to DNS-01 challenge (doesn't need port 80):
```bash
certbot certonly \
  --manual \
  --preferred-challenges dns \
  -d stockagentify.com \
  -d www.stockagentify.com
```
Then add TXT records to DNS as prompted.

---

## Issue 4 — k3s/Traefik Permanently Intercepting Ports

**Cause:** k3s starts automatically on boot and re-installs its iptables rules.

**Fix:** Disable k3s completely (we don't need Kubernetes — we use Docker Compose):
```bash
sudo systemctl stop k3s
sudo systemctl disable k3s
# Reboot to clear all iptables rules
sudo reboot
```

---

## Issue 5 — nginx: `open() axiom.conf failed (2: No such file or directory)`

**Error:**
```
nginx: [emerg] open() "/etc/nginx/conf.d/axiom.conf" failed (2: No such file or directory)
```

**Cause:** The file `nginx/conf.d/axiom.conf` was missing from the server (moved to backup folder, or git stash removed it).

**Diagnosis:**
```bash
ls -la /opt/axiom/nginx/conf.d/
# axiom.conf was missing
```

**Fix:**
```bash
cd /opt/axiom
git stash        # save local changes
git pull origin main   # restore file from git
docker compose -f docker-compose.prod.yml up -d --force-recreate nginx
```

---

## Issue 6 — api-gateway: `failed to convert String to PredicateDefinition`

**Error:**
```
java.lang.IllegalStateException: Cannot convert value of type 'java.lang.String'
to required type 'PredicateDefinition'
```

**Cause:** YAML predicates written as bare strings instead of using `Path=` prefix:
```yaml
# WRONG
predicates:
  - "/api/v1/watchlists/**"

# CORRECT
predicates:
  - Path=/api/v1/watchlists/**
```

**Fix:** Updated `backend/api-gateway/src/main/resources/application-prod.yml` to use proper format.

---

## Issue 7 — api-gateway: `NameValueConfig value must not be empty`

**Error:**
```
java.lang.IllegalArgumentException: NameValueConfig [name='X-Gateway', value=''] value must not be empty
```

**Cause:** Space after comma in inline YAML filter definition:
```yaml
# WRONG — space after comma creates empty value
filters:
  - AddRequestHeader=X-Gateway, axiom

# CORRECT — no space
filters:
  - AddRequestHeader=X-Gateway,axiom
```

---

## Issue 8 — Inter-Container Communication Broken

**Symptom:** After running `sudo iptables -F`, containers couldn't reach each other. `curl http://api-gateway:8080` from nginx container returned "No route to host".

**Cause:** `iptables -F` (flush all rules) wiped Docker's networking rules (DOCKER-USER chain, FORWARD rules, NAT masquerade rules).

**Fix:**
```bash
sudo systemctl restart docker
# Docker re-creates all its iptables rules on restart
```

Also restart DNS resolver if curl shows "Could not resolve host":
```bash
sudo systemctl restart systemd-resolved
```

---

## Issue 9 — api-gateway Routes: Multiple Path Predicates ANDed (Not ORed)

**Symptom:** `curl https://stockagentify.com/api/v1/stocks/AAPL/quote` returned 404.

**Cause:** Spring Cloud Gateway ANDs multiple predicates in the same route. Having two `Path=` predicates means BOTH must match — impossible for a single URL.

```yaml
# WRONG — ANDs the two paths (impossible to match both simultaneously)
- id: stock-data-service
  predicates:
    - Path=/api/v1/stocks/**
    - Path=/api/v1/market/**

# CORRECT — separate routes for each path
- id: stock-data-service
  predicates:
    - Path=/api/v1/stocks/**

- id: market-data-service
  predicates:
    - Path=/api/v1/market/**
```

**Fix:** Split every multi-path route into separate single-path routes.

---

## Issue 10 — nginx http2 Deprecation Warning

**Warning:**
```
nginx: [warn] the "listen ... http2" directive is deprecated
```

**Cause:** nginx 1.25+ changed the http2 directive syntax.

**Fix:**
```nginx
# OLD (deprecated)
listen 443 ssl http2;

# NEW (correct)
listen 443 ssl;
http2 on;
```

---

## Issue 11 — git pull Blocked by Local Changes

**Error:**
```
error: Your local changes to the following files would be overwritten by merge:
    nginx/nginx.conf
Please commit your changes or stash them before you merge.
```

**Cause:** Files were manually edited on the server and differ from git.

**Fix:**
```bash
# Option 1: Discard specific file change and pull
git checkout nginx/nginx.conf
git pull origin main

# Option 2: Stash all changes, pull, then discard stash
git stash
git pull origin main
# (don't pop the stash — the pulled version is correct)

# Option 3: Force reset to remote (CAUTION: loses all local changes)
git fetch origin
git reset --hard origin/main
```

---

## Issue 12 — Windows Disk Full (git add fails)

**Error:**
```
error: unable to create temporary file: No space left on device
error: unable to index file 'web/src/components/AnalysisDashboard.tsx'
```

**Cause:** Windows C: drive was full (247GB used, 7.8GB free — but git temp dir ran out).

**Workaround:** Apply fix directly on VPS using Python:
```bash
# Edit file directly on server
python3 /tmp/fix.py
docker compose -f docker-compose.prod.yml build web
docker compose -f docker-compose.prod.yml up -d web
```

Then later commit from Windows after freeing space:
```bash
git gc --prune=now
git add file.tsx
git commit -m "message"
git push origin main
```

---

## Health Check Commands

```bash
# Check all container status
docker compose -f docker-compose.prod.yml ps

# Check nginx is serving HTTPS
curl -k https://stockagentify.com/

# Check API gateway is routing
curl -k https://stockagentify.com/api/v1/stocks/AAPL/quote

# Check specific service health directly
docker exec axiom-api-gateway-1 wget -qO- http://localhost:8080/actuator/health
docker exec axiom-user-service-1 wget -qO- http://localhost:8081/actuator/health
docker exec axiom-stock-data-service-1 wget -qO- http://localhost:8082/actuator/health
docker exec axiom-analysis-service-1 wget -qO- http://localhost:8083/actuator/health

# Check SSL certificate validity
openssl s_client -connect stockagentify.com:443 -servername stockagentify.com < /dev/null 2>/dev/null | grep -E "subject|issuer|notAfter"

# Check logs for errors
docker compose -f docker-compose.prod.yml logs --tail=20 nginx
docker compose -f docker-compose.prod.yml logs --tail=20 api-gateway
```


#!/usr/bin/env pwsh
# ============================================================
# AXIOM Stock Agent - Clean Build and Start (Local)
# Prerequisites: Java 17+, Maven 3.9+, Node 18+
# ============================================================

$ROOT     = $PSScriptRoot
$BACKEND  = "$ROOT\backend"
$WEB      = "$ROOT\web"
$TARGETS  = @("user-service","stock-data-service","analysis-service","api-gateway")
$PORTS    = @(8080,8081,8082,8083,3000)

Write-Host ""
Write-Host "  AXIOM AI Stock Analysis Platform" -ForegroundColor Cyan
Write-Host "  Clean Build and Start" -ForegroundColor Green
Write-Host ""

# ── STEP 0: Kill old jobs and free ports ─────────────────────
Write-Host "[0/6] Stopping existing processes..." -ForegroundColor Yellow
Get-Job | Stop-Job  -ErrorAction SilentlyContinue
Get-Job | Remove-Job -ErrorAction SilentlyContinue

foreach ($port in $PORTS) {
    $procs = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
             Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $procs) {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Write-Host "  Freed port $port (PID $pid)" -ForegroundColor DarkGray
    }
}
Start-Sleep -Seconds 2
Write-Host "  OK - Ports cleared" -ForegroundColor Green

# ── STEP 1: Check prerequisites ──────────────────────────────
Write-Host ""
Write-Host "[1/6] Checking prerequisites..." -ForegroundColor Yellow

$javaOk = $false
$mvnOk  = $false
$nodeOk = $false

try {
    $jv = java -version 2>&1 | Select-String "version" | Select-Object -First 1
    Write-Host "  OK - Java  : $jv" -ForegroundColor Green
    $javaOk = $true
} catch {
    Write-Host "  FAIL - Java not found. Install JDK 17+ and add to PATH" -ForegroundColor Red
}

# Use mvnw wrapper if mvn not in PATH
$mvnCmd = "mvn"
if (-not (Get-Command mvn -ErrorAction SilentlyContinue)) {
    if (Test-Path "$BACKEND\mvnw.cmd") {
        $mvnCmd = "$BACKEND\mvnw.cmd"
    } elseif (Test-Path "$ROOT\mvnw.cmd") {
        $mvnCmd = "$ROOT\mvnw.cmd"
    }
}
try {
    $mv = & $mvnCmd -version 2>&1 | Select-String "Apache Maven" | Select-Object -First 1
    Write-Host "  OK - Maven : $mv" -ForegroundColor Green
    $mvnOk = $true
} catch {
    Write-Host "  FAIL - Maven not found. Install Maven 3.9+ or add mvnw.cmd to backend/" -ForegroundColor Red
}

try {
    $nv = node --version 2>&1
    Write-Host "  OK - Node  : $nv" -ForegroundColor Green
    $nodeOk = $true
} catch {
    Write-Host "  FAIL - Node.js not found. Install Node 18+" -ForegroundColor Red
}

if (-not ($javaOk -and $mvnOk -and $nodeOk)) {
    Write-Host ""
    Write-Host "  Missing prerequisites. Fix the above and re-run." -ForegroundColor Red
    exit 1
}

# ── STEP 2: Clean build backend JARs ─────────────────────────
Write-Host ""
Write-Host "[2/6] Clean-building backend services (tests skipped)..." -ForegroundColor Yellow
Write-Host ""

foreach ($svc in $TARGETS) {
    $svcPath = "$BACKEND\$svc"
    if (-not (Test-Path $svcPath)) {
        Write-Host "  SKIP - $svc directory not found" -ForegroundColor DarkGray
        continue
    }
    Write-Host "  Building $svc ..." -ForegroundColor White -NoNewline
    $output = & $mvnCmd -f "$svcPath\pom.xml" clean package -DskipTests -q 2>&1
    if ($LASTEXITCODE -eq 0) {
        $jar = Get-ChildItem "$svcPath\target\*.jar" |
               Where-Object { $_.Name -notlike "*.original" } |
               Sort-Object LastWriteTime -Descending |
               Select-Object -First 1
        Write-Host " OK ($($jar.Name))" -ForegroundColor Green
    } else {
        Write-Host " FAILED" -ForegroundColor Red
        Write-Host ($output | Out-String) -ForegroundColor DarkRed
        Write-Host ""
        Write-Host "  Build failed for $svc. Fix errors and re-run." -ForegroundColor Red
        exit 1
    }
}

# ── STEP 3: Web npm install ───────────────────────────────────
Write-Host ""
Write-Host "[3/6] Installing web dependencies (npm install)..." -ForegroundColor Yellow
Push-Location $WEB
$npmOut = npm install 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  OK - npm install complete" -ForegroundColor Green
} else {
    Write-Host "  FAIL - npm install failed" -ForegroundColor Red
    Write-Host ($npmOut | Out-String)
    Pop-Location
    exit 1
}
Pop-Location

# ── STEP 4: Start backend services ───────────────────────────
Write-Host ""
Write-Host "[4/6] Starting backend services..." -ForegroundColor Yellow

function Get-Jar {
    param($svc)
    Get-ChildItem "$BACKEND\$svc\target\*.jar" |
    Where-Object { $_.Name -notlike "*.original" } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}

$userJar     = Get-Jar "user-service"
$stockJar    = Get-Jar "stock-data-service"
$analysisJar = Get-Jar "analysis-service"
$gatewayJar  = Get-Jar "api-gateway"

Write-Host "  Starting User Service       :8081" -ForegroundColor White
Start-Job -Name "user-svc" -ScriptBlock {
    java -jar $using:userJar 2>&1
} | Out-Null
Start-Sleep -Seconds 5

Write-Host "  Starting Stock Data Service :8082" -ForegroundColor White
Start-Job -Name "stock-svc" -ScriptBlock {
    java -jar $using:stockJar 2>&1
} | Out-Null

Write-Host "  Starting Analysis Service   :8083" -ForegroundColor White
Start-Job -Name "analysis-svc" -ScriptBlock {
    java -jar $using:analysisJar 2>&1
} | Out-Null

Write-Host "  Starting API Gateway        :8080" -ForegroundColor White
Start-Job -Name "gateway" -ScriptBlock {
    java -jar $using:gatewayJar 2>&1
} | Out-Null

# ── STEP 5: Start web frontend ────────────────────────────────
Write-Host ""
Write-Host "[5/6] Starting Web Frontend (Vite :3000)..." -ForegroundColor Yellow
Start-Job -Name "web" -ScriptBlock {
    Set-Location $using:WEB
    npm run dev -- --port 3000 2>&1
} | Out-Null

# ── STEP 6: Health checks ─────────────────────────────────────
Write-Host ""
Write-Host "[6/6] Waiting for services (up to 90 seconds)..." -ForegroundColor Yellow
Write-Host ""

$services = @(
    [pscustomobject]@{ Name="User Service     "; Port=8081; Path="/actuator/health" },
    [pscustomobject]@{ Name="Stock Data Svc   "; Port=8082; Path="/actuator/health" },
    [pscustomobject]@{ Name="Analysis Service "; Port=8083; Path="/actuator/health" },
    [pscustomobject]@{ Name="API Gateway      "; Port=8080; Path="/actuator/health" },
    [pscustomobject]@{ Name="Web Frontend     "; Port=3000; Path="/" }
)

$maxWait = 90
$interval = 5
$elapsed = 0
$status = @{}
foreach ($s in $services) { $status[$s.Port] = $false }

while ($elapsed -lt $maxWait) {
    $remaining = $services | Where-Object { -not $status[$_.Port] }
    if ($remaining.Count -eq 0) { break }
    foreach ($svc in $remaining) {
        try {
            $r = Invoke-WebRequest "http://localhost:$($svc.Port)$($svc.Path)" `
                 -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
            if ($r.StatusCode -lt 500) {
                $status[$svc.Port] = $true
                Write-Host "  UP  - $($svc.Name) :$($svc.Port)" -ForegroundColor Green
            }
        } catch {}
    }
    if (($status.Values | Where-Object { $_ -eq $false }).Count -gt 0) {
        Start-Sleep -Seconds $interval
        $elapsed += $interval
        Write-Host "  Waiting... ${elapsed}s" -ForegroundColor DarkGray
    }
}

# Final status
Write-Host ""
Write-Host "  ======================================================" -ForegroundColor Cyan
foreach ($svc in $services) {
    if ($status[$svc.Port]) {
        Write-Host "  OK   $($svc.Name) http://localhost:$($svc.Port)" -ForegroundColor Green
    } else {
        Write-Host "  FAIL $($svc.Name) http://localhost:$($svc.Port) (not responding)" -ForegroundColor Red
    }
}
Write-Host "  ======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Open browser: http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "  Admin login : raghu / bigsky3016" -ForegroundColor Magenta
Write-Host "  Demo login  : demo@axiom.ai / Demo1234!" -ForegroundColor Gray
Write-Host ""
Write-Host "  View logs:" -ForegroundColor Gray
Write-Host "    Receive-Job -Name user-svc     -Keep" -ForegroundColor DarkGray
Write-Host "    Receive-Job -Name stock-svc    -Keep" -ForegroundColor DarkGray
Write-Host "    Receive-Job -Name analysis-svc -Keep" -ForegroundColor DarkGray
Write-Host "    Receive-Job -Name gateway      -Keep" -ForegroundColor DarkGray
Write-Host "    Receive-Job -Name web          -Keep" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Press Ctrl+C to stop all services" -ForegroundColor Gray
Write-Host ""

try {
    while ($true) { Start-Sleep -Seconds 10 }
} finally {
    Write-Host ""
    Write-Host "Stopping all services..." -ForegroundColor Yellow
    Get-Job | Stop-Job  -ErrorAction SilentlyContinue
    Get-Job | Remove-Job -ErrorAction SilentlyContinue
    Write-Host "Done." -ForegroundColor Green
}

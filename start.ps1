#!/usr/bin/env pwsh
# ============================================================
# AXIOM Stock Agent — Start All Services
# ============================================================

$ROOT = $PSScriptRoot
$BACKEND = "$ROOT\backend"
$WEB = "$ROOT\web"

Write-Host ""
Write-Host "  ██████  ██   ██ ██  ██████  ███    ███ " -ForegroundColor Cyan
Write-Host "  ██   ██  ██ ██  ██ ██    ██ ████  ████ " -ForegroundColor Cyan
Write-Host "  ███████   ███   ██ ██    ██ ██ ████ ██ " -ForegroundColor Cyan
Write-Host "  ██   ██  ██ ██  ██ ██    ██ ██  ██  ██ " -ForegroundColor Cyan
Write-Host "  ██   ██ ██   ██ ██  ██████  ██      ██ " -ForegroundColor Cyan
Write-Host ""
Write-Host "  AI Stock Analysis Platform" -ForegroundColor Green
Write-Host ""

# Kill any existing jobs
Get-Job | Stop-Job -ErrorAction SilentlyContinue
Get-Job | Remove-Job -ErrorAction SilentlyContinue

# Kill processes on required ports
@(8080, 8081, 8082, 8083) | ForEach-Object {
    $p = Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue |
         Select-Object -First 1 -ExpandProperty OwningProcess
    if ($p) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }
}

Write-Host "[1/5] Starting User Service      (port 8081)..." -ForegroundColor Yellow
Start-Job -Name "user-svc" -ScriptBlock {
    java -jar "$using:BACKEND\user-service\target\user-service-1.0.0.jar"
} | Out-Null

Write-Host "[2/5] Starting Stock Data Service (port 8082)..." -ForegroundColor Yellow
Start-Job -Name "stock-svc" -ScriptBlock {
    java -jar "$using:BACKEND\stock-data-service\target\stock-data-service-1.0.0.jar"
} | Out-Null

Write-Host "[3/5] Starting Analysis Service   (port 8083)..." -ForegroundColor Yellow
Start-Job -Name "analysis-svc" -ScriptBlock {
    java -jar "$using:BACKEND\analysis-service\target\analysis-service-1.0.0.jar"
} | Out-Null

Write-Host "[4/5] Starting API Gateway        (port 8080)..." -ForegroundColor Yellow
Start-Job -Name "gateway" -ScriptBlock {
    java -jar "$using:BACKEND\api-gateway\target\api-gateway-1.0.0.jar"
} | Out-Null

Write-Host "[5/5] Starting Web Frontend       (port 3000)..." -ForegroundColor Yellow
Start-Job -Name "web" -ScriptBlock {
    Set-Location "$using:WEB"
    npm run dev
} | Out-Null

Write-Host ""
Write-Host "  Waiting for services to start (30s)..." -ForegroundColor Gray
Start-Sleep -Seconds 30

Write-Host ""
Write-Host "  Service Health Check:" -ForegroundColor Cyan
@(
    @{ Name="User Service     "; Port=8081 },
    @{ Name="Stock Data Svc   "; Port=8082 },
    @{ Name="Analysis Service "; Port=8083 },
    @{ Name="API Gateway      "; Port=8080 },
    @{ Name="Web Frontend     "; Port=3000 }
) | ForEach-Object {
    $svc = $_
    try {
        $resp = Invoke-WebRequest "http://localhost:$($svc.Port)/actuator/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        Write-Host "  ✅ $($svc.Name) :$($svc.Port) UP" -ForegroundColor Green
    } catch {
        # For web (no actuator), try root
        try {
            Invoke-WebRequest "http://localhost:$($svc.Port)" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop | Out-Null
            Write-Host "  ✅ $($svc.Name) :$($svc.Port) UP" -ForegroundColor Green
        } catch {
            Write-Host "  ❌ $($svc.Name) :$($svc.Port) NOT READY" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "  ═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🌐 Web Dashboard  → http://localhost:3000   " -ForegroundColor Green
Write-Host "  🔌 API Gateway    → http://localhost:8080   " -ForegroundColor Green
Write-Host "  ═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Press Ctrl+C to stop all services" -ForegroundColor Gray
Write-Host ""

try {
    while ($true) { Start-Sleep -Seconds 10 }
} finally {
    Write-Host "Stopping all services..." -ForegroundColor Yellow
    Get-Job | Stop-Job -ErrorAction SilentlyContinue
    Get-Job | Remove-Job -ErrorAction SilentlyContinue
    Write-Host "Done." -ForegroundColor Green
}


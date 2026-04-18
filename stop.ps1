#!/usr/bin/env pwsh
# Stop all Axiom services
Write-Host "Stopping Axiom services..." -ForegroundColor Yellow
Get-Job | Stop-Job -ErrorAction SilentlyContinue
Get-Job | Remove-Job -ErrorAction SilentlyContinue
@(8080, 8081, 8082, 8083, 3000) | ForEach-Object {
    $p = Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue |
         Select-Object -First 1 -ExpandProperty OwningProcess
    if ($p) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue; Write-Host "  Stopped port $_" }
}
Write-Host "All services stopped." -ForegroundColor Green


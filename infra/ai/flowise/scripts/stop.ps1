# stop.ps1 — Stop Flowise container
# Usage: .\scripts\stop.ps1
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$composeDir = Split-Path -Parent $scriptDir

Write-Host "[INFO] Stopping Flowise ..." -ForegroundColor Cyan
Push-Location $composeDir
try {
    docker compose stop
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] docker compose stop failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Flowise stopped" -ForegroundColor Green
} finally {
    Pop-Location
}

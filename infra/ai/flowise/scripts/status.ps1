# status.ps1 — Check Flowise container and service status
# Usage: .\scripts\status.ps1
$ErrorActionPreference = "Continue"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$composeDir = Split-Path -Parent $scriptDir

Write-Host "=== Flowise Container Status ===" -ForegroundColor Cyan

# Container status
$container = docker ps -a --filter "name=yuzan-flowise" --format "{{.Status}}" 2>$null
if ($container) {
    Write-Host "Container: $container" -ForegroundColor $(if ($container -match "Up") { "Green" } else { "Yellow" })
} else {
    Write-Host "Container: NOT FOUND" -ForegroundColor Red
}

# Health endpoint
Write-Host ""
Write-Host "=== Flowise Health Check ===" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:4300/api/v1/ping" -UseBasicParsing -TimeoutSec 5
    Write-Host "API Ping: OK (HTTP $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "API Ping: UNREACHABLE" -ForegroundColor Red
}

# Docker compose ps
Write-Host ""
Write-Host "=== Docker Compose Status ===" -ForegroundColor Cyan
Push-Location $composeDir
try {
    docker compose ps 2>$null
} finally {
    Pop-Location
}

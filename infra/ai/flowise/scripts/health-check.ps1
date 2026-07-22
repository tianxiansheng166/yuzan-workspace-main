# health-check.ps1 — Verify Flowise and AI provider connectivity
# Usage: .\scripts\health-check.ps1
#
# Checks:
#   1. Flowise container running and healthy
#   2. Flowise API ping response
#   3. AI provider configuration status (via apps/api internal endpoint)
#
$ErrorActionPreference = "Continue"

$flowiseUrl = "http://127.0.0.1:4300"
$apiUrl = "http://127.0.0.1:4000"

# ── Flowise Container ──
Write-Host "=== Flowise Container ===" -ForegroundColor Cyan
$containerStatus = docker inspect yuzan-flowise --format "{{.State.Status}}" 2>$null
if ($containerStatus -eq "running") {
    $health = docker inspect yuzan-flowise --format "{{.State.Health.Status}}" 2>$null
    Write-Host "Container: running (health: $health)" -ForegroundColor $(if ($health -eq "healthy") { "Green" } else { "Yellow" })
} elseif ($containerStatus) {
    Write-Host "Container: $containerStatus" -ForegroundColor Yellow
} else {
    Write-Host "Container: NOT FOUND" -ForegroundColor Red
}

# ── Flowise API ──
Write-Host ""
Write-Host "=== Flowise API ===" -ForegroundColor Cyan
try {
    $resp = Invoke-WebRequest -Uri "$flowiseUrl/api/v1/ping" -UseBasicParsing -TimeoutSec 5
    Write-Host "Ping: OK (HTTP $($resp.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "Ping: UNREACHABLE - $_" -ForegroundColor Red
}

# ── AI Provider (via apps/api) ──
Write-Host ""
Write-Host "=== AI Provider Status (via apps/api) ===" -ForegroundColor Cyan
try {
    $token = $null
    $tokenKey = "yuzan-access-token"
    # Try to read from localStorage file if available
    # Otherwise, just check the endpoint without auth
    $resp = Invoke-WebRequest -Uri "$apiUrl/api/v1/schools/00000000-0000-0000-0000-000000000000/ai/workflows/lesson-planner/status" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($resp) {
        Write-Host "AI Status endpoint: reachable" -ForegroundColor Green
    } else {
        Write-Host "AI Status endpoint: not yet available (expected before commit 3)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "AI Status endpoint: not yet available (expected before commit 3)" -ForegroundColor Yellow
}

# ── AI Provider env check ──
Write-Host ""
Write-Host "=== AI Provider Configuration ===" -ForegroundColor Cyan
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$composeDir = Split-Path -Parent $scriptDir
# rootDir = repository root (3 levels up from infra/ai/flowise/)
$rootDir = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $composeDir))
$providerEnv = Join-Path $rootDir "runtime-local\secrets\ai-provider.env"

if (Test-Path $providerEnv) {
    $envContent = Get-Content $providerEnv -ErrorAction SilentlyContinue
    $baseUrl = ($envContent | Where-Object { $_ -match "^AI_BASE_URL=(.+)$" }) -replace "^AI_BASE_URL=", ""
    $apiKey = ($envContent | Where-Object { $_ -match "^AI_API_KEY=(.+)$" }) -replace "^AI_API_KEY=", ""
    $model = ($envContent | Where-Object { $_ -match "^AI_MODEL=(.+)$" }) -replace "^AI_MODEL=", ""

    if ($baseUrl -and $apiKey -and $model) {
        Write-Host "Provider: CONFIGURED (model: $model)" -ForegroundColor Green
    } else {
        Write-Host "Provider: NOT_CONFIGURED (missing fields in ai-provider.env)" -ForegroundColor Yellow
    }
} else {
    Write-Host "Provider: NOT_CONFIGURED (ai-provider.env not found)" -ForegroundColor Yellow
    Write-Host "  Copy runtime-local\secrets\ai-provider.env.example to ai-provider.env" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Flowise: $(if ($containerStatus -eq 'running') { 'RUNNING' } else { 'STOPPED' })" -ForegroundColor $(if ($containerStatus -eq 'running') { 'Green' } else { 'Red' })

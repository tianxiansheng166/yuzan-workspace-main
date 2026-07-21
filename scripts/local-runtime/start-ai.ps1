# start-ai.ps1 — Unified local startup for AI lesson planning pipeline
# Usage: .\scripts\local-runtime\start-ai.ps1 [-SkipFlowise] [-SkipApi] [-SkipWorker]
#
# Starts the following services in order:
#   1. Flowise (Docker) — unless -SkipFlowise
#   2. API server        — unless -SkipApi
#   3. Worker            — always
#
# Prerequisites:
#   - Docker running
#   - PostgreSQL container running on port 55432
#   - .env files configured (flowise/.env, runtime-local/secrets/ai-provider.env)
param(
    [switch]$SkipFlowise,
    [switch]$SkipApi,
    [switch]$SkipWorker
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent (Split-Path -Parent $scriptDir)
$flowiseDir = Join-Path $rootDir "infra\ai\flowise"

Write-Host "=== Yuzan AI Lesson Planning — Local Startup ===" -ForegroundColor Cyan
Write-Host ""

# ── Check PostgreSQL ──
Write-Host "[INFO] Checking PostgreSQL ..." -ForegroundColor Cyan
$pgRunning = docker ps --filter "name=yuzan-four-port-postgres-55432" --format "{{.Status}}" 2>$null
if ($pgRunning -match "Up") {
    Write-Host "[OK] PostgreSQL is running" -ForegroundColor Green
} else {
    Write-Host "[ERROR] PostgreSQL container not running. Start it first." -ForegroundColor Red
    Write-Host "  docker start yuzan-four-port-postgres-55432" -ForegroundColor Yellow
    exit 1
}

# ── Step 1: Flowise ──
if (-not $SkipFlowise) {
    Write-Host ""
    Write-Host "[INFO] Starting Flowise ..." -ForegroundColor Cyan
    $startScript = Join-Path $flowiseDir "scripts\start.ps1"
    if (Test-Path $startScript) {
        & $startScript
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[WARN] Flowise start failed. Continuing without Flowise." -ForegroundColor Yellow
        }
    } else {
        Write-Host "[WARN] Flowise start script not found at $startScript" -ForegroundColor Yellow
    }
} else {
    Write-Host "[INFO] Skipping Flowise (-SkipFlowise)" -ForegroundColor Yellow
}

# ── Step 2: API Server ──
if (-not $SkipApi) {
    Write-Host ""
    Write-Host "[INFO] Starting API server ..." -ForegroundColor Cyan
    
    # Generate Prisma client and run migrations if needed
    Push-Location $rootDir
    try {
        Write-Host "[INFO] Generating Prisma client ..." -ForegroundColor Cyan
        pnpm --filter @yuzan/database generate 2>&1 | ForEach-Object { Write-Host "  $_" }
        
        Write-Host "[INFO] Running database migrations ..." -ForegroundColor Cyan
        pnpm --filter @yuzan/database migrate:deploy 2>&1 | ForEach-Object { Write-Host "  $_" }
        
        Write-Host "[INFO] Starting API server in background ..." -ForegroundColor Cyan
        Start-Process -FilePath "pnpm" -ArgumentList "--filter", "@yuzan/api", "dev" -NoNewWindow -PassThru | Out-Null
        
        # Wait for API to be ready
        $maxApiAttempts = 30
        for ($i = 1; $i -le $maxApiAttempts; $i++) {
            try {
                $null = Invoke-WebRequest -Uri "http://127.0.0.1:4000/api/v1/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
                Write-Host "[OK] API server is ready (attempt $i)" -ForegroundColor Green
                break
            } catch {
                if ($i -eq $maxApiAttempts) {
                    Write-Host "[WARN] API server not ready after $maxApiAttempts attempts" -ForegroundColor Yellow
                } else {
                    Start-Sleep -Seconds 2
                }
            }
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Host "[INFO] Skipping API server (-SkipApi)" -ForegroundColor Yellow
}

# ── Step 3: Worker ──
if (-not $SkipWorker) {
    Write-Host ""
    Write-Host "[INFO] Starting Worker ..." -ForegroundColor Cyan
    Push-Location $rootDir
    try {
        $workerEnv = @{}
        if ($env:AI_PROVIDER_STUB -eq "true") {
            Write-Host "[INFO] AI Provider Stub is ENABLED (scenario: $($env:AI_STUB_SCENARIO ?? 'valid-output'))" -ForegroundColor Yellow
        }
        
        # Start worker in foreground
        pnpm --filter @yuzan/worker dev
    } finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "=== Startup Complete ===" -ForegroundColor Green
